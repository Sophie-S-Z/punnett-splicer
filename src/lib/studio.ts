export type Step = {
  id: string;
  position: number;
  name: string;
  system_prompt: string;
  user_prompt: string;
  input_kind: "image" | "previous";
  output_kind: "text" | "captions";
  model_id: string;
  model: string;
  provider: string;
  temperature: number;
};
export type Chain = {
  id: string;
  name: string;
  description: string;
  example: boolean;
  weight: number;
  revision: number;
  created_at: string;
  updated_at: string;
  step_count?: number;
  steps: Step[];
};
export type Run = {
  id: string;
  chain_id: string | null;
  image_id: string;
  status: "pending" | "completed" | "failed";
  error: string | null;
  created_at: string;
  completed_at: string | null;
  snapshot: Chain;
  outputs: {
    position: number;
    output: string | string[];
    duration_ms: number;
  }[];
};
export type Option = { id: string; label: string };
export const UUID =
  /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
export function validateChain(chain: Chain): string | null {
  if (!chain.steps.length) return "Add a step before running.";
  if (chain.steps[0].input_kind !== "image")
    return "The first step must take the source image.";
  if (chain.steps.slice(1).some((s) => s.input_kind !== "previous"))
    return "Steps after the first must take the previous output.";
  if (chain.steps.at(-1)?.output_kind !== "captions")
    return "The final step must return captions.";
  if (
    chain.steps.some(
      (s) =>
        s.provider !== "Google Gemini" || !/^gemini-[a-z0-9.-]+$/.test(s.model),
    )
  )
    return "Choose a configured Gemini model for every step.";
  return null;
}
export function weightedChoice<T extends { weight: number }>(
  rows: T[],
  random = Math.random(),
): T | null {
  const enabled = rows.filter(
      (r) => Number.isFinite(Number(r.weight)) && Number(r.weight) > 0,
    ),
    total = enabled.reduce((s, r) => s + Number(r.weight), 0);
  if (!total) return null;
  let remaining = Math.min(Math.max(random, 0), 1 - Number.EPSILON) * total;
  for (const row of enabled) {
    remaining -= Number(row.weight);
    if (remaining < 0) return row;
  }
  return enabled.at(-1)!;
}
export function studioInput(
  operation: string,
  form: FormData,
): { payload: Record<string, string | number>; error?: string } {
  const payload: Record<string, string | number> = {};
  const fields = operation.startsWith("chain.")
    ? { name: 150, description: 2000 }
    : {
        name: 100,
        system_prompt: 12000,
        user_prompt: 12000,
        input_kind: 20,
        output_kind: 20,
        model_id: 36,
        step_id: 36,
      };
  if (
    ![
      "chain.create",
      "chain.update",
      "chain.delete",
      "step.create",
      "step.update",
      "step.delete",
      "step.move",
    ].includes(operation)
  )
    return { payload, error: "Unknown action." };
  for (const [key, max] of Object.entries(fields)) {
    const raw = form.get(key);
    if (raw !== null && typeof raw !== "string")
      return { payload, error: "Enter text in the form fields." };
    const value = String(raw ?? "").trim();
    if (value.length > max || value.includes("\0"))
      return { payload, error: `Check ${key.replaceAll("_", " ")}.` };
    payload[key] = value;
  }
  if (!operation.endsWith("delete") && operation !== "step.move") {
    if (!payload.name) return { payload, error: "Enter a name." };
    if (
      operation.startsWith("step.") &&
      (!payload.user_prompt ||
        !UUID.test(String(payload.model_id)) ||
        !["image", "previous"].includes(String(payload.input_kind)) ||
        !["text", "captions"].includes(String(payload.output_kind)))
    )
      return {
        payload,
        error: "Complete the prompt, model, input, and output fields.",
      };
  }
  if (
    operation.startsWith("step.") &&
    operation !== "step.create" &&
    !UUID.test(String(payload.step_id))
  )
    return { payload, error: "Step no longer exists. Reload the page." };
  const numeric =
    operation === "chain.update"
      ? ["weight", 0, 10000]
      : operation === "step.move"
        ? ["position", 1, 8]
        : operation === "step.create" || operation === "step.update"
          ? ["temperature", 0, 2]
          : null;
  if (numeric) {
    const [key, min, max] = numeric as [string, number, number],
      value = Number(form.get(key));
    if (
      form.get(key) === null ||
      !Number.isFinite(value) ||
      value < min ||
      value > max ||
      (key === "position" && !Number.isInteger(value))
    )
      return { payload, error: `Check ${key}.` };
    payload[key] = value;
  }
  return { payload };
}
