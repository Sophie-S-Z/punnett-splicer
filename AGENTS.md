# AGENTS.md: Punnett build spec

Project: The Humor Project, Columbia University, Fall 2026.
Suite name: **Punnett**. Three Next.js apps that share one design system and one Supabase staging database.
Spec version: 1.0 (2026-09-22). Writing standard: ASD-STE100 style. One instruction per sentence.

---

## 0. How to use this file

1. Put a copy of this file at the root of each of the three repos. Name it `AGENTS.md`.
2. Sections 1 to 4 apply to all three repos.
3. Section 5 applies to `punnett-selection`. Section 6 applies to `punnett-observatory`. Section 7 applies to `punnett-splicer`.
4. Work on one milestone at a time. Do not start the next milestone until the current acceptance criteria pass.
5. The tag **VERIFY** marks an assumption. Inspect the real schema, API, or docs before you write code for that item. Do not guess.
6. The tag **HUMAN** marks a task that only the human owner can do. Stop and ask the human to do it. Do not work around it.
7. At the end of each task, write a report in the format in section 9.2.

---

## 1. Hard rules

A break of a rule marked **FAIL** gives an automatic failing grade. Never break these rules.

| # | Rule | Severity |
|---|------|----------|
| R1 | Do not create, change, enable, or disable any Supabase RLS policy. Do not write SQL that touches policies. | FAIL |
| R2 | Every route in Observatory and Splicer requires Google login and a role check. Check on the server. A client-only check is not sufficient. | FAIL |
| R3 | Each app must stay publicly reachable at its Vercel URL. | FAIL |
| R4 | Vercel deployment protection must stay off. (**HUMAN** sets this in Vercel.) Remind the human at each deploy. | FAIL |
| R5 | Do not hardcode or simulate data that must come from Supabase or the caption API. | Major |
| R6 | Store the Supabase URL and anon key in environment variables. Never commit `.env`, `.env.local`, or any secret. Commit `.env.example` only. | Major |
| R7 | The OAuth redirect route is exactly `/auth/callback`. Do not add other callback routes. Do not add query parameters to the redirect URI. | Major |
| R8 | Do not use a Google client secret. Follow the course auth video (**HUMAN** can share details). | Major |
| R9 | Do not use the Supabase service role key anywhere. | Major |
| R10 | `npm run build`, `npm run lint`, and `npx tsc --noEmit` must pass before each push to `main`. | Major |
| R11 | Use only free, open-source libraries. Do not use paid tiers (for example, Magic UI Pro). | Major |
| R12 | Respect `prefers-reduced-motion`. Every animation needs a reduced or static fallback. | Minor |

---

## 2. Product summary

Punnett is a comedy genetics lab. The metaphor maps course data to lab terms. Use these terms in UI copy and in component names.

| Course term | Punnett term | Notes |
|---|---|---|
| Humor flavor | Genome | A named, ordered chain of steps. |
| Humor flavor step | Gene | Order matters. Reorder = re-sequence. |
| Caption | Specimen | Each caption shows a specimen code (section 4.4). |
| Vote | Selection | A duel win gives an upvote. A duel loss gives a downvote. |
| Duplicate flavor | Clone | Name encodes lineage (section 7.4). |
| Edited step vs. parent | Mutation | Shown as badges in the Splicer. |
| Win rate of a flavor | Fitness | Section 6.5 gives the formula. |

| Repo | App name | Course project | Role |
|---|---|---|---|
| `punnett-selection` | Punnett Selection | Project 1 (Weeks 1 to 5) | Public caption duel and upload app |
| `punnett-observatory` | Punnett Observatory | Project 2 (Weeks 6, 7, 12) | Superadmin panel with 3D caption galaxy |
| `punnett-splicer` | Punnett Splicer | Project 3 (Weeks 8, 10, 12) | Prompt chain editor for genomes |

---

## 3. Shared stack and setup

### 3.1 Stack

| Area | Choice |
|---|---|
| Framework | Next.js, latest stable, App Router, TypeScript with `strict: true` |
| Styling | Tailwind CSS v4. Design tokens as CSS variables (section 4.1). |
| Auth and data | `@supabase/ssr` and `@supabase/supabase-js` |
| Base components | shadcn/ui (on Radix). Restyle with Punnett tokens. |
| Effects | React Bits (install with the shadcn CLI, TS plus Tailwind variant). Free components from Magic UI and Aceternity UI only. |
| Motion | `motion` (formerly Framer Motion) |
| Toasts | Sonner |
| Command palette | cmdk (Observatory and Splicer) |
| Icons | `@tabler/icons-react` |
| Fonts | `next/font/google`: IBM Plex Sans (body), JetBrains Mono (codes, data), Caveat (notebook ink notes) |
| Theme switch | `next-themes` (Splicer only) |
| Deploy | Vercel, one project per repo |

Pin exact versions in `package.json` after install. Do not use `latest` in `package.json`.

### 3.2 Environment variables

`.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_CAPTION_API_BASE=https://api.almostcrackd.ai
```

**HUMAN** adds the same variables in each Vercel project.

### 3.3 Folder layout

```text
src/
  app/                    routes (App Router)
  app/auth/callback/      OAuth callback route (exact path)
  components/ui/          shadcn/ui parts
  components/lab/         Punnett parts (section 4.3)
  lib/supabase/client.ts  browser client
  lib/supabase/server.ts  server client
  lib/supabase/middleware.ts  session refresh helper
  lib/punnett/            specimen codes, lineage, fitness, pairing
  styles/tokens.css       design tokens
middleware.ts             session refresh and route guard
```

### 3.4 Commands

```bash
npm run dev
npm run build
npm run lint
npx tsc --noEmit
```

### 3.5 Known Supabase tables

The course gives these table names. **VERIFY** exact column names in the Supabase table editor before you use a table.

`profiles` (has `is_superadmin`, `is_matrix_admin`), `images`, `captions`, `caption_votes`, `caption_requests`, `caption_examples`, `humor_flavors`, `humor_flavor_steps`, `humor_mix`, `terms`, `llm_models`, `llm_providers`, `llm_prompt_chains`, `llm_responses`, `allowed_signup_domains`, and a whitelisted e-mail table (**VERIFY** name).

### 3.6 Caption API

Base URL: `https://api.almostcrackd.ai`. The endpoints and payloads are in the course "Documentation" section. **VERIFY**: ask the human to paste the docs into `docs/caption-api.md`. Do not guess endpoints, headers, or payloads.

### 3.7 Empty results

If a Supabase query returns an empty array and no error, RLS can be the cause. Stop. Report the table and the query to the human. Do not change policies (R1).

---

## 4. Design system

### 4.1 Tokens

Night mode is the only mode in Selection and Observatory. Splicer has night (default), "lights on", and system.

`src/styles/tokens.css`:

```css
:root,
[data-theme="night"] {
  --bg: #070D12;
  --surface: #0E1719;
  --surface-active: #0C2420;
  --border: #1E3A36;
  --glow: #5DCAA5;          /* primary, bioluminescent teal */
  --glow-soft: #9FE1CB;
  --glow-deep: #1D9E75;
  --text: #D8F3EA;
  --text-muted: #6F9C90;
  --ink: #FAC775;           /* notebook ink notes */
  --mutant: #AFA9EC;        /* secondary accent, clones and mutations */
  --mutant-deep: #534AB7;
  --danger: #F09595;
  --glow-shadow: 0 0 0 1px rgba(93,202,165,.35), 0 0 24px rgba(93,202,165,.18);
  --radius: 10px;
}

/* Splicer only */
[data-theme="lights-on"] {
  --bg: #F7F8F5;
  --surface: #FFFFFF;
  --surface-active: #E6EEE9;
  --border: #C9D3CD;
  --glow: #1D9E75;
  --glow-soft: #0F6E56;
  --glow-deep: #085041;
  --text: #1E2A24;
  --text-muted: #5B6B63;
  --ink: #8A3B24;
  --mutant: #534AB7;
  --mutant-deep: #3C3489;
  --danger: #A32D2D;
  --glow-shadow: 0 0 0 1px rgba(29,158,117,.35);
  --radius: 10px;
}
```

Map these variables into Tailwind v4 with an `@theme inline` block. Use the tokens in all components. Do not hardcode hex values in components.

### 4.2 Type

| Use | Font | Example |
|---|---|---|
| Body and UI | IBM Plex Sans 400 and 500 | Buttons, captions |
| Codes, data, headers in caps | JetBrains Mono 400 and 500 | `SPC-B · TTAG-0977`, `SELECTION CHAMBER 03` |
| Notebook ink notes | Caveat 400 and 500 | "drag a gene to re-sequence the chain" |

Use Caveat only for short annotations (under 10 words). Never use Caveat in tables or forms.

### 4.3 Shared lab components

Build these in `components/lab/`. Copy them to each repo (no shared package is needed).

| Component | Purpose |
|---|---|
| `LabHeader` | App name, mono section label, user menu. |
| `PetriDish` | Circular image frame with a thin glow ring. Props: `src`, `size`, `state` (`idle`, `culturing`, `hatched`). |
| `SpecimenCard` | Caption card with specimen code, text, selected state (glow border). |
| `InkNote` | Caveat text in `--ink` with an optional dashed leader line. |
| `GlassPane` | Overlay that locks content for logged-out users (section 5.3). |
| `GeneNode` | Step node for the Splicer canvas (section 7.2). |
| `LabLoader` | Stage-based loader with lab copy ("Culturing…", "Sequencing…"). |
| `ClearanceRequired` | Access-denied screen for users without the required role. |

### 4.4 Specimen codes

Every caption shows a stable code. Put this in `lib/punnett/specimenCode.ts`:

```ts
export function specimenCode(id: string | number): string {
  let h = 2166136261;
  for (const ch of String(id)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  h >>>= 0;
  const bases = "ACGT";
  let letters = "";
  for (let i = 0; i < 4; i++) letters += bases[(h >>> (i * 2)) & 3];
  const digits = String((h >>> 8) % 10000).padStart(4, "0");
  return `${letters}-${digits}`;
}
```

### 4.5 Motion

1. Use `motion` for enter, exit, and selection transitions. Keep most transitions between 150 ms and 400 ms.
2. Use React Bits backgrounds at low intensity behind content. Content contrast must stay at WCAG AA.
3. Under `prefers-reduced-motion: reduce`, replace motion with opacity fades or no motion.

### 4.6 Copy voice

Use a dry lab voice. Keep labels short and in sentence case.

| Action | Label |
|---|---|
| Vote for a caption | Select specimen |
| Skip a duel | Skip pair |
| Sign in | Put on lab gloves |
| Sign out | Remove gloves |
| Upload image | Place sample in dish |
| Loading | Culturing… / Sequencing… / Hatching… |
| Empty list | No specimens in this dish yet. |
| No access | Clearance required. |

---

## 5. Punnett Selection (`punnett-selection`, Project 1)

### 5.1 Routes

| Route | Access | Content |
|---|---|---|
| `/` | Public | Selection chamber. Duel for logged-in users. Glass pane for visitors. |
| `/specimens` | Public | Week 2 list page from `lab_specimens`. |
| `/incubator` | Logged in | Image upload and caption generation (Week 5). |
| `/lab/notebook` | Logged in (gated route) | The user's own vote history. |
| `/auth/callback` | Public | OAuth callback. Exact path. |

### 5.2 Milestone W2: database list page (due Thu 2026-09-24)

1. **HUMAN** creates table `lab_specimens` in Supabase with columns `id` (int8, identity), `code` (text), `label` (text), `notes` (text). **HUMAN** adds 5 to 8 rows.
2. Create `lib/supabase/server.ts` with `createServerClient` from `@supabase/ssr`.
3. In `/specimens` (server component), select `id, code, label, notes` from `lab_specimens`, ordered by `id`.
4. Render each row as a `SpecimenCard` on the night background.
5. Show an error state if the query returns an error. Follow 3.7 if the result is empty.

Acceptance:
- [ ] The page renders all rows from Supabase on the deployed Vercel URL.
- [ ] No Supabase value is hardcoded.
- [ ] The page loads in an incognito window.

### 5.3 Milestone W3: auth and gated UI (due Thu 2026-10-01)

1. Add Google sign-in through Supabase Auth. Use the flow from the course video. Use no client secret (R8).
2. Implement `/auth/callback`. Exchange the code for a session, then redirect to `/`.
3. Add `middleware.ts` to refresh the session on each request.
4. Protect `/lab/notebook` and `/incubator` on the server. Redirect visitors to `/`.
5. Build `GlassPane` on `/`:
   - A visitor sees a live duel (real captions) behind a translucent pane.
   - The select controls are locked.
   - The main button reads "Put on lab gloves" and starts sign-in.
   - After sign-in, animate the pane away (slide up and fade).

Acceptance:
- [ ] Login and logout work on the deployed URL.
- [ ] A visitor cannot open `/lab/notebook`. A direct URL visit redirects.
- [ ] A visitor sees the locked duel. A logged-in user sees the active duel.

### 5.4 Milestone W4: selection duel (due Thu 2026-10-08)

**VERIFY first:** the `caption_votes` columns, the vote value column and its type, the user id column, any required audit columns, and any unique constraint on (user, caption). Record the findings in `docs/schema-notes.md`.

Pairing rule: same image, captions the user has not voted on.

1. On the server, fetch the caption ids that the current user has voted on.
2. Fetch captions (`id`, `image_id`, text column) in pages of 500. Filter out voted ids in server memory.
3. Group by `image_id`. Keep images with 2 or more unvoted captions.
4. Pick one image at random. Pick two of its unvoted captions at random.
5. If no image qualifies, show the empty state "No unjudged specimens left. Check back after the next culture."

Vote rule:

1. The user selects caption A or caption B.
2. Insert one row for the winner with an upvote value.
3. Insert one row for the loser with a downvote value.
4. Use the logged-in user id from the server session. Never trust a user id from the client.
5. If an insert fails because of a duplicate, show a toast and load the next pair.
6. Do the insert in a server action or route handler that checks the session.

Interaction:
- Keyboard: `A` selects left, `B` selects right, `S` skips.
- Winner card pulses with `--glow`. Loser card fades. Next pair enters.
- `/lab/notebook` lists the user's votes with specimen codes, newest first.

Acceptance:
- [ ] Each selection creates two rows in `caption_votes` that persist after refresh.
- [ ] A visitor cannot insert a vote (UI lock and server check).
- [ ] No pair shows a caption that the user voted on before.

### 5.5 Milestone W5: incubator (due Thu 2026-10-15, with Project 1)

**VERIFY first:** the caption API docs (3.6). Map each API call to one loader stage.

1. `/incubator` shows a large `PetriDish` drop zone.
2. Accept drag and drop and a file picker. On phones, add `accept="image/*"` and `capture="environment"` to the file input.
3. Show stages in `LabLoader` while the API calls run: "Culturing…" (upload), "Sequencing…" (register or process), "Hatching…" (caption generation). Use the real call sequence from the docs.
4. When captions return, show them as `SpecimenCard`s with a staggered "hatch" animation.
5. Add the button "Send to selection chamber". It opens `/` with a duel from the new image.
6. Show a clear error state for each stage.

Acceptance:
- [ ] A real image upload returns real captions from the API.
- [ ] The camera option works on a phone browser.
- [ ] Errors do not leave the UI in a stuck state.

### 5.6 Milestone W5b: smile mode (bonus, before 2026-10-15)

Start this milestone only after W4 and W5 pass.

1. Add a "Smile mode" toggle. It is off by default.
2. On toggle, ask for camera permission. Explain that video stays on the device.
3. Use MediaPipe Face Landmarker (`@mediapipe/tasks-vision`) with blendshapes, in the browser only.
4. The focus cycles between caption A and caption B every 2.5 seconds. A glow ring marks the focused card.
5. When `mouthSmileLeft` and `mouthSmileRight` are both above 0.6 for 600 ms, select the focused card.
6. Never upload or store video frames.
7. If the camera fails, turn off smile mode and show a toast. Keyboard and click voting stay available.

### 5.7 Project 1 rubric checklist

- [ ] App loads, and the full flow works with no blocking bug.
- [ ] Supabase reads and writes work.
- [ ] Login, logout, and route protection work.
- [ ] Votes persist. Logged-in and logged-out states differ correctly.
- [ ] Clean layout and clear navigation for a new user.
- [ ] No placeholder features.

---

## 6. Punnett Observatory (`punnett-observatory`, Project 2)

### 6.1 Access

1. Every route requires Google login.
2. After login, read `profiles.is_superadmin` for the user on the server.
3. If the value is not `true`, render `ClearanceRequired` with a "Remove gloves" button. Do not render any data.
4. Guard in `middleware.ts` and again in each server component or route handler that reads data.
5. **HUMAN** solves the course question about superadmin lockout. Do not add code that bypasses the check.

### 6.2 Milestone W6: admin panel v1 (due Thu 2026-10-22)

| Entity | Operations |
|---|---|
| Users (`profiles`) | Read |
| Images | Create (with upload), read, update, delete |
| Captions | Read |

Also build the statistics home page with the caption galaxy v1 (section 6.4) and a stat row (total captions, total votes, active flavors, votes in last 7 days). Use Magic UI number tickers (free) for the stat row.

### 6.3 Milestone W7: domain model (due Thu 2026-10-29)

| Entity | Operations |
|---|---|
| Users (`profiles`) | Read |
| Images | Create (with upload), read, update, delete |
| Humor flavors | Read |
| Humor flavor steps | Read |
| Humor mix | Read, update |
| Terms | Create, read, update, delete |
| Captions | Read |
| Caption requests | Read |
| Caption examples | Create, read, update, delete |
| LLM models | Create, read, update, delete |
| LLM providers | Create, read, update, delete |
| LLM prompt chains | Read |
| LLM responses | Read |
| Allowed signup domains | Create, read, update, delete |
| Whitelisted e-mail addresses | Create, read, update, delete |

Implementation rules:
1. Build one generic `EntityTable` with server-side pagination (`range()` with `count: "exact"`), sort, and search.
2. Test the first page, a middle page, the last page, and a page size larger than the row count. The rubric checks for pagination errors.
3. Use shadcn/ui `Dialog` and `Form` for create and edit. Confirm each delete.
4. After each mutation, refresh the data. The change must persist after a page reload.
5. Group the sidebar: Specimens (images, captions, caption requests, caption examples), Genomes (flavors, steps, mix), Models (LLM models, providers, prompt chains, responses), Access (profiles, domains, e-mails), Lexicon (terms).
6. Add a cmdk command palette (Cmd K) that jumps to any entity and starts "create" actions.

### 6.4 Caption galaxy

Pipeline:

1. Fetch captions with `id`, text, flavor id, and vote counts. Page through all rows. Cap the default view at 5,000 captions. Add a control to change the cap.
2. Send caption texts to a Web Worker.
3. In the worker, use transformers.js `feature-extraction` with `Xenova/all-MiniLM-L6-v2` (quantized). Use mean pooling and normalization.
4. Cache each vector in IndexedDB. Key = `${modelId}:${captionId}`. On later loads, embed only uncached captions.
5. Run umap-js twice with a fixed random seed: `nComponents: 3` for the galaxy and `nComponents: 2` for the flat view.
6. Render with react-three-fiber and drei. Use one `Points` or instanced mesh for all stars.
7. Star color = humor flavor. Star brightness and size = fitness of the caption (section 6.5). Captions under the vote threshold render dim gray.
8. Hover shows a tooltip with specimen code, text, and win rate. Click opens a side drawer with details.
9. "Flatten" animates from 3D positions to 2D positions (z to 0) over 600 ms. The button toggles back.
10. Show `LabLoader` with a count: "Sequencing 1,204 of 2,904 specimens".
11. Add a legend and a sortable table of flavors below the canvas for exact values.

### 6.5 Fitness formulas

```ts
// lib/punnett/fitness.ts
export const MIN_VOTES = 5;
export function winRate(up: number, down: number): number | null {
  const n = up + down;
  return n < MIN_VOTES ? null : up / n;
}
```

Flavor fitness = win rate over all votes on captions that the flavor produced. **VERIFY** the column that links a caption to a flavor.

### 6.6 Milestone W12: rating statistics (due Thu 2026-12-03)

Add a "Selection pressure" page:
1. Votes per day (line chart).
2. Top 10 and bottom 10 specimens by win rate (min votes applies).
3. Flavor fitness ranking (bar chart plus table).
4. Heatmap of votes by weekday and hour.
5. Label every chart and axis. Show the data window and the min-votes rule.

---

## 7. Punnett Splicer (`punnett-splicer`, Project 3)

### 7.1 Access and theme

1. Every route requires login. Allow a user only if `profiles.is_superadmin = true` OR `profiles.is_matrix_admin = true`. Check on the server.
2. Use `next-themes` with three options: "Night" (default), "Lights on", and "System". Map System to night or lights-on from the OS setting.
3. Put the theme control in the header with the ink note "turn on the bench lights".

### 7.2 Milestone W8: genome editor (due Thu 2026-11-05)

Required features:
- [ ] Create, update, and delete a humor flavor.
- [ ] Create, update, and delete a humor flavor step.
- [ ] Reorder steps.
- [ ] Read captions that a specific flavor produced.
- [ ] Night, lights-on, and system modes.
- [ ] Test a flavor with the caption API on an image test set.

Canvas rules (React Flow, `@xyflow/react`):
1. Read steps for the flavor. Sort by the order column (**VERIFY** name).
2. Place nodes on one horizontal strand at fixed spacing. Add an input node ("Test images") at the start and an output node ("Specimens") at the end.
3. Generate edges from the order. Set `nodesConnectable={false}`. Users cannot draw edges.
4. Enable pan, zoom, `MiniMap`, and `Controls`. Animate edges during a test run.
5. Reorder: the user drags a `GeneNode` along the strand. On drop, compute the new index from the x position. Snap all nodes back to the strand. Persist the new order.
6. If the order column has a unique constraint, write the new order in two phases (temporary offset values, then final values). **VERIFY** the constraint.
7. Also give each node "move left" and "move right" buttons for keyboard users.
8. Click a node to open the inspector panel. Edit the step fields there (**VERIFY** columns, for example prompts, model, input and output types).
9. Show a notebook `InkNote` on first use: "drag a gene to re-sequence the chain".

X-ray trace:
1. The user picks one or more images from a test set and presses "Run on test set".
2. Call the caption API with the flavor (**VERIFY** payload).
3. Light each node in order while the run proceeds.
4. Under each node, show that step's output, duration, and errors. Read per-step data from the API response or from `llm_responses` (**VERIFY** which source holds per-step output).
5. Show final captions as `SpecimenCard`s under the output node.

### 7.3 Milestone W10: field-notes genome (due Thu 2026-11-19)

**HUMAN** creates this flavor with the Splicer UI in staging. Suggested genes:

| Gene | Input to output | Prompt |
|---|---|---|
| 01 | Image to text | Describe this image in plain, objective terms. Name the main subject, its action, and the setting. Do not make jokes. |
| 02 | Text to text | You are a field biologist. Treat the main subject in this description as a newly discovered species. Give it a mock Latin binomial name. Note its habitat and one odd behavior that the description shows. Output the name, habitat, and behavior. |
| 03 | Text to text | Write five field-log entries about this species. Start each entry with "Day N.". Keep each entry under 20 words. Use a dry scientific tone. The humor comes from treating ordinary behavior as a major discovery. Output one entry per line. |

Example output for a dog on a couch: "Day 3. *Canis sofaensis* holds the soft habitat. The large primates have not noticed."

### 7.4 Milestone W12: clone, lineage, compare (due Thu 2026-12-03)

Clone (the required duplicate feature):
1. The "Clone genome" action copies the flavor and all its steps, with the same order and fields.
2. The clone name follows the lineage convention. Use this function:

```ts
// lib/punnett/lineage.ts
const LETTERS = "abcdefghijklmnopqrstuvwxyz";

function suffix(n: number): string {
  let s = "";
  n += 1;
  while (n > 0) {
    n -= 1;
    s = LETTERS[n % 26] + s;
    n = Math.floor(n / 26);
  }
  return s;
}

export function nextCloneName(parent: string, existing: Set<string>): string {
  for (let i = 0; ; i++) {
    const name = `${parent}.${suffix(i)}`;
    if (!existing.has(name)) return name;
  }
}

export function parentOf(name: string): string | null {
  const i = name.lastIndexOf(".");
  return i === -1 ? null : name.slice(0, i);
}
```

3. Check name uniqueness on the server before insert. The user can edit the proposed name, but the result must be unique.
4. The new clone appears in the genome list at once and works in a test run.

Lineage tree:
1. Build a tree from flavor names with `parentOf`. Names without a dot are roots.
2. Show the tree in a side panel. Click a node to open that genome.

Mutation badges:
1. Compare each step of a clone with the parent step at the same order.
2. Badge "edited" (`--mutant`) if prompt text differs. Badge "new" if the parent has no step at that order. Badge "moved" if the same prompt text exists at a different order in the parent.

Compare run:
1. "Compare with parent" runs the parent and the clone on the same test images.
2. Show results side by side, with x-ray traces for both.
3. Show fitness for each genome when votes exist (section 6.5). Otherwise show "Fitness: needs more selection data".

### 7.5 Project 3 rubric checklist

- [ ] All three apps load from commit-specific URLs.
- [ ] Observatory shows rating statistics with clear labels and charts.
- [ ] Duplicate (clone) copies all steps under a new unique name and works.
- [ ] Auth wall works in all three apps.
- [ ] Project 3 goes in on time. No late submission is accepted.

---

## 8. Milestone calendar

Feedback group: Thursday, 2:00 to 3:00 PM EDT/EST. Assignments are due at the start of the feedback group.

| Week | Due (Thu) | Repo | Milestone |
|---|---|---|---|
| 1 | 2026-09-17 (late) | selection | Hello World deploy |
| 2 | 2026-09-24 | selection | 5.2 list page |
| 3 | 2026-10-01 | selection | 5.3 auth and gated UI |
| 4 | 2026-10-08 | selection | 5.4 selection duel |
| 5 + P1 | 2026-10-15 | selection | 5.5 incubator, 5.6 smile mode |
| 6 | 2026-10-22 | observatory | 6.2 admin v1 and galaxy v1 |
| 7 | 2026-10-29 | observatory | 6.3 domain model |
| 8 | 2026-11-05 | splicer | 7.2 genome editor |
| 9 + P2 | 2026-11-12 | selection | User testing (HUMAN), no code |
| 10 | 2026-11-19 | splicer | 7.3 field-notes genome |
| 11 | 2026-11-26 | selection | Changes from user feedback only (HUMAN gives list) |
| 12 | 2026-12-03 | observatory, splicer | 6.6 statistics, 7.4 clone |
| 13 | 2026-12-10 | all | End-to-end QA and bug fixes |
| P3 | 2026-12-17 | all | Final submission. No late work. |

Note: 2026-11-26 is Thanksgiving. **HUMAN** confirms the Week 11 meeting with the group leader.

---

## 9. Working agreement

### 9.1 Definition of done (each milestone)

1. All acceptance boxes pass.
2. `npm run build`, `npm run lint`, and `npx tsc --noEmit` pass.
3. Manual test on the deployed Vercel URL in an incognito window.
4. Auth-gated routes tested as a visitor and as a logged-in user.
5. `docs/schema-notes.md` updated with each VERIFY finding.
6. Commit message names the milestone, for example `W4: selection duel with paired votes`.

### 9.2 Report format

At the end of each task, report:

```markdown
## Milestone
## What changed
## How I verified it
## VERIFY findings (schema, API)
## HUMAN tasks needed
## Open questions
```

### 9.3 When blocked

1. If a VERIFY item has no answer, stop and ask. Do not invent schema or API shapes.
2. If a task needs an RLS change, stop and report. Do not change RLS.
3. If a library does not work with the current Next.js version, report it and propose one free alternative.

---

## 10. Open items (HUMAN)

1. Answer the Week 6 superadmin lockout question.
2. Confirm the `caption_votes` unique constraint and vote value format.
3. Paste the caption API docs into `docs/caption-api.md`.
4. Confirm the Week 11 meeting date (Thanksgiving).
5. Approve the design of `ClearanceRequired` before Week 6.
