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
- `npm run test:rules`: run after any change to `firestore.rules` / `database.rules.json`, then `npm run deploy:rules`
- `npm run check:memory`: the memory bank agrees with itself (log numbering, every standing decision has a line in
  decisions.md or decisions-1.0.md, nothing superseded cited as a rule, state.md ≤ 120 lines); run after editing memory-bank/
- `npm run build`: typecheck + production build; `npm run build:functions`, `npm run deploy:functions` (needs the Blaze plan)

## Hard rules
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
- Do not start work that depends on a `blocking` open question without asking the user.
