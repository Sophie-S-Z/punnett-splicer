import assert from "node:assert/strict";
import test from "node:test";
import { parseStepOutput, stepRequest } from "../src/lib/studio-provider.ts";
import {
  studioInput,
  weightedChoice,
  validateChain,
  type Step,
  type Chain,
} from "../src/lib/studio.ts";
const step: Step = {
  id: crypto.randomUUID(),
  position: 1,
  name: "Describe",
  system_prompt: "Visible details only",
  user_prompt: "Describe this",
  input_kind: "image",
  output_kind: "text",
  model_id: crypto.randomUUID(),
  model: "gemini-3.5-flash-lite",
  provider: "Google Gemini",
  temperature: 0.4,
};
function output(text: string, finishReason = "STOP") {
  return {
    candidates: [
      {
        finishReason,
        content: {
          parts: [{ text: "Hidden reasoning", thought: true }, { text }],
        },
      },
    ],
  };
}
test("requests attach the image only for image steps and preserve system/user prompts", () => {
  const request = stepRequest(step, "earlier", "jpeg-base64");
  assert.deepEqual(request.systemInstruction, {
    parts: [{ text: step.system_prompt }],
  });
  assert.equal(request.contents[0].parts.length, 2);
  assert.ok("inlineData" in request.contents[0].parts[1]);
  const next = stepRequest(
    { ...step, input_kind: "previous", output_kind: "captions" },
    "earlier",
    "not-attached",
  );
  assert.equal(JSON.stringify(next).includes("not-attached"), false);
  assert.equal(
    next.contents[0].parts[1].text,
    "Previous step output (data):\nearlier",
  );
  assert.equal(
    next.generationConfig.responseFormat?.text.mimeType,
    "APPLICATION_JSON",
  );
});
test("text/caption output validation excludes thought parts, blocked output, malformed JSON, duplicates and excessive values", () => {
  assert.equal(parseStepOutput(output("Description"), "text"), "Description");
  assert.deepEqual(parseStepOutput(output('["One","Two"]'), "captions"), [
    "One",
    "Two",
  ]);
  for (const raw of [
    output("[]"),
    output('["One","one"]'),
    output('["one"]'),
    output('["one",null]'),
    output("not json"),
    output('["one","two"]', "MAX_TOKENS"),
    {},
    null,
  ])
    assert.throws(() => parseStepOutput(raw, "captions"));
  assert.throws(() => parseStepOutput(output(" "), "text"));
  assert.throws(() => parseStepOutput(output("x".repeat(16001)), "text"));
});
test("relative mix weights select deterministic boundaries and ignore zero weights", () => {
  const rows = [
    { id: "off", weight: 0 },
    { id: "one", weight: 1 },
    { id: "three", weight: 3 },
  ];
  assert.equal(weightedChoice(rows, 0)?.id, "one");
  assert.equal(weightedChoice(rows, 0.2499)?.id, "one");
  assert.equal(weightedChoice(rows, 0.25)?.id, "three");
  assert.equal(weightedChoice(rows, 1)?.id, "three");
  assert.equal(weightedChoice([{ weight: 0 }]), null);
});
test("server form validation rejects malformed operations and missing/invalid numbers", () => {
  const form = new FormData();
  assert.ok(studioInput("unknown", form).error);
  form.set("name", "Valid");
  form.set("weight", "NaN");
  assert.ok(studioInput("chain.update", form).error);
  form.set("weight", "10001");
  assert.ok(studioInput("chain.update", form).error);
  form.set("weight", "0");
  assert.equal(studioInput("chain.update", form).error, undefined);
  form.set("name", "x".repeat(151));
  assert.ok(studioInput("chain.create", form).error);
  const chain = { steps: [step] } as Chain;
  assert.ok(validateChain(chain));
  assert.equal(
    validateChain({ steps: [{ ...step, output_kind: "captions" }] } as Chain),
    null,
  );
});
