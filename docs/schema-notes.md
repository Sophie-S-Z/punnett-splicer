# Verified prompt studio contract

Date: 2026-10-29. Project: `ralfwrckxnaieamlttmm` (`punnett-staging`).

Inspected live `punnett_private.w7_*` columns and existing admin RPCs before extending them. Historical W7 chains are exact single-request prompt/model snapshots. They remain immutable historical records. The supplied `toosoon` archive at commit `486e62454e826b82603835f646c63fcd992f083c`, specifically `src/app/humor-flavor-step/[humorFlavorStepId]/step-details-form.tsx`, separates step order, input/output types, model, temperature, system prompt, and user prompt. That structure informed this tool without importing its unrelated production database.

The installed `prompt_studio_chains_and_runs` migration adds:

| Private table | Purpose |
| --- | --- |
| `studio_chains` | Editable name, description, example label, relative mix weight, revision |
| `studio_steps` | Ordered step settings and prompts, referencing the existing model catalog |
| `studio_runs` | Source image, originating chain, owner, request ID, immutable snapshot, status and safe error |
| `studio_outputs` | Sequential validated outputs and durations |

The `(chain_id, position)` unique constraint is deferrable. One locked transaction reorders and renumbers steps. Every edit compares the chain revision, including edits to its steps. Deleting a chain cascades its editable steps and sets the run's chain reference to null; its snapshot and outputs remain.

Six public studio RPCs expose only verified superadmin operations: `page`, `chain`, `mutate`, `begin`, `checkpoint`, and `fail` (all prefixed `punnett_studio_`). Anonymous execution is revoked. Direct private table grants remain revoked. The existing Google-session verifier and `punnett_require_admin` are unchanged. No policy SQL is present.

`punnett_studio_page` returns ordered set rows for PostgREST `count: exact` and `range`. The UI reads pages and all reference/mix pages in chunks of 200. No silent 1,000-row cap is used.

The runner accepts only the existing Google Gemini provider and model identifiers matching `gemini-*`. It uses the fixed Google endpoint, a server environment key, `systemInstruction`, image `inlineData`, and previous text output as a separate part. The final caption step uses the verified REST `responseFormat.text.mimeType = APPLICATION_JSON` contract. No arbitrary URL/provider endpoint is accepted.

Primary references rechecked: [GenerateContent REST](https://ai.google.dev/api/generate-content), [Gemini 3.5 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite). The model supports image input and text output. The app validates STOP completion, excludes thought parts, and rejects malformed/repeated captions. One step times out at 30 seconds; up to eight steps fit the configured 300-second function limit. No automatic provider retry is performed. Ten starts per user per rolling 24 hours are enforced in the database.

Live rollback-only diagnostics passed CRUD, order, conflict handling, checkpoint persistence, history retention, and member denial. They do not test browser OAuth/JWT validation or make provider calls. Isolated database tests also cover 1,203 paginated rows and malformed outputs. Initial staging seeds are two explicitly labeled chains and four editable steps, with no simulated run output.
