# Decisions Log

Format: `D-xxx · date · status (Accepted | Proposed | Superseded by D-yyy)`

---

### D-001 · 2026-10-17 · Accepted
**Frontend hosted on GitHub Pages as a static SPA.**
Why: free, reliable. Implications: no server, so use HashRouter and deploy with GitHub Actions.

### D-002 · 2026-10-17 · Accepted
**No self-hosted or free-tier app server. Use a managed DB service the browser talks to directly.**
Why: free backend hosts cold-start or shut down, giving bad UX and latency.
Implications: security is enforced by the DB service's permission rules.

### D-003 · 2026-10-17 · Accepted
**React + three.js (via @react-three/fiber) for the UI.**
Why: the user wants a visual, animated 3D experience.

### D-004 · 2026-10-17 · Accepted
**Design language: 3D ASCII, mostly black and white with vivid accent colours.**
Why: user preference, based on the references in `docs/design/references/`. See [DESIGN.md](../docs/DESIGN.md).

### D-005 · 2026-10-17 · Accepted
**Real-time collaboration with live cursors and presence is in scope.**

### D-006 · 2026-10-17 · Accepted
**AI uses BYOK OpenAI keys, entered on a Settings page, with a cheap model by default.**
The key is stored only in the user's browser and never in the DB. Calls go directly to OpenAI.
Why: no backend to hold secrets, and collaborators must not see each other's keys.

### D-007 · 2026-10-17 · Accepted
**Features are their own view and entity, linked to ideas** (not just an idea with a tag).

### D-008 · 2026-10-17 · Accepted
**Web only. Authentication required. Export/import and attachments (images, PDFs, drawings) are in scope.**

### D-009 · 2026-10-17 · Accepted
**Hybrid rendering: 3D scene in WebGL, readable and editable text in the DOM. The ASCII effect never covers editable text.**
Why: accessibility, text editing quality, readability.

### D-010 · 2026-10-17 · Superseded by D-014
**Backend: InstantDB.** It covers auth, DB, permissions, storage and presence/cursors, and free projects are not paused.
Alternatives: Firebase (mature, but presence is hand-built and storage may need a billing plan), Supabase (free projects pause after about a week of inactivity).
Mitigation: all access goes through the `src/data/` adapter.

### D-011 · 2026-10-17 · Accepted
**Sign-in: Google OAuth only.** (Resolves Q-002.)
Implementation: Firebase Auth Google provider, popup flow (updated after D-014).

### D-012 · 2026-10-17 · Accepted
**Workspaces are shared with an invite code.** The owner generates a code, and others sign in with Google and enter it to join.
The code is stored on the workspace and can be regenerated to revoke it. (Partly resolves Q-007; roles are still open.)

### D-013 · 2026-10-17 · Accepted
**Fonts: Geist (display/UI) + Geist Mono (data/ASCII).** (Resolves Q-005.) Self-hosted through `@fontsource-variable/geist` and `geist-mono`, with no external font CDN.

### D-014 · 2026-10-17 · Accepted
**Backend: Firebase.** Firestore for data, Realtime Database for presence and cursors, Firebase Auth for Google sign-in. Spark (free) plan.
Why: InstantDB's hosted service is shutting down (team joined OpenAI in Aug 2026, sign-ups closed, apps stop 2027-08-31).
Longevity became the top criterion. Firebase never pauses, has no cold starts, and is Google-backed.
Rejected: Convex (cursor updates burn function-call quota, startup risk), Supabase (free projects pause).

### D-015 · 2026-10-17 · Accepted
**Attachments are deferred. Stay on Spark with no card for now.** Firebase Storage needs the Blaze plan
(card required, 5 GB free). Revisit in Phase 5. Options then: Blaze plus a $1 budget alert, or an alternative store.

### D-016 · 2026-10-17 · Accepted
**Presence lives in RTDB at `presence/{wid}/{uid}`. It is readable by any signed-in user, and each user can write only their own node.**
Why: RTDB rules can't read Firestore membership, and mirroring it securely needs Cloud Functions (Blaze).
Exposure is limited to name, colour and cursor coordinates, behind a random workspace ID. Revisit if Blaze is enabled.

### D-017 · 2026-10-17 · Accepted
**Product name: North Star** (formerly "Mind-Map"). Resolves Q-010.
The Firebase project is `north-star-db`. The GitHub Pages base path comes from the repo name in CI, so a repo rename needs no code change.
The local folder was renamed to `north-star` too (2026-10-17).

### D-018 · 2026-10-17 · Accepted
**Idea canvas is 2.5D:** a flat board in a real three.js scene, with a perspective camera that pans and zooms (no rotation),
cards as lit 3D slabs that lift on hover and drag, and edges as curved dashed lines. Resolves Q-008.
Full 3D stays available for transitions and competitor maps later.

### D-019 · 2026-10-17 · Accepted (refines D-009)
**Card display text is WebGL SDF text (troika via drei `<Text>`); all editing happens in the DOM detail panel.**
Why: crisp at any zoom, no DOM churn per card, and cards stay real 3D objects. The ASCII pass still never covers the board.
troika can't read woff2, so the scene uses static `.woff` Geist from `@fontsource/geist(-mono)`.

### D-020 · 2026-10-17 · Accepted
**Local development and tests run on Firebase emulators** (`npm run dev:emu`, `npm run test:rules`) with a `demo-` project,
so nothing can reach production. Test users (Alice, Bob, Carol) sign in with fake Google tokens. The RTDB emulator uses port **9010**
(9000 clashes with OrbStack). Its namespace must be `<project>-default-rtdb` for the rules to apply.

### D-021 · 2026-10-17 · Accepted
**Roles for the MVP: owner + editor.** Resolves Q-007. Owner: members, invite code, delete. Editor: everything else.
Enforced in `firestore.rules`, covered by `tests/rules.test.mjs`.

### D-022 · 2026-10-17 · Superseded by D-025
**A loading curtain covers the app until it's ready** (`src/ui/Curtain.tsx`, `src/state/curtain.ts`).
Anything can hold it with `useHoldCurtain(key, isLoading)`: the shell holds it for auth and fonts, pages for their data.
On first load it stays up for at least 900 ms, then opens as a shutter from the centre. After that it only appears
if a load takes over 250 ms. Entrance animations (`DecodeText`, landing motion) wait for `revealed`.

### D-023 · 2026-10-17 · Accepted
**Owners delete workspaces; editors leave them.** Delete removes every subcollection doc, then the invite code and the workspace
(client-side, children first, since Firestore doesn't cascade). A new `leaving()` rule lets a non-owner remove only themselves,
and `ownerManaging()` now prevents the owner from removing themselves or their owner role (no orphaned workspaces).
Rename is open to all members (card action, or click the name in the canvas header).

### D-024 · 2026-10-17 · Accepted
**One framed surface for all panels, cards, forms and chips:** `src/ui/Frame.module.css` (`frame`, `dashed`, `interactive`, `label`),
using the tokens `--surface`, `--surface-blur`, `--line`, `--line-hover`. New framed UI must compose these classes instead of setting its own background or border.

### D-025 · 2026-10-17 · Accepted (supersedes D-022's visuals; the hold mechanism stays)
**Loading = the flowing background itself, then a cell-by-cell rebuild.** While held, an exact copy of the backdrop
(`BackdropScene` in a second canvas, same clock, same dim) covers the page, with a small status (`▖ LOADING WORKSPACES`) in the
bottom-right. When ready, the copy's ASCII pass masks itself cell by cell along a jittered top-left → bottom-right diagonal
(magenta glyph flash at the edge, about 1.1 s), so the page rebuilds out of the background without the animation restarting.
On first load the cover is solid black until its first frame, so nothing flashes through while shaders compile.
Requirement: **nothing in the backdrop may depend on per-canvas state** (own clocks, pointer). Use `sceneTime()` and `backdropDim` from `src/three/sceneClock.ts`.

### D-026 · 2026-10-17 · Accepted (extended by D-028)
**The background flows by itself, like a fluid. No mouse influence.** Two levels of time-varying domain warp in `AmbientField`.
The landing's floating cards drift on the shared clock with no pointer parallax. Dimming on the board is an ASCII-pass uniform, not CSS opacity.

### D-027 · 2026-10-17 · Accepted
**One HUD on every page** (`src/ui/Hud.tsx`): a fixed-height top bar (`--hud-h`) with a breadcrumb on the left
(`# north-star / workspaces / <name>`; earlier segments link back, the current one is bright, the workspace name is click-to-rename)
and page actions on the right. Every screen-edge element (canvas toolbar, detail panel, loading status) uses `--hud-x` / `--hud-y`,
so nothing shifts between pages. Elements inside the bar must not change its line height (InlineEdit draws underlines as decoration or shadow, not border).
Card footers always split "message or info" on the left and "actions" on the right, in every mode (idle, renaming, confirm).

### D-028 · 2026-10-17 · Accepted
**The background lives in generations.** Every ~9 s a new set of forms is born. Each one drifts in its own direction,
swells brighter (so the ASCII pass switches it to heavier glyphs: `· : - = + # % @`), then fades while the next rises.
Two generations always overlap. ASCII only; no post-its or 3D objects in the backdrop or loading screen (the landing's floating cards were removed).
Bug fixed: R3F copies a `<shaderMaterial uniforms={…}>` object, so per-frame updates must go through the material ref
(`material.current.uniforms`), never the memo'd object. The background had never actually animated before this fix.

### D-029 · 2026-10-17 · Superseded by D-034
**Components enter and leave with a pixelated wave** (`src/ui/PixelWave.tsx`, after the user's reference recording): square tiles
(about 18 px) sweep left to right, faint lead, solid core, softer tail, with the content already there behind the band (enter) or still
there ahead of it (exit). Implemented as a per-row staircase `clip-path` on the element plus a fixed 2D canvas of tiles over its box.
Use `<PixelWave as="li|form|aside|button" accent delay>` for framed components. Wrap in `<AnimatePresence>` for the exit wave
(it waits via `usePresence`). Entrances wait for the loading curtain to open.

### D-030 · 2026-10-17 · Accepted
**In-app motion setting:** `motion: system | full | reduced` in the HUD (`src/state/motion.ts`), saved in localStorage, default *system*.
Everything reads `useMotion().reduced` / `isReducedMotion()`; nothing reads the media query directly. CSS uses `html[data-motion='reduced']`.
Why: the user's Mac has Reduce Motion on but they want the full experience, while users who need reduced motion keep it.
Under reduced motion: the background freezes (and resumes seamlessly), waves and sweeps are skipped, decode text is instant.

### D-031 · 2026-10-17 · Accepted
**The page-load reveal has no coloured edge.** User feedback: the magenta diagonal "wave" was not wanted. The reveal stays a plain
cell-by-cell rebuild (D-025). The user specifically likes the decode text, the workspace-card waves and the detail panel's wave.

### D-032 · 2026-10-17 · Superseded by D-034
**Idea cards wave in too** (`src/views/canvas/CardWave.tsx`). It's the same timeline as `<PixelWave>` (shared `src/ui/waveTimeline.ts`),
rebuilt in 3D: a 13×8 instanced tile grid sweeps across the card while one world-space clipping plane reveals its content
(slab, rim, strip, troika text). The Board enables `gl.localClippingEnabled`. Cards present when a board opens stagger in
(70 ms apart, up to 1 s); cards created later wave in immediately. Enter only, for now.

### D-033 · 2026-10-17 · Superseded by D-034 (rejected trial; the `settled` gating stays)
**Cards and side panels enter with the landing headline's "rise"** (fade up about 40 px out of a 12 px blur, 1.1 s, `cubic-bezier(0.16,1,0.3,1)`),
without colour. Applies to workspace cards, board idea cards and the idea detail panel. Forms, invite chip and landing CTA keep the wave.
Switch with `?entrance=rise|wave` (remembered in localStorage, `src/ui/entrance.ts`). DOM: `<Appear effect=…>` (formerly PixelWave)
uses the Web Animations API. 3D cards: `CardEntrance` → `CardRise` (rise + fade via material opacity and troika fillOpacity; a 0.96 → 1 scale
stands in for blur, which WebGL can't do cheaply per object).
**Entrances now wait for `settled`** (the page-load rebuild has fully finished), not `revealed`, so they're seen in full.
Text decode still starts at `revealed`. Open question for the user: keep rise, or go back to wave (Q-014).

### D-034 · 2026-10-17 · Accepted
**One entrance everywhere: cell-by-cell build-up.** The user loved the "North Star" headline appearing piece by piece. That was the
page-load reveal (D-025), not the headline's blur animation. Now every component builds itself the same way: content appears in
9 px cells on the backdrop's ASCII grid, along a jittered top-left → bottom-right diagonal (0.8 position + 0.2 per-cell noise), no colour.
- DOM: `<Appear as=… delay duration>` (`src/ui/Appear.tsx`): a `clip-path: path()` of merged cell runs, viewport-aligned. Exit = breaks apart the same way.
- 3D idea cards: `CardReveal` injects a `discard` into every card material via `onBeforeCompile` (screen-space cells from `gl_FragCoord`).
  Each card owns a base `MeshBasicMaterial` for its troika text (troika's derived material calls the base `onBeforeCompile`), so the shared default isn't touched.
- The landing headline uses it too, so it builds on every visit, including after sign-out (which previously only faded in).
- **Rejected by the user:** coloured tile waves (anywhere) and the blur "rise".
Shared math: `src/ui/cellReveal.ts`. Entrances wait for `settled`.

### D-035 · 2026-10-17 · Accepted (refines D-034, D-025)
**Random order, all at once, fast.**
- Cells appear in **random order** (pure per-cell hash, no top-left → bottom-right diagonal), for components, 3D cards and the page-load reveal.
- **Nothing waits:** every entrance and text decode starts the moment the page is revealed (`revealed`). There are no staggers or delays,
  and nothing waits for the page-load rebuild to finish (the `settled` state was removed).
- **Faster:** components 320 ms, landing headline 400 ms, page-load reveal 400 ms, text decode 260 ms (nav 220 ms). (Halved, then about 25% more on request.)

### D-036 · 2026-10-17 · Accepted
**Workspace views switch from tabs in the HUD breadcrumb:** `# north-star / workspaces / <name> / [ideas] features competitors matrix`.
Routes: `/w/:wid` (ideas), `/w/:wid/features`, `/w/:wid/competitors(/:cid)`, `/w/:wid/matrix`. One workspace layout route loads every
collection once and shares it with all views, so switching tabs is instant and any panel can show links to nodes in other views.

### D-037 · 2026-10-17 · Accepted (promote button removed by D-057)
**The Features view is a 3D board like the idea canvas.** The Board, cards and detail panel are generic over board node types
(`idea`, `feature`). Ideas and features share their board fields (`title`, `body`, `color`, `tags`, `x`, `y`); features add
`priority`, `status`, `effort`. An idea can be promoted to a feature (new feature + `inspired-by` edge).

### D-038 · 2026-10-17 · Accepted
**Competitors are profiles with a categorized feature list, not a spatial map.** The competitor page shows name, URL, pricing,
audience and notes, plus its features grouped by `category`. `CompetitorFeature` has no position.

### D-039 · 2026-10-17 · Superseded by D-048
**Domains organise a workspace.** A workspace holds domains (e.g. pet care, fintech). Ideas and problems belong to exactly one
domain; competitors and features can belong to several. Domains are the main tabs. (Spec now [docs/specs/board.md](../docs/specs/board.md).)

### D-040 · 2026-10-17 · Accepted
**The Board is the main view.** All item types live on one free canvas, filtered by domain and type. Flow, Table and Matrix are
other ways to view the same data. Supersedes the per-type tabs of D-036.

### D-041 · 2026-10-17 · Accepted
**Problem is its own item type**, created, dragged and linked like an idea (not a field on the idea), so several ideas can attack one problem.

### D-042 · 2026-10-17 · Accepted
**Customer is its own item type** (a persona such as "solo dog walker"), placed on the board and linked like the others
(customer → has → problem), not only a segment multi-select. Answers Q-015 point 2; the user overrode the "segments for now" recommendation.

### D-043 · 2026-10-17 · Accepted
**No fixed segment list; the tool supports any kind of startup (B2B, B2C, anything).** Segments are created by the user, not
picked from start-ups / scale-ups / SMEs / enterprises. How they attach: D-044.

### D-044 · 2026-10-17 · Accepted
**Customers are the segments.** One user-created Customer item at any breadth ("SMEs", "solo game devs"); no separate segment type or
segment fields. Tagging an item with a customer is a `for` edge, drawn on the board as a label chip on the item's card, not a line.
Selecting a customer card highlights the items tagged with it and shows those lines while selected. The `for:` filter lists customers.

### D-045 · 2026-10-17 · Accepted
**Flow columns: Customers → Problems → Competitors → Ideas → Features** (who hurts, what hurts, how they cope today, our answer,
what we build). Competitors before ideas so the gap shows before the solution.

### D-046 · 2026-10-17 · Accepted (answers Q-013)
**Undo/redo by document snapshots** (`src/data/history.ts`). Every write in `src/data/` goes through `tracked()`, which snapshots
the documents it touches before and after; undo/redo write a snapshot back. So cascades (a competitor with its features, matrix cells
and links; a domain and its items' domain fields) undo as one step. Typing in one field and one drag merge into one step.
Local to the tab and workspace (cleared on switching), last write wins against collaborators.
Keys: ⌘Z / Ctrl+Z, ⇧⌘Z / Ctrl+Y, Delete or Backspace on the selected item; text fields keep their own undo. A toast says what happened.
Deletes are one click now (they're undoable); domain delete keeps its `delete?` step.
Tracked writes are serialised but never wait for the server (Firestore applies writes locally in call order), so editing works offline.

### D-047 · 2026-10-17 · Superseded by D-049 (answered Q-012)
**Groups are labelled frames on the board** (`groups/{id}`: name, color, x, y, w, h, domainId; `src/views/canvas/GroupFrame.tsx`).
Membership is spatial: dragging the label moves the frame plus every card whose centre is inside it and every smaller frame that fits inside,
as one undo step. The bottom-right corner resizes (top-left stays put). The fill has no handlers, so panning and double-click-to-create
work inside a frame. Clicking the label opens the group panel (name, domain, colour, delete); deleting a group leaves its cards.
A group shows on its domain's tab and on `all`; without a domain it shows everywhere. `+ Group` frames the selected card or the view centre.
The old `groupIds` field on ideas is unused. Table and Flow ignore groups for now.

### D-048 · 2026-10-17 · Accepted (reverses D-039)
**No domains.** The user found them unnecessary: a workspace already is one idea space, and customers (the `for:` filter) plus
text labels cover slicing and naming areas. Removed tabs, pickers, unsorted marks and the domain filters on Table/Matrix.
Rules refuse new `domains` docs but keep read/delete for clean-up; old `domainId`/`domainIds` fields are tolerated and ignored.

### D-049 · 2026-10-17 · Accepted (reverses D-047)
**No groups.** Replaced by text labels (D-050) to mark areas. Rules refuse new `groups` docs, keep read/delete for clean-up.

### D-050 · 2026-10-17 · Accepted
**Text labels on the board are the places you jump to.** `labels/{id}`: text, color, x, y. Written straight on the canvas
(`+ Text`, or double-click after it): a DOM input sits over the spot while typing (never WebGL), Enter saves, Escape cancels,
empty text deletes. Drag to move, double-click to edit, Delete to remove; all undoable, and a new label plus its first text undo as one step.
The board's "go to" row lists every label in reading order (top→bottom, left→right); click or press 1–9 to glide the camera there
(instant under reduced motion; your own pan/zoom cancels the glide). Only labels are jumpable: no other text anywhere (user's words).
Zoom-out limit raised from 60 (later capped at 150 with the camera far plane at 1000, after cards vanished past the old far plane of 200).

### D-051 · 2026-10-17 · Superseded by D-055
**One silhouette per card type** (user picked shapes over colour headers): customer pill (green), problem with a folded top-right
corner (magenta), competitor wide with a double rim (yellow), idea post-it with a top strip (neutral), feature tag with pointed ends
(cyan). Each is outlined in its colour. Geometry in `src/views/canvas/cardShapes.ts` (extruded shapes, shared per type).

### D-052 · 2026-10-17 · Accepted
**Built-in example workspace** ("Create example" on the workspaces page, `src/data/example.ts`): a made-up startup, Tablebook
(shift scheduling for independent restaurants), with 4 customers, 4 problems, 4 fictional competitors and their features,
4 ideas, 6 features, every link kind, customer tags, a full matrix and six area labels. Competitor names are invented on purpose.

### D-053 · 2026-10-17 · Accepted
**Fewer, clearer controls.** One `+` create button (bottom-left, solid magenta) opens a menu of card types and text.
`show`, `for` and `go to` are dropdowns (`src/ui/Menu.tsx`: checkbox items stay open, actions close; arrows/Home/End/Escape).
The views (board, flow, table, matrix) moved from bottom-right to a framed menu bar beside the breadcrumb, so they read as views
rather than more path.

### D-054 · 2026-10-17 · Accepted
**Settings modal** (`src/ui/Settings.tsx`, a native `<dialog>`), opened from an account button on every signed-in page:
account + sign out, the workspace's name / members / invite code (moved out of the HUD), motion (moved out of the HUD),
and a "coming later" list (AI key, live cursors, export). Later phases add their settings here. Board shortcuts ignore keys inside it.

### D-055 · 2026-10-17 · Accepted (replaces D-051)
**Flat cards; colour means type.** The user disliked the 3D silhouettes. Every card is the same flat rectangle; a left border and a
small uppercase label in the type colour identify it (customer green, problem magenta, competitor yellow, idea white, feature cyan).
The per-card colour picker is gone, because it clashed with the type colours; old `color` values are ignored.
The workspace name in the breadcrumb is plain text (rename in settings / workspaces page only).

### D-056 · 2026-10-17 · Accepted
**Tags group cards within a type.** Shown as white `#chips` on every card (never type colours); a `TAG ▾` filter beside SHOW and FOR;
an editable tags column in Table (`#a #b` or `a, b`); competitors gained `tags` (rules + 2 tests). Chosen over colours or symbols because
a tag carries its meaning in its name and works the same in every view. The example workspace tags everything.

### D-057 · 2026-10-17 · Accepted
**Small cards, compact panels.** Cards no longer show notes or descriptions (height 1.25: type label, title ≤2 lines, tags, meta).
In the side panel, `for` is a multi-select dropdown and tags use a picker (`src/ui/TagInput.tsx`: chips with ×, type to filter the
workspace's existing tags, Enter or comma adds, Backspace removes the last); the same picker is in the competitor panel and the
Table's tags cell. The idea panel's "To feature" button is gone.

### D-058 · 2026-10-17 · Accepted
**A competitor's features stack behind it on the board.** Up to three plates peek out behind a competitor card. Selecting the
competitor (or one of its features) fans them out to the right as compressed cards (`FeatureChip.tsx`: name + category). Clicking
one opens the competitor panel with that feature unfolded; shift+dragging a card onto one creates an `inspired-by` link. Links to
competitor features are drawn only while fanned out.

### D-059 · 2026-10-17 · Accepted
**Links read as sentences.** Straight lines from card edge to card edge with an arrowhead at the target and the kind written at the
midpoint ("solves", "competes", "inspired by"…; "relates" stays unlabelled and faint). Line pattern by kind, neutral colour,
cyan for the selected card's links; no flowing animation.

### D-060 · 2026-10-17 · Accepted
**Opening a workspace frames everything** (all cards and labels, within zoom limits 9–150; room left for the HUD and toolbar).
Switching between views inside a workspace keeps your place. The Matrix frame fills the page height.

### D-061 · 2026-10-17 · Accepted
**Calmer board.** No double-click to create (the `+` menu is the only way; double-click still edits a text label). Cards don't lift
or scale on hover, selection or drag: the lift moved a dragged card toward the camera, so it looked bigger and dropped away from
the pointer. A dragged card now sits exactly under the pointer. In a workspace the backdrop is dimmer (14%, was 28%). Slowing it down was
tried and reverted: the user felt it slowed the card animations too; speed stays as it was.
