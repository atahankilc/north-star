# Project State

_Last updated: 2026-10-17_

## Phase
**Phase 0: Foundations**, mostly done. Next up is Phase 1 (single-user core).

## Done
- Specs: product, architecture, design, roadmap (`/docs`)
- Decisions D-001 to D-016. **Backend switched InstantDB → Firebase** (D-014), because Instant is shutting down
- Scaffold: Vite 8 + React 19 + TS + R3F 9 + postprocessing + Firebase 13 + motion + Zustand
- GitHub Pages deploy workflow (`.github/workflows/deploy.yml`, base path = `/<repo-name>/` from CI, HashRouter)
- Design tokens (`src/styles/tokens.css` + `tokens.ts` mirror), Geist / Geist Mono self-hosted via fontsource
- **ASCII post-processing effect** (`src/three/AsciiEffect.ts`): glyph atlas from Geist Mono, luminance → ramp, keeps colour for accents
- **Ambient field** shader (flowing strands, sparse accents, pointer bend, calm top/bottom bands) plus floating 3D post-it cards
- Persistent `<Backdrop>` WebGL layer behind DOM routes; `prefers-reduced-motion` respected
- UI: `AsciiButton` (`[ LABEL ]` with accent wipe), `DecodeText` (glyph decode-in)
- Landing page (Enosta-style huge headline) and a signed-in workspaces placeholder
- Firebase init (`src/data/firebase.ts`, Firestore offline cache), data model types (`src/data/model.ts`)
- Rules **deployed** to `north-star-db` (compile OK; signed-out access confirmed blocked). Behaviour with real users is still untested (Q-011)
- Google sign-in wired (`src/data/auth.ts`, popup). Errors show on the landing page. Untested until the Firebase project exists.
- Verified in Chrome: renders, no console errors, build passes

## In progress
- None

## Next steps
1. ~~User setup~~ done: Firebase project `north-star-db` (Auth Google, Firestore, RTDB europe-west1), `.env.local` filled, firebase CLI logged in. Still to do: add `atahankilic.github.io` to Authorized domains, and the GitHub Pages variables
2. Verify Google sign-in end to end and verify the rules with two accounts (Q-011)
3. Phase 1: workspace list, create, join by invite code; Idea Canvas (create, move, edit post-its; connections)

## Blockers
- Phase 1 data work needs the Firebase project and config from the user

## Notes for future sessions
- In a hidden or background browser tab rAF is paused. In dev, call `window.__advance(t, true)` to step frames manually (see `Backdrop.tsx`).
- The bundle is about 1.4 MB (three + drei). Code-split views later.
