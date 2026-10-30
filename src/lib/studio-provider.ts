import type { Step } from "./studio.ts";
export function stepRequest(step: Step, previous: string, jpegBase64: string) {
  return {
    ...(step.system_prompt
      ? { systemInstruction: { parts: [{ text: step.system_prompt }] } }
      : {}),
    contents: [
      {
        role: "user",
        parts: [
          { text: step.user_prompt },
          ...(step.input_kind === "image"
            ? [{ inlineData: { mimeType: "image/jpeg", data: jpegBase64 } }]
            : [{ text: `Previous step output (data):\n${previous}` }]),
        ],
      },
    ],
    generationConfig: {
      temperature: Number(step.temperature),
      maxOutputTokens: 4096,
      ...(step.output_kind === "captions"
        ? {
            responseFormat: {
              text: {
                mimeType: "APPLICATION_JSON",
                schema: {
                  type: "array",
                  minItems: 2,
                  maxItems: 6,
                  items: { type: "string", minLength: 1, maxLength: 500 },
                },
              },
            },
          }
        : {}),
    },
  };
}
export function parseStepOutput(
  raw: unknown,
  kind: "text" | "captions",
): string | string[] {
  const body = raw as {
    candidates?: {
      finishReason?: string;
      content?: { parts?: { text?: string; thought?: boolean }[] };
    }[];
  };
  const candidate = body?.candidates?.[0];
  if (candidate?.finishReason !== "STOP") throw new Error("incomplete_output");
  const text = candidate.content?.parts
    ?.filter((p) => p.thought !== true)
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!text || text.length > 16000) throw new Error("invalid_output");
  if (kind === "text") return text;
  const parsed: unknown = JSON.parse(text);
  if (
    !Array.isArray(parsed) ||
    parsed.length < 2 ||
    parsed.length > 6 ||
    !parsed.every(
      (p) =>
        typeof p === "string" && p.trim().length > 0 && p.trim().length <= 500,
    )
  )
    throw new Error("invalid_captions");
  const captions = parsed.map((s: string) => s.trim());
  if (new Set(captions.map((s) => s.toLowerCase())).size !== captions.length)
    throw new Error("duplicate_captions");
  return captions;
}
