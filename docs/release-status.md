# Feedback release status

Implementation and local verification are complete. See `task-report.md` for scope, evidence, and limits. The live database migration and review seeds are installed.

All three apps passed lint, strict TypeScript, unit/database tests (25 Observatory, 35 Selection, eight Prompt Studio), and production builds. The repaired lockfiles pass clean-install validation. The examples and editor UI fixtures passed. Prompt Studio's public browser tests passed. Selection's deployed visitor suite passed 18 tests, with four real-account tests explicitly skipped.

Deployment-specific URLs, status, and final public smoke results are recorded in the workspace `week7-release-status.md` and the final handoff. Git-tracked code reports do not embed a moving “latest commit” URL.

The new `punnett-splicer` Vercel project still requires owner environment configuration and disabled deployment protection. Its generation flow is not accepted until an actual Google superadmin completes a deployed run and inspects its outputs. Keep the other two projects' protection off, and add the final exact callback origins in Supabase. No secrets or browser credentials need to be shared with the agent.

