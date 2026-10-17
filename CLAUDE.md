# CLAUDE.md

North Star (formerly "Mind-Map") is a visual, real-time collaborative startup-ideation workspace (ideas, features,
competitors, comparison matrix) with a 3D ASCII design language. It is a static React + three.js
SPA on GitHub Pages, backed by Firebase (Auth, Firestore, Realtime Database). There is no server of our own.

## Session start: always
1. Read `memory-bank/state.md`, `memory-bank/open-questions.md` and `memory-bank/decisions.md`.
2. Consult `/docs` as needed:
   - `docs/PRODUCT.md`: what we're building (entities, views, flows)
   - `docs/ARCHITECTURE.md`: stack, backend, data model, collaboration, AI, export/import
   - `docs/DESIGN.md`: the 3D ASCII design language, tokens, motion
   - `docs/ROADMAP.md`: phases

## Session end, or after meaningful progress: always
- Update `memory-bank/state.md` (done / in progress / next / blockers, plus the date).
- A new decision gets a `D-xxx` entry in `decisions.md`. An answered question moves out of `open-questions.md`.
- A new uncertainty gets a `Q-xxx` entry in `open-questions.md` with a recommendation.
- If a decision changes a spec, update the relevant `/docs` file in the same change.

## Commands
- `npm run dev` (real Firebase), `npm run dev:emu` + `npm run emulators` (local, test users)
- `npm run test:rules`: run after any change to `firestore.rules` / `database.rules.json`, then `npm run deploy:rules`
- `npm run build`: typecheck + production build

## Hard rules
- Never store or log users' OpenAI API keys anywhere except the user's own browser storage.
- The ASCII post-processing effect must never cover readable or editable text.
- All DB access goes through `src/data/`. Permissions are enforced by `firestore.rules` and
  `database.rules.json`, not by the client. Change a rule and the data shape together.
- Respect `prefers-reduced-motion`.
- Do not start work that depends on a `blocking` open question without asking the user.
