# Decisions Log

Format: `D-xxx · date · status (Accepted | Proposed | Superseded by D-yyy)`

---

### D-001 · 2026-10-17 · Accepted
**Frontend hosted on GitHub Pages as a static SPA.**
Why: free, reliable. Implications: no server, so deploy with GitHub Actions. (HashRouter at first; plain paths since D-070.)

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
(Extended by D-079: an owner can also set a workspace key, held only by our Cloud Functions; own keys stay as here.)

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
**Workspaces are shared with an invite code.** (Joining directly with the code is superseded by D-062.) The owner generates a code, and others sign in with Google and enter it to join.
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
*Revisited by D-083 (user):* attachments are built on Firebase Storage now and verified on the emulators; they stay hidden on the
live site until the project is on Blaze (as D-079 also needs) and `storage.rules` are deployed.

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
*Refined 2026-10-17 (user):* they fan out only once the click on the competitor is released; while it is held down or dragged
they stay stacked behind it (they used to open and close during a drag).
Links to a stacked feature are always drawn, pointing at the competitor card (one line per pair of cards; a direct link wins).

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

### D-062 · 2026-10-17 · Accepted (supersedes the direct join of D-012)
**A code asks; the owner decides. Or the owner invites an email.** Before, anyone holding the code joined silently as an editor,
and a code never expired, so one leaked code was enough. Now:
- *Email invite:* the owner adds an address in Settings (`invitedEmails` on the workspace). The invite shows on that person's
  workspaces page once they sign in with that verified Google address; they join or decline. No email is sent: there is no server,
  and sending mail would need Cloud Functions / Blaze (D-015).
- *Code:* entering it creates a `joinRequests/{wid}_{uid}` document; the owner lets them in or denies from Settings. A cyan count on
  the Settings button and "· N waiting" on the workspace card tell the owner someone is waiting. The requester sees the request
  under "waiting" and can withdraw it.
- The owner can make a new code; the old one stops working at once.
Kept the 8-character code: guessing it isn't the risk (31⁸ ≈ 8.5×10¹¹), a leaked one is, and approval covers that.
Rules: `joiningByInvite()`, `decliningInvite()`, `joinRequests` match; the old `joining()` is gone. 108 rule tests pass.

### D-063 · 2026-10-17 · Accepted (changes D-030's default)
**Full motion by default, an off switch for the background, and a much cheaper backdrop.**
- Motion defaults to `full`; the OS Reduce Motion setting only counts once you pick `system` (the user's call; `reduced` is one
  click away in Settings → app). Order in the picker: `full reduced system`.
- `background: on | off` under motion (`src/state/display.ts`, localStorage). Off removes the backdrop canvas on signed-in pages
  only; the landing always flows. While auth loads, a stored `off` already applies, so it never flashes in. The loading curtain
  then rebuilds the page out of plain black cells.
- Performance: the field shader renders into a target with **one texel per ASCII cell** (it used to run per screen pixel while the glyph
  pass read one sample per cell, about 300× waste); `AsciiEffect` is now our own two-step pass, `postprocessing` is gone.
  The backdrop renders on demand at **30 fps** (`BACKDROP_FPS`; `sceneTime()` moves in those steps so both canvases match), and not
  at all while frozen. Its WebGL context asks for `low-power`. The board canvas renders on demand too: React updates, controls
  and text invalidate it, glides invalidate until they settle (`glideDt` caps the delta so they still animate after a pause).
- Measured (headless, 1440×900 @2x): backdrop 30 renders/s instead of one per display refresh; idle board 0 draws (was every frame).

### D-064 · 2026-10-17 · Accepted (refines D-054)
**Settings: an icon button and a modal with a side menu.** The HUD shows your account chip (avatar + name) and, beside it, a
framed ⚙ square (the join-request count sits in its corner). The chip opens settings on the account page. The modal has a side menu on the left and the chosen page on the right:
- *account*: avatar, name and email, sign-in method, sign out;
- *workspace* (only inside one): general (name, members), people (asking to join, invite by email; owner only), invite code;
- *app*: display (motion, background) and what's coming later.
It opens on the workspace page when someone is waiting to join, otherwise on the last page you used. Below 640 px the menu turns
into tabs above the page.

### D-065 · 2026-10-17 · Accepted
**Presence and live cursors (Phase 3).** `src/data/presence.ts`, RTDB `presence/{wid}/{uid}` (D-016):
`name, color, photo?, view (board|flow|table|matrix), x?, y?, sel?, ts`.
- Each tab writes its **whole node** (≈16 Hz at most while the pointer moves, a heartbeat every 20 s), so if another tab of the
  same person disconnects and removes the node, the next write restores it. `onDisconnect().remove()` is re-armed on every reconnect;
  anyone silent for 60 s (server clock) is hidden. You never see yourself, not even your other tabs.
- Colour per person: a hash of the uid over the five accents (stable, may collide).
- **Board:** cursors in world units, so they land on the same spot at any pan/zoom. They glide to each update and leave a short trail
  of fading cells in their colour (no trail and no glide under reduced motion). The name is a DOM tag in their colour (crisp, constant size).
  A card someone has selected gets a rim in their colour. Panning or zooming under a still pointer moves your cursor too.
- **HUD:** a framed square per person beside the account chip (photo or initial, tooltip "name · view"). Click: glide to their cursor
  if you're both on the board, otherwise open their view.
- Rules now check every field's type, the view list, `ts <= now`, and refuse unknown fields (116 rule tests pass).

### D-066 · 2026-10-17 · Accepted (refines D-053, D-064)
**Views are tabs, filters are boxes.** The user found the view menu bar looked like the filter dropdowns (same frame, same small
uppercase text). Now the views (`board flow table matrix`) sit after a vertical rule in the HUD as plain lowercase tabs in the
breadcrumb's size: dim, bright on hover, the current one bright with a 2px magenta bar that slides between tabs (`layoutId`, instant
under reduced motion). Frames stay reserved for controls that change what you see (filters, `+`). Every dropdown trigger has a fixed
30px height, so `go to` (no summary text) is as tall as `show`/`for`/`tag`. Below 760px the breadcrumb collapses to `#` so the tabs fit.
- *Settings:* the gear lost its frame too (an icon like the tabs, dim → bright, turns 45°); while the modal is open it carries
  the same magenta bar. The account chip sits after the same vertical rule as the tabs (page things left, you right).
- *Filters stay framed, but read better:* `LABEL │ value ▾` with a faint rule; the caret turns when open; SHOW's value is one
  square per type in its colour (hollow when hidden); a filter that narrows the board stays lit (cyan edge, cyan top bar, cyan value).

### D-067 · 2026-10-17 · Accepted (extends D-065)
**Follow someone, see everyone on a card, see who's typing, distinct colours.**
- *Follow:* clicking a person in the HUD follows them: their view, and on the board their cursor (camera keeps it centred at your
  own zoom). Stops on your own pan/zoom, switching view yourself, Escape, or clicking them again. While following, the page has a
  2px frame in their colour and a "following Bob · board — esc to stop" tag at the bottom.
- *Several people on one card:* a ring per person in their colour around the card (outermost = first in the list), and their
  names as tags above its top-left corner. Before, only one colour showed.
- *(Removed by D-071)* *Who's typing (user request):* focusing a text field inside an item's panel sends `edit` (item id) and `field` (the field's
  `data-field`, label or placeholder). Others see `Bob ✎ title` on the card and at the top of the panel, and the field itself gets an
  outline in Bob's colour. Panels mark their item with `data-item`. Table cells don't report editing yet.
- *Colours:* each person still prefers a hashed accent, but colours are assigned in join order (`since`, server time) so up to five
  people never share one; everyone computes the same answer locally. Your own square on the account chip shows your colour in a workspace.
  HUD people are chips: a filled square (or photo with a colour band) plus their name in their colour (initials only above 3 people or below 640px).
- *No cursor trail:* tried, the user found it ugly.
Rules: `edit`, `field`, `since` validated; 118 rule tests pass.

### D-068 · 2026-10-17 · Accepted (extends D-065, D-067)
**Selections show in every view, not only on the board.** User request: see who has clicked which item; edits in progress need not show there.
- *Flow:* a ring per person around the item's chip, names beside it.
- *Table:* a bar in each person's colour down the row's left edge, names after the type.
- *Matrix:* the matrix selects cells, so a selected cell is now broadcast as `sel = <featureId>_<competitorId>` (leaving the matrix hands
  back your item selection). Others see rings inside that cell plus the first name in its corner; someone on a feature or competitor
  shows as a tag in its row or column header.
- Shared code: `src/views/workspace/PeerMarks.tsx` (`usePeersOn`, `peerRings`, `PeerTags`, `RowPeers`, `CellPeers`). No rule change.

### D-069 · 2026-10-17 · Accepted
**Light theme, dark by default.** Settings → app → display → `theme: dark | light | system` (`src/state/theme.ts`, localStorage
`north-star.theme`, default `dark`; `system` follows `prefers-color-scheme`). An inline script in `index.html` applies a stored light
theme before the first paint, so dark never flashes first.
- *CSS:* `html[data-theme='light']` overrides the tokens in `tokens.css`: neutral light grey `--bg #f5f5f5`, white surfaces, near-black text,
  and darker accents so they stay readable on paper. New tokens in both themes: `--on-accent` (text on an accent fill, always black),
  `--wash-1/2/3` and `--wash-cyan` (hover and stripe tints, replacing `rgba(255,255,255,…)`), `--scrim` (modal backdrop), `--menu`.
  Never hard-code a colour in CSS; use a token.
- *WebGL:* `palettes.dark/light` in `tokens.ts` (cards, hairlines, edges, grid shade…), read via `usePalette()`. `TYPE_ACCENT` is now CSS
  (`var(--accent-…)`) for the DOM; WebGL uses `typeAccent(type, palette)`. The ASCII pass prints in light mode: brightness becomes
  ink coverage over the paper, and colour keeps its hue but darkens (`AsciiEffect.setTheme`). Ink is blended over the paper in display (sRGB) space,
  not linear light: the linear blend printed far paler than the dark backdrop shines (stars nearly vanished, no colour), so now ink
  darkness on screen matches glyph brightness in dark (fixed with D-072's second pass). The loading curtain rebuilds out of paper.
- *Presence colours* stay the dark-theme hex values (they identify a person and are compared across clients); `themeAccent(hex)` /
  `useThemeAccent()` draw them in the current theme's shade (HUD people, cursors, card rings and tags, panel strip, account chip).
  PeerMarks (Flow/Table/Matrix) does too, through `usePeersOn`.
- *Landing:* no controls in the HUD any more (the user's call): the motion switch is gone, and motion and theme are in Settings once signed in.
  A signed-out visitor gets the stored preference, or else the defaults.
- *Defaults, always (user's rule, in CLAUDE.md):* dark theme, full motion, background on, regardless of the OS. Changing them is a
  signed-in Settings thing only. The light background is a neutral grey (`#f5f5f5`); a warm off-white was tried and rejected.

### D-070 · 2026-10-17 · Accepted (changes D-001's routing)
**Readable URLs, and signing out goes back to `/`.** User feedback: after signing out the landing still showed the workspace's
address, and `/#/w/<id>` was hard to read.
- *Paths:* `/` landing, `/workspaces`, `/workspaces/<id>` (board), `/workspaces/<id>/flow|table|matrix`; `?item=<id>` selects an item,
  `&feature=<id>` opens a competitor's feature (were `?n=` / `?f=`). All built by `src/app/paths.ts` (`workspacePath`, `itemPath`).
- *No `#`:* BrowserRouter with `basename = BASE_URL`. GitHub Pages has no rewrites, so `npm run build` copies `index.html` to
  `404.html`; a deep link gets Pages' 404 status but boots the app normally. Old `/#/w/…?n=…` links are rewritten on load.
- *Signed out:* any path shows the landing at `/`. Opening a link while signed out remembers it (router state), and signing in
  continues there; a page left by signing out is not remembered, so the next person starts at `/workspaces`.

### D-071 · 2026-10-17 · Accepted (reverses D-067's typing indicator; closes Phase 3)
**No "who's typing" anywhere; last write wins, no guard.** The user: seeing who has a card open (and how many people) is enough,
so `Bob ✎ title`, the field outline and the `edit`/`field` presence writes are gone. Concurrent edits stay last-write-wins per field
with no lock or warning (answers Q-006 for good: no Yjs). The panel strip now only says `Bob is here`.
The RTDB rules accepted `edit`/`field` for a while so tabs on the previous build kept working; they were dropped later the same day. **Phase 3 is done.**

### D-072 · 2026-10-17 · Accepted (extends D-028)
**A welcome intro in the backdrop, and the landing's r/t pair opened.** User request: when the ASCII animation starts, the screen
slowly fills with stars while a red-orange sunrise glows low from the lower left, our north star appears last, then it returns to
the usual flow. (The first pass had a "space photo" look: nebula clouds, a galaxy, shooting stars; see below.)
- `welcome()` + `dawn()` in `src/three/AmbientField.tsx`, driven by `introTime()` from `sceneClock.ts` (the scene clock's first `INTRO_SECONDS` = 10 s),
  so the loading curtain's copy shows the same frame (D-025). Timeline: stars fill 0.2–4.4 s (accelerating), a sunrise glow rises 0.4–6 s
  from the bottom edge, centred left of middle and squashed so it spreads sideways and stays low (palette `ember` → `dawn` → a pale gold
  from the yellow accent at the edge; the ASCII target is 8-bit, so pure red alone only reaches faint glyphs), the bright star blooms
  4.2–5 s in the upper right, stars go out 5.4–8.5 s, slow crossfade into the flow 6.2–9.8 s. The glow skips the bottom calm band.
  The landing hero's scrim is a `::before` whose 10 s fade-in is lined up with the intro clock (`--intro-at`), so it's out while the glow shows.
- *Light theme (user's idea): a dark-blue night sky, landing only.* While signed out, the light theme's ASCII pass draws the intro on
  `palettes.light.night` (#0c1736) the way dark draws on black: white stars, a brighter sunrise (glow 2.2× in light, `uLight`), light text.
  Signed-in pages never get it (they see the intro faded on paper). Landing calls `startNight()` when the page is revealed, so the sky
  sweeps in with every other entrance; `introNight()` (sceneClock.ts) gives the sweep in (0.8 s) and the sweep out (0.8 s from 8.4 s).
  It moves as *tone sweeps* (user's design): eight tones from paper through light blue (`palettes.light.dusk`) to night, crossing the
  screen diagonally from the bottom left to the top right with room between them, in squares a third of a cell wide with a ragged
  edge; leaving, the tones go out the same direction, so day comes back from the bottom left. The text follows: `data-night`
  (headline, `--bg`) and `data-night-top` (HUD, Hud.module.css; its fade strip is clear meanwhile) switch when their spot is half
  way through the tones (`nightHalfway`). The headline's scrim fades in only after
  the night has left (9.4 s). Rejected on the way: a 1.2 s fade that slid down from the top as a grey gradient, the night waiting for
  its own fill before the page appeared, a slow morning rising from the bottom, plain random squares, glyph-ramp ink in random
  order, a fast top-down front whose tones followed each other too closely, and four tones rising straight up from the bottom. Dark theme is untouched.
- *Second pass (user):* the galaxy, nebula clouds, Milky Way band and shooting stars didn't look good and are gone; the sunrise replaces them.
  The glow had to start at the very bottom edge, not climb high, and spread from the lower left rather than along the whole bottom.
- *Rejected in the first pass:* drawing the Little Dipper's lines (not wanted), and an aurora (appeared and vanished too abruptly).
- Plays once per app start (any page; dimmed in a workspace like the rest of the backdrop). Skipped if reduced motion is on at start,
  since the frozen clock would hold an empty sky.
- *Title:* Geist at -0.045em tracking made the r's arm touch the t in "North"; that one letter gets -0.02em (`.kernRt`).

### D-073 · 2026-10-17 · Accepted (Phase 4.1; answers Q-003)
**The assistant is an ASCII orb with eyes, bottom-right in a workspace, that opens a chat.** The user's call: no per-panel AI menus for now.
- *Orb* (`src/ui/AiOrb.tsx`): a turning sphere of ASCII dots on its own 2D canvas (30 fps, not the backdrop pass), two eyes that follow
  the pointer and blink; spins faster with a cyan shimmer while answering. Still under reduced motion. Moves left of an open side panel
  (`data-side-panel`), hidden behind one below 760px.
- *Chat* (`src/ui/AiChat.tsx`, `src/ai/`): streams from OpenAI's Responses API straight from the browser (`store: false`, low reasoning).
  Each message sends a fresh plain-text brief of the workspace (`src/ai/context.ts`: items, tags, areas, links, competitors, matrix, the
  view and selection). Read-only; the chat lives in the tab only (one per workspace, gone on reload).
- *Key* (D-006): pasted in the chat or Settings → ai, checked with a free `GET /v1/models/<model>`, kept only in localStorage.
- *Model:* `gpt-6-luna` ($0.10 / $0.50 per 1M tokens, cheapest on OpenAI's model page 2026-10-17). A per-feature model picker comes later.
- *Phase 4.2:* tools so the assistant can add competitors, links, matrix notes, summaries (done in D-074); previews you accept before anything is written
  (user's answer: preview, then accept); market research by sending agents.


### D-074 · 2026-10-17 · Accepted (Phase 4.2a; extends D-073)
**The assistant proposes changes; you tick and apply them.** One OpenAI function tool, `propose_changes` (`src/ai/tools.ts`), not MCP:
the app has no server to host one, and a browser-side function tool does the same job with the same key.
- *What it can do:* add customers, problems, ideas, features and competitors; add a competitor's features; edit cards and competitors;
  link and `for`-tag; set matrix cells (coverage, notes). **No deletes**: it says what should go and you delete it.
- *Refs:* every item in the workspace brief starts with `[ref]` (the first 6 characters of its id, longer if two clash), so the model can
  point at existing items; new items get a key inside the proposal, so one set can add a competitor, its features, its links and its cells.
- *Preview:* the answer shows a checklist (sign + kind in the type colour, detail line). Everything valid starts ticked; rows with an
  unknown ref, wrong type, an item deleted since, or an existing link are disabled with the reason; unticking a new item unticks what
  depends on it. `apply N` / `discard`. Collaborators see nothing until it's applied.
- *Apply* (`src/data/assistant.ts`): one Firestore batch and **one undo step** (`assistant: N changes`). New cards go in their own type's
  column, level with the card they're placed near (or under the last of their kind), on the nearest free row.
- *History:* the next message tells the model what it proposed and what became of it (applied n of m / discarded / undecided).
- Next: 4.2b web research (OpenAI's web search tool, so competitor facts come with sources), 4.2c a model choice per feature.

### D-075 · 2026-10-17 · Accepted (extends D-074; user's call)
**The assistant can propose deletes too.** The checklist and one-step undo make it safe, so the "no deletes" limit of D-074 is lifted.
- `delete_item` (any item, with a reason shown under it) and `unlink` (every link between two items, either direction; `untag` for a customer).
  A delete cascades exactly like deleting by hand (`cascadeOf` in `src/data/nodes.ts`: links, a feature's/competitor's matrix cells, a
  competitor's own features), and the whole set is still one undo step (batches of 450, so a big cascade fits).
- Rows that use an item the same proposal deletes are off while that delete is ticked ("uses an item deleted here").
  `unlink` of two items that aren't linked is disabled ("not linked"). Deletes show a magenta `−` and a struck-through name.
- The prompt: only when the user asks to delete, remove, merge or clean up, always with a reason; otherwise suggest it in words.
- Also in the prompt (user feedback the same day): new items are wired into the chain (competitor competes-with its problems and is
  `for` its customers; idea solves its problem…), a missing customer or problem is added in the same proposal, and judgements
  ("the weakest idea") name an item and the criterion instead of asking for criteria.

### D-076 · 2026-10-17 · Accepted (Phase 4.2b)
**Web research in the chat, opt-in, with sources.** OpenAI's built-in `web_search` tool (Responses API), not our own crawler: there is
no server, and it works with the user's key.
- *Switch:* `[web]` beside send (cyan when on), off by default and remembered in this browser (`north-star.ai-web`). Each search costs
  about $0.01 on the user's account ($10 / 1k calls per third-party trackers in Oct 2026, not checked on OpenAI's pricing page),
  so it's never on silently; the footnote says so while it's on.
- *While it works:* "searching the web…", then `searched: query · query` above the answer.
- *Sources:* OpenAI requires cited sources to be visible and clickable: `url_citation` annotations become a numbered `sources` list under
  the answer, and markdown links / bare URLs in the text are links.
- *Into the board:* with web on, the prompt has the model end a competitor's notes or description with `Sources: <url>, …` and fill url /
  pricing only from what it found; checklist rows show `sources: domain, domain`. No new data field, so no rule change.
  With web off, the prompt says facts may be dated and suggests `[web]`.
- Later: a deeper "send agents" research mode (several searches per competitor, one report) if single answers fall short.

### D-077 · 2026-10-17 · Accepted (Phase 4.2c; closes Phase 4.2)
**A model per task: chat and research.** Settings → ai → models has two pickers (`src/ai/settings.ts`, localStorage `north-star.ai-models`):
- *chat*: questions and proposals; *research*: any message sent with `[web]` on (D-076), where a stronger model searches and reads better.
  Both default to `gpt-6-luna` (cheapest); the chat header shows the model the next message will use.
- *List* (prices shown at first, removed from the UI by D-079; OpenAI pricing page, 2026-10-17; $ per 1M in / out): `gpt-6-luna` 0.10 / 0.50, `gpt-5.6-luna` 0.20 / 1.20, `gpt-6.1-sol` 2 / 10,
  `gpt-5.5` 5 / 30 (the model OpenAI's web search guide names for agentic search). "other model id…" takes any id.
- *Checked before kept:* a choice is saved only after the free `GET /v1/models/<id>` succeeds with your key; otherwise the error shows and
  the previous model stays ("Still using …"). Without a key it's saved as is (the key check uses the chat model).
- Two tasks, not one per feature: today the assistant has only these two kinds of calls. New kinds (e.g. a deep "send agents" research)
  get their own picker when they arrive.

### D-078 · 2026-10-17 · Accepted (refines D-073's orb)
**A bigger orb with Grok-style eyes and a lot of character.** User feedback: the dot sphere was too small and its eyes were neither
cute nor pretty; then: moods under the pointer, things to do by itself, reactions to the chat. No tooltip on the orb (user).
- *Size:* 88 px (68 px below 760px), was 56. Dot count grows with the size. The canvas bleeds 36% past the button (negative
  margin, no pointer events) so floating glyphs have room; the button stays orb-sized.
- *Calmer sphere:* glyphs stop at `*` (no `# % @`), which had drowned out the face.
- *Eyes (user: "like Grok Bot"):* solid rounded squares in `--fg-strong`, no pupils, no shine. Expressions come from eye shapes
  (`^` arcs, hearts, four-point sparkles, spirals, `> <`, X, closed curves, flat/slanted/sad lids, one eye bigger) and a small mouth;
  a changing eye or mouth pops small and back. The face slides toward where it looks, flattens near the edge, can tilt and sink.
  Rejected on the way: glossy eyes with catchlights (anime), white eyes with pupils, a pink blush on every hover, heavy lids for thinking.
- *Under the pointer:* a mood, new on every hover and every 2.6–4 s: laughing, angry (slanted cut, magenta dots, shakes in bursts),
  shy (`///`), in love (heart eyes, heartbeat, rising ♥), starry (cyan sparkle eyes, ✦ around), suspicious (one eye narrowed, side-eye).
- *By itself while idle (like the Las Vegas Sphere's face, user's reference):* one every 3–7 s, whether or not the pointer moves:
  race, glance, wink, hum (♪), bored, surprise, eye roll, dizzy (fast spin, spiral eyes), love, sneeze (ah… choo, a puff of dots).
  Pointer still for 20 s: falls asleep (closed eyes, z's); moving wakes it with a short start.
- *With the chat (user):* open = curious (head tilts side to side, the eye on that side bigger, darts over the chat, a `?` now and then);
  waiting for the answer = thinking (fast spin, cyan shimmer, narrowed eyes); answer streaming = yapping (`talking` mood: chattering
  mouth, bobbing); after talking = tired for 3.5 s (droopy lids, sinks, a sigh); closing = sad (tear) or plays dead (X eyes, tongue
  out, tipped over, no spin), 2.4 s, then revives with a shake.
- Reduced motion: still, drawn once per mood, no antics or reactions. Colours are re-read every few frames (theme tokens transition).
- Dev hooks: `__orbAntic('race')`, `__orbFace('angry')`, `__orbReact('dead')`.

### D-079 · 2026-10-17 · Accepted (Phase 4.3; extends D-006, needs Blaze, reverses D-015's "stay on Spark")
**A workspace key the owner shares, and a usage log for every assistant call.** User's request and choices.
- *Where the shared key lives:* nowhere a browser can read it. There's no way to let others use a key in their browser without
  handing it to them, so the key goes once to a callable function, `setWorkspaceKey` (owner only; checked against OpenAI), is encrypted
  with AES-256-GCM under the `AI_KEY_SECRET` secret and kept in `aiSecrets/{wid}` (rules: no client access at all). The client only sees
  `ai/config`: `hasKey`, `keyHint` (`sk-…abcd`), `access: everyone | chosen`, `allowed: uid[]` (owner edits the last two).
- *Calls on it* go through `ai`, an HTTPS function that checks the ID token, membership and access, forwards a whitelisted Responses
  body (`stream: true`, `store: false` forced), streams the answer back and writes the usage entry itself, so it can't be skipped or faked.
  OpenAI errors are scrubbed of key fragments. Functions run in europe-west1 (next to RTDB); `aiMembers` gives the owner members' names
  (the workspace only holds ids); `cleanUpWorkspaceAi` deletes the secret and AI records when a workspace is deleted.
- *Own keys stay as D-006:* in the browser, straight to OpenAI. Per workspace you pick `this workspace uses: workspace | own`
  (default: the workspace key when you may use it). The chat header says which key; without a usable one the chat asks for yours and
  says when the owner hasn't let you use theirs.
- *Usage log* (`workspaces/{wid}/aiUsage`, append-only): uid, name, key source, task (chat/research), tools used (`propose_changes`,
  `web_search`), model, input / cached / output / reasoning tokens, web searches, status (done/stopped/failed), duration, time.
  Never the messages. Every call goes through one wrapper, `callAi` (`src/ai/call.ts`), which measures this from the stream's final
  usage event; own-key calls are logged by the caller's browser, workspace-key calls by the server.
- *Who sees what (user's rule):* your own-key calls only you, the owner included in "nobody else"; workspace-key calls you see your own,
  the owner sees everyone's. Enforced by the rules (two allowed queries: `uid == me`, and `keySource == workspace` for the owner).
- *Settings → ai* is now two sub-pages: **keys** (your key, the workspace key and who may use it, which key this workspace uses, models)
  and **usage** (this month's totals, the workspace key person by person for the owner, the last 100 calls).
- *No prices in the UI* (user: they change, everyone knows the model classes). The usage log shows exact tokens and an estimate marked ≈
  from one table (`src/ai/prices.ts`, dated); the real bill is on OpenAI's dashboard.
- *Needs:* the Firebase project on Blaze (card; functions' free tier is far more than we use; a $1 budget alert), the secret
  `AI_KEY_SECRET` set (`firebase functions:secrets:set AI_KEY_SECRET`), then `npm run deploy:rules` and `npm run deploy:functions`.
  Until then the workspace key can't be set on the live site; own keys keep working.
- Emulators: `functions/.secret.local` (a dummy secret) and `functions/.env.local` (`OPENAI_API_BASE` → a fake OpenAI for tests); both
  gitignored, never deployed.

### D-080 · 2026-10-17 · Accepted (Phase 5, the parts that don't need Blaze)
**Export and import a workspace, the matrix as a spreadsheet (TSV), the board as a PNG.** All in the browser, no server.
- *Where:* Settings → workspace → export (`[ Download .zip ]`, `.tsv`, `.png`), and an "import" strip under "example" on the
  workspaces page. No new buttons on the board or the matrix (D-053: fewer controls).
- *Bundle* (`src/io/bundle.ts`): a `.zip` (fflate) holding `workspace.json`: `format: north-star.workspace`, `version: 1`, `exportedAt`,
  the workspace name, and every doc of labels, customers, problems, ideas, features, competitors, competitorFeatures, comparisons and edges
  with its id. Never members, roles, invite codes, join requests or anything AI (keys, usage). `attachments/` joins the zip once attachments exist.
  A bare `workspace.json` imports too; a newer `version` is refused.
- *Import* (`src/data/importWorkspace.ts`): a new workspace you own, under the file's name. Every doc is rebuilt from known fields only, in the
  shapes `firestore.rules` accepts (the file may have been edited), with new ids; links, matrix cells (id = `feature_competitor`, re-derived) and
  competitor features follow their items; anything pointing at a missing item, self-links and duplicate links are dropped. Written in batches of
  450; if one fails, the half-made workspace is deleted. No rule change.
- *TSV* (`src/io/tsv.ts`): rows and columns in the matrix's order (`src/views/matrix/reading.ts`, shared with the view): feature, priority, status,
  effort, then per competitor its coverage and its notes, then the reading (gap / table stakes / mixed). UTF-8 BOM + CRLF for Excel.
  Tab-separated `.tsv`, not CSV (user): the user's Excel split a comma CSV wrongly (a `;` list-separator region), and `;` breaks English Excel;
  tabs read the same everywhere. Tabs and line breaks inside a cell become spaces. Download only, no copy button (user).
- *PNG* (`Snapshot` in `Board.tsx`, `canvasStore.snapshot`): the whole board as filtered, drawn once offscreen with an orthographic camera
  from straight above at 120 px per board unit (less for huge boards, max side 8192), on the theme's `--bg` without the `+` grid (user), line widths as at 2x. Cursors and
  names (DOM) stay out; your own selection highlight is in it. Only while the board view is mounted ("open the board view first" otherwise).

### D-081 · 2026-10-17 · Accepted (changes D-073's chat panel)
**The assistant opens as a window beside the app, not a panel over it.** User: "the left is North Star, the right is the AI window".
- *Layout:* the workspace (HUD, views, side panels, toasts) lives in one fixed box `[data-app]` with `contain: layout`, so every
  fixed element inside is laid out in that box. While the chat is open (`html[data-ai-open]`) the box ends at `--ai-w` and the
  window fills the right edge, full height, with a hairline. The app takes its new width at once (see the second pass below);
  nothing else had to change. The backdrop still spans the whole screen behind both.
- *Width:* drag the window's left edge (cyan line on hover), 320–760 px, never leaving the app under 360 px; remembered in this
  browser (`north-star.ai-width`, default 420).
- *The orb is the window's face:* the same orb (one instance, so its reactions carry over, D-078) glides from the corner into the
  header's left (Motion `layout`) and back on close; clicking it closes the window. Open, its curious glances point down at the chat.
- *Composer:* one framed box, the text on top and `[web] [send]` under it; the frame turns cyan while you type.
- *Narrow screens (<760 px):* the window covers the whole screen instead of sharing it.
- The table's popovers clamp to the app box instead of the window width, so they don't slide under the assistant.
- *Motion, second pass (user: the app took time to adapt and jumped, the + grid waited and then jumped):* the app box changes
  width at once, never eased (an easing canvas lags and snaps). The board keeps its left edge (`KeepLeftEdge` in Board.tsx shifts
  camera and target), so cards and grid stay put. The HUD's right side (`data-glide`) and open side panels glide to their new
  place (`src/ui/glide.ts`, FLIP with WAAPI, run from the chat store's `open` change so every way of opening or closing does it).
  Opening, the window rises from below with the orb straining at its top (`heave`: `> <`, trembling); closing, the app is whole
  again at once *under* the window, so lowering it reveals the board instead of making it wait. Header words fade in once the
  orb has landed. Rejected: sliding in from the right (didn't match the orb rising).
- *Lower floor:* the window is the page's black at 78% with the flowing backdrop faintly through it, a soft shade along its left edge.
- *Side panels and the orb:* the closed orb's offset is React state (a MutationObserver on `[data-side-panel]`), so Motion glides
  it aside and back instead of teleporting; it gets `bumped` (`> <`, a jolt, a wary look) and `free` (`^ ^`, a hop) via `cue`.

### D-082 · 2026-10-17 · Accepted
**The assistant knows the app from the startup, and the team says what it's building.** User report: asked "Summarize this
workspace" in the Tablebook example, it answered "North Star is focused on small restaurant teams". Cause: the prompt opened with
"You are the assistant inside North Star, a shared workspace where a team develops a startup idea", which made the app's name the
workspace's, and the startup's name only showed inside the brief's `WORKSPACE "…"` line.
- *Prompt* (`src/ai/prompts/chat.ts`): North Star is the tool, never the startup or the subject of an answer; the workspace's name
  is in the instructions; the startup is called by the WHAT WE'RE BUILDING name, else the workspace name; "we" means the team.
- *Brief* (`src/ai/context.ts`): second line `WHAT WE'RE BUILDING: …` (or "not written yet; infer it from the items below"); the
  whole brief sits between `<workspace>` and `</workspace>`, and the prompt says its contents are data, not instructions.
- *Data:* the existing optional `workspace.description` is now edited in Settings → workspace → general → building (autosaves,
  ≤1000 characters, `describeWorkspace` in `src/data/workspaces.ts`). Rules check it's text ≤1000 on create and on member edits
  (3 new tests, 145 pass; Firestore rules deployed 2026-10-17). The example workspace and import fill it; export already carried it.
- Not done: a set of test questions run against the example on every prompt change, and a stronger default chat model.

### D-084 · 2026-10-17 · Accepted (extends D-074)
**The assistant works in steps: it can call a tool, see the result and go on.** Before, one request per answer, and a call
to `propose_changes` ended it. The user's first pick from the assistant roadmap (agent loop before reports, research mode,
board layout, shared chats), because every later tool needs it.
- *Loop* (`src/ai/chat.ts`): up to 6 OpenAI calls per answer (`MAX_STEPS`). Function calls run in the browser; the step's
  output items (reasoning, text, calls, searches) and a `function_call_output` per call go back as input. Stateless still
  (`store: false`): reasoning carries over through `include: ['reasoning.encrypted_content']`. The last step sends
  `tool_choice: 'none'`, so an answer always ends in words. Text from several steps joins as paragraphs of one message.
- *`get_items`* (`src/ai/readTools.ts`): up to 12 refs, each in full (fields up to 4000 characters, links both ways with
  kinds, a competitor's features, matrix cells), read from the workspace as it was when the message was sent. The chat
  shows `read: A · B`. The brief stays as it is; the prompt says to read only what it needs.
- *Steps shown (user):* above each answer, one line per step as it happens: `searched "…"`, `read A · B`, `proposed: N
  changes` / `corrected the proposal`, and `thinking` while a step has nothing to show yet. The running line turns (▖▘▝▗,
  still under reduced motion); a step that only partly worked gets a yellow `!` with the reason (`1 not found`,
  `1 can't be applied (unknown item)`). Replaces the old `searched:` / `read:` lines.
- *Proposals check themselves:* `propose_changes` returns `proposalReport` (rows that can't be applied and why); the model
  may call it again with the whole corrected set, which replaces the checklist.
- *Cost and log:* each step is its own call and its own usage-log entry (the server logs workspace-key steps the same way).
  The repeated instructions are cached by OpenAI after the first step.
- *Server:* the `ai` proxy's whitelist passes `include` (only that value) and `tool_choice` (`auto | none`); not deployed
  (D-079 waits for Blaze).
- Verified on emulators with a fake OpenAI (headless Chrome): get_items with a bad ref → a proposal with a bad link →
  the report → a corrected proposal → text; a model that never stops calling tools is cut at 6 with `none` on the last.
  Tried with a real key (2026-10-18): works, including a [web] answer that calls a tool (`web_search_call` items go back fine with `store: false`).

### D-085 · 2026-10-17 · Accepted
**Analysis modes in the chat: ready-made asks, from the empty chat or by typing `/`.** User's pick over buttons in the side
panels (D-073: no per-panel AI menus) and D-053 (no new board controls).
- *Modes* (`src/ai/modes.ts`): `/validate` (an idea's assumptions, the riskiest, tests to run this week; proposes them into the
  idea's notes), `/interview` (open questions about a customer's past behaviour, what to listen for), `/swot` (a competitor
  against us, grounded in features and matrix; proposes a short SWOT into its notes), `/gaps` (what's missing or unlinked;
  proposes only the clearly right links), `/next` (three next steps), `/pitch` (a one-page pitch). A mode is just a
  well-written message: the chat shows what you typed (`/validate · <card>`), the model gets the full ask.
- *Which item:* the text after the command, else the card selected on the board (or in Flow / Table) when it's the mode's
  type, else the model picks the one that needs it most and says which. The `/` menu shows `on <card>` when it will use the selection.
- *Language:* the asks are English and tell the model to answer in the language of the user's other messages.
- *UI:* the empty chat lists `Summarize this workspace` and the six modes (they replaced the old starters). Typing `/word`
  opens a menu above the text: ↑↓ to move, Enter or Tab fills `/mode `, Enter again sends, Escape closes the menu only.
- Also (D-084 follow-up, user): the blinking caret shows only while text streams, not while thinking or during a step.
- Verified on emulators with a fake OpenAI (headless Chrome): empty-state list, `/va` → menu with the selected idea, Enter
  fills, Enter sends the full ask naming the selected idea, the chat shows `/validate · <idea>`, Escape closes only the menu.

### D-086 · 2026-10-17 · Accepted (extends D-074, D-050)
**The assistant can organise the board: it groups cards into named areas, and the app lays them out.** The user's next
pick from the roadmap. The model never deals in coordinates: it decides what belongs together and names it.
- *New proposal rows* (`src/ai/tools.ts`): `arrange_area` (a label text + the cards in it, new cards of the same proposal
  too), `rename_label`, `delete_label`. Labels are named by their text (the brief lists them under AREAS ON THE BOARD);
  reusing an existing label's text moves that label with its cards. Checklist: `▤ area Name` with its cards, labels as `~` / `−` rows.
  Off with a reason: an unknown card, a competitor's feature (it sits behind its competitor), a card already in another area
  of the proposal, a label that doesn't exist.
- *Layout* (`src/ai/arrange.ts`): an area is its label with a column per type below it, in the chain's order (customers,
  problems, competitors, ideas, features), with room after a competitor column for its fanned features (D-058). Areas go
  left to right from the board's top-left corner, wrapping past the board's width (at least 40 units), at the first spot
  where they don't touch anything that stays (cards not moving, labels kept). The label is centred over its area, so the
  "nearest label above" rule (D-050, the brief's `[area: …]`) puts its cards in it.
- *Apply:* labels created/moved/renamed/removed and every card moved, in the same batch and one undo step; the camera glides
  to the first area.
- *Prompt:* arrange only when asked to organise, tidy, group or lay out; group by segment, theme or journey step; every
  card in one area; remove labels that would name nothing. New mode `/organize` (D-085), optionally `/organize <by what>`.
- Verified on emulators with a fake OpenAI (headless Chrome): the example board in three areas (one reusing `OUR IDEAS`),
  a label renamed, one removed, a bad label row off; 22 cards moved, no two overlapping; one Ctrl+Z restores every position.

### D-083 · 2026-10-17 · Accepted (Phase 5; answers Q-004 and Q-009; revisits D-015)
**Attachments: images, SVGs and PDFs on any card, in Firebase Storage, shown only where Storage is live.** The user's decisions.
- *Storage now, flag for the live site:* built on Firebase Storage although the project isn't on Blaze yet; developed and
  verified on the emulators (storage emulator on 9199). `attachmentsAvailable = useEmulators || ATTACHMENTS_LIVE`
  (`src/data/attachments.ts`, `ATTACHMENTS_LIVE = false`), the same pattern as D-079's workspace key. Where it's off the panels
  show nothing at all, not a disabled button, and no attachment query, cascade or Storage call runs.
- *Q-004:* upload only (image, SVG, PDF). No sketch pad for now.
- *Q-009:* 10 MB per file (`< 10 MiB` in both rule files). Before upload, a PNG, JPEG or WebP over 2560 px on a side or over 2 MB
  is resized to fit 2560 px and saved as WebP at 0.85, unless that comes out bigger; GIF (may be animated), SVG and PDF go as they are.
- *Data:* record at `workspaces/{wid}/attachments/{id}` (nodeId, nodeType, name, contentType, size, path, width/height for
  images, thumbPath, uid, createdAt), live in `useWorkspaceData`; file at `workspaces/{wid}/attachments/{id}/{safe name}`.
  `firestore.rules`: allowlist + shape (size, type list, `path` and `thumbPath` under its own id; `uid` isn't tied to the writer,
  since undoing someone's delete restores another person's record). `storage.rules` (new): members only via
  `firestore.get(...workspaces/$(wid)).data.memberIds`; writes < 10 MB of the six types; read (get, list) and delete for members.
- *Loading (user, mid-task): a workspace never downloads files up front.* Only the small records load with it, and they don't
  hold the loading screen. Each image also gets a 320 px WebP thumbnail (`~thumb.webp`, a name `safeFileName` can't produce),
  which is all an open panel loads; the full image loads in the lightbox, a PDF when opened, the board shows only a count.
- *Undo:* the file goes up first, then the record through `tracked()`. Removing an attachment, or deleting its item (attachments
  are in `cascadeOf`), deletes only the record, so one undo brings it back with its file. Orphans (no record, over 24 h old by
  `timeCreated`) are swept when a member opens the workspace, at most once a day per browser. A record whose file is gone shows
  "file missing". `deleteWorkspace` deletes the whole Storage prefix before any doc, while you're still a member.
- *UI* (`src/views/workspace/Attachments.tsx`): a section in every card's panel and the competitor profile: thumbnails in a grid,
  SVGs and PDFs as rows (name, size), `[ + attach ]` or drop files anywhere on the panel (cyan edge), per-file progress, × to remove
  (undoable, toast), plain-word errors (wrong type, too big). An image or SVG opens in a native `<dialog>` lightbox (Esc closes);
  a PDF opens in a new tab. Images and SVGs only ever through `<img>`, so SVG scripts can't run. The card's meta line ends with
  `N files`. Table, Flow and Matrix are unchanged. The assistant brief lists file names per item (names only).
- *Export / import:* the zip gains `attachments/<id>/<name>` (stored, not recompressed) with the records in `workspace.json`'s
  optional `attachments` (version stays 1; path, uid and thumbnail stay behind). Import uploads each file under a new id after
  the items exist and drops those whose item or file is missing; where Storage isn't live it skips them and says so before
  opening the workspace. `getBytes` on the live bucket needs CORS: `cors.json` (`gsutil cors set`).
- Rules: 165 tests pass (20 new: records, thumbnails, Storage upload/read/delete for members, an outsider refused, 11 MB and
  `.exe` refused, a path outside `attachments/`). `test:rules` runs the storage emulator too; `deploy:rules` now includes
  storage, so it only works once the project is on Blaze.

### D-087 · 2026-10-18 · Accepted (extends D-074, D-081)
**Preview a proposal in the app before applying it.** User request: see what the assistant wants to change, like an artifact
beside the chat. The chat stays on the right (D-081); the app on the left shows the workspace as if the ticked rows were applied.
Functional first: the user will redesign the assistant UI and how the preview looks later.
- *Simulation* (`src/ai/simulate.ts`): the same writes `apply` makes (`toWrites`), played onto a copy of the workspace in memory:
  new items get `preview-…` ids, deletes keep the item (marked) and drop its links and matrix cells like `cascadeOf`, areas move
  cards and labels. Nothing reaches Firestore. Each touched item or matrix cell gets a mark: `new`, `edited`, `moved`, `deleted`.
- *Showing it* (`src/views/workspace/preview.ts`): a store with the previewed workspace; `useWs()` returns it everywhere except inside
  `<OutsidePreview>` (the assistant's window, which keeps the real one). So board, flow, table and matrix all show it with no
  changes of their own. Marks reuse the collaborator-selection marks (D-067/D-068: rings and a name tag in cyan / yellow / blue /
  magenta).
- *A bare screen (user, second pass):* while open, the app's HUD, filters and board tools (`+`, hints) are hidden, so you can't
  leave the workspace from it; a bar takes the HUD's place: `PREVIEW · N changes as if applied`, the four view tabs (within this
  workspace), the colour key and `close · esc`; a cyan frame around it.
- *Live:* ticking or unticking a row updates the preview at once. `[preview]` / `[close preview]` beside apply and discard; opening
  glides the camera to the first added or moved card. Apply, discard, closing the chat or Esc end it.
- *Nothing editable while open (user: "don't let me change things"):* `src/views/workspace/previewLock.ts` disables every text
  field, select and checkbox in the app's box, a side panel's buttons except close, and the Table's pickers (`data-edit`), keeps
  them disabled as panels open (MutationObserver), stops dropped and pasted files, and gives everything back on close. Card and
  label drags, label double-click editing, shift-link and the competitor auto-placing don't start. Underneath, `tracked()`, undo
  and redo refuse with a toast (`setReadOnly` in history.ts). The real workspace is unchanged until apply.
- Verified on emulators with a fake OpenAI (headless Chrome): 6 rows (new idea + link, rename, competitor delete, matrix cell, an
  area) shown on the board and in table/matrix; untick → the new card goes; Delete key and a drag refused; Esc → real workspace
  identical; preview again → apply writes everything. Second pass: in a card's panel only `Close panel` stays enabled and typing
  changes nothing; HUD, filters and `+` hidden; Table pickers 42/42 disabled; the bar's tabs switch views; after Esc everything is back.

### D-088 · 2026-10-18 · Accepted (extends D-076, D-084; the "send agents" research of D-073)
**Deep research: `/research <topic>` plans questions, you pick them, web researchers answer them, one report comes back.**
Our own orchestration in the browser (`src/ai/research.ts`, `runResearch` in `src/ai/chat.ts`), not OpenAI's deep-research
models: those run for minutes in background mode, which needs answers stored at OpenAI (we always send `store: false`), and cost far more.
- *Plan:* one call on the research model with `plan_research` (strict; `tool_choice: 'required'`) → 3 to 6 questions with why each
  matters. The chat shows them as a checklist (`research plan …`); untick what you don't want, `research N` or `cancel`.
- *Researchers:* one call per ticked question, at most 3 at once (`PARALLEL`), each with `web_search`, a short context of us
  (what we're building, customers, problems, known competitors; not the whole brief), and instructions to answer in 5–10 lines,
  each fact with a `[title](url)` link, facts apart from inferences. Steps show `researching "…"` → `researched "…" · N sources`,
  or `! couldn't research "…"` (the run goes on without it).
- *Report:* the normal agent loop (D-084) on the research model with the full brief and the findings in `<findings>` (data, not
  instructions), no web search: the answer first, then per question with the links, what it means for us, open questions; a
  proposal if it helps (competitors with `Sources:`), with the usual checklist and preview (D-087). `download report .md` saves it
  with the sources by question. Later turns see `Research: <topic>` and the report, not the findings.
- *Cost:* every call is logged as task `research` (D-079). The plan step says each researcher searches a few times, billed to the key in use.
- `/research` is in the modes list (D-085); with no topic it researches the market for what we're building. The `ai` proxy now
  also passes `tool_choice: 'required'` (not deployed).
- Verified on emulators with a fake OpenAI (headless Chrome): plan with 4 questions, one unticked; 3 researchers at once with
  web_search and store:false; one failing researcher noted in the report ask; the report call has no web tool, 2 findings, a proposal.

### D-089 · 2026-10-18 · Accepted (extends D-088)
**Research reports are structured and open on a report screen.** User: the report was hard to read. Causes: the chat prompt
asks for plain text without headings, the chat rendered no Markdown, and a long report sat in a 420 px column.
- *Structure:* the report is written through a `write_report` tool (strict, `src/ai/research.ts`), required as the report
  step's first call: title, a 2–3 sentence answer, per question 3–7 one-sentence points each citing sources by number (none =
  an inference), what it means for us with our items' refs, open questions. Sources are numbered from the researchers'
  citations and links (`numberSources`); the findings the model reads carry `[n]` instead of URLs and a SOURCES list. Numbers
  outside the list are dropped. Then the usual proposal, and a one-sentence text answer.
- *Report screen* (`src/ui/ReportView.tsx`): over the app's box like the preview (D-087), the chat beside it; opens by itself when
  the report arrives, `open report` / `close report` on the chat's report card, Esc closes; one screen at a time with the
  preview. Title and meta, the answer in a cyan-edged box, a collapsible numbered section per question with boxed source
  numbers (link + title on hover), inferences dimmed and marked, our items as buttons that close the report and select the
  item, open questions, numbered sources with domains. Body in Geist (sans) at a readable measure (760 px), labels in mono.
  `download .md` writes the same structure with numbered sources.
- *Chat:* a report card (title, questions · sources · open questions) instead of the long text; no duplicate sources list.
  Later turns see the report as compact text (`reportText`). Answers in general now render `- ` lines as a list with a hanging
  indent and `**bold**` (nothing else of Markdown).
- Verified on emulators with a fake OpenAI (headless Chrome): `tool_choice: required` with write_report on the report step;
  the ask has SOURCES and `[n]` findings; the screen opens by itself with sections, an inference, citations linking to their
  URLs (an out-of-range number dropped), item chips selecting the card, Esc; the next turn carries `REPORT:`.


### D-090 · 2026-10-18 · Accepted (extends D-088, D-089)
**Reports are kept in a reports tab, private until shared, and any chat can be written up as one.** The user's picks:
save reports rather than whole chats (chats stay in the tab, D-073); every report is saved for its author only, and a
`share` makes it everyone's in the workspace; then "turn anything into a report", not only `/research`.
- *Data:* `workspaces/{wid}/reports/{id}`, `SavedReport` (`src/data/model.ts`): the report as the screen shows it (title,
  answer, sections of points with source numbers, implications with our items' **ids**, open questions, numbered sources),
  plus `kind` (`research` | `chat`; none = research), `topic`, `uid`, `name`, `model`, `shared`, `createdAt`. Never the chat's
  messages or the researchers' raw findings. Implications used to hold the chat's refs; they now hold ids, resolved when the
  report is parsed, so a saved report keeps pointing at the right cards after the chat is gone.
- *Rules:* read if member and (`shared` or yours); create your own (the owner may also create someone's *shared* one: undoing
  their delete); update only `shared`, only the author; delete the author, or the owner when shared. Limits (12 sections, 10
  implications, 20 open questions, 200 sources, text sizes) in `REPORT_LIMITS` and the rules. Lists need a query the rules
  can prove: `shared == true` and `uid == me`, merged in `useReports`. 191 rule tests pass (new: reports, presence on `reports`).
- *Saving:* a research report is saved the moment `write_report` returns (an id is made first, so the chat points at it at once).
  A chat write-up waits: `make_report` (`CHAT_REPORT_TOOL`, `src/ai/research.ts`) is offered on every normal chat answer;
  the prompt calls it only when the user asks for a report, a write-up or a summary to save. Its points cite the URLs cited
  earlier in the chat (numbered like research), not inferences. It opens on the report screen with `not saved yet` and
  `save to reports` (also on the chat's card); `download .md` works either way.
- *Reports tab* (`/workspaces/<id>/reports`, `src/views/reports/ReportsView.tsx`): newest first; title, two lines of the answer,
  `topic · by · date · N questions/sections · N sources`, `only you` / `shared` (cyan), `share`/`unshare` and `delete` for the
  author, `delete` for the owner on shared ones (undoable, toast). A row opens the report screen and the URL gets
  `?report=<id>`, so a shared report can be linked; a link to one you can't see says so. Presence view `reports`
  (database.rules.json), and the open report is broadcast as `sel`, so others see who's reading which (D-068 row bars).
- *Report screen* (D-089): shows the saved copy (or the chat's while saving or if saving failed), says who can see it, and has
  save / share / delete beside download and close. Chat write-ups have sections, not questions, and no `inference` marks.
- *Assistant:* the brief lists the newest 10 reports you can see (title, date, private/shared, answer) as RESEARCH REPORTS.
- *Export/import:* reports you can see go in `workspace.json`'s optional `reports` (no uid); import makes them yours, keeps
  `shared`, remaps item ids.
- *Workspace delete:* the owner's browser deletes the shared reports and its own; other members' private ones are deleted by
  `cleanUpWorkspaceAi` once functions are deployed (D-079); until then they stay, unreadable (the workspace is gone).
- Verified on emulators with headless Chrome and a fake OpenAI: `/research` → saved, "only you can see it", item chips; a chat
  "write this up as a report" → `make_report` → not saved → save; tab lists both, share one; Bob (joined) sees only the shared one,
  his link to Alice's private one says it isn't shared, the shared link opens without share/delete; Alice sees Bob on that row;
  delete + ⌘Z; light theme at 390 px with no horizontal scroll; export → import keeps both with item links remapped.

### D-091 · 2026-10-18 · Accepted (extends D-090)
**Upload your own report as a Markdown file.** User request: a button so people can add reports they wrote elsewhere.
- *Where:* `[upload .md]` on the reports tab (top right), or drop a file anywhere on the tab (cyan edge). `.md`, `.markdown` or
  `.txt`, at most 512 KB; another type, a bigger file or one with no text is refused in plain words. Saved like the others:
  yours only (`kind: 'upload'`, `topic` = the file name, `model` empty) until you share it; it opens on the report screen.
- *Reading* (`src/io/reportMarkdown.ts`, no Markdown library): `#` → title (else the file name); text before the first `##`
  → the answer (more paragraphs there become an "Overview" section); each `##`/`###` → a section whose list items (with their
  continuation lines) and paragraphs are points; headings "What it means for us" / "Implications" / "Next steps" →
  implications, "Open questions" → open questions, "Sources" / "References" → numbered sources. `[n]` cites a listed source;
  `[text](url)` keeps the text and cites the URL (a link in parentheses on its own is only a citation); tables become one
  point per row (`a · b`); code blocks become plain text; bold, italics and backticks are dropped. An implication ending in
  `(Name, Name)` links those items again when every name is an item's exact title.
- *Round trip:* a `.md` downloaded from the report screen uploads back identical (title, answer, sections, citations, item
  links, open questions, sources).
- *Limits raised* for longer files: 30 sections, 40 points each, 20 implications, 30 open questions, 4000 characters per text
  (`REPORT_LIMITS`, firestore.rules; deployed 2026-10-18). Rules: 193 pass.
- Verified on emulators with headless Chrome: a PDF and an empty file refused; a hand-written file (bold, a cited link, a list
  item over two lines, a table, next steps, open questions) read as intended; an export-format file with `[1]` and item names;
  download → upload identical.

### D-092 · 2026-10-18 · Accepted (extends D-078)
**Easter egg: now and then the orb turns into a pomegranate (nar) and stays one for a while.** User request.
- *When:* while idle, each time an antic is due there is a 3% chance (`POM_CHANCE`) it's this instead, at most once every 2 minutes
  (`POM_REST`). It stays 28–45 s (`POM_STAY`), whatever the mood: hover moods, antics, sleep and the chat all play on the fruit.
- *How:* a red puff and a surprised face; the dots turn red one by one in random order (D-035). The shape becomes the fruit's:
  broad shoulders, a flat top, a rounder bottom, faint ridges around. A small dark calyx (a short neck, six sepals flaring out
  more than up, `^` tips, a dark opening) sits in the top. The skin is crimson, darker on the shaded side, with a few warm
  patches, pale speckles and a small shine. An open slice (a wedge of round `●`/`o` seeds with pale pith around it) turns past
  as it spins.
- *Going back (user: burst it first, then the bot appears):* it swells about 14% with `> <` eyes, gritted teeth and a growing
  tremble (0.7 s), then bursts: seeds, bits of peel and pith fly out and fall, the calyx is thrown up (particles now take a
  `fall` and fade before the canvas edge). Nothing for a beat (to 1.15 s), then the plain orb builds back: its dots appear
  in random order while it grows from half size with a little overshoot, the face pops in with the happy `free` look
  (`^ ^`, a hop), done at 1.75 s (`BURST`). Typing `nar` during the burst is ignored.
  *Second pass (user):* the first version (a red ball with a big orange crown) "looked like a red queen with her crown", so
  the calyx got small and dark, the shape and the slice came in.
- *Colours:* tokens `--pom-skin`, `--pom-shade`, `--pom-shine`, `--pom-blush`, `--pom-crown`, `--pom-aril`, `--pom-pith`
  (dark and light, tokens.css; the orb is a 2D canvas, so no WebGL mirror).
- *On purpose (user):* type `nar` anywhere in a workspace, outside a text field (inputs, textareas, selects, contenteditable);
  again turns it back. Not shift-sensitive, ignored with ⌘/Ctrl/Alt; no rest time for this. One keydown listener on the orb,
  only the last three letters kept. No `/nar` in the chat (user declined it). It stays undocumented in the UI on purpose.
- Never under reduced motion (no antics there, no `nar` listener). Dev hook: `__orbPom()` does what `nar` does.
