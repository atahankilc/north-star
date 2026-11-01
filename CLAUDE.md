# CLAUDE.md

North Star (formerly "Mind-Map") is a visual, real-time collaborative startup-ideation workspace (ideas, features,
competitors, comparison matrix) with a 3D ASCII design language. It is a static React + three.js
SPA on GitHub Pages, backed by Firebase (Auth, Firestore, Realtime Database). The only server code is a few Cloud
Functions in `functions/` for the assistant's shared workspace key (D-079).

## Session start: always
1. The memory bank is auto-loaded into context via these imports (no need to read them manually):
   - @memory-bank/state.md
   - @memory-bank/open-questions.md
   - @memory-bank/decisions.md (current rules by topic; the full entries are in `decisions-log.md`)
   Not auto-loaded, read on demand: `memory-bank/decisions-log.md` (every D-xxx in full: why, alternatives, user quotes),
   `memory-bank/state-history.md` (what was done and verified, session by session) and `memory-bank/decisions-1.0.md`
   (1.0's rules, for when a deleted feature comes back). Grep them by D-number.
2. Consult `/docs` as needed:
   - `docs/PRODUCT.md`: what we're building (entities, views, flows)
   - `docs/ARCHITECTURE.md`: stack, backend, data model, collaboration, AI, export/import
   - `docs/DESIGN.md`: the 3D ASCII design language, tokens, motion
   - `docs/ROADMAP.md`: phases

## Session end, or after meaningful progress: always
- Update `memory-bank/state.md` (in progress / next / blockers, plus the date). It is a snapshot under ~100 lines: finished
  work gets a `## Done (…)` section in `state-history.md`, and at most one line stays in state.md.
- A new decision gets its full `### D-xxx` entry appended to `decisions-log.md`, plus one line in the right topic of
  `decisions.md` (edit the line it replaces; a rejected idea goes under "Rejected"). Older log entries it contradicts
  get fixed in place, or shrink to a `Superseded by D-xxx` stub: no two entries may disagree. An answered question moves out of
  `open-questions.md`. Then run `npm run check:memory`.
- A new uncertainty gets a `Q-xxx` entry in `open-questions.md` with a recommendation.
- If a decision changes a spec, update the relevant `/docs` file in the same change.

## Commands
- `npm run dev` (real Firebase, http://localhost:5288, set in `vite.config.ts`), `npm run dev:emu` + `npm run emulators` (local, test users; builds and runs the functions too)
- `npm run test:rules`: run after any change to `firestore.rules` / `database.rules.json`, then ask the user before
  `npm run deploy:rules` (D-322; storage-less until Blaze, `deploy:storage` apart)
- `npm run check:gallery`: every component in a covered folder has its `X.gallery.tsx`, and the gallery stays out of
  the app and every build (D-324); the gallery itself: `/gallery.html` on the dev server
- `npm run check:kit`: hand-made UI outside src/ui no more than scripts/kit-baseline.json (D-326)
- `npm run check:memory`: the memory bank agrees with itself (log numbering, every standing decision has a line in
  decisions.md or decisions-1.0.md, nothing superseded cited as a rule, state.md ≤ 120 lines); run after editing memory-bank/
- Onboarding again as a new person (dev only): add `?onboarding=reset` to the address; that tab gets an empty test
  seen-state, the real one untouched; `?onboarding=real` or a new tab leaves it (docs/specs/onboarding.md §5.3)
- `npm run build`: typecheck + production build; `npm run build:functions`, `npm run deploy:functions` (needs the Blaze plan)

## Hard rules
- The rules below are enforced, not asked for (D-339): after every Write/Edit under `src/`, `.claude/settings.json` runs
  `scripts/ui-rules-hook.mjs` (tokens, kit, gallery, lessons, memory bank) and a refusal comes back as the tool's
  feedback: fix it before going on, never work round it. Commits run `scripts/commit-rules.mjs` (`.githooks/`, set by
  `npm install`): the same checks, and a staged component without its `X.gallery.tsx` or without a lesson change needs a
  `Gallery: …` / `Lessons: …` line in the message saying why. A rule the checks can't see yet: add it to the check.
- OpenAI keys: a person's own key lives only in their own browser storage. A workspace key (D-079) is sent once to the
  `setWorkspaceKey` function and kept only encrypted in `aiSecrets/`, which no client can read; it is never returned to
  any browser. Never log or store either key anywhere else, and never put message text in the usage log.
- The ASCII post-processing effect must never cover readable or editable text.
- All DB access goes through `src/data/`. Permissions are enforced by `firestore.rules` and
  `database.rules.json`, not by the client. Change a rule and the data shape together.
- Defaults are always **dark theme, full motion, background animation on** (D-063, D-069), whatever the OS says. Never change
  them, and never add a theme/motion/background control outside Settings (the landing has none). Signed-in users change them
  in Settings → display; the choice is saved in that browser.
- Reduced motion and light theme must always work when chosen: every animation reads `useMotion().reduced` /
  `isReducedMotion()`, CSS colours come from tokens (light values under `[data-theme='light']`), WebGL colours from `usePalette()`.
- Tokens (D-325, docs/specs/tokens.md): no raw value in CSS or TS. Sizes, colours, type, spacing, layers and durations
  are tokens (`src/styles/tokens.css`; in TS the token itself, or `tokenPx()` for pixel math). A constant that isn't a
  token has one home by kind: `src/model/world.ts` (canvas and pieces' geometry), `src/model/limits.ts` (text lengths and
  list sizes, kept equal to firestore.rules by tests/unit/limits.test.ts), `src/ui/foundation/feel.ts` (drag threshold, zoom),
  `src/ui/foundation/motionTokens.ts` (durations, D-326). Import it; never redefine it. A new constant used in two places, or one
  that is a design or feel choice, goes to its home. `npm run check:tokens` must pass; a line that truly must name a
  number says why with `// tokens-ok: …`.
- Do not start work that depends on a `blocking` open question without asking the user.
- Kit (D-326, docs/foundation-audit-2026-10-31.md): UI is built from the kit in `src/ui` (Button, Label, Rule, Field,
  PromptField, Checkbox, Tabs, Options, Chip, CountBadge, Empty, Spinner, Window, WizardShell…); a need it doesn't meet
  grows the kit first. Outside `src/ui`, a raw `<button>`/`<input>`/`<textarea>`, an own `role="dialog"` or portal, a
  hand-drawn bracket or caps label in CSS fails `npm run check:kit` past its baseline (scripts/kit-baseline.json, only
  shrinks: `-- --write` after moving an area); one that truly must stay says why with `// kit-ok: …`.
- Gallery (D-324, docs/specs/gallery.md): a new component in a covered folder (`src/ui`, `src/views/workspace`, `src/views/workspaces`, `src/onboarding`), or a real change to one,
  ships in the same change with its `X.gallery.tsx` beside it; `npm run check:gallery` must pass.
  The gallery is dev only: never in a build input, never imported by the app.
- Onboarding (D-315): every new user-facing feature, or a real change to one, ships in the same change with its
  lesson in `src/onboarding/lessons.ts` (words, trigger, scene; a changed feature bumps its lesson's version) and a
  line in `src/onboarding/releases.ts`; `npm run check:lessons` must pass. Until onboarding is built, add or change
  the lesson in `docs/specs/onboarding-lessons.md` instead. Not the agent (D-312) while it's being built: its lessons
  and demos are written once its UI is done, since a lesson's demo is drawn from the finished components.
