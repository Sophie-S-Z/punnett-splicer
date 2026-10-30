## Milestone

Week 7 feedback implementation and the separate prompt-chain tool.

## What changed

Admin navigation uses plain content and prompt-chain terms. Icons identify categories. Mobile navigation collapses behind an explicit button, and the desktop sidebar scrolls independently. The overview shows four daily metrics and three workflow links. The full caption constellation is preserved at `/atlas`.

The pipeline studio at `/chains` now manages editable multi-step prompt chains. `/mix` updates weights actually consumed by optional weighted runs. `/pipeline-runs` shows saved step outputs, exact prompts, timing, errors, and source images. The same editor is supplied in the new `punnett-splicer` repository/app with dark, light, and system themes. Its role requirement is superadmin only, as the latest assignment specifies.

The supplied `toosoon` step form informed the separate system/user prompts, model, temperature, input/output types, and order. Historical single-call snapshots remain under Recorded prompts. Their old planning weights do not masquerade as runnable chains.

Examples now preview valid source images, validate file existence, and expose missing legacy sources as repairable states. Textarea labels remain stable for existing values. Branded SVG, ICO, and Apple icons are served publicly. Existing caption/profile feedback fixes remain in Selection.

Installed explicit starter chains and meaningful review data in Supabase: two labeled chains, four steps, four term definitions, and eight examples copied from real saved captions with source provenance. The existing missing-source example is preserved for the owner to repair. No simulated model outputs, fictional accounts, or granted roles were inserted.

Dependency lockfiles were validated with clean-install dry runs. Missing optional peer entries were repaired without changing application behavior. The framework security patch is Next.js 16.4.3.

## How I verified it

- Observatory: lint, strict application/test TypeScript, 25 regression/database tests, and production build.
- Prompt tool: lint, strict TypeScript, eight provider/database tests, production build, and an actual-component editor UI fixture.
- Pagination was tested with 1,203 PostgreSQL fixture rows, including first, middle, last, and oversized pages.
- The production-built examples fixture passed create, image decoding, edit/reload, delete, cancel/focus, missing-source repair, and accessibility/layout checks at 320/768/1440px.
- The prompt UI fixture passed chain/step CRUD, reorder/reload, mix-weight persistence, keyboard command navigation, and responsive accessibility checks. Only fixture transport/actions were replaced. Product authentication was not bypassed.
- Prompt-tool visitor browser checks passed access denial, icons, exact-origin callback initiation, theme persistence, and accessibility at 320/390/768/1440px.
- Selection's current deployed browser suite passed 18 tests; four signed-in tests were skipped because they require an available real account session.
- Live studio RPC checks passed CRUD, atomic order, conflicts, saved checkpoints, history after source deletion, and member denial in a rolled-back diagnostic. This is not a browser OAuth/JWT or provider acceptance test.

## VERIFY findings (schema, API)

The existing `w7_chains` and `w7_steps` are historical prompt/model snapshots. New private `studio_*` tables and six guarded RPCs implement editable execution without altering historical records. All anonymous RPC grants are revoked. Every RPC calls the existing verified Google-session superadmin guard. No RLS policy SQL or service-role key is used.

Gemini's fixed REST generation endpoint, system instructions, image parts, text output, and structured-caption format were checked against primary documentation. Each actual step output is validated and saved before the next model call. Snapshots preserve the exact prompts/settings used at run start. No automatic provider retry occurs. The runner enforces ten starts per person per rolling day and up to eight steps.

## HUMAN tasks needed

The new Vercel `punnett-splicer` project needs its owner-configured Supabase URL/anon key and server-only Gemini key. Its deployment protection currently defaults to enabled and must be disabled by the owner under AGENTS.md R4. Keep the existing projects' protection off. Register each final origin's exact `/auth/callback` in Supabase, including the new stable domain.

After configuration, test a real Google superadmin login and a complete generation in the new tool, inspect its saved run, and verify ordinary-user denial. Retest examples in the deployed admin app. The isolated UI tests do not substitute for these real-account checks. Select the intended replacement photo for the one legacy example; its deleted source cannot be reconstructed.

## Open questions

Deployment-specific URLs/statuses and the remaining owner checks are tracked in `release-status.md`. The semester project's saved blind-review proposal remains separate and was not overwritten. Finite tests do not establish that every possible defect is absent.
