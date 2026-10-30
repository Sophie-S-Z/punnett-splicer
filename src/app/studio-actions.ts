"use server";
import { revalidatePath } from "next/cache";
import { adminAccess } from "@/lib/admin";
import { UUID, studioInput, weightedChoice, type Chain } from "@/lib/studio";
import { parseStepOutput, stepRequest } from "@/lib/studio-provider";
type Result = { ok: boolean; message: string; id?: string };
export async function editStudio(
  operation: string,
  form: FormData,
): Promise<Result> {
  const access = await adminAccess();
  if (access.state !== "admin")
    return {
      ok: false,
      message: "Google superadmin access required. Sign in again.",
    };
  const { payload, error } = studioInput(operation, form);
  if (error) return { ok: false, message: error };
  const id = String(form.get("chain_id") ?? ""),
    revision = Number(form.get("revision"));
  if (
    operation !== "chain.create" &&
    (!UUID.test(id) || !Number.isSafeInteger(revision) || revision < 1)
  )
    return { ok: false, message: "Reload this chain before saving." };
  const result = await access.client.rpc("punnett_studio_mutate", {
    operation_input: operation,
    chain_input: operation === "chain.create" ? null : id,
    revision_input: operation === "chain.create" ? null : revision,
    payload_input: payload,
  });
  if (result.error)
    return {
      ok: false,
      message:
        result.error.code === "40001"
          ? "This chain changed in another tab. Reload before saving."
          : result.error.code === "23505"
            ? "A chain with that name already exists."
            : result.error.code === "23514"
              ? "Check the fields. A chain supports at most eight steps."
              : "The change could not be saved. Reload and try again.",
    };
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: operation.endsWith("delete") ? "Deleted." : "Saved.",
    id: result.data,
  };
}
export async function runStudio(form: FormData): Promise<Result> {
  const access = await adminAccess();
  if (access.state !== "admin")
    return {
      ok: false,
      message: "Google superadmin access required. Sign in again.",
    };
  if (!process.env.GEMINI_API_KEY)
    return {
      ok: false,
      message:
        "Generation needs the Gemini API key in this app’s server settings. Contact the app owner.",
    };
  let chain = String(form.get("chain_id") ?? ""),
    id: string | undefined,
    position = 0,
    providerStatus: number | undefined;
  const image = String(form.get("image_id") ?? ""),
    request = String(form.get("request_id") ?? "");
  if (!UUID.test(image) || !UUID.test(request))
    return { ok: false, message: "Choose an image and try again." };
  if (form.get("use_mix") === "true") {
    const rows: Chain[] = [];
    for (let offset = 0; ; offset += 200) {
      const result = await access.client
        .rpc(
          "punnett_studio_page",
          { kind_input: "chains" },
          { count: "exact" },
        )
        .range(offset, offset + 199);
      if (result.error || result.count === null)
        return { ok: false, message: "The mix could not be read." };
      rows.push(...result.data.map((r: { record: Chain }) => r.record));
      if (rows.length >= result.count) break;
    }
    const chosen = weightedChoice(rows);
    if (!chosen)
      return {
        ok: false,
        message:
          "Set at least one prompt-chain weight above zero before using the mix.",
      };
    chain = chosen.id;
  }
  if (!UUID.test(chain))
    return { ok: false, message: "Choose a prompt chain." };
  const start = await access.client.rpc("punnett_studio_begin", {
    chain_input: chain,
    image_input: image,
    request_input: request,
  });
  if (start.error)
    return {
      ok: false,
      message: start.error.message.includes("daily_limit")
        ? "You can start 10 runs in 24 hours. Try again later."
        : start.error.message.includes("run_in_progress")
          ? "A run is already in progress. Check its results before starting another."
          : start.error.code === "23505"
            ? "This request was already submitted. Check the run history."
            : start.error.code === "23514"
              ? start.error.message
              : "The run could not be started. Reload and try again.",
    };
  const started = Date.now();
  try {
    id = start.data.id;
    const snapshot = start.data.snapshot as Chain;
    const path = await access.client.rpc("punnett_admin_image_path", {
      id_input: image,
    });
    if (path.error || typeof path.data !== "string")
      throw new Error("image_unavailable");
    const source = await access.client.storage
      .from("caption-images")
      .download(path.data);
    if (source.error || !source.data || source.data.size > 2 * 1024 * 1024)
      throw new Error("image_unavailable");
    const base64 = Buffer.from(await source.data.arrayBuffer()).toString(
      "base64",
    );
    let previous = "";
    for (const step of snapshot.steps) {
      position = step.position;
      const stepStarted = Date.now();
      if (
        !/^gemini-[a-z0-9.-]+$/.test(step.model) ||
        step.provider !== "Google Gemini"
      )
        throw new Error("model_unavailable");
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(step.model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": process.env.GEMINI_API_KEY,
          },
          body: JSON.stringify(stepRequest(step, previous, base64)),
          signal: AbortSignal.timeout(30000),
          cache: "no-store",
        },
      );
      providerStatus = response.status;
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? "quota"
            : response.status === 401 || response.status === 403
              ? "configuration"
              : "provider",
        );
      const output = parseStepOutput(await response.json(), step.output_kind);
      const saved = await access.client.rpc("punnett_studio_checkpoint", {
        run_input: id,
        position_input: step.position,
        output_input: output,
        duration_input: Date.now() - stepStarted,
      });
      if (saved.error) throw new Error("persistence");
      previous = typeof output === "string" ? output : JSON.stringify(output);
    }
    revalidatePath("/", "layout");
    return {
      ok: true,
      id,
      message: `${snapshot.name} completed. Open the run to view every step and its captions.`,
    };
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : "unknown";
    const message =
      reason === "quota"
        ? "Gemini is rate limited. Try again later."
        : reason === "configuration"
          ? "Gemini rejected this app’s configuration. Ask the owner to check its key and model access."
          : reason === "image_unavailable"
            ? "The source image could not be read. Choose another image."
            : reason === "persistence"
              ? "The output could not be saved. Check the recorded run before trying again."
              : cause instanceof Error &&
                  (cause.name === "TimeoutError" || cause.name === "AbortError")
                ? "Gemini timed out. The run stopped; earlier step outputs remain available."
                : "The provider returned an error, blocked output, or an incomplete result. Earlier step outputs remain available.";
    console.error(
      "[punnett:studio-run-failed]",
      JSON.stringify({
        runId: id,
        step: position,
        providerStatus,
        durationMs: Date.now() - started,
        reason: [
          "quota",
          "configuration",
          "persistence",
          "image_unavailable",
          "model_unavailable",
        ].includes(reason)
          ? reason
          : "provider_or_output",
      }),
    );
    if (id)
      try {
        await access.client.rpc("punnett_studio_fail", {
          run_input: id,
          error_input: message,
        });
      } catch {
        /* Leave an interrupted run visible if persistence is unavailable. */
      }
    revalidatePath("/", "layout");
    return { ok: false, id, message };
  }
}
