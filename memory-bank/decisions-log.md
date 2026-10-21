# Decisions Log

Every decision in full, oldest first: what was decided, why, alternatives, what the user said, how it was verified.
Not auto-loaded; the current rules are summarised by topic in [decisions.md](decisions.md).

Format: `### D-xxx · date · status (Accepted | Proposed | Superseded by D-yyy)`. Append new entries at the end; never
renumber or delete (code and docs cite these numbers). A reversed decision is marked `Superseded by D-yyy`.

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
**Features are their own entity, linked to ideas** (not just an idea with a tag). Since D-040 they are a type on the one board, not a view of their own.

### D-008 · 2026-10-17 · Accepted
**Web only. Authentication required. Export/import and attachments are in scope.** Attachments are images, SVGs and PDFs; no drawing pad for now (D-083).

### D-009 · 2026-10-17 · Accepted
**Hybrid rendering: 3D scene in WebGL, readable and editable text in the DOM. The ASCII effect never covers editable text.**
Why: accessibility, text editing quality, readability.

### D-010 · 2026-10-17 · Superseded by D-014
Was: InstantDB as the backend. Its hosted service shut down; Firebase instead (D-014).

### D-011 · 2026-10-17 · Accepted
**Sign-in: Google OAuth only.** (Resolves Q-002.)
Implementation: Firebase Auth Google provider, popup flow (updated after D-014).

### D-012 · 2026-10-17 · Superseded by D-062
Was: anyone with the invite code joined directly as an editor. Now a code only asks and an owner approves, or an owner invites an email (D-062).

### D-013 · 2026-10-17 · Accepted
**Fonts: Geist (display/UI) + Geist Mono (data/ASCII).** (Resolves Q-005.) Self-hosted through `@fontsource-variable/geist` and `geist-mono`, with no external font CDN.

### D-014 · 2026-10-17 · Accepted
**Backend: Firebase.** Firestore for data, Realtime Database for presence and cursors, Firebase Auth for Google sign-in. Spark (free) plan at first; Blaze is needed for functions and Storage (D-079, D-083).
Why: InstantDB's hosted service is shutting down (team joined OpenAI in Aug 2026, sign-ups closed, apps stop 2027-08-31).
Longevity became the top criterion. Firebase never pauses, has no cold starts, and is Google-backed.
Rejected: Convex (cursor updates burn function-call quota, startup risk), Supabase (free projects pause).

### D-015 · 2026-10-17 · Superseded by D-079, D-083
Was: attachments deferred, stay on the Spark plan. Attachments are built on Firebase Storage (D-083) and the project is moving to Blaze for functions (D-079).

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
cards on it, and links between them. Resolves Q-008. (Cards are flat and never lift, D-055, D-061; links are straight lines with arrows, D-059, D-108.)
Full 3D stays available for transitions and competitor maps later.

### D-019 · 2026-10-17 · Accepted (refines D-009)
**Card display text is WebGL SDF text (troika via drei `<Text>`); all editing happens in the DOM detail panel.**
Why: crisp at any zoom, no DOM churn per card, and cards stay real 3D objects. The ASCII pass still never covers the board.
troika can't read woff2, so the scene uses static `.woff` Geist from `@fontsource/geist(-mono)`.

### D-020 · 2026-10-17 · Accepted
**Local development and tests run on Firebase emulators** (`npm run dev:emu`, `npm run test:rules`) with a `demo-` project,
so nothing can reach production. Test users (Alice, Bob, Carol) sign in with fake Google tokens. The RTDB emulator uses port **9010**
(9000 clashes with OrbStack). Its namespace must be `<project>-default-rtdb` for the rules to apply.

### D-021 · 2026-10-17 · Superseded by D-098
Was: roles owner + editor, one owner. Now owner / editor / viewer with several owners (D-098).

### D-022 · 2026-10-17 · Superseded by D-025
Was: a shutter curtain opening from the centre. The hold mechanism (`useHoldCurtain`) stays; the look is D-025, timings D-035.

### D-023 · 2026-10-17 · Accepted
**Owners delete workspaces; others leave them** (owners may leave too unless they are the last one, D-098). Delete removes every subcollection doc, then the invite code and the workspace
(client-side, children first, since Firestore doesn't cascade). A `leaving()` rule lets a member remove only themselves; the rules never leave a workspace without an owner (D-098).
Rename is open to all members (workspace card action, or Settings; the breadcrumb name is plain text, D-055).

### D-024 · 2026-10-17 · Accepted
**One framed surface for all panels, cards, forms and chips:** `src/ui/Frame.module.css` (`frame`, `dashed`, `interactive`, `label`),
using the tokens `--surface`, `--surface-blur`, `--line`, `--line-hover`. New framed UI must compose these classes instead of setting its own background or border.

### D-025 · 2026-10-17 · Accepted (supersedes D-022's visuals; the hold mechanism stays)
**Loading = the flowing background itself, then a cell-by-cell rebuild.** While held, an exact copy of the backdrop
(`BackdropScene` in a second canvas, same clock, same dim) covers the page, with a small status (`▖ LOADING WORKSPACES`) in the
bottom-right. When ready, the copy's ASCII pass masks itself cell by cell in random order (400 ms, D-035; no coloured edge, D-031), so the page rebuilds out of the background without the animation restarting.
On first load the cover is solid black until its first frame, so nothing flashes through while shaders compile.
Requirement: **nothing in the backdrop may depend on per-canvas state** (own clocks, pointer). Use `sceneTime()` and `backdropDim` from `src/three/sceneClock.ts`.

### D-026 · 2026-10-17 · Accepted (extended by D-028)
**The background flows by itself, like a fluid. No mouse influence.** Two levels of time-varying domain warp in `AmbientField`. Dimming on the board is an ASCII-pass uniform, not CSS opacity.

### D-027 · 2026-10-17 · Accepted
**One HUD on every page** (`src/ui/Hud.tsx`): a fixed-height top bar (`--hud-h`) with a breadcrumb on the left
(`# north-star / workspaces / <name>`; earlier segments link back, the current one is bright; the name is plain text, D-055)
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
Was: a pixelated tile wave on enter/exit (PixelWave). Rejected by the user; one cell-by-cell build-up everywhere (D-034, D-035).

### D-030 · 2026-10-17 · Accepted
**In-app motion setting:** `motion: full | reduced | system` in Settings → display (`src/state/motion.ts`), saved in localStorage, default *full* (D-063).
Everything reads `useMotion().reduced` / `isReducedMotion()`; nothing reads the media query directly. CSS uses `html[data-motion='reduced']`.
Why: the user's Mac has Reduce Motion on but they want the full experience, while users who need reduced motion can pick it.
Under reduced motion: the background freezes (and resumes seamlessly), waves and sweeps are skipped, decode text is instant.

### D-031 · 2026-10-17 · Accepted
**The page-load reveal has no coloured edge.** User feedback: the magenta diagonal "wave" was not wanted. The reveal stays a plain
cell-by-cell rebuild (D-025). The user specifically likes the decode text, the workspace-card waves and the detail panel's wave.

### D-032 · 2026-10-17 · Superseded by D-034
Was: idea cards waving in with 3D tiles. Cards build up cell by cell like everything else (D-034, `CardReveal`).

### D-033 · 2026-10-17 · Superseded by D-034
Was: a blur "rise" entrance (rejected trial). Entrances start at `revealed`; the `settled` state is gone (D-035).

### D-034 · 2026-10-17 · Accepted
**One entrance everywhere: cell-by-cell build-up.** The user loved the "North Star" headline appearing piece by piece. That was the
page-load reveal (D-025), not the headline's blur animation. Now every component builds itself the same way: content appears in
9 px cells on the backdrop's ASCII grid, in random order (D-035), no colour.
- DOM: `<Appear as=… delay duration>` (`src/ui/Appear.tsx`): a `clip-path: path()` of merged cell runs, viewport-aligned. Exit = breaks apart the same way.
- 3D idea cards: `CardReveal` injects a `discard` into every card material via `onBeforeCompile` (screen-space cells from `gl_FragCoord`).
  Each card owns a base `MeshBasicMaterial` for its troika text (troika's derived material calls the base `onBeforeCompile`), so the shared default isn't touched.
- The landing headline uses it too, so it builds on every visit, including after sign-out (which previously only faded in).
- **Rejected by the user:** coloured tile waves (anywhere) and the blur "rise".
Shared math: `src/ui/cellReveal.ts`. Entrances start at `revealed` (D-035).

### D-035 · 2026-10-17 · Accepted (refines D-034, D-025)
**Random order, all at once, fast.**
- Cells appear in **random order** (pure per-cell hash, no top-left → bottom-right diagonal), for components, 3D cards and the page-load reveal.
- **Nothing waits:** every entrance and text decode starts the moment the page is revealed (`revealed`). There are no staggers or delays,
  and nothing waits for the page-load rebuild to finish (the `settled` state was removed).
- **Faster:** components 320 ms, landing headline 400 ms, page-load reveal 400 ms, text decode 260 ms (nav 220 ms). (Halved, then about 25% more on request.)

### D-036 · 2026-10-17 · Superseded by D-040
Was: per-type tabs (ideas, features, competitors, matrix). Now one board with all types plus Flow, Table, Matrix and Reports views (D-040, D-066). The one layout route that loads every collection once stays.

### D-037 · 2026-10-17 · Superseded by D-040, D-057
Was: a separate Features board and promoting an idea to a feature. Features are a type on the one board (D-040); the promote button is gone (D-057).

### D-038 · 2026-10-17 · Superseded by D-040, D-058
Was: competitors as profile pages, not on a map. Competitors are cards on the board with their features named beside them (D-164); the profile (fields + features by category) is their side panel (`CompetitorProfile.tsx`).

### D-039 · 2026-10-17 · Superseded by D-048
Was: domains organising a workspace. Removed (D-048).

### D-040 · 2026-10-17 · Accepted
**The Board is the main view.** All item types live on one free canvas, filtered by type, customer, tag and link kind. Flow, Table and Matrix are
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
Selecting a customer card highlights the items tagged with it. The `for:` filter lists customers. (Lines and filter changed by D-119.)

### D-045 · 2026-10-17 · Accepted
**Flow columns: Customers → Problems → Competitors → Ideas → Features** (who hurts, what hurts, how they cope today, our answer,
what we build). Competitors before ideas so the gap shows before the solution.

### D-046 · 2026-10-17 · Accepted (answers Q-013)
**Undo/redo by document snapshots** (`src/data/history.ts`). Every write in `src/data/` goes through `tracked()`, which snapshots
the documents it touches before and after; undo/redo write a snapshot back. So cascades (a competitor with its features, matrix cells
and links) undo as one step. Typing in one field and one drag merge into one step.
Local to the tab and workspace (cleared on switching), last write wins against collaborators.
Keys: ⌘Z / Ctrl+Z, ⇧⌘Z / Ctrl+Y, Delete or Backspace on the selected item; text fields keep their own undo. A toast says what happened.
Deletes are one click (they're undoable).
Tracked writes are serialised but never wait for the server (Firestore applies writes locally in call order), so editing works offline.

### D-047 · 2026-10-17 · Superseded by D-049
Was: groups as labelled frames on the board. Removed; text labels mark areas (D-049, D-050).

### D-048 · 2026-10-17 · Accepted (reverses D-039)
**No domains.** The user found them unnecessary: a workspace already is one idea space, and customers (the `for:` filter) plus
text labels cover slicing and naming areas. Removed tabs, pickers, unsorted marks and the domain filters on Table/Matrix.
Rules refuse new `domains` docs but keep read/delete for clean-up; old `domainId`/`domainIds` fields are tolerated and ignored.

### D-049 · 2026-10-17 · Accepted (reverses D-047; frames return as sections, D-130)
**No groups collection.** Replaced by text labels (D-050) to mark areas. Rules refuse new `groups` docs, keep read/delete
for clean-up. Named frames came back in D-130 as a kind of label, by the user's request.

### D-050 · 2026-10-17 · Accepted
**Text labels on the board are the places you jump to.** `labels/{id}`: text, color, x, y. Written straight on the canvas
(`+` menu → text): a DOM input sits over the spot while typing (never WebGL), Enter saves, Escape cancels,
empty text deletes. Drag to move, double-click to edit, Delete to remove; all undoable, and a new label plus its first text undo as one step.
The board's "go to" row lists every label (headings and subheadings since D-116, with a search field) in reading order (top→bottom, left→right); click or press 1–9 to glide the camera there
(instant under reduced motion; your own pan/zoom cancels the glide). Only labels are jumpable: no other text anywhere (user's words).
Zoom-out limit raised from 60 (later capped at 150 with the camera far plane at 1000, after cards vanished past the old far plane of 200).

### D-051 · 2026-10-17 · Superseded by D-055
Was: one 3D silhouette per card type. Rejected by the user; flat cards with a type-colour border and label (D-055).

### D-052 · 2026-10-17 · Accepted
**Built-in example workspace** ("Create example" on the workspaces page, `src/data/example.ts`): a made-up startup, Tablebook
(shift scheduling for independent restaurants), with 4 customers, 4 problems, 4 fictional competitors and their features,
4 ideas, 6 features, every link kind, customer tags, a full matrix and six area labels. Competitor names are invented on purpose.

### D-053 · 2026-10-17 · Accepted
**Fewer, clearer controls.** One `+` create button (bottom-left, solid magenta) opens a menu of card types and text.
`show`, `for` and `go to` are dropdowns (`src/ui/Menu.tsx`: checkbox items stay open, actions close; arrows/Home/End/Escape).
The views sit beside the breadcrumb as plain tabs (D-066).

### D-054 · 2026-10-17 · Superseded by D-064, D-097
Was: the first Settings modal (account, workspace, motion, a "coming later" list). Now a gear + account chip and a grouped menu (D-064, D-097).

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
**Small cards, compact panels.** Cards no longer show notes or descriptions (height 1.25: type label, title ≤2 lines, tags, meta;
laid out again in D-152).
In the side panel, `for` is a multi-select dropdown and tags use a picker (`src/ui/TagInput.tsx`: chips with ×, type to filter the
workspace's existing tags, Enter or comma adds, Backspace removes the last); the same picker is in the competitor panel and the
Table's tags cell. The idea panel's "To feature" button is gone.

### D-058 · 2026-10-17 · Superseded by D-164
Was: a competitor's features stacked behind its card as plates and fanned out as chips while it was selected. Now they're
names beside it, the full list while hovered or selected (D-164).

### D-059 · 2026-10-17 · Accepted
**Links read as sentences.** Straight lines from card edge to card edge with an arrowhead at the target and the kind written at the
midpoint ("solves", "competes", "inspired by"…; "relates" stays unwritten unless it has a label). Line pattern by kind;
no flowing animation. Colours by meaning, chips on solid plates and thicker lines for the selected card: D-108.
_Since D-155 a line can be bent through points the user puts on it._

### D-060 · 2026-10-17 · Accepted
**Opening a workspace frames everything** (all cards and labels, within zoom limits 9–150; room left for the HUD and toolbar).
Switching between views inside a workspace keeps your place. (The Matrix frame is as tall as its content, D-106.)

### D-061 · 2026-10-17 · Accepted
**Calmer board.** No double-click to create (the `+` menu is the only way; double-click still edits a text label). Cards don't lift
or scale on hover or selection, nor lift in a drag (since D-150 a dragged card goes small under the pointer): the lift moved a dragged card toward the camera, so it looked bigger and dropped away from
the pointer. A dragged card now sits exactly under the pointer. In a workspace the backdrop is dimmer (8% since D-110; 28% before). Slowing it down was
tried and reverted: the user felt it slowed the card animations too; speed stays as it was.

### D-062 · 2026-10-17 · Accepted (supersedes the direct join of D-012)
**A code asks; the owner decides. Or the owner invites an email.** Before, anyone holding the code joined silently as an editor,
and a code never expired, so one leaked code was enough. Now:
- *Email invite:* the owner adds an address in Settings (`invitedEmails` on the workspace). The invite shows on that person's
  workspaces page once they sign in with that verified Google address; they join or decline. No email is sent: there is no server,
  and sending mail would need Cloud Functions / Blaze (D-015).
- *Code:* entering it creates a `joinRequests/{wid}_{uid}` document; an owner lets them in or denies from Settings. A cyan count on
  the Settings button and "· N waiting" on the workspace card tell the owner someone is waiting. The requester sees the request
  under "waiting" and can withdraw it.
- The owner can make a new code; the old one stops working at once.
Kept the 8-character code: guessing it isn't the risk (31⁸ ≈ 8.5×10¹¹), a leaked one is, and approval covers that.
Rules: `joiningByInvite()`, `decliningInvite()`, `joinRequests` match; the old `joining()` is gone. 108 rule tests pass.

### D-063 · 2026-10-17 · Accepted (changes D-030's default)
**Full motion by default, an off switch for the background, and a much cheaper backdrop.**
- Motion defaults to `full`; the OS Reduce Motion setting only counts once you pick `system` (the user's call; `reduced` is one
  click away in Settings → display). Order in the picker: `full reduced system`.
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
framed ⚙ square (the join-request count sits in its corner). The chip opens settings on the account page. The modal has a side menu on the left and the chosen page on the right; its pages are D-097's (you: account, display ·
workspace: general, people, export · assistant: keys, usage).
It opens on people when someone is waiting to join, otherwise on the last page you used. Below 640 px the menu turns
into tabs above the page.

### D-065 · 2026-10-17 · Accepted
**Presence and live cursors (Phase 3).** `src/data/presence.ts`, RTDB `presence/{wid}/{uid}` (D-016):
`name, color, photo?, view (board|flow|table|matrix), x?, y?, sel?, ts`.
- Each tab writes its **whole node** (≈16 Hz at most while the pointer moves, a heartbeat every 20 s), so if another tab of the
  same person disconnects and removes the node, the next write restores it. `onDisconnect().remove()` is re-armed on every reconnect;
  anyone silent for 60 s (server clock) is hidden. You never see yourself, not even your other tabs.
- Colour per person: assigned in join order over the five accents (D-067).
- **Board:** cursors in world units, so they land on the same spot at any pan/zoom. They glide to each update (no glide under reduced motion; the trail was removed, D-067). The name is a DOM tag in their colour (crisp, constant size).
  A card someone has selected gets a rim in their colour. Panning or zooming under a still pointer moves your cursor too.
- **HUD:** a chip per person beside the account chip (D-067). Click: follow them (D-067).
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
**Light theme, dark by default.** Settings → display → `theme: dark | light | system` (`src/state/theme.ts`, localStorage
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
- *Orb* (`src/ui/AiOrb.tsx`): a turning sphere of ASCII dots on its own 2D canvas (30 fps, not the backdrop pass); spins faster
  with a cyan shimmer while answering. Still under reduced motion. Moves left of an open side panel (`data-side-panel`).
  Size, eyes and character: D-078.
- *Chat* (`src/ui/AiChat.tsx`, `src/ai/`): streams from OpenAI's Responses API straight from the browser (`store: false`, low reasoning).
  Each message sends a fresh plain-text brief of the workspace (`src/ai/context.ts`: items, tags, areas, links, competitors, matrix, the
  view and selection). The chat lives in the tab only (one per workspace, gone on reload). Its window: D-081, D-094, D-095;
  changes through proposals: D-074.
- *Key* (D-006): pasted in the chat or Settings → assistant → keys, checked with a free `GET /v1/models/<model>`, kept only in localStorage.
- *Model:* `gpt-6-luna` by default (cheapest on OpenAI's model page 2026-10-17). Choosing models: D-104.
- *Phase 4.2:* tools so the assistant can add competitors, links, matrix notes, summaries (done in D-074); previews you accept before anything is written
  (user's answer: preview, then accept); market research by sending agents.


### D-074 · 2026-10-17 · Accepted (Phase 4.2a; extends D-073)
**The assistant proposes changes; you tick and apply them.** One OpenAI function tool, `propose_changes` (`src/ai/tools.ts`), not MCP:
the app has no server to host one, and a browser-side function tool does the same job with the same key.
- *What it can do:* add customers, problems, ideas, features and competitors; add a competitor's features; edit cards and competitors;
  link and `for`-tag; set matrix cells (coverage, notes). Deletes and unlinks came with D-075, board areas with D-086,
  link edits and notes with D-108.
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

### D-077 · 2026-10-17 · Superseded by D-104
Was: one chat + research model pair per browser for every key. Models now belong to the key that pays, per task (chat, web, deep research) (D-104).

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
- *Rejected 2026-10-18 (user: "çok korkunç"):* kaomoji eyes and mouth (one glyph each: `o ^ > < ♥ T`…), and the face
  sampled into small `@#*` glyph cells (unreadable at 88 px). The rounded-square eyes stay.

### D-079 · 2026-10-17 · Accepted (Phase 4.3; extends D-006, needs Blaze, reverses D-015's "stay on Spark")
**A workspace key the owner shares, and a usage log for every assistant call.** User's request and choices.
- *Where the shared key lives:* nowhere a browser can read it. There's no way to let others use a key in their browser without
  handing it to them, so the key goes once to a callable function, `setWorkspaceKey` (owner only; checked against OpenAI), is encrypted
  with AES-256-GCM under the `AI_KEY_SECRET` secret and kept in `aiSecrets/{wid}` (rules: no client access at all). The client only sees
  `ai/config`: `hasKey`, `keyHint` (`sk-…abcd`), `access: everyone | chosen`, `allowed: uid[]` (owner edits the last two).
- *Calls on it* go through `ai`, an HTTPS function that checks the ID token, membership and access, forwards a whitelisted Responses
  body (`stream: true`, `store: false` forced), streams the answer back and writes the usage entry itself, so it can't be skipped or faked.
  OpenAI errors are scrubbed of key fragments. Functions run in europe-west1 (next to RTDB); `cleanUpWorkspaceAi` deletes the secret
  and AI records when a workspace is deleted. (Members' names come from the people list, D-098; `aiMembers` is gone.)
- *Own keys stay as D-006:* in the browser, straight to OpenAI. Per workspace you pick `this workspace uses: workspace | own`
  (default: the workspace key when you may use it). The chat header says which key; without a usable one the chat asks for yours and
  says when the owner hasn't let you use theirs.
- *Usage log* (`workspaces/{wid}/aiUsage`, append-only): uid, name, key source, task (chat/research), tools used (`propose_changes`,
  `web_search`), model, input / cached / output / reasoning tokens, web searches, status (done/stopped/failed), duration, time.
  Never the messages. Every call goes through one wrapper, `callAi` (`src/ai/call.ts`), which measures this from the stream's final
  usage event; own-key calls are logged by the caller's browser, workspace-key calls by the server.
- *Who sees what (user's rule):* your own-key calls only you, the owner included in "nobody else"; workspace-key calls you see your own,
  the owner sees everyone's. Enforced by the rules (two allowed queries: `uid == me`, and `keySource == workspace` for the owner).
- *Settings → assistant* has two pages: **keys** (your key, the workspace key and who may use it, which key this workspace uses, models
  per D-104) and **usage** (this month's totals, the workspace key person by person for the owner, the last 100 calls).
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
  with its id. Never members, roles, invite codes, join requests or anything AI (keys, usage). Attachments go in the zip too (D-083).
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
- *The orb:* the same orb (one instance, so its reactions carry over, D-078); it perches on the chat's top edge (D-095).
- *Composer:* a `>` prompt line (D-094).
- *Narrow screens (<760 px):* the window covers the whole screen instead of sharing it.
- The table's popovers clamp to the app box instead of the window width, so they don't slide under the assistant.
- *Motion, second pass (user: the app took time to adapt and jumped, the + grid waited and then jumped):* the app box changes
  width at once, never eased (an easing canvas lags and snaps). The board keeps its left edge (`KeepLeftEdge` in Board.tsx shifts
  camera and target), so cards and grid stay put. The HUD's right side (`data-glide`) and open side panels glide to their new
  place (`src/ui/glide.ts`, FLIP with WAAPI, run from the chat store's `open` change so every way of opening or closing does it).
  Closing, the app is whole again at once *under* the window, so moving it away reveals the board instead of making it wait.
  How the window opens, grows and closes: D-095. Rejected: sliding in from the right.
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
- *UI:* typing `/word` opens a menu above the text (the empty chat no longer lists the modes, D-095): ↑↓ to move, Enter or Tab fills `/mode `, Enter again sends, Escape closes the menu only.
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
beside the chat. The app shows the workspace as if the ticked rows were applied, on the stage (D-094: the chat moves to the left while it's open).
Its look (marks, bar, stepper) is D-096.
- *Simulation* (`src/ai/simulate.ts`): the same writes `apply` makes (`toWrites`), played onto a copy of the workspace in memory:
  new items get `preview-…` ids, deletes keep the item (marked) and drop its links and matrix cells like `cascadeOf`, areas move
  cards and labels. Nothing reaches Firestore. Each touched item or matrix cell gets a mark: `new`, `edited`, `moved`, `deleted`.
- *Showing it* (`src/views/workspace/preview.ts`): a store with the previewed workspace; `useWs()` returns it everywhere except inside
  `<OutsidePreview>` (the assistant's window, which keeps the real one). So board, flow, table and matrix all show it with no
  changes of their own. Marks reuse the collaborator-selection marks (D-067/D-068: rings and a name tag in cyan / yellow / blue /
  magenta; replaced by diff signs and colours, D-096).
- *A bare screen (user, second pass):* while open, the app's HUD, filters and board tools (`+`, hints) are hidden, so you can't
  leave the workspace from it; the stage box's bar (D-096) has the view tabs within this workspace and `esc`.
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
- *Report screen* (`src/ui/ReportView.tsx`): on the stage (D-094; its box and stepper D-101), the chat beside it; opens by itself when
  the report arrives, `open report` / `close report` on the chat's report card, Esc closes; one screen at a time with the
  preview. Title and meta, the answer in a cyan-edged box, a collapsible numbered section per question with boxed source
  numbers (link + title on hover), inferences dimmed and marked, our items as buttons that close the report and select the
  item, open questions, numbered sources with domains. Body in Geist (sans) at a readable measure (760 px), labels in mono.
  `download .md` writes the same structure with numbered sources.
- *Chat:* a report card instead of the long text (its look: D-101); no duplicate sources list.
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
- *Reports tab* (`/workspaces/<id>/reports`, `src/views/reports/ReportsView.tsx`; its layout now D-106): `share`/`unshare` and
  `delete` for the author, `delete` for an owner on shared ones (undoable, toast). Opening a report sets
  `?report=<id>`, so a shared report can be linked; a link to one you can't see says so. Presence view `reports`
  (database.rules.json), and the open report is broadcast as `sel`, so others see who's reading which (D-068 row bars).
- *The chat's report on the stage* (D-089, D-101): shows the saved copy (or the chat's while saving or if saving failed), says who
  can see it, and has save / share / delete beside download and close. Chat write-ups have sections, not questions, and no `inference` marks.
- *Assistant:* the brief lists the newest 10 reports you can see (title, date, private/shared, answer) as REPORTS (D-099).
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
- *Where:* the upload square in the reports table's top row (D-103, D-106), or drop a file anywhere on the tab (cyan edge). `.md`, `.markdown` or
  `.txt`, at most 512 KB; another type, a bigger file or one with no text is refused in plain words. Saved like the others:
  yours only (`kind: 'upload'`, `topic` = the file name, `model` empty) until you share it; it opens beside the table (D-106).
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

### D-093 · 2026-10-18 · Accepted (refines D-024, D-027; DESIGN.md §4, §6)
**One page system: shared tokens, two labels, two button sizes, every view from the same left edge.** User: the pages looked
inconsistent with each other. Audited with screenshots (dark 1440, light 1440, dark 390) of board + panel, flow, table, reports,
the report screen and every Settings page; the assistant chat was left out on purpose (the user will redesign it).
- *Found:* reports was a centred 880 px column while the other views start at `--hud-x`, and its header sat neither where the
  filter row is nor at its height; the table frame stopped where its columns ended while Flow's filled the width; 23 raw
  font sizes (26 px was the de facto heading size) and five letter-spacings; four styles of section label; two button styles
  copied by hand in five files, so `[ DELETE ]` and `[delete]` both existed; Settings rows had a 136 px label column and its
  choices 76 px, so values didn't line up between pages; a stale "coming later: Attachments" row; table names cut mid-letter.
- *Tokens:* `--text-lg` 18, `--text-heading` 26 (20 on phones), `--text-hero`; 10 px folded into `--text-xs` 11 (user);
  `--track-label/title/display`; `--measure` 760. No raw sizes or tracking left outside the assistant chat.
- *Shared pieces:* `src/ui/Page.module.css` (`page`, `toolbar`, `title`); `fieldLabel` beside `label` in Frame.module.css;
  `small` in AsciiButton.module.css for `[verb]` row actions (reports, report screen, Settings, workspaces cards).
- *Layout:* reports in the filter row's place (now a full-width table, D-106); the table fills the
  width ("linked to" takes the spare room) and names end in "…"; Settings rows line up (their layout now D-097); the
  "coming later" section is gone; on phones the side panel covers the filter row instead of sliding under it.
- *Fonts (user):* Geist for titles and long reading text, Geist Mono for everything else, as it already was.
- *Case (user, follow-up):* every action is lowercase: `[ create ]`, `[ delete ]`, `[+ attach]`, `[+ link]`, the Settings menu
  (`> account`). Uppercase is only for labels. Before, `[ DELETE ]` (panel) and `[delete]` (lists) both existed. The
  `--track-button` token went with it. `sign in with Google` keeps the name's capital; test users stay `Alice`/`Bob`/`Carol`.
- *No native dropdowns (user, follow-up):* the five `<select>`s (link kind in the side panel, Table priority and status, the
  Matrix's "their version", Settings models) opened the macOS menu. `src/ui/Select.tsx` replaces them. First pass used the filter menu's
  list (tall rows, cell build-up, `>` marks); the user found it looked like an accordion opening, so it now matches the tag
  picker's suggestion list (compact rows, wash on hover, current value bright, no animation, opens downward when it fits), in a portal fixed to the viewport (inside the Settings dialog when it's in one), following its
  trigger on scroll, Escape closing only the list; `data-edit` so the preview lock disables it. The competitor category field's
  `<datalist>` suggestions are still native.
- *`+ link` as a dropdown (user, follow-up):* the link search used to spread inside the panel (search box, results, `done`),
  pushing the links down. Now it opens as a dropdown under the links heading, the tag list's look with a search box on top;
  picking links and closes it. `src/ui/floating.ts` holds the placement both dropdowns use.
- *Fix (follow-up):* the shared-button swap had split the workspace card's hover selector, so on hover the actions took the
  name input's full width and pushed out "owner · 1 member"; restored.
- Kept: the Matrix keeps its fit-content width;
  the /workspaces page only got tokens (its card titles went 22 → 18 px).
- Verified with headless Chrome on the emulators in the same three setups: no horizontal scroll, light theme reads the same.
  The white focus box on Settings' first menu item after opening shows only when the dialog opens without a pointer (keyboard,
  or a script); left as is.

### D-094 · 2026-10-18 · Accepted (changes D-081, D-087, D-089; first step of the user's assistant redesign)
**The chat is a terminal; a preview or a report opens a stage, and the chat glides across to make room.** The user's picks:
placement first, then look, then motion. The preview and report screen keep their old look for now (next steps of the redesign).
- *Placement (user):* at rest the chat is the window on the right (D-081). When a proposal's preview or a report opens, the chat
  moves to the left edge and the app's box becomes the **stage** on its right, showing the preview or the report. The real app
  is hidden meanwhile (user's pick over "shrunk behind" or "side by side"). Closing runs it back. With the chat closed a report
  still opens over the app as before; opening the chat beside a staged report puts it straight on the left.
- *Look (user: "terminal log"):* all Geist Mono. Your messages are `>` prompt lines (cyan `>`), answers sit under them indented
  2ch; steps are log lines (`✓` done, turning `▖▘▝▗` while running, yellow `!`); the empty chat lists commands one per line
  (`/validate   validate an idea`), lit by a cyan left bar on hover; the composer is a `>` prompt line under a rule that turns
  cyan while typing, with the hint and `[web] [send]` on one line below. Proposals, research plans and report cards are boxes
  with their title in the top edge (`┌ proposal · 2 changes ───┐`, `BoxHead`), cyan while undecided; `[preview →]` comes first.
- *Appearing (user: cell by cell; replaced by D-095: the small box slides up from below):* the window builds up cell by cell like every surface (D-034, `<Appear>`), and breaks apart on
  close, while the orb glides into its header. The rise-from-below of D-081 is gone.
- *The crossing (user: "glide across"):* `src/ui/stageMotion.ts`. The chat and its orb glide 700 ms, eased in and out (an ease-out
  had them across in ~100 ms, unreadable), FLIP on `html[data-ai-left]`. Meanwhile the app breaks apart (220 ms, random); then the
  stage swaps in and builds up in the chat's wake (460 ms, mostly from the side the chat leaves first: `runCells(..., sweep)`).
  Preview ↔ report breaks the stage apart and rebuilds it in place. Instant under reduced motion, below 760 px, or with the chat closed.
- *Stage vs asked:* the preview store and `reportOpen` say what is asked for; `useStage` (`src/views/workspace/stage.ts`) is what is
  on screen, and follows only once the app has broken apart, so the old screen never turns into the new one in place. `useWs()`,
  preview marks, the preview bar and the report screen read the stage. The board remembers its view when a preview opens and
  returns to it on close (not after apply: then it glides to what went in); the preview glides to its first change once staged.
- Verified on emulators with headless Chrome and a fake OpenAI, dark and light, 1440: open (cells + orb), proposal box, preview →
  chat crosses left, stage builds from the right; Esc → back, board view identical (-10.87, 2.33); preview → apply writes the card,
  chat back on the right. Build passes.

### D-095 · 2026-10-18 · Accepted (refines D-094, D-078)
**An empty chat is a small box with the orb perched on it; a conversation makes it tall, and the orb peeks over its edge.**
User feedback on D-094: the chat needn't be big with nothing in it; the header's "assistant" meant nothing; the orb looked
alone up in the header. Their picks: the orb perches on the box's top edge; the box rises from below and startles it; when
it grows tall the orb drops behind the box and only the top of its head and its eyes show, as if peeking over at you and
what you type; so the tall chat stops short of the top.
- *Small box:* empty (no messages, nothing staged) the chat is a framed box in the bottom-right corner, over the app (the app
  keeps its width), as tall as its content: header, commands, prompt. It slides up from below on open and down on close.
- *Tall:* the first message (or a preview/report on the stage, D-094) grows it into the column beside the app (D-081), from
  `--ai-top` (0.56 × the orb) to the bottom. It grows by its edges (`morph` in `src/ui/perch.ts`, WAAPI on top/left/width/height,
  650 ms ease-out-cubic), not a transform, so the text never stretches; the growth starts from the box as it was drawn before
  the message landed. `clear` shrinks it back the same way. Resizing the width only in the column.
- *Orb* (`usePerch`, perch.ts): keeps its corner in CSS and, while the chat is open, follows the box's top edge every frame
  with a `translate` and a `clip-path` that hides what is below the edge. Sunk 14% into the small box, 44% behind the tall one.
  It never goes below its corner, so the rising box picks it up (cue `startled`: a jolt, wide eyes, an `!`, then a look down at
  the box) and sets it down on close. Growing tall plays `fall` (wide eyes, mouth open) as it sinks. While tall it peeks
  (`peek` prop): its face rides 0.3 R higher and its eyes look down at most 0.3, so they stay over the edge. Replaces the
  header seat and the heave (D-081).
- *Along the edge (user, follow-up):* a little body on a spring. On the small box near its right end; on the tall column in
  the middle, from where every 7–14 s (not while answering) it wanders up to 35% of the width along the edge and stretches
  up (sunk only 20%) to peek for 2.6 s, then comes back. When the column crosses to a preview or report (D-094) it can't keep
  up: it slides along the edge and is carried at whichever end it reaches, then, once the column stops, is rattled (cue
  `shaken`: `> <` and a jolt, then spiral eyes and a wobble) for 1 s, pulls itself together (`composed`: a quick head shake,
  a straight look) and walks back to the middle. Instant and centred under reduced motion; no sweep while resizing.
- *Fixes (user, second round):* the orb went back to its corner on close only if nothing restarted its tracking mid-move;
  it now carries on from its current offset. The empty box shows only the prompt (2026-10-18, user: the invitation and "Type / for
  commands" lines repeated the placeholder and the scope line, so they went; the commands aren't listed). The `/` menu eases open and shut by its height, so the box grows with it instead of jumping. While the box
  is small, side panels end just above it (`html[data-ai-small]`, `--ai-small-h`), over the orb's spot, and ease to their new
  length (bottom, 450 ms), whether the panel or the chat opened first. The orb is knocked aside as when the chat is closed
  (cue `bumped`: `> <`, a jolt, a wary look at the panel) to the panel's left, hanging off the box's end if it must, and hops
  back (`free`) when the panel goes (user's pick over bumping its head on the panel).
- *Tall open/close and a bigger orb (user, third round):* the window carries its tall shape itself (`data-tall`), kept while
  it slides away, so a tall chat slides down whole on close and up whole on open (it used to snap to the small box first);
  the growth by edges runs only while the chat stays open. Open/close slide 600 ms ease-out-cubic (the expo ease looked
  instant). On the tall chat the orb is 1.5× (CSS `scale` from its bottom centre, 600 ms; drawn at 1.5× the pixel ratio so it
  stays crisp), and `--ai-top` is 1.5 × 0.56 × the orb. Closing the tall chat glides side panels and the HUD back again (glide.ts),
  as opening did (D-081).
- *Header:* one line, the model (and which key) on the left, `[clear]` and `[×]` on the right. No title.
- Verified on emulators with headless Chrome and a fake OpenAI, dark and light, 1440: open (box rises, orb lifted), first
  message (box grows, orb sinks to peek), preview (column crosses left, orb with it), Esc, apply. Build passes.

### D-097 · 2026-10-18 · Accepted (refines D-064, D-093)
**Settings reorganised: grouped menu, smaller pages, framed sections, readable help next to each setting.** User: the modal
looked unorganised and things were hard to see. Audit (headless screenshots): help text was `--fg-faint` (#4d4d4d on #0b0b0b,
about 2.3:1) in 11 px mono; section labels, row labels and hints were all the same small uppercase grey, so nothing led the
eye; hints sat at the left edge under a row instead of beside it; the workspace page was one long scroll of four sections.
- *Menu:* three groups, `YOU` (account, display: was "app"), `WORKSPACE` with the workspace's name (general, people, export:
  the old workspace page split in three) and `ASSISTANT` (keys, usage). Waiting join requests open on, and badge, people.
  `SettingsButton` takes `workspace: (page) => ReactNode` and `workspaceName`; `WorkspaceSettings` renders one page.
- *Page:* title plus a one-line description; the close `[×]` sits in the dialog's corner and doesn't scroll. Dialog 960 × 720
  (was 780 × 600), nav 216 px on a faint wash.
- *Sections* (`Section` in Settings.tsx): a framed box, its label (`fieldLabel`, no `┌`, the box is the corner) in the top
  edge, rows split by hairlines, an optional `note` at the foot on a wash (Geist, readable).
- *Rows* (`Row`): name (mono, strong, 30 px line so it lines up with the control) with an optional `hint` under it, control
  on the right. `Choice` gained `bare` (options only) so choices sit in rows. `Note` for messages inside a section.
- *Colour:* new token `--fg-muted` (dark #9a9a9a, light #555555) for help text; usage tables, card details, times and
  "you're the owner" moved off `--fg-faint`.
- Row labels are lowercase names, not uppercase labels: they read as the setting itself; section labels stay uppercase (D-093).

### D-096 · 2026-10-18 · Accepted (changes D-087's marks and bar; second step of the assistant redesign)
**The preview marks changes as diffs, shows what an edit replaced, and lets you step through the changes.** User feedback
on the first look: the marks used the type colours (magenta = problem and deleted, cyan = feature and new, yellow =
competitor and edited) and looked like collaborators' name tags; deleted items looked alive; an edit didn't show what it
replaced; the board glided to the first change and left the rest off screen. The user's picks:
- *Marks (user: diff signs, still colour-coded):* the checklist's signs, `+` new, `~` edited, `→` moved, `−` deleted, in diff
  colours of their own (`--diff-*`, lime / orange / blue / red, darker in light; `palettes.*.diff` in WebGL). On a board card:
  a sign badge in the top-right corner and a ring; in Table a sign after the type and a bar down the row; in Flow a ring and a
  sign beside the chip; in the matrix a ring and sign inside the cell, struck headers. A deleted item stays, grey and struck
  through. A moved card leaves a dashed ghost where it was with a line to its new place; links the proposal adds are drawn in
  the new colour; board labels get an underline and sign. In the chat's checklist the sign takes the diff colour and the kind
  word the type colour. Collaborator rings and name tags show only people again.
- *Old values (user: under the new):* an edit keeps what it replaced (`before` in `src/ai/simulate.ts`): a `was …` strip
  under the board card (title, else the first changed field), `was` + the old value struck under each changed Table cell and
  Flow chip, `○→◐` in a matrix cell, `was …` under a renamed label.
- *Getting around (user: stepper + linked rows):* opening frames every change (`flyToFit` on the board). `‹ n/N ›` in the bar,
  or n / p when you're not typing, steps through the checklist's rows (`steps` from simulate: the ids each row touches): the
  board glides to frame that row's items (never closer than about 14 × 8 units), other views scroll to them (`data-mark-id`),
  the row lights in the chat and scrolls into view. Hovering a row lights its items on the stage (thick ring, filled sign,
  row wash); hovering a marked item lights its row. `usePreviewFocus` in stage.ts, kept apart from the preview so a hover
  never restages it; `src/views/workspace/previewNav.ts`.
- *Bar (user: a box like the chat's):* the stage is one cyan box with its title written into the top edge, like the
  proposal box: `preview · N changes` and how many of each kind in their signs and colours (a competitor's hidden features
  not counted), the four views, the stepper, `esc`. The matrix's editing hints are hidden while previewing.
- Verified on emulators with headless Chrome and a fake OpenAI, dark and light, 1440: a six-row proposal (new idea + link,
  rename, competitor delete, matrix cell, an area) on all four views; row hover lights the deleted competitor; n steps to the
  rename (card framed with its `was` strip) and the delete (title struck); Esc → the real workspace; apply writes everything.

### D-098 · 2026-10-18 · Accepted (extends D-021, D-090, D-079)
**Viewers and several owners; a people list owners edit; nothing beyond the workspace's items loads until it's shown.**
The user's asks: don't load usage, the people list or reports when a workspace opens; a people section where owners edit
roles; loading screens for the report list and for opening a report; paging for people, usage and reports. Their picks:
a viewer role plus remove (and several owners per workspace), and reports split into a summary and a body.
- *Roles:* `owner | editor | viewer` in `roles`. Any number of owners, never none (rules: `validRoles`, `roles.values().hasAny(['owner'])`).
  Owners: people, roles (anyone's, their own too while another owner remains), invite code and email invites, join
  requests (queried by workspace, so every owner sees them), the assistant key and its usage, deleting the workspace.
  Editors: all content. Viewers: read everything, keep and share their own reports, log their own-key calls; no content
  writes (Firestore and Storage rules). `ownerId` stays as the creator and never changes; rules, functions and the client
  read `roles` (`roleOf`, `isOwnerOf`, `canEditIn` in workspaces.ts). Anyone but the last owner may leave; owners may too.
- *Viewers in the app:* the preview's lock in a viewer mode (previewLock.ts): fields locked but readable, panel buttons
  that change things hidden, navigation (`data-nav`), filters, Settings and the reports tab usable; no `+` create; drags
  and label edits don't start (`editLocked`); tracked writes refused with a toast (read-only reasons are keyed now, so the
  preview closing doesn't unlock a viewer); apply disabled on proposals. A role change applies live, no reload.
- *People:* `workspaces/{wid}/members/{uid}` (name, email, photo, joinedAt), written by each member when they open the
  workspace (if missing or changed) and by an owner who lets someone in; removed with them. Settings → workspace → people
  lists it by name, 20 at a time: initial, name, email, a role picker and `remove` (confirm) for owners, the role as text
  for others; the last owner's picker is locked. Members who haven't opened it since show once the list is complete.
  The key page's "who may use it" uses the same list; the `aiMembers` function is gone.
- *Reports:* `reports/{id}` is a summary (title, answer, counts, meta) and `reports/{id}/content/body` holds sections,
  implications, open questions and sources; saved in one batch, deleted (and undone) together. Reports from before stay one
  doc and are read, shared and deleted as they were (no migration). The reports tab lists summaries (10 a page with
  numbered pages, D-106); opening one fetches its body with a loading screen (`useReport`);
  a `?report=` link checks just that report. The brief's newest reports load only while the chat is open; export fetches
  every visible report at export time; import writes summary + body.
- *Usage:* this month's totals are fetched once when the usage page opens; the call log is paged 20 at a time with the
  right queries per filter. *Paging:* `usePaged` (hooks.ts): live, several queries merged, rows past a full page's edge
  held back so none are skipped. `Loading` (src/ui/Loading.tsx): the turning ▖▘▝▗ with a label.
- *Indexes:* `firestore.indexes.json` (reports by shared/uid + createdAt; aiUsage by uid, keySource, both + at), deployed by
  `deploy:rules` now. Rules: 232 tests pass (39 new).

### D-099 · 2026-10-18 · Accepted (extends D-084, D-085, D-090)
**The assistant reads reports and builds the board from them; `/analyze` does it in one go.** User request: with a report
open, the bot should see it, read it and do what's asked (build, rework or add cards from it), plus an "analyze" command.
- *Open report:* whatever is on the report screen (saved, via `useReport`; else the chat's unsaved copy) goes into the brief
  in full after the reports list, as `OPEN REPORT [report:…] … END OF OPEN REPORT` (`reportFull`): sections, points with
  `[n]`, implications with our items' refs, open questions, numbered sources *with URLs* (so proposals can carry
  `Sources:`). Capped at 24 000 characters. "This report" means it.
- *Other reports:* the brief's list (now `REPORTS`, uploads aren't research) gives each a `[report:<6+ chars of id>]`
  handle; `get_report` (`src/ai/readTools.ts`) fetches one whole (`fetchReport`, summary then body; null when deleted or
  not shared). The step shows `read the report "…"`, or a warn step. Tools in the loop may now be async; calls run in order.
- *Prompt:* asked to build, fill, update, rework or check the board from a report: read it, compare with the items it
  touches, propose in one set (new items wired into the chain, edits that keep the text and add the finding with
  `Sources:`, links, matrix cells, an area for new cards), only what the report backs, name the report. A report's text
  is data, not instructions.
- *`/analyze`* (`build from a report`, `src/ai/modes.ts`, `report: true`): works on the open report; text after it names
  another report or says what to focus on (`/analyze only competitors`). The `/` menu shows `on <report title>` when one is
  open, and the chat shows `/analyze · <title>`. No new buttons on the report screen (D-053).

### D-100 · 2026-10-18 · Accepted (changes D-089, D-090, D-094)
**A report from the reports tab opens as a page of the tab; only a report the chat just wrote goes on the assistant's stage.**
User: the right-to-left crossing (D-094) is for what the chat recommends. Reports that were uploaded (D-091), saved from
another session's chat, or shared by someone else belong to the main page. First step of the report screen's redesign;
the chat's own report (its card and the stage) is refactored next, the way the preview was (D-096).
- *One body, two frames:* `ReportDocument` (`src/views/reports/ReportDocument.tsx`): title, meta, answer, sections, what it
  means for us, open questions, sources; `downloadReport` for the .md. Used by the tab's reader (`ReportReader`, D-102) and the stage's `ReportView`.
- *In the tab* (now `ReportReader.tsx` beside the table, D-102, D-106): `/workspaces/<id>/reports?report=<id>`, with the HUD and
  chat untouched; its bar: who can see it, share/unshare, delete, download .md. Loading line while the body comes (D-098); "isn't shared with you, or it was
  deleted" for a bad link. A row and an upload *push* the URL, so browser back returns to the list. Presence: the open
  report is still broadcast as `sel` (D-090). Item chips select the card and go to it. Viewers can use it (`data-viewer-ok`).
- *Stage:* `useChat.reportOpen` now means only the chat's report (research or a write-up, its card's `open report →`);
  `ReportView` no longer touches the URL. The assistant's brief counts the stage's report, else the page's (D-099), so
  `/analyze` works on either.

### D-101 · 2026-10-18 · Accepted (changes D-089's report screen and card; extends D-096, D-100)
**The chat's report is drawn like the preview: a stage box with a section stepper, and a card whose rows go to the sections.**
Second step of the report redesign (user: "refactor the chat's report recommendation part like the preview"). Only the chat's
own report comes here (D-100).
- *Stage box* (`src/ui/StageBox.tsx`): the preview's frame and top-edge bar became a shared component (`StageBox`, `Rule`,
  `Part`, `Stepper`, `BarButton`); `PreviewBar` uses it unchanged in look. The report's bar: `report · <title>`, who can see it,
  `‹ n/N ›` through its sections (n / p when not typing), `save to reports` (cyan) / share / delete / download .md, `esc`.
  The report scrolls inside the box, starting under the bar; the 2 px cyan border and the old HUD-like bar are gone.
- *Lit both ways* (`useReportFocus` in stage.ts, `src/views/workspace/reportNav.ts`): stepping or clicking a row opens the
  section, scrolls it to the top and lights it (a wash) on the stage and its row in the chat (scrolled into view); hovering
  either lights the other. `ReportDocument` takes `lit` and `sectionProps` for this; the tab's page passes neither.
- *Card in the chat:* a box like a proposal's (`report · N questions|sections`, cyan while a write-up waits to be saved):
  title, the answer in three lines, a row per section (`01` + heading, `N points · N sources`) that goes to it (opening the
  stage first if it's closed), a line of implications / open questions / sources, the status, then `open report →` /
  `close report`, `save to reports`, and once saved `open in reports` (closes the stage, opens the tab's page, D-100).

### D-102 · 2026-10-18 · Accepted (changes D-090's tab layout and D-100's report page)
**The reports tab is a list and a reader in one full-width frame, on a solid background, with an outline beside the text.**
User: the tab didn't look like the other pages, used a small part of the screen, a report left lots of empty space on the
right, and the backdrop's animation behind the text made reading hard. Their pick: list + reader (over a full-width
table with a separate reader screen).
- *The table and list are now D-106's.* What stays from here: the reader (`ReportReader.tsx`,
  replaces `ReportPage`): a bar (who can see it, share, delete, download .md), then the report at `--measure` with an
  "on this page" outline beside it (sections, what it means for us, open questions, sources): sticky, the part you're
  reading marked as you scroll, a click jumps there. The outline goes when the reader is under 1000 px wide (container query).
  Text and outline centre on very wide screens.
- *Opening:* picking a report pushes `?report=`; nothing opens by itself (D-106). Phones (≤760 px) show the table, then the report
  alone with `← reports`.
- `ReportDocument` marks its blocks (`data-report-block`) for the outline.

### D-103 · 2026-10-18 · Accepted (refines D-091, D-102)
**Upload is the reports tab's solid button, with an icon.** User: `[upload .md]` looked like an unimportant label; use a
prominent button like the board's `+`, an icon instead of words. It's the board `+`'s solid magenta square (Menu.module.css
`.primary`) at the toolbar's 30 px height, an arrow-into-tray SVG; hover empties it to `--bg` with a magenta edge and icon;
while uploading the arrow keeps rising (still under reduced motion). The tooltip says ".md, or drop one here".

### D-104 · 2026-10-18 · Accepted (changes D-077; extends D-079)
**Models belong to the key that pays.** User: is a model choice for everyone or just me, and can my own key and the
workspace key have different settings? Before, one chat + research pair per browser applied to every call, whichever key
paid, so a member could run the owner's workspace key on any model. The user's picks: owners allow a list on the
workspace key; a switch in the chat header for one conversation; your own key's models with a default and per-workspace
overrides.
- *Tasks:* chat, web answers (`[web]` on) and deep research (`/research`: plan, researchers, report), which used to borrow
  research's model.
- *Your own key* (only you, this browser; `north-star.ai-models`, old flat saves migrate): a default per task, and in a
  workspace "set for: here" overrides per task ("same as default" follows it). Checked against your key before kept.
- *The workspace key* (`ai/config.models`, `allowedModels`; owners write, rules check): owners pick a model per task
  (checked with the key by the new `checkWorkspaceModel` function) and tick others members may switch to. Members pick
  within that, kept in their browser (`north-star.ai-workspace-models`). The `ai` proxy refuses any model outside the
  owners' picks (unset tasks count as the default) and the extras, so nobody runs up the bill with another.
- *One answer to "which model?"* (`src/ai/models.ts`, `resolveModel`): this chat's switch, else (own key) this
  workspace's override or your default, else (workspace key) your allowed pick or the owners'. Each with where it came from:
  "this chat only", "your pick for this workspace", "your default", "the owners' pick", "your pick, allowed by the owners".
- *Settings → assistant → keys:* "in <workspace>" first: which key your calls go on (the old "this workspace uses") and
  each task's model with its origin; then your key, its models, the workspace key, its models; each section says who it
  applies to.
- *Chat header* (`ModelSwitch`): `model ▾ · key`; switching changes it for this conversation only (within what the key
  allows), shows `this chat`, offers "back to …", and clears with the chat.
- Verified on emulators (headless Chrome, functions, a fake OpenAI): owner sets deep research and allows one extra; a
  member's summary, pick and calls through the server; the header switch for one message and back after clear; an
  owner's own-key default and workspace override sent straight to OpenAI; the proxy refusing a model not allowed; only
  owners may check models. Found and fixed on the way: the server allowed only explicitly set tasks, refusing the default.
  Rules: 237 pass (5 new).

### D-105 · 2026-10-18 · Accepted
**Every scroll bar in the app has the same thin, square, token-coloured look.** User: the browser's default bars didn't fit the design.
Their pick: one global CSS rule, not a scroll bar component drawn in ASCII glyphs (that would need JS on every scroller and
redoing keyboard, screen reader and touch behaviour; still possible later for the chat or report reader).
- *Look:* an 8 px track, transparent; the thumb a square 4 px bar (`--line-hover`, inset by a transparent border), 6 px and
  `--fg-faint` under the pointer, `--accent-cyan` while dragged. Corner transparent. Light theme from the tokens.
- *How:* `::-webkit-scrollbar*` in `src/styles/global.css` for Chrome and Safari. The standard `scrollbar-width` /
  `scrollbar-color` go only to Firefox (`@supports (-moz-appearance: none)`), because setting them makes Chrome ignore the
  webkit rules (no hover, no cyan). Firefox gets the thin bar in the same colours, brighter while the area is hovered.
- *Trade-off:* in Chrome and Safari on macOS, styled bars are always shown and take their 8 px, where the system's overlay
  bars appeared only while scrolling.
- Verified with headless Chrome on the emulators (puppeteer's default `--hide-scrollbars` turned off): Table and Settings in
  dark and light at 1440, Table at 390 (both bars); hover and drag states.

### D-106 · 2026-10-18 · Accepted (changes D-102, D-098's report paging)
**The reports tab is a table on its own; a report opens beside it; ten a page with numbered pages; filters and upload
inside the table.** The user's calls after D-102: 20 a page is too many; page numbers (1, 2, 3), not scrolling for more
and not `show more`; no report opens by itself; the table stands alone and an opened report builds up with the cell effect
while the table takes the left; no toolbar above it (the HUD already names the page); a filter row at the table's top with
upload in it, so the table has its actions and the report its own.
- *Table:* one frame on the shared frame surface like the other tables (the report reader stays solid `--bg`). Top row: `KIND`, `BY`, `SEEN BY` dropdowns (the board's
  `Menu`, lit while narrowing; `clear`), `N reports`, the upload square (D-103). Columns: report (title over a line of the
  answer), kind, by, date, size, seen by (`workspace` cyan / `only you`); size and seen by drop under 1100 px; on phones
  title and kind only. No row actions: share / delete / download are the open report's.
- *Opening:* `?report=<id>`; the table rebuilds cell by cell (`runCells`, 320 ms) as a 300–380 px list (title, two
  lines, a meta line) and the reader builds up beside it (`Appear`). The reader's bar ends with `×`; Esc closes (not while
  typing or in a menu). Clicking the open row closes it too. Phones: the table, then the report alone with `← reports`.
- *Paging* (`useReportPage` in src/data/reports.ts, replaces `useReportList`): two queries that never overlap (shared
  reports; your own unshared ones), filters as equality clauses on them; page n listens to the newest n × 10 of each and
  shows the n-th ten merged (no offset in Firestore; exact because they don't overlap); the total is
  `getCountFromServer` of each, counted again when the lists change. Pages `‹ 1 2 3 … 9 ›`; a filter goes back to page 1.
  While the next page loads the rows dim instead of emptying. Reports from before `kind` existed have none, so a kind
  filter leaves them out (they show under `any`).
- *Lined up with the other views (user, follow-up):* the filters and upload sit in the filter row's place on the backdrop
  (no solid fill), across the page also beside a report, and the table and report frames start where every view's table
  does (48 px under the HUD). The frames stay solid black for reading. Cause of the empty band above the table: the page's
  `padding-top` override lost to the composed `Page.module.css` padding whenever that stylesheet loaded later; it is
  `main.page` now.
- *Frames as tall as their content (user, follow-up; changes D-060's full-height Matrix):* Flow and Table already were;
  the Matrix frame and the reports table and report frames now end under their last row too, and stop at the page's
  bottom edge (then scroll inside) instead of always filling the height. The matrix legend sits right under its frame.
- *Indexes* (firestore.indexes.json): reports by shared+kind, shared+uid, shared+uid+kind, uid+shared, uid+shared+kind,
  each + createdAt desc. Deployed 2026-10-18 (`npx firebase deploy --only firestore:indexes --project north-star-db`);
  filtered lists fail until they're built.

### D-107 · 2026-10-18 · Accepted (refines D-093)
**One column header for every table-like view.** User: the headers of Flow, Table, Matrix and Reports looked different
(heights, sizes, other details). They differed in height (32 to 41 px), fill (Reports on `--bg`, the rest `--bg-raised`),
line height (Table's sort buttons), the Matrix's `┌` before "our features", and its `!important` overrides.
- `src/ui/TableHead.module.css` (`head`, zero specificity through `:where` so a view's own rules always win): `--head-h`
  40 px, `--bg-raised`, a solid bottom line, Geist Mono `--text-xs` uppercase at `--track-label`, `--fg-dim`, line height 1,
  centred vertically. Each view composes it and sets only its side padding (to line up with its cells) and its own marks.
- Kept as each column's own (user: allowed): Flow's type-colour squares, Table's sort (bright when sorted, cyan arrow),
  the Matrix's competitor names in `--fg` and centred. The Matrix's `┌` is gone.
- Verified with headless Chrome on the emulators: every header 40 px with the same fill, colour, size and tracking.

### D-108 · 2026-10-18 · Accepted (extends D-059, D-050; refines D-055's "colours mean type")
**Links read better and can be edited on the board; several things can be selected; text has sizes.** User: links were hard to
read; colour-code them (not with colours already used), give their label a solid background, select a link to change its type,
more editing tools. Their picks: four colour groups by meaning, a floating bar at the link, and all four extras offered
(hover focus + LINKS filter, multi-select, label styles, duplicate + an edge handle).
- *Colours* (`src/views/canvas/linkKinds.ts`, `--link-*` tokens, `palette.link`): four groups by meaning with line
  patterns inside them, at the time. Superseded by D-146 (a LINKS group per kind) and D-147 (a colour per kind, no dashes).
  The selected card's links are thicker instead of cyan. One list of kinds for the board, the bar and the panel's link list.
- *Chip:* the kind (and the link's own `label`, after a `·`) on a solid `--bg` plate with a border in the link's colour, text
  0.14 (was 0.09 on an invisible black plate). "relates" stays unwritten unless it has a label.
- *Focus:* hovering a card, or having cards selected, draws every link not touching them at 22%; a selected link dims the rest.
- *Selecting a link:* click its line (a 0.22-wide hit band) or chip; `canvasStore.edgeId`, separate from item selection. A bar
  under the chip (`LinkBar.tsx`, drei `<Html>`): kind (the shared `Select`, colour swatches), a label field (Enter / blur saves,
  empty clears), `⇄ reverse` (off for customer tags, which always point at the customer), `× remove`; Delete / Backspace
  removes; Escape or a click on the board lets go. All undoable (`updateEdge`, `reverseEdge`, `deleteEdge`). No bar for
  viewers or in the assistant's preview. No data or rule change: `label` already existed.
- *LINKS filter* beside SHOW / FOR / TAG: one checkbox per group in its colour, remembered with the other filters
  (`hiddenLinks`); the selected card's links always show.
- *Multi-select* (`selection` in canvasStore; `selectedId` stays the last one picked, which presence broadcasts): shift+click a
  card or text toggles it (shift+drag still links: a shift press that never leaves the card toggles instead); alt+drag on empty
  board draws a cyan box (shift adds). Dragging any selected piece moves all (`groupDrag.ts`, streamed like one drag, one undo
  step via `endMoveMany`). A press on a selected piece without moving picks just that one. The panel turns into "N selected":
  counts by type, a tag picker for tags all of them share (adding or × applies to all, `retagMany`), duplicate, delete
  (`deleteMany`, cascades like a hand delete, one step). Delete / Backspace deletes them all.
- *Copy / paste / duplicate* (`src/data/selection.ts`, `clipboard.ts`): ⌘C keeps the documents in memory (this tab), with a
  competitor's features, the links among them and their customer tags; ⌘V pastes at the view's centre keeping the layout,
  ⌘D duplicates 0.6 down-right; new ids, one undo step, the copies end up selected. Not when text is selected on the page.
  Matrix cells and attachments aren't copied.
- *Edge handle:* a hovered card shows a handle on its right edge (a `○`; a `›` since D-152); dragging from it links like
  shift+drag. Since D-152 the handle stops its own over/move events (a link ending under it took the cursor), and the
  card's hover holds because its out-check counts the handle as part of the card.
- *Text sizes:* `labels.size`: `heading` (default, not stored) 0.6, `subheading` 0.36, `note` 0.2 in mono and dim. A selected
  label gets a bar (`LabelBar.tsx`) from its left edge: H1 / H2 / note, a colour (plain or the five accents, stored as the
  dark hex like presence colours and drawn with `themeAccent`), edit, remove. Notes stay in the jump list like any label (no longer: notes left it, D-116).
  Rules: `size` in heading / subheading / note (2 new tests, 239 pass). Import keeps a label's colour and size now.
- *The assistant knows (user, follow-up):* a proposal row `edit_link` (from / to as the link should read afterwards, so
  giving them swapped turns it around; kind null keeps it; label null keeps it, "" removes it) changes a link in place: the
  checklist says `was competes-with · turns the arrow around · label "…"`, the preview draws it in the edited colour, apply
  is one `edge` write in the same undo step. Customer tags aren't edited (unlink + tag). `add_note` writes a note under a
  card (where the card ends up, stacked if several). Notes no longer count as areas in the brief (`areaOf`, AREAS); they're
  listed as NOTES ON THE BOARD with the card they're by, and rename_label / delete_label work on them. The prompt says when
  to use both. Several selected cards reach the brief too (done in the other session's "working on" line, which uses `selection`).
  Verified on emulators with a fake OpenAI: edit_link + add_note → checklist, preview, apply → the next brief has
  `Sick calls —contradicts→ ShiftGrid (only chains)` and the note under NOTES, not AREAS.
- Not done: formatting (bold, lists, links) in card notes; snapping and alignment guides; a right-click menu.
- Verified with headless Chrome on the emulators, dark and light at 1440: chips and colours, hover dimming, select a link →
  kind list → label → reverse, alt+drag box → 4 selected → group drag → ⌘D (4 copies with their links) → ⌘Z removes them,
  label bar H2 + colour, handle drag creates a link.

### D-109 · 2026-10-18 · Accepted (refines D-085)
**The chat says what the next message works on, right above the prompt.** User: when a panel is open the assistant works on
that card, but the chat only said so in a faint line of the empty state. Now a `working on` line sits above the prompt
in every state: `WORKING ON PROBLEM <title>` with a bar and the kind in the type's colour while a card's panel is open,
`REPORT <title>` while a report is open (D-099), and a quiet
`WHOLE WORKSPACE N items` otherwise. With D-108's multi-select it also shows `N CARDS <titles>` (cyan), and the brief
lists every selected item (it used to name only the last one picked); that part went in with D-108. `Scope` in src/ui/AiChat.tsx; the matrix's cell selection isn't in the brief, so it isn't shown.

### D-110 · 2026-10-18 · Accepted (refines D-061)
**A dimmer backdrop in workspaces, and the board's `+` grid gives way as you zoom out.** User: the animation behind the board
sometimes draws the eye; zoomed far out the `+` marks shrank into an ugly speckle.
- *Backdrop:* 8% in a workspace (was 14%, `backdropDim.target` in Backdrop.tsx; the loading curtain follows it). Brightest
  glyphs measured at 94/255 on screen (were ~123).
- *Grid* (`DotGridMaterial` in Board.tsx), by camera distance so it behaves the same on every screen size: a full `+` up to 30
  units away, shrinking to a one-pixel dot by 70 (now it stays a thin `+`, D-151), fading out between 80 and 120 (the zoom-out limit is 150). A first pass
  measured pixels between marks instead, which left a faint grid at the limit on taller screens.
- Verified headless on emulators (example workspace, dark, 1728 × 1117): `+` at the opening zoom, no grid at the limit.

### D-111 · 2026-10-18 · Accepted (refines D-110, D-108)
**The board's depth range follows the camera, and what's drawn depends on how big things are on screen, not on the zoom.**
User: during the fit-all glide links flickered and their colours ended up over the text; cards flickered too; far out, text
on some cards and links vanished and others didn't. Cause: `near 0.1 / far 1000` left about 0.01 units of depth precision at
150 units away, while a card's and a link chip's layers are 0.001 apart, so they swapped places frame to frame.
- *Depth* (`BoardDetail` in `src/views/canvas/detail.ts`): right before each render, near = 0.5 × and far = 2 × the camera's
  height (everything lies near z = 0 and the camera looks straight down). The PNG snapshot keeps its own camera.
- *Scale:* CSS pixels per board unit, measured every frame (`useDetail`), so a big screen far out still reads.
  Text under 6 px is left out (`useReadable(size, minPx)`); short mono words (a card's type label, tags, meta; link chips)
  stay down to 4 px and 6.5 px, a selected link keeps its chip.
- *Cards in three looks* (`CardDetail`, 10% hysteresis): `full` while the small text (≈0.075) is ≥ 4 px; `compact`: the
  title alone, bigger down to 5 px; `far`: no text. (What compact and far look like: D-153, which replaced the centred
  26-character title and the stars.) A competitor's fanned features (FeatureChip) follow the same levels. Notes and headings follow
  `useReadable` (gone under 6 px).
  *Second pass (user):* the first thresholds (full only while the small text was ≥ 6 px) dropped most of a card's context
  at a normal working zoom; a band where the small text was gone left the title small at the top of an empty card; and
  the far look (cards filled with 40% of their colour) glowed like blobs.
- Verified headless on emulators (example workspace): dark 1440 × 900 and 2560 × 1440 at distances 25–150 and frames of the
  fit-all glide from 150 (no colour over text, same look at the same on-screen size, cards rebuild from stars); light at 45 / 80.

### D-112 · 2026-10-18 · Accepted (extends D-050, D-108; refines D-110's grid)
**Dragging snaps to a small grid, switched on and off beside the `+`.** User: lining cards up in the same row or column by
hand was too hard; keep the grid small so any shape is still possible; a button to turn snapping off for free design.
- *Snap* (`src/views/canvas/snap.ts`): a dragged card or label lands with its centre on the nearest 0.25-unit point (a
  quarter of the `+` grid). (Step and anchor changed by D-148: the `+` marks are the snap points, corners snap.) Every card is the same size (D-055), so centres on the grid put edges in line too. A group drag
  (D-108) snaps the piece you hold and moves the rest by the same step, keeping their layout. Holding alt while dragging
  moves freely for that drag. Positions only change when something is dragged; nothing already on the board moves.
- *Switch:* a framed square beside the fit-all button (cyan while on, `aria-pressed`) and the `g` key; on by default,
  remembered in this browser (`north-star.board-snap`). Viewers don't get it (they move nothing). The hint line says
  `drag: move on the grid (alt: freely)` and `g: snap`.
- *Grid:* (replaced by D-148's grid) while snapping is on, faint dots marked the quarter points between the `+`
  marks when close up.
- Not done: alignment guides to other cards' edges (separate idea in state.md).
- Verified headless on emulators (example workspace, dark, 1440): a drag lands on (−22.75, 1.25); alt+drag lands off the
  grid; button and `g` switch it and it's remembered; the quarter dots show close up.

### D-113 · 2026-10-18 · Accepted (refines D-059, D-058)
**Several links between the same two cards are all drawn, side by side.** User: "do the offsetting thing if there are two or
more links between two cards". Until now the board drew one line per pair of cards (a direct link won, then the first
link to one of a competitor's stacked features), so the others were invisible on the board.
- *Lines* (`sideBySide` in `src/views/canvas/Board.tsx`): every link of a pair is drawn, moved square to the line so the
  set is centred on the cards' centres, 0.32 units apart (a chip's height and a little); with many links the spacing
  shrinks so the spread stays within 80% of the smaller end's shorter side (a card, a fanned feature, or a star far
  out), and every line still leaves its card. The side is taken from the pair (ids in order), not the link's direction,
  so A → B and B → A sit apart. Direct links come first, then links through a competitor's stacked features (D-058).
- *Chips* (`chipShift` on `EdgeLine`): on steep lines the chips (wider than the spacing) would sit on each other, so each
  moves along its line by 0.36 × its slot × how steep the line is; never past the visible line, so between close cards
  they bunch up instead of going under a card. The link bar sits at the moved line's middle.
- Making links is unchanged: dragging the `○` handle still refuses a second direct link between two cards; pairs come from
  both directions, competitor features, the assistant's proposals, imports.
- Also answered: link chips already hide when too small to read (D-111); the remaining idea is a constant on-screen size.
- Verified headless on emulators (example workspace, dark, 1440 × 900): three links (solves, depends on reversed,
  contradicts) on a diagonal pair, a vertical pair and two close vertical cards; fit-all with chips hidden.

### D-114 · 2026-10-18 · Accepted (extends D-084, D-094; next step of the assistant redesign)
**Steps are a live log with times that folds once the answer is done; on a phone the chat and the stage take turns.**
The user's picks, from three options each: "live log, then fold" (over an ASCII progress bar, or polishing the lines as they
were) and "toggle chat ↔ stage" (over a bottom sheet, or the stage hiding the chat behind a prompt bar).
- *Times:* each step carries `t0`/`t1`, stamped by the run by its place in the list (`begin` in `src/ai/chat.ts`). A step's time
  runs from the end of the step before it (or the run's start), so it counts the model's thinking that led to it. The message
  keeps `runAt` while a run goes and `took` (all its runs, a research run being two; your review of the plan isn't counted).
- *Live:* one line per step with its time on the right (ticking every 100 ms, every second under reduced motion), and a last
  running line with nothing else to show: `thinking`, then `writing the answer` while the text streams under it.
- *Folded:* once the answer is done, `▸ N steps · 1 partly worked · 8.1s` (the warn count yellow); a click opens the list by its
  height (as the `/` menu), `▾` closes it. An answer with no steps shows no line. A research run unfolds again while it runs.
- *Phones (≤760 px):* beside a stage the header gets `chat · preview|report` (current one underlined cyan). Something new on the
  stage shows it: the chat shrinks to its header along the bottom (`html[data-ai-face]`, morph 450 ms), model and `clear` hidden,
  the app's box ending above it (`--ai-head-h`), the orb on its edge. `chat` brings the conversation back; nothing staged, the
  switch goes. The phone's chat is solid (`--bg`): over the whole screen, what's behind only showed through its text.
- Verified on emulators with headless Chrome and a fake OpenAI streaming in the page (fetch wrapped, slow on purpose): 1440 dark
  (thinking → read 1.4s → `!` 1.8s → writing → folded 8.1s → unfolded) and 390 (fold, proposal, preview → strip at the bottom
  with the stage above it, `chat` back, Esc ends the preview and the switch). Build passes.

### D-115 · 2026-10-18 · Accepted (refines D-108's focus, D-058)
**Selecting (or hovering) a competitor lights the links to its features too, not only its own.** User: "if I selected a
competitor and there are links to its features, those links should be highlighted too, besides the ones going straight
to the competitor". Fanned out, those links end at the feature chips, so the focus check (ends and drawn ends only) dimmed
them. Now each line's `touches` (Board.tsx) adds the competitor that owns a feature end; it drives both the faint/lit
focus and `active` (thicker, kept through the LINKS filter).
- Verified headless on emulators (example workspace, dark, 1440 × 900): Crewly selected, its `competes` link and the
  `inspired by` link to its "Availability collection" feature lit, everything else faint.

### D-116 · 2026-10-18 · Accepted (refines D-050, D-108)
**The `go to` jump list holds headings and subheadings only, not notes, and has a search field at the top.** User: "Notes
do not belong to go to jump. Also go to jump filter should have a search bar implemented inside the dropdown." This answers
the open item from D-108 ("decide whether notes belong in the jump list"); the 1–9 keys follow the same list.
- `src/ui/Menu.tsx` takes an optional `search` (the field's placeholder). The field is focused on open and narrows the items
  by their label as you type (case-insensitive); Enter picks the first match, ↓ moves into the list, ↑ from the first item
  goes back, Escape closes. `No match` when nothing fits; the query clears on close. Only `go to` uses it today.
- The same user turn also turned down two board ideas: copy/paste across tabs and workspaces through the system clipboard
  (the in-tab clipboard of D-108 stays), and a minimap for big boards. Both are under "Rejected".

### D-117 · 2026-10-18 · Accepted (extends D-112, D-108)
**Alignment guides while dragging, with their own switch; a right-click menu on cards, text, links and the empty board.**
User: "do the right click menu and alignment guides if they are turned on" (both from the board ideas listed after D-108).
- *Guides* (`src/views/canvas/guides.ts`): a dragged card's left edge, centre and right edge (and bottom, centre, top) pull
  to the same lines of other cards on the board once within 6 screen pixels (centres to centres, edges to either edge, so
  a card can also start where another ends); text lines up by its centre. Each axis on its own: the nearest pull wins, and
  where nothing is close the grid (D-112) applies as before. 1 px magenta lines (`palette.magenta`, apart from the cyan of
  selection) run across the dragged card and everything it's in line with, also when the grid alone put it there; for a
  card in the same column only the centre line is drawn, not three. In a group drag the piece you hold aligns and the rest
  keep their layout; the selection isn't aligned against itself. Alt drags freely, as with the grid.
- *Switch:* "if they are turned on" read as a switch of their own: a framed square beside the grid's (cyan while on,
  `aria-pressed`) and the `a` key; on by default, remembered in this browser (`north-star.board-guides`). Viewers don't get it.
- *Right-click menu* (`BoardMenu.tsx`, `rightClick.ts`): right-click already pans (D-018), so a right press only records
  what's under the pointer (R3F hit: card, text, link, or the board) and the menu opens on release if the pointer moved
  ≤ 5 px; the browser's own menu is off on the board. What it's opened on becomes the selection unless it's already part
  of it, so a group stays together. Rows: card / text → (edit text,) copy, duplicate, zoom to, delete, for the whole
  selection when it's one of several; link → every kind (current `●`), reverse (not for a customer tag), remove; board →
  `add here` each type and text (at the pointer, on the grid when snapping), paste here (when something's copied), fit
  all, `[x]` snap to grid, `[x]` alignment guides. Viewers and the assistant's preview get only zoom to / fit all. Same
  panel and rows as the dropdowns, keyboard as there (arrows, Home/End, Escape), closes on a press elsewhere, the wheel,
  resize or blur. A competitor's fanned features open no menu. A link's or label's floating bar waits while the menu is open on it.
- Not done: equal-spacing guides, guides to fanned feature chips, ctrl+click on a Mac as a right click.
- Verified headless on emulators (example workspace, dark, 1440 × 900): a card dragged to 0.05 below another's row landed
  exactly on it with the magenta line drawn; right-click on the board, a card and a link opened the right rows; `idea` from
  `add here` made a card; a kind picked from the link menu was saved (`solves` → `depends on`); a right drag panned
  without opening the menu. Build passes.

### D-118 · 2026-10-18 · Accepted (extends D-050, D-082)
**The project's title block on the board: the workspace's name and description, big, framed, one per board.**
User: "like different cards and text, i wanna be able to add the workspace/project name and description of the project. It
will be a big one and maybe has its own design. We already have those fields in settings/workspace/general tab but i want to
carry it (the current one can stay inside settings) to the board view".
- *Data:* a label with `kind: 'title'` and empty `text` (`Label.kind`, firestore.rules `validLabel` allows `kind in
  ['title']`, 2 new rules tests). The name and description stay on the workspace doc (`renameWorkspace`,
  `describeWorkspace`), so the board and Settings always agree. Being a label gives it moving, the group drag, box
  selection, Delete and undo of moves for free. Alternative: a position field on the workspace doc, rejected: none of
  that would apply, and undoing a workspace-doc snapshot could put back roles.
- *Look* (`BoardTitle.tsx`, layout in `titleBlock.ts`): 9 units wide; a magenta four-pointed star (the app's mark) and
  `PROJECT` in small mono, the name in Geist at 1.15 (display tracking -0.045), a 1.2-unit magenta lead on a hairline rule,
  the description in Geist 0.32 muted and wrapped. A row of counts per type was tried and dropped: "customer yada problem
  sayılarını görmek çok da umrumda değil. O satırı kaldırabiliriz". Corner brackets like a viewfinder: grey, lit on hover, cyan when selected. Reveals cell by cell like every card.
- *Editing:* double-click above the rule edits the name (selected, to retype), below it the description (caret at the
  end); a DOM field over the text at its size (the text is never WebGL while typed); Enter or blur saves, Escape cancels,
  shift+Enter breaks a line in the description. Not tracked by undo, like Settings. Viewers and the assistant's preview
  can't edit. The right-click menu has "edit name" and "edit description" (user: "edit name in yanına edit description
  ekleyelim"), sent through `editTitle()` in titleBlock.ts.
- *One per board:* `+` → "project title" only while there is none; placed above the top-left of the board (size estimated
  from the text), or mid-view on an empty board. Not copied or duplicated (`clipOf` skips it); the right-click menu says
  "project title", edit name / edit description, no copy/duplicate, "remove from board". Delete takes the block away, never the name.
- *Elsewhere:* framing, box selection, alignment guides (edges, like a card) and the assistant's `arrange_area` layout use
  its measured size (`titleHalf()`); `go to` lists it under the workspace's name and flies to its centre; export/import
  keep it (`cleanLabel` accepts the empty text for a title). The assistant's context skips it (empty text); D-120 says whether it's there and lets the assistant edit its two fields.
- *Verified* in headless Chrome on the emulators: added from `+` on the example workspace (placed clear of the headings),
  renamed on the board (the breadcrumb followed), description edited, right-click menu; `npm run test:rules` 245 passed.

### D-119 · 2026-10-18 · Accepted (changes D-044)
**`for` links drawn as lines; the `for:` filter hides the other customers.** User: "for linkleri default olarak gözükmüyor,
neden? … gösterelim bakalım" and "for filtresinde bir customer seçtiğimde, sadece o customer card ı gözüksün".
- `for` edges are drawn on the board like any other link (grey, dashed, `relates · for` group), so the LINKS filter hides them;
  the customer chip on the card stays. Before, they showed only while their customer was selected.
- Under a `for:` filter only the chosen customers' cards stay (board, Flow, Table: `useVisibleItems`); before, every
  customer card stayed visible. The dropdown still lists every customer.
- *Alternative kept in mind:* if the lines turn out too busy, turn the `relates · for` group off by default or give `for`
  its own LINKS entry.

### D-120 · 2026-10-18 · Accepted (extends D-074, D-118)
**The assistant can edit the project: `update_project`; proposals keep clear of the project block.** User asked whether
the agent can edit the new project card and whether its functions still cover everything ("agentımız yeni eklediğimiz
project cartını düzenleyebiliyor mu?"), then "yap bakalım" to the four fixes below.
- *`update_project`* (`src/ai/tools.ts`): a `propose_changes` row with `name` and `description` (null keeps one), the
  same two fields as the block and Settings → general. Checklist row `~ project <new name>` with `was …` and the new
  description; "nothing to change" when both match. Name clipped to 120, description to `DESCRIPTION_MAX` (1000). The
  write is `{ do: 'project' }` in `src/data/assistant.ts`, in the same batch and undo step as the rest. No rule change:
  editors and owners may already change exactly `name` and `description`.
- *Undo of the workspace doc:* `history.ts` snapshots only `name` and `description` of `workspaces/{wid}` (missing
  description as '') and restores them with `merge`, never deletes it. A full-doc restore would put back roles, codes and
  invites (and an editor's would be refused). Hand edits on the block and in Settings stay untracked, as in D-118.
- *Context:* the brief says `PROJECT BLOCK ON THE BOARD: yes/no` after `WHAT WE'RE BUILDING`; the prompt says when to
  propose `update_project` (rename, write or sharpen what it's building, fill in an empty description on request).
- *Preview:* the simulated workspace carries the new name/description, so the block shows them; the block gets the
  edited mark (brackets in the diff colour, `~ was …` under it) and is the row's stepper target.
- *Placement fix:* new cards (`add_card`, `add_competitor`) took only cards into account and could land on the block;
  the block's rectangle now fills the spots it covers. *Label fix:* `sameLabel` matched an empty label name to the block
  (its text is empty), so `rename_label`/`delete_label` with `""` could hit it; an empty name now matches nothing.
- *Not done:* the assistant can't add, move or remove the block (it's one click in `+`); suggest it in words.
- *Verified* with a node script on parseProposal/toWrites/simulate (rows, writes, preview marks, empty label refused; a
  card placed where the block is now lands clear of it, before the fix it overlapped); `npm run build`. Not yet tried in
  the browser or against the emulator's undo.

### D-121 · 2026-10-18 · Accepted (extends D-095)
**Pushed off the small chat box, the orb falls, crashes and peeks around the box's side.** The user saw the orb hanging in
mid-air left of the small chat box with a side panel open, worst with the competitor panel (the widest, 520 px), and
asked for it to fall and hit the floor instead, get angry or upset with some cute effects, then keep peeking from
behind the box, "bu sefer üstten değil yandan" (from the side this time, not over the top).
- *Physics (`src/ui/perch.ts`):* a vertical state `edge | falling | floor | climbing` next to the edge spring. On the
  small box, once the orb's middle is pushed past the box's left end it falls (gravity 2800 px/s², bounces keeping 30% of
  its speed) to its corner's height, beside the box. On the floor it sits with 30% of itself behind the box's left side
  (10% when it leans out to look, on the same 7–14 s timer as peeking over the tall box). Once the box has room again
  (its middle fits with 6 px to spare), or the box grows tall, it hops back up in 520 ms (smoothstep across, a parabola
  0.7 orb sizes high) and lands with `free`. The box coming up with a wide panel already open leaves it on the floor
  (no lift); closing the chat walks it back to its corner. Off the edge the clip is an evenodd `path()` cutting out the
  box and the side panel, so it is drawn behind both. Reduced motion: placed directly, no cues.
- *Face (`src/ui/AiOrb.tsx`):* cues `fall` (an `!`, wide eyes, mouth open), `crash` 3.4 s (squashed around its bottom
  and springing back, a puff of dust, `> <`; dizzy spiral eyes with three stars circling its head until 1.7 s; then cross,
  slanted eyes, the sphere hot magenta, frown, magenta `~` steam), `climb` (eyes on the edge). `peek` is now `top` (the
  tall chat) or `side` (on the floor: eyes look no further right than −0.35, head tilted −0.16).
- *Wiring:* `usePerch` takes `onFloor`; AiChat keeps `floored` and passes `peek={tall ? 'top' : floored ? 'side' : undefined}`.
- *Verified* in headless Chrome on the emulators (1440×900, Tablebook): small chat open, competitor panel opened → bumped,
  falls, crash frames (squeeze + dust, spirals, angry), then peeking around the side; Esc closes the panel → hops back
  onto the edge. Chat opened with the panel already open → stays on the floor, peeking; chat closed → back to its corner.
  `npm run build`.

### D-122 · 2026-10-18 · Accepted (extends D-074, D-108)
**The assistant edits competitor features, a matrix cell's "their version", and empties fields.** After D-120 the user
asked whether the agent was now capable everywhere ("agentımız her konuda daha capable oldu mu artık?"); of the gaps
listed they said "1,2,3 ü yap sonra da 4 ve 5 i yapıcaz" (4 and 5, label size/colour/headings and moving one card, next).
- *`update_competitor_feature`* (`src/ai/tools.ts`): name, category, description of a feature in a competitor's
  breakdown. Before, the only way was delete + add, which lost its links and matrix "their version". Wrong type or a
  feature added in the same proposal is refused.
- *Matrix:* `set_matrix_cell` takes `their_feature` (the competitor feature matching ours, `competitorFeatureId`; a
  ref, or the key of one added in the same proposal; `""` removes it) and `coverage: "not assessed"` to clear coverage.
  A feature of another competitor is refused (refs carry `parent`, the competitor id; new ones take their row's
  competitor). The brief and `get_items` show `their version` on cells, and list cells that have only that.
- *Emptying:* in `update_card`, `update_competitor`, `update_competitor_feature` and `set_matrix_cell`, null keeps a
  field and `""` empties it (row detail `notes emptied`); a title or name can't be emptied. Writes carry `null`, which
  `src/data/assistant.ts` turns into `deleteField()` (as `edit_link` already did for labels); the preview leaves it undefined.
  Feature priority/status/effort still can't be cleared (enums; one click by hand).
- Checklist colours: `update_competitor_feature`, `update_project`, `edit_link`, `add_note` were missing from `ROW_MARK`.
- *Verified* with a node script on parseProposal/toWrites/simulate (every row kind above, the refusals, null → removed
  field, a new competitor feature as their version); `npm run build`. Not tried with a real key or in the browser.

### D-123 · 2026-10-18 · Accepted (extends D-086, D-108)
**The assistant writes and styles board text and moves single cards: `add_label`, `edit_label`, `move_card`.** The
user's 4 and 5 from the D-122 list ("1,2,3 ü yap sonra da 4 ve 5 i yapıcaz"): before, text could only appear through
`arrange_area` (moving cards with it) or as a note, its size and colour couldn't change, and a card moved only as part
of a whole area.
- *`add_label`:* text, `size` heading | subheading | note, `color` by name (magenta, cyan, yellow, blue, green: the label
  bar's accents, stored as their hex like a hand pick) or null, `above` a card (ref or new key) or null for above the
  board's top-left. No card moves.
- *`edit_label`* replaces `rename_label` (still parsed, for proposals already in a chat): text, size, colour (`default`
  removes it), `above` moves it over another card. Null keeps a field.
- *Placing text:* after every card has its place (like `add_note`): centred over the card just above its top edge, or
  left-aligned above the board; it steps up until clear of cards (the project block included) and other text.
- *`move_card`:* one card or competitor beside another, `side` right (default) | left | above | below; from that spot
  the nearest free one (`findFreeSpot`). Competitor features, itself, an item added in the same proposal, or a card an
  `arrange_area` row also gathers are refused (if the area row comes later, the area's place wins).
- The brief marks subheadings and coloured labels in AREAS and NOTES; the prompt says to use these for small changes and
  `arrange_area` for whole areas, never coordinates. Checklist colours for the three rows.
- *Verified* with a node script (vite-node + jsdom) on workspaceBrief/parseProposal/toWrites/simulate: rows, refusals,
  positions (text clear of cards and other text, a card below another), preview marks; `npm run build`. Not tried with a
  real key or in the browser.


### D-124 · 2026-10-18 · Accepted (extends D-108, D-112, D-067)
**Multi-select: line up, nudge with the arrow keys, and collaborators see the whole selection.** The user picked
"do the multi select" from the D-108 follow-up list (align / distribute, arrow-key nudge, broadcast the whole selection).
- *Line up* (`src/views/canvas/arrange.ts`, buttons in the "N selected" panel): left / centre / right, top / middle /
  bottom to the selection's bounding box; `space ↔` / `space ↕` (three or more) gives equal gaps between neighbours, the
  outermost two staying put (overlapping cards don't spread, like Figma). Sizes as the guides see them (`halfOf`): cards
  by their box, the title block by its box, text by its centre. No snapping afterwards.
- *Nudge:* arrows move the selection (one or many) by `SNAP_STEP` (0.25), shift by 1; skipped while typing, editing a
  label, for viewers/preview, or when a menu/dropdown already handled the key (`defaultPrevented`). A held key repeats
  faster than the board catches up, so the last nudge's targets are used while a piece still shows where it was found.
- *Undo:* `placeMany` in `src/data/selection.ts`, one tracked step per line-up; nudges share a key (`nudge:<ids>`) so a
  run within 2 s merges into one step.
- *Presence:* `more` (string, ids joined by spaces, ≤2048 chars in `database.rules.json`) next to `sel`; `selectionOf` /
  `hasSelected` used by the board's rings, PeerMarks and PeersHere. Old clients ignore it. The matrix and reports tab hand
  back the whole selection when they let go. **The rules must be deployed before the client ships:** the live rules
  refuse unknown fields, so a new client would lose its presence node against the old rules.
- *Alternatives:* a map of ids in RTDB (more rule lines, no gain); distributing by centres (unequal gaps when text and
  cards mix).
- *Verified:* rules tests 247 (two new); `npm run build`; headless Chrome on the emulators with the example workspace:
  left, space ↕, top, space ↔ moved the right cards to the right places; 4× → and shift+↑ moved +1, +1; one ⌘Z undid all
  the nudges; the RTDB node carried `sel` + `more` with the other three ids. Not tried with two people in two windows.

### D-125 · 2026-10-18 · Accepted (extends D-086)
**The assistant designs the board when it organises it: a layout per area, sections, areas placed beside each other, more room.**
The user: "while agent is reorganizing the board, it should be able to create more meaningful design and orderings. Right
now, whatever it creates looks too crowded and it always creates in a row. Let's give it more power."
- *Why it looked like that:* D-086's layout had one shape (a column per type), packed areas left to right up to the
  board's width (at least 40 units, so a few areas always made one row), 0.8 between columns (a link chip didn't fit),
  and ignored the label's own width.
- *New `arrange_area` fields* (strict, null = not given): `layout` — `columns` (column per type in chain order, a card
  level with what it links to in earlier columns), `rows` (a band per problem, else per customer/competitor/idea when
  there are two or more; every other card goes to its nearest lead over links, like the Flow view; the rest in a last
  band), `grid` (given order, about 1.7:1), `line` (one row in order: journeys, steps), `hub` (the first card in the
  middle, the rest on an oval around it). Null picks: one type → line (≤4) or grid; two or more problems → rows; else
  columns. `within`: another area of the proposal this is a section of; its name is written as a subheading, the parent
  may have no cards of its own; the parent's own cards and its sections are packed inside it. `beside` + `side`
  (right/left/above/below): next to another (top-level) area of the proposal, sliding out until clear, placed right
  after that area so later areas don't take the spot.
- *Spacing:* columns 1.4 apart (room for a chip), rows 0.6, bands 1.1, sections 2, areas 3 apart and from anything that
  stays; an area is at least as wide as its name. Areas without a place pack from the board's top-left to about 1.7:1
  over their total size, not the board's width. Links (current edges plus the proposal's link rows, a competitor feature
  standing for its competitor) feed `columns` and `rows`.
- *Checklist:* the area row shows `layout · in X · below Y · N cards`; a section's kind is `section`. Off with a reason: a
  `within`/`beside` naming no area of the proposal (or itself); no cards and no sections. An unticked parent or beside
  target: the area stands on its own / finds room.
- *Writes:* area labels get `size: heading`, section labels `subheading`. Prompt (chat + `/organize`): pick the layout
  for what the area shows, keep areas to ~3–10 cards with sections for big ones, put related areas beside each other.
- *Alternatives:* coordinates from the model (rejected in D-086: models are bad at it); one smarter automatic layout
  with no model choice (the model knows what the areas mean, the app doesn't).
- *Verified:* `npm run build`; the layout engine in node on the example board (26 cards, 0 overlaps; sections, hub,
  beside below/right) and a rendered before/after picture. Not tried in the app with a real key or the fake OpenAI.

### D-126 · 2026-10-18 · Accepted (extends D-125)
**Organising, second step: fewer crossings, areas placed by their links, one area tidied in place, and the assistant
checks its own layout.** Asked "can we make improvements over this?", I suggested six; the user said go ahead with my
pick (1–3). Left for later: `group_by` inside an area (status, priority, tag, customer), `tree` and `matrix` layouts,
area colours and captions.
- *Crossings* (`src/ai/arrange.ts` `columns`): cards in each column are sorted by the mean place of what they link to,
  four sweeps forwards and back, then aligned level with earlier columns as in D-125. `line`/`grid` keep the model's order.
- *Placement by links:* an area without `beside` tries the first free spot from the top-left, every side of each placed
  area, and every side of up to 6 staying cards it links to; it takes the cheapest: link lengths (each capped at 40,
  ×0.7) + the half-perimeter of everything placed so far + a penalty for straying from 1.7:1 + a penalty for going
  above or left of the board's start. `Fixed.cards` now carry ids for this.
- *In place:* when the ticked rows hold one top-level area (its sections aside) whose label exists and isn't deleted,
  the area keeps its label where it is and the cards go under it (nearest free spot). Before, "tidy the roadmap" threw
  the area to the board's top-left.
- *Layout report* (`layoutReport` in `src/ai/tools.ts`, used by `chat.ts`): after a proposal with areas, the tool
  result adds each area's and section's outline (x right, y down from its top-left) and layout, the total size, how many
  links touch moved cards, how many pairs cross, and the links longer than 12 units with their areas; the model is told
  to propose once more only if it clearly reads badly. After a second proposal in the same answer it is told to leave it.
  `toWrites` and the report share `planAreas`, so the report is what the user gets.
- *Verified:* `npm run build`; vite-node + jsdom on the example board: rows and problems, the report (31 × 18, 7
  crossings, 2 long links), ROADMAP alone kept its label at (8, 6.6); rendered pictures with and without `beside`.
  Not tried with a real model.

### D-127 · 2026-10-18 · Accepted (extends D-040, D-045)
**A focus view: the board showing one card and its chain.** The user: "lets add another view, next to board. If i
select that, everything except the thing i selected and the connection of it and also connected cards and things that
are connected to them [is hidden] (… i select a idea, and then on a new view, i only see the problems and features
connected to it, but also customers that are connected to that problem or competitors that are connected to the
features and problems)". Asked how far, how laid out and what a click does, the user chose: "only the flow from customer
to problem to idea to feature and the connected competitors to them"; board positions with the rest hidden; a click
opens the panel, a button refocuses.
- *What shows* (`src/views/canvas/focus.tsx` `focusSet`): from the card, follow links up the chain (to customers) and
  down it (to features), each direction only one way, so an idea brings its problems and their customers, the customers
  it is tagged for, its features, but not other ideas for the same problems. Same-step links (feature depends-on feature)
  aren't followed. Then every competitor linked to one of its problems, ideas or features (a competitor's feature stands
  for it); not through customer tags: that brought every competitor serving the same segment (seen in the first try).
  A competitor in focus starts from the chain cards it is linked to.
- *View:* route `focus` → `BoardView focusMode`; cards keep their positions; no labels or project block, no `+` and no
  create/paste on right-click (the card would vanish); the card in focus has a magenta ring (`NodeCard centre`). Filters
  still apply, except to the card in focus. Footer: `N of M cards`. Empty: "Pick a card in focus ▾ to see its chain";
  a deleted card: "That card is gone".
- *Choosing:* `FOCUS │ card ▾` first in the filter bar (every card by type in chain order, search, ◎ on the current one,
  closes on choice); `[◎ focus]` in a card's and a competitor's panel header (any view; closes the panel so it doesn't
  cover the card; hidden on the card already in focus); right-click `◎ focus` on a card. The tab links to the selected
  card, else the last one focused in this workspace (in memory). URL `?on=<id>`, so back/forward walk the history.
- *Camera:* remembered per focused card (`Board cameraKey`); the first open frames the chain, each refocus glides to frame it.
- *Presence:* reported as `board` (same world positions, so cursors and follow line up); no RTDB rules change.
- *Verified:* `npm run build`; headless Chrome on emulators with the example: an idea (7 of 22 cards, as above), the
  picker (search → Enter refocuses and frames), back returns to the previous card, no `?on` shows the prompt, a
  feature's panel button → its idea, problem, customer and ShiftGrid; tab href carries the selected card; no page errors.

### D-128 · 2026-10-18 · Accepted (extends D-108, D-119)
**Customer-tag lines are their own LINKS group; they and `relates` are hidden by default.**
- *Why:* the user: "for linkleri çok yer karmaşıklaşmasına neden oluyor. For linklerini ayıralım ve otomatik disable
  edelim" (`for` links clutter the board a lot; separate them and turn them off automatically). Every tagged card drew a
  grey dashed line to its customer, so a segmented board was mostly those lines.
- *What:* `linkKinds.ts` gets a fifth group `for` (label `for (customer tags)`, same grey as `relates`, which now stands
  alone as `relates`). `workspaceView` defaults `hiddenLinks` to `['for']`; filters saved before this (no `linksV`, or
  `linksV < 2`) get `for` added once, so existing workspaces turn it off too; after that the choice is remembered.
  Then the user: "do the same for relates one -> not selected automatically": `plain` (relates) is hidden by default
  too; `HIDDEN_SINCE` adds each newly hidden group once to saved filters (`for` at `linksV` 2, `plain` at 3).
  The LINKS filter only lights when a group other than `plain` / `for` is hidden. Still shown while hidden: the selected card's
  lines (select a customer to see who's tagged), and tag lines the assistant's preview adds. The customer chips on
  cards, the FOR filter, Table's `for` column and the focus view's chain (D-127, which reads edges, not lines) are untouched.
- *Alternatives:* drop the lines entirely (chips already say it, but selecting a customer would lose its fan of lines);
  a separate switch beside fit-all (another control, when the LINKS filter already is the place).
- *Verified:* `npm run build`.

### D-129 · 2026-10-18 · Accepted (extends D-125, D-126)
**Organising, more shapes: `cycle`, `orbit`, `tree`, `quadrant`.** The user: "when doing /organize, can our bot make
circles or different kinds of shape to make more meaningful designs", then, offered five shapes with three recommended:
"yeah i just want it to be more capable when we use /organize command". Built the three plus `tree` (left for later in D-126).
- *`cycle`*: the cards in the given order round an oval (about 2 : 1, cards being wide), clockwise from the top, nothing in
  the middle: a flywheel, a lifecycle, a feedback loop. Under 3 cards: a line.
- *`orbit`*: the first card in the middle; the cards linked to it on an inner ring; the rest on an outer ring, each at the
  (circular) mean angle of the inner cards it links to, spread just enough to keep clear; unlinked ones after the rest. No
  card linked to the centre: everything on the inner ring (like `hub`). Distance from the centre = how close a card is.
- *`tree`*: top-down from the first card, each card under the card it was first reached from over links (children in the
  area's order), a parent centred over its children; cards it doesn't reach start trees of their own beside it.
- *`quadrant`*: on an area whose sections are its content: the first four sections in a 2 × 2 of equal cells (top-left,
  top-right, bottom-left, bottom-right), more sections and its own cards packed beside. Fewer than 2 sections: packed as
  before. Axes are only the sections' names ("High impact · low effort"): the board has no drawn lines or boxes.
- *Rings* keep a chip's room between neighbours (a card width + 1.4 across, or a card height + 1.2 down), growing the oval
  until they do. `hub` unchanged.
- *Prompt:* the tool's layout description, the chat's arranging guidance ("mix shapes so the board reads as a picture") and
  `/organize`'s ask name the new shapes and when each fits.
- *Alternatives:* drawn shapes on the board (circles, axis lines, boxes): a new item type, rules and data shape, for later
  if labels aren't enough; `funnel`/`pyramid` (which cards on which row needs the model to group them: sections do that).
- *Verified:* `npm run build`; vite-node + jsdom: a picture of all four on synthetic links (29 cards, 0 overlaps), and edge
  cases (rings of 2/3/12, orbit with no links, unlinked outer cards, 14 on one inner card, tree with no links or a loop,
  quadrant with 2 or 5 sections or none): 0 overlaps, no NaN. Not tried with a real model or in the app.

### D-130 · 2026-10-18 · Accepted (brings frames back after D-047/D-049; extends D-050, D-127)
**Sections: named frames that group part of the board, kept in the focus view.** The user: "lets add sections to the
board. For example A section can contain, cards, texts and other sections and they are used to label them and group them
together. And when i go to foucs tab, we protect the section labels tooo. So that user can still understand what the
cards are for."
- *Data:* a label of `kind: 'section'` with `w`, `h` (x/y its centre); rules require both, > 0, ≤ 2000 (`validLabel`);
  import keeps them (`cleanLabel`). So it selects, copies, undoes, syncs and exports like text, with no new collection.
- *Membership by position, nothing stored* (`sections.ts`, `groupDrag.contentsOf`): a card's or text's centre inside the
  frame, or a smaller section wholly inside it. Drop a card in and it belongs; nesting falls out of containment.
  Rejected: stored member ids (they go stale with every drag, need rules and cascades, and disagree with what you see).
- *Board* (`BoardSection.tsx`): thin frame, faint wash, a name band across the top, set like text (below); grab the band or the left/right/bottom edge to drag (the group drag carries the contents, one undo step,
  guides ignore what's carried); bottom-right handle resizes (top-left fixed, grid snap, contents stay); double-click
  renames; the middle has no hit area, so cards inside and panning work as before. Under every card, inner over outer.
  Bar under its frame: colour, rename, remove (contents stay). Box select takes a section only when wholly inside the box.
  Nudge and line-up move contents with it. Named sections are `go to` places (framed whole).
- *Never copied:* the user: "dont alow a section to duplicate because then it stoles every content to itself" (a copy
  laid over the original holds everything in it). Copy/duplicate skip sections; their menu rows are gone for one.
- *Drawing one:* the user: "when i click to a section, my curser changes in to a aim or like + and then i start
  constructing its dimention with clicling to a space and then draging and then cinally releasing the click. I dont want
  to have a section created automatically to a random place". `+` → section, or "section" in the empty board's
  right-click, arms a crosshair (`useSectionDraw`); a sheet over the board takes the left button (so a press on a card
  starts a frame too; right drag and wheel still pan and zoom); press, drag, release draws it, grown to 4 × 3 at least,
  corners snapped; under 1 unit draws nothing; Esc or leaving the board disarms; the footer hint says what to do.
  Replaced the first version, which placed a 16 × 10 frame mid-view or wrapped the selection. A selection's right-click
  keeps "put in a section" (round it, taking in text it would cover so the name band sits above an area's heading).
  The name field opens at once. Empty names allowed ("Section" shown).
- *Setting text* (`textStyle.ts`): the user: "when i change the size of a section, its titles size change but lets make it
  like already existing text. Give options for h1, h2, and h3 also (add h3 to text fields too). and maybe more options can
  be given to any text field. Maybe doing it italic or idk, more configuration". A section's name is H1 (default), H2 or
  H3, never scaled by the frame (the first version grew it 0.3–1.4 with the section). Text gets H3 (`size: 'minor'`,
  0.27; not a `go to` place, like notes). Both get bold, italic and capitals (`bold`/`italic`/`caps`, only `true`
  stored; rules check booleans): the real Geist 500/700 normal/italic faces (mono for notes), caps a little tracked; the
  editing field matches. All eight faces are warmed when the board loads (`FontWarmup`): drei's `<Text>` suspends on
  a new font and, with no boundary, remounted the board, whose cards then stayed invisible (seen on the first italic).
- *Focus view:* every section holding a card in the chain stays, refitted round those cards (inner first, parents round
  them), drawn only. The camera frames the chain with them.
- *Assistant:* reads them (`SECTIONS ON THE BOARD`, a card's `[section: Outer › Inner]`); its label rows skip sections
  (`textLabels`). Section ops and arrange_area frames are the assistant session's (agreed with it).
- *Also fixed, "zoom to"* (the user: "zoom to da düzgün çalışmıyor"): it framed every piece as a card-sized point
  (text and sections wrong), flew in until one card filled a quarter of the screen, and centred on the whole canvas
  though the card's side panel (opened by the right-click) covers its right part. Now each piece by its real extent
  (`labelHalf`), at least an 18 × 10 area round it, and every fit (`fitView`: zoom to, fit all, focus, previews) frames
  within the part a `[data-side-panel]` leaves open. Checked: a card lands left of the panel with its neighbours; a
  section is framed whole.
- *Also fixed:* the text/section name field could miss focus (drei `<Html>` attaches it after it renders), so typing
  went to the `+` button and Enter reopened the menu; now retried per frame until focused (`focusField.ts`).
- *Verified:* `npm run build`; rules 251 pass (4 new); headless Chrome on emulators with the example: three sections from
  the `+` menu (two round cards, one round both), dragging Discovery's band moved its 8 cards by the same 5.1 and nothing
  else, one undo restored them, the corner resized without moving cards, the focus view on an idea kept Discovery,
  Solution and Product fitted round the chain. Drawing: a click draws nothing and stays armed, Esc disarms, a drag
  starting on a card made the section and opened its name; ⌘D on a section added nothing. Text: H3 + B + I + AA from the
  bar (all pressed after, drawn bold italic caps, board intact); a section in italic kept its name size when resized. Not tried: light theme, a collaborator watching, the assistant reading them.

### D-131 · 2026-10-18 · Accepted (extends D-125, D-129, D-130)
**The assistant draws sections: organised areas become frames, frames that stay are kept clear, and it can add, rename
and remove them.** After D-129 the other session's D-130 brought section frames; asked whether `/organize` should use
them (frames round areas and sections, a quadrant as four boxes, existing frames respected, section ops), the user said
"go ahead when other agent finishes its task".
- *Areas as frames:* `arrange_area` takes `frame` (null = a frame, unless the label reuses a heading on the board, which
  stays a heading; false = a heading as before). A framed area is a `kind: 'section'` label round its block: padded 1,
  the name's band on top (as `wrapRect`), at least `MIN_W` × `MIN_H` and as wide as its name; its `within` sections are
  frames inside it, so they nest by position. A quadrant's framed sections are stretched to equal cells: four boxes.
- *Reuse:* an area named like a section on the board moves and refits that frame (a lone one keeps its top-left corner,
  as D-126 keeps a heading). `frame: true` on a heading turns that label into a frame in place (size removed); `frame:
  false` on a frame turns it into a heading (kind, w, h removed). Same document either way.
- *Frames that stay* (not named by an area, not deleted in the set) go to the layout as obstacles (`Fixed.frames`), so no
  moved card lands in one and changes what it holds. Before, they were left out entirely.
- *Ops:* `add_section` (a frame round cards where they end up in the set, `wrapRect`; placed after every card has its
  place, like notes, so it can frame cards added in the same proposal; off for unknown cards, a competitor's feature, a
  name a section already has, or one another area or section in the same proposal has: never a second frame laid over
  the first, as D-130 never copies a section), `edit_section` (rename), `delete_section` (the frame only; its cards stay). Checklist kind
  `section`; `stillValid` turns them off once the section is gone. `parseProposal` takes the section names.
- *Text setting (D-130's H3 and styles):* `add_label` / `edit_label` take `bold`, `italic`, `caps` (true sets, false removes
  the field, null keeps; a new label stores only true) and the size help names H1/H2/H3 (`minor`)/note; `edit_section`
  renames or sets its name's size (H1–H3), style and colour. The prompt says moving a card into a frame puts it in
  that section (out of it, takes it out), and that sections are never copied.
- *Colour:* `arrange_area` takes `color` (a label colour, "default" removes it, null leaves it) for the frame or
  heading, so `/organize` can colour areas where it means something (a segment, the core loop), not each for decoration.
  `/organize`'s ask says areas become frames, to reuse sections that still fit, delete frames left empty, colour by meaning. The brief shows a label's or section's size, style and colour when
  not the default. A framed area's name is H1, a section's H2; the band comes from `sectionBand`.
- *Prompt:* the brief's SECTIONS line names the ops; the arranging guidance says areas are frames, a card belongs to the
  frame it sits in, and to reuse a section's exact name.
- *Alternatives:* frames only as an option the model asks for (headings stay the default): the user asked for more
  visible designs, and a frame says what belongs together better than a heading over a gap.
- *Verified:* `npm run build`; vite-node + jsdom: a picture (frames, a stretched quadrant, a heading area, a staying
  frame kept clear); a synthetic workspace through brief → `parseProposal` → `toWrites` → `simulate`: every card inside its
  own frame, none in the staying frame, quadrant sections inside their parent, the existing section moved (same id), a
  reused heading kept, bad rows off; `add_section` round three cards and one added later in the same set; heading ↔ frame
  both ways with no leftover fields. Not tried with a real model or in the app.

### D-132 · 2026-10-18 · Accepted (extends D-118, D-111)
**The project title block resizes, and folds to its name when zoomed out.** User: "i want the project card to be
resizeable And when i am zoomed out enough, the description part becomes invisible. so when that happens, card can
callapse to just project name".
- *Resize:* a grip along the block's right edge (cursor `ew-resize`, lights the brackets) drags its width, the left
  edge staying put; the name and description rewrap and the height follows the text. Width 5–30 units (default 9),
  in quarter units while snapping is on (alt free). Stored as `w` on the title label (rules already allowed `w` on any
  label; export/import keep it), streamed while dragging, one undo step (`resizeTitle` / `endTitleResize` in labels.ts).
  Width only, not a scale: the text sizes stay. Alternative, a corner that scales the whole block: not done, ask if wanted.
- *Fold:* when the description is too small to draw (`useReadable(DESC)`, the same 6 px rule as all board text, D-111),
  the caption, rule and description go; never while the description is being edited. User, next: "instead of first
  collapsing, lets try to maximize the font size and then collapse if there is empty space left". So the name grows
  into the room they leave: the biggest size whose lines fit the unfolded block's height (same width) without breaking a
  word, the star beside its first line, sized to it; the block then shrinks, about its centre, only to the name's height.
  Typeset with troika's `getTextRenderInfo` (now a direct dependency; types in `src/types/`), a binary search on the
  size. In a block too narrow for the name beside the star, the folded name may go below the unfolded size (to 0.6×)
  rather than break a word.
- *Animated* (320 ms, ease in-out, from where it is if reversed midway; instant with reduced motion): the caption, rule
  and description fade in the first half, the star travels and grows, the name slides and scales, the brackets close in.
  The name is laid out at its new size at once and scaled from the size troika last laid it out at, so nothing jumps.
- *Sizes:* `titleHalf` is the block as drawn (framing, selection, guides); `titleFullHalf` / `labelRoom` the unfolded
  block, which the assistant's placement and layouts (`tools.ts`, `arrange.ts`) use whatever the zoom, so new cards never
  land where the description shows up close.
- *Verified* in headless Chrome on the emulators: example workspace, title added, edge dragged narrower (text rewrapped,
  left edge fixed), ⌘Z restored it; zoomed out, the name grew (~1.5× for "Example: Tablebook" at width 9) and the block
  shrank to it; screencast frames show the fold and unfold travelling; a narrowed block folds without breaking words.
  The assistant's use of the unfolded size not tried with a model. `npm run build`.

### D-133 · 2026-10-19 · Accepted (extends D-040's matrix, D-080)
**A feature's criteria: the matrix says which part a competitor covers.** From examining the user's BUBBLES workspace
(docs/specs/usefulness.md): 116 of 145 cells were `partial`, every competitor "fully covered 0/19", while the notes
behind the cells all said "they cover X but not Y". User: "Matrix page dont tell much, like most of the stuff is selected
as partial but i mean how partial or what". Slice 1 of Phase 6.
- *Data:* a feature gets `criteria: {id, text}[]` (≤ 8, ids its own, base-36, kept by export/import); a cell gets
  `criteria: {criterionId: 'met' | 'part' | 'no'}` (missing = not assessed). Rules check a list ≤ 8 and a map ≤ 8 with
  only those three values. Removing a criterion removes its scores from the feature's cells in the same undo step
  (`setCriteria`); typing in one merges into one step.
- *Reading:* once any criterion is scored, the cell reads from its scores (all met = full, or `better` if set so by hand;
  all `no` = none; else partial), and so do the row's reading, the footer's "fully covered" and the TSV. Unscored cells
  keep their hand-set coverage, so old workspaces read as before.
- *Matrix:* a scored cell shows one block per criterion (met cyan, part yellow, no an outline, not assessed a dot); a
  cell's note shows on hover (`title`, 400 chars). The reading column adds `◇ N open`: criteria no assessed competitor
  meets, the white space (hover lists them). The cell panel scores each criterion (`met part no`, click again clears),
  coverage then shown as derived (`partial · 1 of 3 criteria met`); `edit` opens the list, which stays open while a
  feature's first criteria are written.
- *Feature panel:* a `CRITERIA` list under effort: edit, remove (×), add (Enter); each says `met by N` or `◇ open` once any
  cell is scored.
- *TSV:* `partial (2/5 met)` and a last `nobody meets` column. *Assistant:* reads criteria and scores (brief and
  `get_items`); writing them is slice 2.
- *Alternatives:* a finer coverage scale (still says nothing about which part); per-competitor feature lists only
  (already there as "their version", not comparable across competitors).
- *Verified* in headless Chrome on the emulators (example workspace): three criteria added from the cell panel, two
  cells scored, bars and `◇ 2 open` shown, feature panel shows `met by 1` / `◇ open`; removing criterion 3 dropped its
  scores from both cells and ⌘Z brought them back. Rules: 257 pass incl. 6 new; the 2 failing usage-log tests fail the
  same on the committed rules. `npm run build`. Firestore rules deployed 2026-10-19; not tried on the live site.

### D-134 · 2026-10-19 · Accepted (extends D-133, D-074, D-085)
**The assistant writes criteria and scores the matrix against them.** Slice 2 of Phase 6 (docs/specs/usefulness.md):
BUBBLES has 145 cells with good notes, too many to score by hand.
- *`set_criteria`* (a `propose_changes` op): one row per feature, `feature`, `criteria` (string list replacing its
  criteria, or null to keep them) and `scores` (per competitor, one of `met | part | no | not assessed` per criterion, in
  order). One row carries a whole feature, so 19 features fit one proposal (the limit is 60 rows). A criterion kept word
  for word (case and spaces ignored) keeps its id and so its scores; scores of the ones dropped leave every cell of that
  feature in the same batch (`do: 'criteria'` in `assistant.ts`, a query of the feature's cells), one undo step.
  `not assessed` clears a score. Only features already in the workspace (not ones added in the same proposal).
- *Row checks:* unknown or wrong items, more than 8 criteria, a score list whose length isn't the criteria count, two rows
  for one feature, nothing to change. The row reads `criteria <feature>`, the numbered criteria, then `met: ShiftGrid 1/3, …`.
- *Preview* (`simulate.ts`): the feature and its cells marked edited or new; the cells show their blocks.
- *Mode `/criteria`* ("score the matrix"): on the selected feature, the one named, or as many features as fit (most partial
  cells first). The model reads them in full, keeps good existing criteria, scores only from the workspace (never guesses
  `met`), and says where the white space is and which features are left.
- *Alternatives:* scores inside `set_matrix_cell` (one row per cell: 145 rows, past the 60-row limit, and the criteria
  would have to be set in another row first).
- *Verified* in headless Chrome on the emulators with a fake OpenAI: `/criteria` gave one row; preview showed the cells;
  applied, the matrix read `part,met,no` / `no,no,·` and `◇ 2 open`; a second proposal keeping one criterion word for word
  kept its scores and dropped the rest (`◇ 1 open`); ⌘Z restored the first. Not tried with a real model. `npm run build`.

### D-135 · 2026-10-19 · Accepted (extends D-108, D-128; slice 3 of Phase 6)
**Competitors' lines are off the board by default; link labels show in focus only.** In BUBBLES 67 of 252 links were
competitor `competes with` lines crossing the whole board, repeating what the matrix says, and 127 links carried a
full-sentence label whose chips piled up into unreadable text (docs/specs/usefulness.md).
- *Group:* `competes-with` leaves `clashes` (now `contradicts` alone) for its own LINKS group `competes (competitors)`,
  same salmon colour (`palette.link.competes`). Hidden by default (`QUIET_LINKS` with `plain` and `for`); the saved
  filters' version goes to 4, so boards opened before hide it once, then the choice is remembered. Hiding it doesn't count
  as narrowing (the LINKS filter isn't lit for it).
- *Shown* for the selected card (as every hidden group, D-128) and, for this group only, for the hovered card, so pointing
  at a competitor draws what it competes with. The assistant's preview still shows links it adds.
- *Count:* a competitor card's meta line starts `vs N`, the distinct cards it competes with. Not ⚔: the board's Geist Mono
  is the Latin subset, which hasn't the glyph.
- *Chips:* the kind only; the link's own label joins it while the link is hovered, selected, or touches the selected card.
  Labels stay in the link bar and the panel's link list.
- *Verified* in headless Chrome on the emulators (example workspace): no salmon lines by default, hovering ShiftGrid drew
  its two, selecting Paper rota drew its one with `competes`, cards read `vs 2 · 4 features`. Not seen on BUBBLES (the
  browser tab was signed out). `npm run build`.

### D-136 · 2026-10-19 · Accepted (extends D-133, D-134; slice 4 of Phase 6)
**A matrix cell can be "not relevant", and says how sure it is.** In BUBBLES only 145 of 418 cells were filled, and the
matrix couldn't tell "we didn't look" from "doesn't apply"; many notes said "the reviewed docs do not establish".
- *Not relevant* (`notRelevant: true` on the cell, only true stored): the competitor isn't comparable on this feature at
  all. The cell shows `—`, and is left out of the row's reading, the white space and the footer, which now counts out of
  the comparable features (`0/5`). Different from `none` (they could, and don't); the panel says so. Set in the cell panel
  (`compare [not relevant]`, click again to undo); while set, coverage, criteria and confidence are hidden there.
- *Confidence* (`confidence: documented | inferred | guess`; missing = not said): the panel's `sure` row. The cell's top
  left shows `~` inferred, `?` a guess; documented needs no mark. The spec said "unknown"; `guess` says what it means.
- *Rules:* `optBool notRelevant`, `confidence` in the three values (3 new tests). Export/import and the TSV carry both
  (`not relevant`, `partial (2/5 met) [inferred]`).
- *Assistant:* reads both in the brief and `get_items`; `set_matrix_cell` takes `relevant` (false / true / null keeps) and
  `confidence` (`not said` clears); each `set_criteria` competitor entry takes a `confidence`.
- *Verified* in headless Chrome on the emulators: a cell marked not relevant (`—`, its column's footer 0/6 → 0/5), two
  cells given inferred / guess (marks shown); with a fake OpenAI, one proposal set a criteria row `inferred` and a cell not
  relevant. Rules: 260 pass (the 2 usage-log tests fail as before). `npm run build`. Firestore rules deployed 2026-10-19.

### D-137 · 2026-10-19 · Accepted (slice 5 of Phase 6)
**Status and evidence on customers, problems and ideas.** Every card in BUBBLES said "Hypothesis, not validated demand"
in its notes, and nothing could ever stop being one: the app had nowhere to put what was learned. Asked two things, the
user chose: evidence in the card's panel (not evidence cards on the board, which already felt too busy), and a status set
by hand that the evidence informs (not one worked out by a rule).
- *Status* (`validation`: hypothesis | testing | validated | invalidated) on customers, problems and ideas, a row in their
  panel coloured dim / yellow / green / magenta. Not on features: they have their own status.
- *Evidence:* `workspaces/{wid}/evidence/{id}` (`nodeId, nodeType, kind, text, stance, source?, url?, date?`), kinds
  interview, quote, data, observation, link; supports or contradicts; date `YYYY-MM-DD`, defaulting to today (local).
  Its own collection (people add pieces at once; each write its own undo step), loaded with the workspace like
  attachments (small, and counted on cards). Deleted with its card (`cascadeOf`) and with the workspace; export/import
  carry it (`evidence` in the bundle, missing = none; version stays 1).
- *Panel:* `EVIDENCE [add]` opens a form (what, supports / contradicts, kind, from, date); a piece reads `+ interview` /
  its text / `source · date`, and opens to edit (text, stance, kind, source, date, link) or remove. Under the status,
  `+2 −1` and a warning when they disagree: validated with nothing for it, or more against than for; invalidated with
  nothing against.
- *Card:* the meta line starts with the status and the tally, `!` on a mismatch: `validated ! +1 −2`.
- *Assistant:* the brief lists `{status}` and each piece under its card (`get_items` in full); `update_card` takes
  `validation`; `add_evidence` (on a card, also one added in the same proposal; only what the user or a source said).
  `/validate` proposes what you told it as evidence plus a status; `/gaps` lists cards with no evidence or a status their
  evidence doesn't back.
- *Rules:* `validation` in `validCard`; `validEvidence`; `evidence` a known collection (7 new tests).
- *Not done:* an `assumption` card with experiments (spec's "possibly"); a STATUS filter; status in Table/Flow.
- *Verified* in headless Chrome on the emulators: a problem set validated (`validated !`), three pieces added (+1 −2, the
  warning shown); deleting the card removed its 3 pieces, ⌘Z brought back card and pieces; with a fake OpenAI, one
  proposal added a piece and set `testing` (card `testing +1 −0`). Rules 267 pass (the 2 usage-log tests fail as before).
  `npm run build`. Firestore rules deployed 2026-10-19.

### D-138 · 2026-10-19 · Accepted (slice 6 of Phase 6)
**A priorities tab: impact × effort, confidence from the chain, a suggested order.** In BUBBLES 11 of 19 features were P1
and 17 effort L: priority carried no information, and nothing said how sure we were of any of it.
- *Impact* (`low | medium | high`) on features, in their panel under effort; rules, export/import, TSV column.
- *Confidence* is never set by hand: the customers, problems and ideas a feature rests on (its chain, `focusSet` as the
  focus view follows it, D-127) score validated 2, testing 1, else 0; share ≥ 0.75 high, ≥ 0.34 medium, else low. Nothing
  behind it, or anything on it invalidated: low, with why. Shown in the feature's panel (`confidence ▮▯▯ low`, and "Of the
  5 it rests on: 1 validated, 4 still a guess").
- *Score* impact × confidence ÷ effort (each 1–3); 0 when it rests on something invalidated (first tried without: a cheap
  feature on an invalidated problem ranked first). Rated features split in thirds as suggested P1–P3, equal scores alike;
  a suggestion only, never written.
- *Tab `priorities`* (after matrix; `/workspaces/<id>/priorities`, presence view `priorities`, RTDB rule): a 3 × 3 grid,
  impact rows high → low, effort columns S M L; corners named (quick wins washed green, big bets, fill-ins, money pits);
  a chip per feature with its confidence blocks, `!`, priority. "Not rated yet" lists the rest. Beside it, the suggested
  order with score, and `P2 → P1` in yellow where the set priority differs. Clicking opens the feature's panel.
- *Assistant:* impact in `add_card` / `update_card`, impact and confidence in the brief and `get_items`; `/prioritize`
  proposes missing impacts (never priorities), ranks, and says what to learn to raise the top three's confidence.
- *Verified* in headless Chrome on the emulators (example workspace, impacts and statuses set): grid, chips, order, the
  invalidated feature at 0.0 / P3, the panel's confidence. Rules 270 pass (the 2 usage-log tests fail as before).
  `npm run build`. Firestore + RTDB rules deployed 2026-10-19.

### D-139 · 2026-10-19 · Accepted (answers Q-016, Q-017, Q-018; spec docs/specs/planes.md)
**Planes and packages: one set of cards, placed on many planes.** The user's idea: planes to keep cards (a competitors
plane), planes to show an MVP from problem to idea to feature, packages of those, and reusing the same cards across
planes "instead of creating a new one all the time". Unlike per-type boards (D-036) and domains (D-048), which split the
cards, planes split only where they're looked at. The user went with the recommendations:
- *All plane* (Q-016): every workspace has All, showing every card; it can't be deleted or emptied; a card made on another
  plane lands there too. All is today's board: positions stay on the cards, no migration.
- *Packages are cards* (Q-017): `packages/{id}` with members by id and a home plane; on other planes one card that links
  and rates in priorities (replaces slice 7, bets).
- *Sections and text per plane* (Q-018): `planeId` on labels, missing = All.
- Data: `planes/{pid}`, `placements/{pid}_{itemId}` (x, y), links stay the workspace's (drawn when both ends are on the
  plane, `+N off-plane` otherwise). Steps: planes, packages, the assistant on planes, a plane filter in other views.

### D-140 · 2026-10-19 · Accepted (step 1 of D-139)
**Planes on the board.** Built as the spec says (docs/specs/planes.md §2–§3, §5), with these choices:
- *Positions:* the board draws the open plane: on All the cards' own x/y, elsewhere only the placed cards at their
  `placements/{planeId}_{itemId}`. Every position write goes through `positionRef` (nodes.ts) / `placeOf` (selection.ts),
  which follow the open plane (`usePlaneView` in state/plane.ts, mirrored into data/planes.ts `openPlane()`): drags,
  group drags, nudges, align/space. Anything but the board writes to All (it resets on leaving), so other views and the
  assistant are unchanged.
- *New things on a plane:* a card is made with its placement in one undo step, and lands on All in a column right of
  everything there (`allSpot`); paste and duplicate the same. Text and sections get `planeId`; the project title block
  stays on All only (not offered elsewhere).
- *Delete:* on a plane other than All the ⌫ key takes cards off it ("Took "Crewly" off Competitors (still on All)",
  undoable); text there is deleted. The right-click menu has `take off this plane` (⌫) and `delete everywhere`; the
  panel's delete still deletes everywhere.
- *Switcher:* `PLANE │ All ▾` first in the filter bar: All and each plane with card counts, `new plane` (named "Plane N",
  renamed in place straight away), rename, delete (its placements, text and sections; cards stay; one undo step).
  `?plane=<id>`; `[` / `]` step through them. Each plane keeps its own camera.
- *Bringing cards in:* `existing ▾` beside `+` on a plane: every card not on it, by type, searchable; placed at the
  view's centre, clear of the plane's cards. A card's panel has a `planes` row: All and the planes it's on (click to see it
  there), `place on ▾` another, `take off this plane`.
- *Cards:* meta starts `on 3 planes` when on more than All; on a plane, `+4 off-plane` counts links to cards not on it
  (a competitor's features count as it). Links are drawn only when both ends are on the plane.
- *Presence:* `plane` beside `view` (RTDB rule); cursors only for people on the same plane; following someone switches to
  their plane.
- *Data:* `planes`, `placements` load with the workspace (they hold the loading screen but can't fail it); placements go
  with their card (cascade) and with the workspace; export/import carry planes, placements and plane text (new ids).
- *Not yet:* the focus view stays on All; the assistant's writes and previews are on All (step 3); no plane filter in
  other views (step 4); a plane's own title block.
- *Verified* in headless Chrome on the emulators: new plane renamed "Competitors", two cards brought in with `existing`
  (meta `on 2 planes · +2 off-plane`), a nudge moved only the placement, a new idea landed on the plane and on All's right
  column, ⌫ took a card off (toast) and ⌘Z put it back, `[` / `]` switched, deleting the plane kept all 23 cards; text on a
  plane only there; export → import kept the plane, 3 placements and its text. Rules 279 pass (the 2 usage-log tests
  fail as before). `npm run build`. Firestore + RTDB rules deployed 2026-10-19.

### D-141 · 2026-10-19 · Accepted (step 2 of D-139)
**Packages: a piece of the chain as one card.** As the spec says (docs/specs/planes.md §4), with these choices:
- *A card type* `package` (blue, `--accent-blue`), last in `BOARD_TYPES`: the board's card, drag, link, select, panel,
  SHOW filter and Table work as for any card. Not in the create menus (`MADE_TYPES`) nor in Flow (not on the chain).
  Saved filters from before it show it once (`TYPES_VERSION` 2).
- *Data* `packages/{id}`: a card (title, notes, tags, x/y on All) + `memberIds` (≤ 60), `homePlaneId`, `impact?`,
  `effort?`. Members that no longer exist are skipped, never cleaned up, so undoing a card's delete puts it back in.
  Deleting a package takes its links and placements; its members and home plane stay. Links accept `package` both ends.
- *Made from a selection:* `package these` in the N-selected panel (any cards but packages). On a plane other than All,
  that plane is its home and the package lands in All's right column; on All, a new plane named after it holds the
  members where they are, and the package goes just right of them. Named "Package N", renamed in its panel. One undo step
  (package, plane, placements).
- *On its home plane:* a dashed blue frame round its members with `PACKAGE · name` (computed from where they sit; not
  movable or editable itself).
- *Card:* meta `1 problem · 1 idea · 3 features · impact high · M`.
- *Panel:* impact, effort, confidence (its members and what they rest on, the D-138 rule), `holds` (members by chain
  order, click to select), `open its plane: <name>`, planes row, links, tags.
- *Priorities:* packages rated and ranked with features (`package · <name>`, a blue edge); no priority of their own.
- *Elsewhere:* export/import (members and home remapped; one without a home dropped), copy (keeps members), the assistant's
  brief lists them (editing them is step 3). Fixed on the way: `duplicate` in the N-selected panel used All's positions on a
  plane.
- *Verified* in headless Chrome on the emulators: three cards packaged on All (toast, card `1 problem · 1 idea · 1
  feature`, its own plane with the frame round the three), a link from it, rated in priorities; ⌘Z removed package,
  plane and placements together; export → import kept it (3 members, home found). Rules 284 pass (the 2 usage-log tests
  fail as before). `npm run build`. Firestore rules deployed 2026-10-19.

### D-142 · 2026-10-19 · Accepted (step 3 of D-139)
**The assistant works on planes and packages.** As the spec says (docs/specs/planes.md §7), with these choices:
- *Its plane:* a proposal keeps the plane open when the model made it (`proposal.plane`). Layout is planned on that
  plane (`layoutWs`: its placed cards at their places, its text and sections; links, criteria and the rest whole), and
  lands there (`onPlane` in tools.ts): card moves become placements (after the rows' writes), new cards are placed there
  and land on All's right column, new text and frames get its `planeId`. Preview (`simulate`) does the same, so a plane's
  preview shows its placements changing. On All nothing changes, except that All's planning no longer sees other
  planes' text (a step-1 leak).
- *Brief:* `PLANES (All + N)` with the open plane named ("layout changes … land on it") and each plane's cards; `PACKAGES`
  with refs, what they hold, rating and home plane; areas and notes as the open plane has them (cards not on it have no
  area there); packages have refs (link, delete, edit).
- *New rows:* `add_plane` (key, name, cards laid out in columns by chain type), `place_on_plane` (a plane by name or a
  key added here; columns right of what's there), `take_off_plane` (an existing plane; "not on that plane" checked),
  `add_package` (key, name, notes, cards, home plane by name/key or null = a new plane named after it holding them in
  columns; cards missing from a named home are placed there; impact, effort; the package lands on All's right column),
  `edit_package` (name, notes, add, remove, impact, effort). A row on a plane added here needs that row, like a new card.
- *Apply* (`assistant.ts`): write kinds `plane`, `placement`, `unplace`, `package`; ids for new planes and packages made up
  front so rows can point at them; one undo step as before.
- `/organize` may propose planes when one board is too much to read.
- *Not done:* `delete_plane` / renaming planes by the assistant; the focus view and other views still ignore planes (step 4).
- *Verified* in headless Chrome on the emulators with a fake OpenAI: on All, one proposal added a "Competitors" plane with
  the 4 competitors, a package of 3 cards with its own plane (impact high, M) and a link from it (7 placements, link
  written); then on the Competitors plane, an `arrange_area` and an `add_card` landed there (label `Direct` with the
  plane's id, the new idea placed there and on All's right column, All's positions untouched). `npm run build`.

### D-143 · 2026-10-19 · Accepted (step 4 of D-139)
**The other views follow the plane.** Flow, Table, Matrix and Priorities show only the cards on one plane.
- *One choice per workspace:* `plane` joins the remembered filters (`useWsView`). The board opens on it when the URL has
  no `?plane=`, and whatever the board opens (switcher, `[ ]`, a card's planes row, `open its plane`, following someone)
  becomes it. So moving from the board on "MVP" to Table shows MVP's cards, and choosing All in Table opens the board on
  All. A plane since deleted reads as All (`useViewPlane`).
- *On a plane* = placed on it, or a package at home there (`planeIds`).
- *Flow and Table:* `PLANE │ MVP ▾` first in their filter bar (the board keeps its switcher; the focus view, always on
  All, has none), applied in `useVisibleItems` with the other filters.
- *Matrix:* the plane's features as rows, its competitors as columns (all competitors if it has none); the filter in the
  footer.
- *Priorities:* the plane's features and packages, ranked among themselves (the P1–P3 thirds of the plane); the filter in
  the footer.
- *Not done:* the focus view on a plane (spec §6: when the whole chain is there); Reports have no cards to filter.
- *Verified* in headless Chrome on the emulators (a plane "MVP" with 5 cards): Table and Flow showed only them, the
  Matrix MVP's 2 features × ShiftGrid, Priorities its features; All from Table's filter brought every row back and the
  board then opened on All. `npm run build`.

### D-144 · 2026-10-19 · Accepted (slice 8 of Phase 6)
**An overview tab: the workspace read on one screen.** usefulness.md slice 8: a one-screen "so what".
- *Where:* `overview`, the first tab (`/workspaces/<id>/overview`, presence view `overview`, RTDB rule). Opening a
  workspace from the workspaces list lands on it; a new, joined or imported one, and every `/workspaces/<id>` link, still
  open the board.
- *What* (`overview/reading.ts`, worked out from the data, no model): the name, what we're building and the counts; then
  framed blocks:
  - `next`: up to four steps, each with why and `ask the assistant: /mode` (it opens the chat with `/mode ` typed in, to
    send yourself; `useChat.ask`, `prefill`) or a view to open. Steps: cards still a guess (`/validate`), interviews
    (`/interview`), features without criteria (`/criteria`), features without impact (`/prioritize`), the first white space.
  - `on solid ground` (validated / evidence for, without a mismatch) and `still a guess` (no status or hypothesis with no
    evidence for, invalidated, or a status the evidence doesn't back; problems first).
  - `riskiest bets`: high-impact or P1 features and packages whose confidence isn't high, with the guesses they rest on.
  - `white space`: features' criteria no competitor meets (or how to get there).
  - `worth a look`: most features P1 or effort L, a competitor competing with 6+ cards, problems with no idea, ideas
    solving nothing, mostly-partial matrix cells without criteria, statuses the evidence doesn't back.
- *Not done:* a written summary by the model (the reading is deterministic); the overview per plane.
- *Verified* in headless Chrome on the emulators (example workspace with a few statuses, evidence, an impact and two
  scored criteria): opening from the list landed on the overview; the blocks read as above; `ask the assistant: /validate`
  opened the chat with `/validate` typed in. Rules 285 pass (the 2 usage-log tests fail as before). `npm run build`.
  RTDB rule deployed 2026-10-19.

### D-145 · 2026-10-19 · Accepted
**Competitors say where they operate.** The user: "competitorların hangi regionda çalıştıklarını yazsak iyi olabilir…
isteyen kişi competitor amerikadan ya da almanyadan ya da europedan diyebilmeli" (write which region a competitor works
in; you should be able to say it's from America, Germany or Europe).
- *Data:* `regions?: string[]` on a competitor (rules: a list, ≤ 20; bundle import keeps ≤ 20 of ≤ 60 chars). Where they
  sell, not only where they're based: one field, so nobody has to choose between the two.
- *Names* (`src/views/competitors/regions.ts`): free text, but a known list (Global, continents, EU / DACH / Nordics /
  Benelux, ~40 countries) and aliases (`usa`, `america`, `amerika` → `US`; `almanya`, `deutschland` → `Germany`; `avrupa`
  → `Europe`; `türkiye` → `Turkey`…) turn what's typed into one name, so the filter finds them all.
- *Inside:* each known place lies in bigger ones (Germany → DACH, EU → Europe; Turkey → Europe and Middle East; all →
  Global). A filter keeps a competitor when one of its regions and one chosen overlap either way: Europe keeps a German
  one, Germany keeps a Europe-wide or Global one. A place not in the list only matches itself (and Global). No regions set
  = left out while a region filter is on.
- *Where it shows:* the panel (`regions` row under pricing/audience, the tag picker without `#`, suggestions = the
  workspace's regions, then the list); the card's meta line starts with them (`US · UK +1   vs 2   4 features`).
- *Filter:* `REGION │ any ▾` after TAG in the filter bar (board, flow, table) and in the matrix footer; only shown once a
  competitor has a region (or the filter is on); the matrix footer always shows it, with a hint when there are none yet. It lists the regions in use under their continent (also offered), Global
  first, with counts; narrows competitors only, other cards stay; remembered per workspace with the others; `reveal`
  clears it. The matrix falls back to every competitor when none match, so its footer stays reachable.
- *Assistant:* the brief and `get_items` say `operates in: …`; `add_competitor` / `update_competitor` take `regions`
  (names cleaned the same way); with [web] it fills them only from what it found.
- *Example:* Tablebook's competitors got regions (ShiftGrid US, UK; Crewly Germany, Netherlands; paper rota Global;
  BigChain Europe, North America).
- *Not done:* a regions column in Table; regions in the matrix column heads.
- *Verified* in headless Chrome on the emulators: the example's cards read `Germany · Netherlands   vs 1 …`; the matrix
  REGION menu listed Global, Europe (Germany, Netherlands, UK), North America (US) with counts, and Germany kept Crewly,
  BigChain and the paper rota, hid ShiftGrid; in Crewly's panel `usa` offered `US` first and Enter added it. Node check of
  the matching (15 cases). Rules 293 pass (3 new). `tsc -b`.

### D-146 · 2026-10-19 · Accepted
**`solves` / `part of` and `inspired by` / `depends on` are separate LINKS groups.** The user: "split the part of and
solves links into two separate links", then "same for inspired by and depends on".
- `part-of` moved from the `solves` group to its own `part` group, `depends-on` from `draws` to its own `depends` group
  (linkKinds.ts), each listed right after its old partner in the LINKS filter. They kept their partner's colour at
  first; D-147 gave every kind its own.
- Filters saved before (links version < 5) that hid `solves` / `draws` hide `part` / `depends` too, once; all show by default.
- *Verified:* `npm run build`.

### D-147 · 2026-10-19 · Accepted (changes D-108's colours, D-119's dashed `for` line)
**Every link kind has its own colour; no dashed link lines.** The user: "now give them different colors. I dont want no
link to be same color. You can choose closely related colors. Also no dashed lines", then, after close shades
(orchid beside violet, rose beside salmon…): "colors are tooo similar now".
- Dark / light (`--link-*`, `palette.link`): solves violet `#a78bfa` / `#6d4fd6`, part of sky `#6cb6ff` / `#1f78c8`,
  competes orange `#ff9a52` / `#c2600f`, contradicts raspberry `#ff5c86` / `#c41e4e`, inspired by gold `#e3c77a` /
  `#94741c`, depends on moss `#9cc96a` / `#4c8a1c`, relates grey `#8a8a8a` / `#6e6e6e`, for near-white `#d6d6d6` /
  near-black `#2e2e2e`. Soft and light so they don't read as the saturated type colours.
- Link lines are solid: `dash` left `linkKinds.ts`, EdgeLine draws no dashes (the select box and frames keep theirs).
- *Rejected:* close shades of one hue per pair (too alike to tell apart).
- *Verified:* swatch page in headless Chrome, both themes, beside the type colours; `npm run build`.

### D-148 · 2026-10-19 · Accepted (changes D-112's snap step and grid, D-117's pull, D-055's card width and edge)
**The `+` marks are the snap points; a snapped card has a mark on each corner; cards lose their grey edge.** The user:
"board grid position visualization is not working. Make the steps smaller also make sure "+" do match with where cards
sit. Also we can remove the gray borders of the cards". Before, marks sat every unit, cards snapped their centres to 0.25,
and the quarter-point dots were too faint to see, so a card never lined up with any mark.
- *First try, rejected:* finer marks the closer the camera (⅛ → 1 unit) with snapping to the finest on show. The user:
  "i didnt wanted you to add tons of + characters … left colored side of the cards never match with the grids … grid
  points and the location of "+" characters do not match".
- *Why they didn't match:* besides the step, the grid plane sits 0.1 behind the cards, so with the perspective camera the
  marks drifted off the cards' corners, more toward the screen's edges. The shader now takes each point back to where
  the camera's ray meets the cards' plane (z = 0).
- *Grid* (`DotGridMaterial`, `GRID_STEP` in snap.ts): one `+` every 0.625; zoomed out, every other mark fades once
  they're under 16 px apart; dots and fade by distance as in D-110. Shown whether snapping is on or not.
- *Snap:* a box's top-left corner on a mark (`snapPoint(p, free, half)`). Cards 2.5 × 1.25 (was 2.4 wide) = 4 × 2
  steps, so all four corners land on marks. Arrow keys nudge one step, shift four.
- *Guides (D-117):* with snapping on they don't pull (older cards off the grid would pull a card off the marks); the
  lines still show what lines up. With snapping off they pull as before.
- *Edge:* no hairline round cards or the competitor plates behind them. The hover/selection/link rim became corner marks
  (D-150); only a card tagged with the chosen customer keeps a cyan edge.
- *Verified* headless (example workspace, 1400 × 900 @2x): dragged cards land with corners on multiples of 0.625 and on
  the drawn marks, also at the far right of the screen.

### D-149 · 2026-10-19 · Accepted (refines D-148's snap step)
**Drags snap to fifths of the step between `+` marks.** The user, after D-148: "now it fits exactly and it's great", but
while a card moves one mark at a time, split that into 5 equal parts so cards can sit on the 4 steps between too, with
no extra `+` marks for them.
- `SNAP_STEP = GRID_STEP / 5` (0.125) in snap.ts; the marks stay every 0.625 and nothing new is drawn. A card's top-left
  corner snaps to the 0.125 steps, so on a mark its corners are all on marks, as before.
- Arrow keys nudge one 0.125 step, shift one mark (0.625). Guides still don't pull while snapping is on (D-148).
- *Verified:* `npm run build`.

### D-150 · 2026-10-19 · Accepted (changes D-148's hover/selection rim, D-061's "no scale in a drag")
**Corner marks instead of a rim; a dragged card goes small and its corners show where it lands.** The user didn't want the
grey edge on hover that turned the card's colour when held, and asked for another way to show hover and holding. Shown
side by side on a scratch preview first (port 5188), four ways: today's rim; corner marks; a wider left stripe; the
card's fill tinted. The user picked corner marks, then changed the drag twice.
- *Hover:* four L-shaped corners (`CardCorners.tsx`), grey (`hover` token), a little outside the card (0.12).
- *Press:* they take the type colour and close in onto the card's corners, wholly inside it, their outside on its
  edge (first centred on the edge, then wrapped outside; the user wanted them inside), longer arms; a drag's landing
  corners sit the same way; *selected:* type colour, just
  outside (0.06). Together this reads as a click. Link target: cyan.
- *Drag:* first try put the corners outside even while dragging plus a dashed outline where it lands. The user: the
  card looked bigger, so it was harder to place, and the outline wasn't clear. Second try shrank the card on hover
  too; the user wanted hover and select as before. Now: only a drag shrinks the card to 0.8 (`CARRIED`), round the
  point held so it stays under the pointer, following the pointer freely; the corners sit on the full-size corners of
  where the grid or guides put it. On release it grows into them. Cards carried in a group drag a card started shrink
  round their centres; a section drag doesn't shrink what it carries.
- *Click vs drag:* the user found almost every click turned into a small drag. A press becomes a drag only after the
  pointer goes 5 screen px (`DRAG_PX`); before that nothing moves or shrinks, and no move is written.
- *A held card grew a little* (user: "kartlar tıklanınca neden büyüyo", also on a long press): a held card is lifted
  0.06 toward the perspective camera to draw on top, so it looked bigger and slid off the pointer (the same reason as
  D-061, just smaller). Every card and its corners are now drawn smaller and toward the camera's axis by as much as
  they're lifted, so they look exactly as at z = 0; only the stacking is left. Measured: before, 1 px wider when held
  (7 zoom steps in); after, identical.
- Far out (stars, D-111) the ring stays. Competitor feature chips keep their own edge. Reduced motion jumps.
- *Verified* headless on the emulators' example workspace: hover, press, drag (single and group), drop, a 3 px wobble
  click; `tsc`.

### D-151 · 2026-10-19 · Accepted (changes D-110's "the `+` turns to dots")
**Zoomed out, the grid's `+` stays a thin `+`.** The user: the `+` "takes too much space and looks like a fat dot when i
zoom out enough"; asked to keep it lean. A first try made the mark the same 7 px on screen at every zoom; the user: the
zoomed-in look was fine, keep it, and use the new look only zoomed out.
- Zoomed in, unchanged: arms 0.06 board units out from the centre, stroke 2.4 device px.
- Zoomed out, the arms stop shrinking at 3 CSS px and the stroke eases to 1 CSS px (needs the canvas's pixel ratio, `uDpr`);
  edges smoothed over one device pixel. Before, the arms shrank to the stroke's width and hard pixel edges made a blob.
- Thinning instead of dots: under 18 px apart every other mark fades, under 18 px at twice the step all but every fourth
  (2.5, a card's width); all still fade out between 80 and 120 (D-110). Marks stay where they were, so snapping is unchanged.
- *Verified* headless: the shader from Board.tsx on a test page, old and new at camera distances 9, 20, 40, 60, 90; `tsc`.

### D-152 · 2026-10-19 · Accepted (changes D-057's card contents, D-108's `○` handle, D-137's status text on the card)
**Cards: less padding, a header with status and evidence cells, facts and tag chips; the link handle is a `›`.** The user:
"padding is too much and most of the card is empty space. Also i want to put more details on the card. And also the line
connection dot do not match with our design language". Size stays 4 × 2 marks (D-148). Shown side by side on a scratch
preview (port 5188): today; tight with facts as text; tight with an evidence meter and tag chips; then padding 0.12 /
0.08 / 0.06. The user picked the meter + chips layout at 0.06.
- *Layout* (`NodeCard.tsx`, `CardFacts.tsx`): everything 0.06 in from the edges (and the type stripe). Header: type label
  left; right, the `head` (a customer/problem/idea's status with `!` when the evidence disagrees, a competitor's regions,
  a feature's priority, a package's rating), then the evidence as cells (filled = supports, outlined = against, up to 5
  each, magenta with the `!`). Title 0.165, up to 3 lines (cut at 80 characters, was 44). The facts line (`meta`), then
  tags as framed chips (`+N` when they don't fit); without tags the facts line sits at the bottom. The preview's diff
  sign moves to the padding and the header ends left of it.
- *Facts* (`useBoardItems`): customer `N tagged for them`; problem `N solve it · vs N` + its customers; idea
  `solves N · N features` + customers; competitor `vs N · N features` + customers; feature its status, impact, effort +
  customers; package what it holds. Files at the end; planes still put `on N planes` first (planes.ts).
- *Link handle:* tried a square port, a `+`, four ports, a tab, an edge line, a small square, a `]`, triangles; then
  characters the mono font has (`>`, `›`, `»`, `->`). The user picked `›`, a little closer to the card: dim, bright
  under the pointer, cyan while linking. Not while the card is dragged, not far out. Its hit area is a band over
  the right edge; the glyph itself is never hit (its outline made the hover flicker), and the handle stops its own
  pointer events so a link ending under it can't take the cursor (the user saw it switch between arrow and hand).
- *Verified* headless on the emulators' example workspace: the layout on every type, the handle on hover, gone in a
  drag; the cursor across the card and handle reads grab → crosshair → none with no flicker; `tsc`.

### D-153 · 2026-10-19 · Accepted (changes D-111's compact and far looks)
**Zoomed out, the title in whole words at one size; far out, the card stays and its title's lines become bars.** The user,
after D-152: "now time to refactor how the text looks from far". Today's compact title was cut at 26 characters, often
mid-word (`shifts e…`) with room left, centred (so it jumped from the full card's top), and far out the card became a star.
Shown side by side on a scratch preview (port 5190): today; A, a type/status line + title + big evidence cells; B, the
title alone as big as each card fits; C, the title alone at one size; and far out, 1 the stars or 2 bars. The user picked
C and 2.
- *Compact* (`NodeCard.tsx`): the title alone in Geist 0.3 (`COMPACT_TITLE`, was 0.28), top-aligned where the full card's
  header starts, at most 3 lines (`COMPACT_LINES`); past them it ends at the last whole word with `…` (`cutAtWord`,
  cardLayout.ts, from troika's line layout on sync; a single long word breaks). The threshold moves with the size (5 px).
- *Far:* the card is drawn as always (stripe, corners, rings, preview marks, the stack behind a competitor), the title
  hidden and each of its compact lines a bar in `fgDim` as long as the line, 0.6 of the line's height (`TitleBars`). No
  rebuild when crossing a level (the card no longer swaps for another shape). A fanned feature chip: the name cut at a
  whole word (13 characters) when compact; far, one bar as long as that name.
- *Removed:* `FarNode.tsx` (stars), `chipSpot`'s far column, the round link ends far out (links end at card edges at
  every zoom; EdgeLine's circle branch is left for the session reworking links to drop).
- *Verified* headless on the emulators' example workspace, dark and light, zooming from full to the limit: whole-word
  titles in up to 3 lines, bars far out in both themes; `tsc`.

### D-154 · 2026-10-19 · Accepted (changes D-108's chip size and side-panel link rows)
**Link chips at a card's small-text size; a link just made opens ready to label; one link editor everywhere.** The user:
"i dont like their design and how big their text are compared to card titles. Also when i create a link from another
one, i automatically want to see the link settings under the link. If i am creating a link from side panel, i also want
to easily understand which link i just created and maybe add a label to it."
- *Ways a link is made* (listed for the user): the `›` handle drag, shift+drag, a drop on a fanned competitor feature
  (`inspired by`), the panel's `+ link` (also the competitor profile), the `for` picker (tags), the assistant, copy/paste
  and import. *Edited* in three places: the bar, the right-click menu, the panel's rows.
- *Chip:* shown side by side on a scratch page (real screenshots, a temporary `?chips=` switch): today (text 0.14 vs the
  title's 0.165), a the same box smaller, b no frame, c a dot until in focus. The user picked a: Geist Mono 0.085 (a
  card's small text), chip 0.15 high, 0.008 border, drawn down to 4.5 px text. A selected `relates` link says `relates`.
- *Drawn on the board* (drag, shift+drag, onto a feature): the new link is selected, its bar open with the cursor in
  the label field (`selectEdge(id, true)`, `labelling` in canvasStore; LinkBar waits for drei's `<Html>` to mount the
  field). `createEdge` returns the id at once, the write going on behind. The selected link always shows, even in a
  LINKS group that's hidden (it vanished before, `for` and `relates` being hidden by default).
- *Side panel:* every row: where it goes, kind, `⇄` reverse, `×`; under it the link's own label (faint `label…` when
  empty). The link just added is marked (a bar in its kind's colour, a short flash), its label field focused, and drawn
  on the board as if selected (`litEdge`) until the field is left; hovering a row lights its line too.
- *Right-click a link:* `add label` / `edit label` opens the bar with the cursor in the field.
- *Verified* headless on the emulators' example workspace: shift+drag → bar with the field focused, the typed label on
  the chip; `+ link` → marked row, field focused, line lit, then saved and unlit on Enter; menu `edit label` → field
  focused with the label; `tsc`.

### D-155 · 2026-10-19 · Accepted (adds to D-059's straight lines)
**Links stay straight; the user bends one by putting bend points on it. Nothing moves them by itself.** The user: "links
directly go from a to b but it makes it harder to organize stuff. Sometimes two links can coexist at the same
location... maybe like a snake, where we can shape it".
- *Tried first, turned down:* right-angle elbows routed round the cards by the app, overlapping pieces moved into lanes,
  chips placed off each other, a middle piece draggable (the user's pick from: elbows / curves / bends by hand; auto and
  adjustable). The user: "böyle hiç iyi olmadı. Biz her linki her zaman göstermiyoruz ki. Şu anda linkler oynayıp
  duruyo, linki istediğim gibi çizmek de imkansız." Lanes were worked out from the lines on screen, and lines show and
  hide with hover and selection (D-128, D-135), so every line shifted when one came or went; and the app, not the user,
  chose the shape. Removed entirely.
- *Bend points:* on the selected link (only it, editable, not in a preview), each piece has a hollow square in its
  middle (beside the chip when that's there); dragging a piece (5 px to start) puts a bend point there and moves it;
  a bend point is a filled square, dragged to move, double-clicked to take out. Points land on the grid's fifths
  (D-149) unless snapping is off or alt is held. `↺ straighten` in the bar, `straighten` in the menu take them all out.
- *Stored* as `bends: [{x, y}]` on the link (≤ 8), relative to the middle between the two cards' centres: moving both
  cards keeps the shape, moving one shifts the points by half; reversing the link just reverses the list. Undoable.
- *Drawn:* from the card's edge to the first point, through the points, to the other card's edge; the arrow along the
  last piece; the chip on the longest piece. A bent link isn't moved beside the others of its pair (D-113 still applies
  to straight ones). Each line depends only on its own cards and points.
- *Fixed on the way:* a line whose number of pieces changed kept drawing the old count (three keeps it), so the line
  is rebuilt when it changes; the link bar's and text bar's invisible box (left where the bar would be unshifted) took
  clicks to the right of the chip, now only the bar does.
- *Data:* `Edge.bends` in model.ts, `bends` a list of ≤ 8 in firestore.rules, 3 rules tests; import keeps valid points.
  Not deployed yet (`npm run deploy:rules`).
- *Verified* headless on the emulators' example workspace: links straight; a selected link's hollow square dragged → a
  bend point saved, both pieces drawn; the point dragged → moved; double-clicked → gone; rules tests 296/296 on a
  separate emulator set; `npm run build`.

### D-156 · 2026-10-20 · Accepted (changes D-050's and D-130's text; the note size becomes a paragraph)
**Text on the board gets a new look, paragraphs, and quarter turns.** The user asked to turn text 90°, said the text
and section designs didn't appeal, and "we do not allow people to write paragraphs but maybe we should". Shown a
mockup (heading with a numbered small line and a fading rule, a paragraph box, turned text beside a column): "A looks
absolutely gorgeous, go ahead".
- *Headings (H1–H3):* still centred on x/y (nothing that places text moves); set left-aligned with an optional small
  line (`kicker`, ≤ 60) over the text's left edge, Geist Mono capitals in `--fg-dim`, a leading number in magenta (or
  the label's colour); an H1 gets a hairline rule under it fading out to the right (1.3 × its width). Tracking −0.03 on H1.
  Selection and hover: a dashed box round it (cyan / grey) instead of the underline.
- *Paragraphs:* the old `note` size is now a paragraph (stored value unchanged, no migration; shown `¶`): Geist 0.24,
  leading 1.55, wraps at `w` (6.25 by default; an old note without `w` is as wide as its text), ≤ 4000 characters
  (rules: `size == 'note'` or a sticky allows 4000, others 200). Light Markdown like the chat: `**bold**`, `*italic*`,
  `- ` / `1. ` lists, `` `code` ``, `[text](url)` (shown underlined, not clickable). A hairline down its left side. The
  selected one has a grip on its right edge: drag the width (grid steps unless alt), its top-left corner stays put; typing
  more keeps the top-left too. Edited in a textarea over it: Enter is a new line, ⌘Enter or clicking away saves, Esc cancels.
- *Why a canvas texture:* troika's SDF text has one face per block, so bold words inside a line can't be set. The
  paragraph is laid out in board units with the DOM's Geist (measured once per text and width, `richText.ts`) and drawn
  into a canvas at the zoom's pixels per unit in powers of two (≤ 4096 px), so it's redrawn only now and then and stays
  sharp; it's in the PNG export since it's part of the scene.
- *Turning:* `rotate` 90 (↺, reads up) or −90 (↻, reads down) on any text, from the text bar; pressed again it's level.
  The box used for framing, selecting and the bar swaps its sides. Free angles were not offered (they'd break the grid).
- *Data:* `Label.rotate`, `kicker`; rules + 6 tests; import keeps them. `Palette.fgStrong` added for bold words.
- *Verified* headless on the emulators: heading with small line and rule, H2 turned 90 with a number, H2 turned −90,
  paragraph with bold/list/link selected (grip, bar with `¶` and ↺ ↻), old one-line note, editor opens at the right size
  with the caret at the end; rules tests 304/304; `tsc`.

### D-157 · 2026-10-20 · Accepted (changes D-130's look)
**Sections: the name is set into the frame's edge, along the top or up the left; colour goes to the line and the name
only.** From the mockup's four looks the user picked the first: "lets use that for all the options. When colored, just
color the line and the text. 90 degree rotation also would work with lines".
- The frame is a thin line, no wash, no band. The name sits on the top edge starting near the left corner (inset 0.35 +
  0.4 × its size), the line breaking round it; or with `side: 'left'` up the left edge, read bottom to top, ending near
  the top corner. A small line before the name (`kicker`, the same field as text's), mono, a number in magenta.
- Coloured: the line and the name in that colour. Hover greys the line, selection turns it cyan (thicker).
- Grabbed by the name and the four edges (0.22 wide on the line); the empty middle still belongs to the board.
  `sectionBand` is now 0.9 × the name's size (half the name hangs inside), so wrapped frames are a little shorter.
- The text bar for a section has `⌐ top` / `⌊ left` instead of the turn buttons. The name's field has the small line
  field over it.
- *Data:* `Label.side` (`'left'` or absent); rules + 2 tests; import keeps it.
- *Verified* headless: top and left names, coloured blue and magenta, numbers, selection bar; `tsc`.

### D-158 · 2026-10-20 · Accepted
**Sticky notes on the board, in the dark ASCII look.** The user, offered sticky notes and comment threads as two
different things and shown two sticky looks (bright paper, dark ASCII): "For C, ascii one looks better. Go ahead with that".
- A label of `kind: 'sticky'`: dark paper in the card colour, a bar of its colour along the top (yellow, the default,
  isn't stored; the bar's dots pick the others), three little checks in that colour in its corner, the text in Geist Mono
  0.15 with the paragraph's light Markdown (D-156), and `FIRSTNAME · 2d` at the foot. 3.125 wide (its right edge drags
  it, 1.875–12), as tall as its text, never under 1.875; centred on x/y, its top-left kept when the text grows.
- Signed: `uid` and `author` (the writer's Google name) when made; not tied to the writer in the rules (undo restores
  someone else's note, as with attachments). Copies keep the signature.
- Made from `+` (`sticky note`, beside `heading` and `paragraph`) or the board's right-click; opens for typing; left empty, it's
  deleted. Editors and owners only, like all text; viewers comment instead (D-159).
- It's not a place (not in `go to`), not an area for the assistant; the brief lists it under the board's notes as
  `sticky note from <name>`. Kept clear by the assistant's layouts like text.
- *Data:* `Label.kind` `'sticky'`, `uid`, `author`; rules allow 4000 characters for it; 3 rules tests; import keeps it.
- *Verified* headless: three notes (yellow default, magenta with bold and a list and a wider width, an empty cyan one with
  the placeholder), selected bar with colour dots, edit, remove; rules tests 307/307; `tsc`.

### D-159 · 2026-10-20 · Accepted
**Comment threads pinned to anything selectable on the board, or to a spot.** Offered in the mockup (a pin on a card in
the starter's colour, a thread beside it with resolve and a reply field); the user: "D also looks good. One thing i
would say is notes should be addable everything that are selectable on the board".
- *What a thread is on:* a card, text, a section, a sticky note, the project title (labels), a link, or a spot on the
  board (on the plane it was started on). Right-click any of them → `comment` (the board's empty space → a spot thread
  there). The pin sits at the thing's top-right corner (a link's chip), follows it when it moves, hides when the thing is
  filtered out, on another plane or a hidden link; what was deleted keeps a hollow pin where it was.
- *Who:* any member, viewers too (comments are how a viewer gives feedback), always as themselves: rules tie a thread's
  and a message's `uid` to the writer, only the writer edits a message, owners/editors delete any message or thread, a
  starter deletes their thread while nobody answered it. Anyone resolves or reopens. Not during the assistant's preview.
- *Not content:* no undo (`tracked()` isn't used, so a viewer's read-only lock doesn't refuse them), not copied, not in
  the export bundle, not filtered by SHOW/FOR/TAG. Loaded with the board (`useThreads`), messages only while a thread is
  open (≤ 300). A workspace delete takes threads and messages first.
- *UI:* pins are DOM over the canvas (constant size); the open thread is a panel beside its pin: header with what it's
  on, `✓ resolve` / `reopen`, `×`; messages (avatar, first name, `2d`, `edited`, own: edit/delete on hover; owners and
  editors: delete); reply field (Enter sends, shift+Enter new line, Esc closes); `delete thread`. Footer `comments N ▾`:
  `[x] show pins` (`c`), open threads newest first, resolved ones; picking one flies there and opens it. `@name` is only
  highlighted (no notifications, no member lookup).
- *Data:* `threads/{id}` (on, targetId?, planeId?, x, y, uid, name, count, lastAt, resolved?, resolvedBy?) and
  `threads/{id}/messages/{id}` (uid, name, text ≤ 2000, createdAt, editedAt?); a thread is written with its first message
  in one batch, each answer bumps `count`/`lastAt`. Rules + 19 tests.
- *Verified* headless on the emulators: pins on a card and a spot, a seeded 3-message thread opened from its pin, a reply
  sent (count 4), right-click → comment on a heading started a new thread whose pin landed on the heading's corner;
  rules tests 326/326; `tsc`.
- *Restyled 2026-10-20 as the assistant's chat box* (the user: "comment or thread thing do not look that good. Please
  make it look like chat box. Also buttons used there do not fit with our design language"): the panel is the chat
  window's frame (1px `--line`, near-black, mono 13), the header shows what it's on faint with `[resolve]` / `[reopen]`,
  `[delete]` and `[×]` as the chat's bracket actions; messages are a terminal log (`● name 2d` in the writer's colour,
  `you` for yours, the text indented 2ch under it, `[edit]` `[delete]` on hover); the composer is the chat's prompt
  (`>` in cyan, the rule above turns cyan while typing, `enter sends · shift+enter: new line`, `[send]`). No avatars,
  no green link-style resolve, no underlined reply field. Verified headless with a seeded 4-message thread.

### D-160 · 2026-10-20 · Accepted (changes D-156, D-157, D-111 for text)
**Fixes after the user tried D-156–D-159.** The user: "i dont like the way how section color change to blue when we
select them… like how card selection looks", "when i try to scroll any right click panel, it immediately closes and
board zoom outs", "lets separate headings from paragraphs completely", "if i click to a heading or paragraph and then
zoom out, the editing components gets bigger and bigger", "when i change the length of the paragraph… it moves to left
or right on its own", "headings disappearing after a point… paragraphs stay at max zoom out but not headings", and
"paragraph font sizes could be also adjustable… like 3 different values".
- *Sections:* the line keeps its own colour; hover and selection are a card's corner marks (D-150): grey a little out on
  hover, in the section's colour (or white) just inside while pressed, just outside once selected; the resize L the same.
- *Right-click menu:* the wheel over it scrolls it (and never reaches the board); the wheel anywhere else closes it.
- *Headings and paragraphs apart:* a heading's bar offers H1–H3, a paragraph's S/M/L; neither turns into the other. The
  assistant's `edit_label` drops a size that would cross over.
- *Editors follow the zoom:* the heading, paragraph, section-name and title fields size from the live pixels-per-unit
  (`useDetail`) instead of the zoom when they opened.
- *Width drag:* the paragraph's / sticky note's new centre is worked out from where it was when the drag began; it used
  the position the streamed writes kept moving, so it crept sideways.
- *Headings and section names always drawn* however far out (D-111's cut-off no longer applies to them); the small line
  over a heading still hides when tiny. (These two edits came from a parallel session, north-star-19, committed here.)
- *Paragraph sizes:* `scale` `small` 0.18 / medium 0.24 (default, not stored) / `large` 0.34, from S M L in its bar;
  the top-left corner stays put. Rules + 2 tests; import keeps it.
- *Verified* headless on the emulators: section selected (pink corners, pink line unchanged), S/M/L paragraphs and the
  bar, editing a heading then zooming far out (field stays small), headings readable zoomed far out, right-click menu
  scrolled 71 px by the wheel and stayed open; rules tests 328/328; `tsc`. The width drag was fixed by reading, not
  dragged in the headless test.

### D-161 · 2026-10-20 · Accepted (changes D-160's paragraph sizes)
**Paragraph sizes stay under an H3: S 0.14, M 0.18, L 0.24.** The user: "paragraph L is bigger than h3. Please fix that.
maybe adding a smaller font and then shifting the size labels." L (0.34) was over H3 (0.27).
- The sizes shift down one: L is the old M (0.24, what every paragraph had before D-160) and is the default (not
  stored), M is the old S (0.18), S is new (0.14). Stored `scale` is now `small` or `medium`; an old stored `large` reads
  as L. Rules allow all three; import keeps `small` / `medium`.
- *Verified* headless: H3 beside S/M/L paragraphs, L just under the H3; rules tests 329/329; `tsc`.

### D-162 · 2026-10-20 · Accepted (changes D-158's look, D-161's paragraph sizes)
**Sticky notes made quieter than cards, with text sizes; paragraphs and notes grow as you type.** The user: "sticky note
height is not being updated correctly when i continuously write. Also size of the text should also be adjustable. And
also there is too much padding and space is not being utilized perfectly… They should not take much more focus than the
cards we have", and "for paragraph, make the L smaller than h3" (0.24 against 0.27 read as the same).
- *Sticky notes:* a card's width (2.5; 1.25–10 by its edge), exactly as tall as the text (no minimum), padding 0.09, a
  0.025 colour bar, paper in `cardBehind` (a shade darker than a card), the signature moved to a small top line
  (`NAME · 2h`, 0.065 mono, checks on the right) so there's no empty foot. Text mono S 0.085 / M 0.105 (default) /
  L 0.13, all under a card title (0.165), from S M L in its bar (`scale`, the same field as a paragraph's, its own
  default); the top-left corner stays put.
- *Growing while typing:* the box (paper, dashed box, paragraph hairline) follows the text as it's typed, its top-left
  kept; it used the saved text until you clicked away. The edit field is the drawn text's exact size, width and line
  height (it had an 11 px minimum and the paragraph's line height, so what you typed wrapped differently and spilled
  out); under 11 px it's set at 11 and scaled down.
- *Paragraph sizes:* S 0.13 / M 0.165 / L 0.2 (default), so L sits clearly under an H3. Existing paragraphs get a bit
  smaller (they were 0.24).
- *Verified* headless: H3 beside S/M/L paragraphs; four notes (S, M with bold and a list, L, empty) selected with S/M/L
  in the bar; typing four lines into an empty note, the paper grew with each line and the text stayed inside it, zoomed
  out and in; `tsc`.

### D-163 · 2026-10-20 · Accepted (changes D-156's dashed box and width grip)
**Text, paragraphs and sticky notes select like cards; a paragraph's or note's width drags by a strip down its right
side.** The user: "lets make size adjustment handle like how it is implemented in section card. A thingy strip. Also
instead of using blue stripped lines, use the selection design that we used in cards and sections", then "i meant just a
vertical strip on the right side of the components... since their height is not adjustable".
- *Selection:* a card's corner marks (D-150) instead of the dashed cyan box: grey and a little out on hover, just inside
  while pressed, just outside once selected, in the text's colour (white, the label's colour, a note's colour); round a
  note's paper edge, a little clear of text. Also shown while a paragraph or note is being edited (its field lost its
  dashed cyan outline), so the box visibly grows with what's typed.
- *Width grip:* a thin strip (0.014 wide, 60% of the height) just inside the right edge (0.025 in; the user: "put
  the handle inside the card but to very very right… and make it thinner"), shown on hover or selection in the
  same colours; dragging anywhere on that side changes the width, the top-left corner stays put. An L in the corner was
  tried for a moment and replaced at once (the height isn't adjustable, so a corner suggested the wrong thing).
- *Verified* headless: three things selected (H3, paragraph, note), a paragraph alone with its strip, a note edited with
  its corners growing; `tsc`.

### D-164 · 2026-10-20 · Accepted (supersedes D-058's stack and fan-out)
**A competitor's features are names beside its card; a feature's parts fold into it as names; every open and close
glides.** The user asked to rethink how a competitor's features show ("a better way to visualize it… still features
close under a competitor"), to let features that are part of another "close under the parent feature", and said the
fan-out animation was "half baked… even if i click to the same competitor, feature animation retriggers and i dont see
any animations when i click somewhere else". After mocks on a local page (squares, spines, strip or names beside the
card; for parts: a row, nested dots, a tree or names), the user picked **names for both**: "names for both of them!!!".
They also asked that the competitor card keep its size and liked the framed tray with a side panel.
- *Competitor features:* the first three names beside the card (right of the `›` handle), `+N more` under them; the full
  list (category names with counts, a cyan bar when it matches one of ours, availability on the right) while it (or one
  of its features) is selected; the tray and opening on hover were dropped by D-173. Dragging the competitor closes it
  until it's dropped. Rows open the feature
  in the panel and take link drops (`inspired by`); links end at a row while it shows. The plates behind the card and
  the fanned chips (`FeatureChip.tsx`) are gone (`SideList.tsx`).
- *New fields:* `availability` (`free | paid | enterprise | beta`) and `url` (source) on a competitor feature, edited in
  its panel row with "matches our feature", which is the matrix cell's `competitorFeatureId` (no new field: setting it
  names the feature on `our feature × its competitor` and lets go of any other cell that named it; one undo step).
- *Parts:* `part of` between two features makes the first a part of the second (first link wins, loops left out). The
  parent's facts line ends in `[−] 3 parts` / `[+] 5 parts` (the mono font has no ▾ ▸); clicking it or the right-click
  `fold parts` folds them: each part card shrinks (to 0.1) into its name row beside the parent, indented by depth, and
  hides; a row click unfolds, the cards growing back out of their rows. A part folded on its own stays folded inside.
  Links to a folded part end at its row; `part of` lines inside one fold are left out. `folded` is stored where a card's
  place is (the feature on All, its placement on another plane), so it's per plane and shared; undoable. Rules allow
  `folded` (bool) on features and placements and `availability`/`url` on competitor features; bundle export/import
  carries them.
- *Motion:* rows, headings, the tray and a folding card glide from where they are, cubic ease-in-out, 280 ms; a target
  that doesn't change starts nothing, so re-clicking replays nothing, and closing runs the opening backwards (the user's
  earlier note that front-loaded eases read as no motion). Reduced motion snaps. Too small to read, a row's name is a
  grey bar (D-153).
- *Also fixed:* leaving a card through its `›` handle never cleared its hover (the handle stops the event the card's
  own out would need), so a hover-opened list stayed open; the handle's out now clears the card's hover when the
  pointer is off the card.
- *Not done:* lines to a row jump to it while the row is still gliding (as lines already do while cards glide); the
  assistant's `update_competitor_feature` doesn't write availability or source yet.
- *Rejected in the mocks:* squares, spines or a strip beside the card; nested dots, a tree, or a frame round the parts;
  a separate competitor page.
- *Verified* on emulators (example workspace, dark, 1600 × 1000, headless): Crewly closed with three names, hovered open
  with category headings, staying open on the list, closing off it; selected and clicked again with nothing replayed;
  dragged (closed while carried, open again on drop); a 2-level fold (Payroll export in Rule-based swap approval, then
  both in Availability collection) folding mid-frame and folded, links ending at the rows; unfolded by a row with the
  inner fold kept; the panel's new fields. `tsc`; rules tests 335 passed, 0 failed.

### D-165 · 2026-10-20 · Accepted (changes D-159's pins and list)
**Comments: the list moves into the filter bar; every pin is the same comment mark.** The user: "First put the bottom
left dropdown to top right filter location. Second. Why we show the profile picture of the one who started the thread?
Cant we just put a logo there?"
- `COMMENTS │ N ▾` is the last item of the board's filter bar (after GO TO), framed like the filters, lit while the pins
  are hidden; inside, `[x] show pins (c)`, open threads newest first, resolved ones (`…` / `✓`), or `none yet ·
  right-click anything → comment`. The bottom toolbar no longer has it.
- A pin is a speech bubble (24 × 22, rounded with its bottom-left corner pointed at the spot) in `--fg-strong` with three
  small dots in `--bg`, the same for every thread; a framed count once it has answers; grey ring on hover, cyan while
  open; hollow when what it was on is gone. Who started it shows only in its tooltip and inside the thread.
- *Verified* headless (on the parallel session's running emulators): two pins, the thread opened, the comments list open
  under the filter bar; `tsc`.

### D-166 · 2026-10-20 · Accepted (changes D-159 and D-165)
**Comments grow up: full names, only writers delete, a framed chip for a pin, a threads panel, mentions, no person
colours.** The user: "lets put the full name to each message", "someone other than the message owner can delete their
messages, we should not let this happen", "we can come up with a better design for thread indicator aligned with our
design language", "Maybe a separate all communication tab would be great. People can see all of the threads, can redirect
themselves, can see if there is something new… put this panel to the left bottom corner", "mentioning would be great",
and on the colours: "is it random? If so maybe we do not need to color code" (they were presence colours: a hash of the
uid, or join order while online; nothing a thread needs).
- *Messages:* the writer's full name in `--fg-strong` (your own in cyan), when, the text; no person colours anywhere.
- *Deleting:* only a message's writer edits or deletes it (rules: own, or an owner together with the whole thread in the
  same batch, `!existsAfter(thread)`). A thread is deleted by an owner, or by its starter while nobody answered; editors
  no longer delete others' words. `deleteThread` is one batch (≤ 450 messages); a workspace delete goes thread by thread.
- *Pin:* a small framed mono chip like a link's chip, `“ 3`, its bottom-left corner at the spot; magenta when someone
  else wrote since you last read it, `@` instead of `“` when it mentions you, cyan while open, `✓` for a resolved one
  shown, dashed when what it was on is gone.
- *Read marks:* `threadReads/{uid}` (`seen: {threadId: lastAt}`), yours alone (rules); opening a thread marks it read;
  a thread is new when `lastAt` is past your mark and the last writer (`lastUid`, rules: always the writer) isn't you.
- *Threads panel:* `THREADS │ 2 new` in the board's bottom-left toolbar (lit magenta while something's new) opens a panel
  above it, set like the assistant's chat window: views `[all] [new] [mentions] [resolved]` with counts, `[mark all read]`,
  `[×]`; a row per thread, newest first: mark (`●` new, `@` mentioned, `“`, `✓`), what it's on, when, who wrote last and
  how it began (`lastName`, `lastText` ≤ 160 on the thread), how many and who started it. A row flies the board there and
  opens the thread. The filter bar's `COMMENTS │ on ▾` now only says what the pins show: show pins (`c`), only with
  something new, resolved ones too.
- *Mentions:* `@` in the prompt suggests the workspace's people (the members list, ≤ 200; first name or full name
  prefix), arrows + Enter/Tab pick, inserting `@Full Name`; the message keeps `mentions` (uids, ≤ 20) and the thread
  gathers them (≤ 50). `@Full Name` of a member, or any `@word`, shows in cyan. No email or push: the panel's mentions
  view and the `@` pin are how you find out.
- *Data:* `Thread.lastUid/lastName/lastText/mentions`, `ThreadMessage.mentions`, `ThreadReads`; rules + 12 tests (344/344).
  The parallel session's D-164 commit (be728b9) happened to include the first part of these rules and types, which were
  already in the working tree; the rest is in this commit.
- *Verified* headless (on the parallel session's emulators): pins `“ 1`, `@ 1` (magenta), `“ 3` (magenta → cyan when
  opened), the panel with all 3 / new 2 / mentions 1, opening a thread from it marked it read (new 1), `@bo` suggested
  "Bob Builder bob@example.com"; `tsc`.

### D-167 · 2026-10-20 · Accepted (changes D-166's threads button and pin mark)
**One comment icon; the threads button is a square icon button like `+`.** The user: "make the threads buttons something
like '+' button with how many new mentions shown. We need to think about icon cuz right now the icon used on the board
also not working for us."
- *The icon:* a square speech bubble (square corners, its tail at the bottom left) with three square dots inside, on a
  16 grid with a 1.5 stroke, like the toolbar's fit/snap/guides icons (`CommentIcon` in Threads.tsx). It replaced the `“`
  mark and stays the one comment mark everywhere.
- *Threads button:* 36 × 36 framed, right of `+`, the icon in `--fg-dim` (brighter on hover, cyan edge while the panel is
  open); a magenta square in its corner with the number of new mentions (`9+` past nine), or a small magenta dot while
  something else is new.
- *Pins:* the icon at 11 px and the count; `@` when it mentions you, `✓` resolved; colours as D-166.
- *Verified* headless: the button with `1` beside `+`, pins with the icon (one new in magenta, one `@ 1`, one read).

### D-168 · 2026-10-20 · Accepted (adds to D-159, D-166 and the planes, D-139)
**A thread takes you to its plane.** The user: "eğer kullanıcı bir plane deyse ve başka bir planeden mesaj geldiyse mesaja
tıklasa da gidemiyor. Bu farklı planeler olayını düşünmeliyiz" (on one plane, a thread from another plane couldn't be
reached from the panel; the camera flew to where it would be on the open plane).
- *Which plane a thread is seen on:* text, a section, a sticky note or a spot belong to one plane (the label's
  `planeId`, the spot's). A card or a link: the open plane if the card (both ends, a competitor feature counting as its
  competitor) shows there; else the plane the thread was started on, if it's there; else All, where every card is.
- *Threads remember where they began:* `planeId` is now set for every new thread started off All (before, only spots).
- *Going there:* from the threads panel a row on another plane switches the board to it (`?plane=`, remembered as with the
  switcher), waits until that plane's cards and text are in place, then flies there and opens the thread beside its pin.
- *Seeing it first:* with planes in the workspace, a row on another plane than the open one ends `· on Pricing ↗` (cyan).
- The panel's rows now use the comment icon too (D-167) instead of `“`.
- *Verified* headless: a plane "Pricing" with one card; from All a spot thread on Pricing switched to Pricing and opened;
  on Pricing the other thread's row said `on All ↗`, and opening it switched back to All and opened it; `tsc`.

### D-169 · 2026-10-20 · Accepted (adds to D-065, D-067)
**People here as a stack; smooth live cursors.**
**What:** HUD people: only squares, never names (the user: "direkt herkesi isimsiz göster"), overlapping (−4 px, edged in
the page colour), the name and view in a tag under the square on hover; past four, the first three plus `+N`, which opens
a framed list of everyone (square, name, view; click follows). Whoever you follow stays among the squares. Live cursors:
still written at most every 60 ms (~16 Hz); the receiver keeps each position with its arrival time and draws the cursor
120 ms (two writes) in the past on a Catmull-Rom curve through them; after a still spell the move starts from the resting
point; bunched arrivals are spaced out again. Cursor positions live outside zustand (`cursorAt`, `onCursorMove` in
`presence.ts`); the peer list publishes only when something other than a cursor's position changed.
**Why:** the user: names for every person don't fit past two people; cursors moved in jerks, not smooth like Miro. They
asked not to send 30–60 positions a second, only to make it smoother for the one watching.
**Verified:** two headless Chromes on the emulators (Alice moves in a circle, Bob records her cursor each frame): before,
99 of ~140 moving frames stood still and the speed varied 1.67 (sd/mean); after, none stood still, 0.17. People chips
checked with 1, 3 and 7 injected peers (hover tag, `+4` list).
**Alternatives:** sending more often (rejected by the user); damping toward the last point (what it was: steps then stops).

### D-170 · 2026-10-20 · Accepted (adds to D-067)
**Following someone opens what they open.** The user: "izlediğim kişi sağ panel açıcak bir hareket yapınca, benim de sağ
panelim açılsın istiyorum". While following, each change of their selection (presence `sel` + `more`) becomes yours once
you're on their view, so the side panel (one item, or "N selected") opens and closes with theirs. Done in `PeopleHere`
only, nothing new written. Not in the matrix (a cell there is its own selection) or reports (the open report is in the
address). A click of your own holds until they pick something else; it doesn't stop following.
**Verified:** two headless Chromes on the emulators, Bob following Alice: Alice picks a card → Bob's panel shows it; three
→ "Selection"; none → Bob's panel closes.

### D-171 · 2026-10-20 · Accepted (changes D-159's hollow pin)
**A thread whose card, text or link was deleted leaves the board but stays in the threads panel.** The user asked why
such a thread hung on the board as a dashed pin, and agreed to: no pin; kept in the panel, marked; back on the board
when the delete is undone.
- Threads aren't deleted with what they're on, on purpose: deleting a card is undoable (⌘Z) and threads aren't part of
  undo, and only a message's writer may delete it (D-166), so an editor's delete must not take others' words with it.
- *Board:* no pin while what it's on doesn't exist; opened from the panel, it opens at where the thing was. A pin's
  being there is worked out from the thing existing, so undoing the delete brings it back with nothing extra.
- *Panel:* its title reads `a removed card` / `removed text` / `a removed link`, and its row ends `· what it was on was
  deleted`; it can still be answered, resolved, or deleted by an owner.
- *Verified* headless: a card's thread pin (1) gone after deleting the card with Delete (0), the panel row marked, ⌘Z
  brought the pin back (1); `tsc`.

### D-172 · 2026-10-20 · Accepted (changes D-063's cell size)
**The backdrop's ASCII cell is 9 device pixels, not 9 CSS pixels.** The user moved the app from a 1x monitor to their 2x
laptop and saw the glyphs get small and the field turn much finer, and wanted it like that all the time.
- *Why it happened:* `cellSize()` was `9 × devicePixelRatio`, read once when the page opened. Opened at 1x (9 px cells)
  and moved to 2x, the cells stayed 9 device px = 4.5 CSS px; the other way they became 18 CSS px (~200 across a wide
  screen).
- Now a fixed 9 device px: a 2x screen gets 4.5 CSS px cells (4 × the cells, the look the user liked), a 1x screen is
  as before, and moving between screens changes nothing.
- The DOM/card reveal grid stays 9 CSS px (`CELL_PX`): one backdrop cell at 1x, 2 × 2 at 2x, so its lines still fall on
  the backdrop's grid.
- *Follow-ups the fine grid needed:* the welcome's stars lined up in rows (the sine hash loses precision on big cell
  ids), so stars and the dawn's dither use a hash without sine (`cellHash`); the north star is sized per 9 CSS px
  (`uFine` = pixel ratio, 1–2), so it doesn't shrink; stars start brighter (0.3) and 1.6× on paper; light theme ink is
  near-black (was grey 0.08) and thin glyph edges count for more (`pow(…, 0.75)`), since on paper the intro and flow
  barely showed.
- *Verified* headless at deviceScaleFactor 1 and 2, dark, light and light without the night sky (as signed-in pages show
  it): stars scattered, north star the same size on both, the intro clearly readable on paper; `tsc`.

### D-173 · 2026-10-20 · Accepted (changes D-164's open list)
**A competitor's full feature list opens only on click, shows as plain category names over rows, and sits over
everything.** The user: the list opening on hover should open "only after clicking"; the open list "sometimes stays
under other things"; and the tray was "too complex… show the areas and lists directly; no panel behind them, they can
look like a feature with subfeatures". From a local mock of three options (A: areas as rows with features indented
under them; B: plain text, grey caps area names, `├ └`; C: area row with hanging names) they picked "like A, but the
categories shown like B, not in a card, and the features under them not indented".
- *Open on click:* selecting the competitor or one of its features opens it; hover no longer does (the 160 ms
  leave timer and the list's own hover are gone, `Board.tsx`).
- *Look:* no tray, no `FEATURES n`; each category's name and count in small grey caps (`BOOKING  3`, 0.066, tracking
  0.14) over its rows; rows 2.58 wide at the same left edge as the name, availability on the right (`SideList.tsx`).
- *Order:* the open list, and one still closing, lifts 0.024 above the lists' 0.046 (to 0.07): over every card (a
  dragged one is 0.06) and the other lists, under the board's overlays at 0.08. Before, the tray sat at 0.044, under
  other competitors' closed rows (0.046) and newer cards' text.
- *Closed (same day):* the user asked for five names beside the card with `+N more`, and for the list not to reorder
  on opening ("when i click to competitor feature list re orders, lets just not do that"): closed shows the first five
  in the open list's order (by category, oldest first within one), so opening only adds category names and rows. Then
  "make it 4 instead of 5" and "the gap between different categories is too much": four names; between one category's
  last row and the next one's first, 0.21 (was 0.32), its name nearer its own rows.
- *Rows like cards:* "no need for grey border… in line with our new card designs", and the same for folded parts' rows:
  every row (competitor features and folded parts) is card paper with a solid accent strip and no edge; hovered, grey
  corner marks a little out; selected, accent corner marks close in (`CardCorners`, kept out of pointer hits).
- *Blur behind:* "the features may overlap with other things. Lets just blur the background of feature list": behind an
  open list, a plate shows the board under it blurred (each frame it shows, the board without the list is drawn into a
  quarter-size picture, sampled 7 × 7 round each pixel, 14 css px) and 35% toward the page colour; no edge, no fill of
  its own; it fades and shrinks with the list. The user: "it laggsss so much with that effect", since it drew the whole
  board twice a frame. Replaced the same day by a soft shade: one plate in the page colour, 90% in the middle, fading
  out over its last 0.12 (`ListShade` in SideList.tsx), no extra render. Don't bring back a real blur on the board.
- *Verified* headless (emulators, Tablebook): hovering a competitor leaves it closed; selecting opens it with category
  names over un-indented rows; with ShiftGrid dragged onto Crewly, the open list's meshes draw after Crewly's closed
  rows (logged draw order) and its names show over them; `tsc`.

### D-174 · 2026-10-20 · Accepted (changes D-144's landing on the overview)
- *Decision:* opening a workspace shows its canvas at `/workspaces/<id>`: an empty page with only the flowing backdrop,
  not dimmed, no `+` grid marks, no view tabs, no assistant chat. The board moved to `/workspaces/<id>/board`
  (`workspacePath(wid)` still means the board; `canvasPath(wid)` is the canvas); the other views keep their paths and
  open from links. Old links `?item=` / `?plane=` on the bare path go on to the board. Presence has a `canvas` view
  (database.rules.json, rules test).
- *Where it's going:* the user: "workspace'e girince sonsuz bir canvas üzerinde bomboş başlamak. Canvasın üzerine board
  koyabilicem … table koyabilicem başka bir noktasına … birden fazla board". So the canvas will hold boards (each with its
  own cards), tables and more, several of each. This step is only the empty canvas.
- *Verified* headless (emulators, Tablebook): the workspace opens on the bare backdrop with breadcrumb and you/settings
  only; `/board` shows the board as before; `npm run test:rules` 345/345; build. RTDB rules deployed 2026-10-20.

### D-175 · 2026-10-20 · Accepted (changes D-054's account chip and gear in the top right)
- *Decision:* the HUD moves to a left side nav, piece by piece. First, you and settings: bottom left, `--space-3` from the
  edges, stacked: a short horizontal rule, your square (initial only, name on hover), the gear under it. Token
  `--corner-h` is the room it takes; the board's bottom-left toolbar, the threads panel and the pages' bottom padding sit above it.
- *User:* "bütün hud'ı yavaş yavaş sola taşıycaz … ayarlar ve logged in user'ı sol alta", "side nav bar gibi olcak …
  dikey yerleştir", then "padding'i azalt, ayarlar ile profil resminin yerini değiştir, profil resminin üstüne yatay separator".
- *Verified* headless: canvas and board screenshots, the board toolbar clear above the corner; build.

### D-176 · 2026-10-20 · Accepted (builds on D-174)
- *Decision:* pages go away; what they were become pieces placed on the workspace canvas. First piece: a board. The side
  nav's `+` (top left under the breadcrumb, the create button's magenta, its menu opening to the right) has `board`,
  which adds one at the middle of the screen, 960 × 600 canvas px, moved right past any piece it would cover, and selects
  it. A piece drags (a press turns into a drag after 5 px, held where dropped until its data comes back, one undo step),
  Delete/Backspace removes it, Escape or a click on empty canvas lets go. The canvas pans by dragging empty space and the
  wheel zooms round the pointer, 0.1–4; the camera is kept per workspace for the tab's life (`state/canvasView.ts`).
  Data: `pieces/{id}` `{ kind: 'board', x, y, w, h, name?, createdAt, updatedAt }` (`src/data/pieces.ts`, rules
  `validPiece`, in `deleteWorkspace`'s list); viewers read, can't add. Not in the export bundle yet.
- *Look:* the user: "ana canvasımın üstüne koyduğum her şeyin kendi bir bg'si olacak. Board için … animasyon oynamayacak,
  simsiyah bir arkaplan, sadece `+` gözüküyor olacak". So a board is solid `--bg` with a thin border, `+` marks every 25 px
  (3 px arms, 1 px stroke, new token `--grid-mark`, the board grid's grey), its name set into the top edge; magenta edge
  and name when selected. Inside, for now, only `open the board ↗` to the board page: the board's own cards inside it are next.
- *User:* "sayfa kavramı kalmadı. Sayfalar … canvasımızın üstüne eklediğimiz componentler gibi … side navigation'da bir
  artı butonu ver, burada board koy. Ben board'a tıkladığımda bulunduğum konuma kart ekler gibi board ekleyeyim".
- *Verified* headless (emulators, Tablebook): `+` → board adds one in the middle; a drag moves it; pan, wheel zoom; a
  second lands beside the first; both still there after a reload. `npm run test:rules` 352/352; build.
  Firestore rules deployed 2026-10-20.

### D-177 · 2026-10-20 · Accepted (archives D-040–D-173's views for now)
- *Decision:* on branch `refactor/north-star-1.5`, everything from before the canvas goes to `src/archive/` (paths mirror
  `src/`, moved with `git mv`; `tsconfig.json` excludes it, nothing live imports it; README there): every view
  (board, focus, flow, table, matrix, priorities, overview, reports, competitors), the assistant (`src/ai`, the chat, orb,
  proposals, keys and usage pages), export/import (`src/io`, the example workspace, the import strip), and the data layer
  behind them (cards, links, matrix, labels, planes, packages, evidence, threads, attachments, reports, selection;
  canvasStore, plane and workspaceView state). Files that stayed live but were cut down keep their full earlier version
  in the archive too.
- *Live:* landing, workspaces list (create, join by code, invites; no example or import), settings (account, display,
  workspace general and people), presence (squares and the `+N` list; following is archived until the canvas has
  cursors), undo/redo keys, viewers read-only, the canvas with its pieces (D-174–D-176). `model.ts` holds only the live
  shapes; `workspaceData.ts` loads only `pieces`. Every old path under a workspace opens its canvas. Rules and their tests are
  unchanged: the old data is still in older workspaces, and `deleteWorkspace` still removes all of it (thread and
  attachment-file cleanup inlined there).
- *User:* "parça parça doğru ilerlemek istiyorum … önceki bütün implementation'ları bir archive içine koy, parça parça
  şu anki çalışmamıza ekleriz feature'ları" — then chose "veri katmanı da arşive" and "build'e dahil olmasın".
- *Verified* headless (emulators): sign in, create a workspace, add a board, `/board` opens the canvas, settings show
  you + workspace (general, people) only, no console errors; `tsc`, build (2.17 MB, was 2.9), `npm run test:rules` 352/352.

### D-178 · 2026-10-20 · Accepted (changes D-176's `+` button)
- *Decision:* the side nav's tools sit at the vertical middle of the left edge (`.side` in Hud.module.css, `top: 50%`),
  `--space-3` from it, lined up with the you/settings corner. The `+` is no longer the filled magenta create button: it's
  an unframed 30 px icon button like the settings gear, a drawn `+` (SVG, 20 px, 1.5 px stroke) in magenta, a little
  bigger on hover, the tabs' magenta bar under it while its menu is open (Menu `icon` prop).
- *User:* "board eklemeyi yaptığımız düğmeyi vertically ortala … normalde toollar ekranın sol ortasına gidecek … ayarlar icon
  button'u gibi yapabiliriz, sadece icon'un kendisi pembe olur", then "daha büyük bir + kullan".
- *Verified* headless: the `+` centred on the left edge at y = 450 of 900, its menu opening to the right with the bar under it; build.

### D-179 · 2026-10-20 · Accepted (builds on D-176)
- *Decision* (renaming changed by D-180: in edit mode only, the name always a field): boards have their own names: a double-click on the name in the top edge turns it into a field (as wide as
  the text, cyan underline), Enter or a click elsewhere keeps it, Escape doesn't; empty takes the name away and it reads
  `board` again (grey). `renamePiece` in pieces.ts, one undo step, ≤ 80 characters (the rule already allowed `name`).
  A board's drag now listens on the window instead of capturing the pointer, so a press that doesn't move stays a click.
- *Console:* every board has one, always open, just outside the board under its bottom-right corner, set like the bar a
  selected text or link got (D-108): solid, mono, a heavier top edge, `[−] 100% [+] │ [⛶ full screen]`. The user asked
  for the look only: the buttons do nothing yet.
- *User:* "board'lar farklı isimlendirilebilir olmalı … board'un sağ alt köşesine … bir konsol, hep açık … zoom in, zoom out
  ve full ekran düğmesi … şimdilik fonksiyon implemente etmene gerek yok", then "card'ın dışına sağ alta koy".
- *Verified* headless: double-click, type, Enter: the name shows and is still there after a reload; the board still drags
  (moved 50, 50); the console sits under the corner; `tsc`, build.

### D-180 · 2026-10-20 · Accepted (changes D-176's moving and D-179's renaming)
- *Decision:* the piece is called a **plane**, everywhere: the `+` menu, its label, its console, the code (`PieceKind =
  'plane'`, `KIND_NAME`, `PlaneConsole`, undo labels). New pieces are stored `kind: 'plane'`; ones made before say
  `board`, which the rules still allow (and undo can bring back) and the app shows as a plane. Not the archived `planes`
  collection (D-139). Presence's view is just `canvas` now.
- *Edit mode:* the console gets `✎ edit`. A press on a plane belongs to the plane, since its inside will be controlled
  there: the canvas doesn't pan from it and nothing moves. With edit on (the button lit cyan, a dashed cyan edge, square
  handles on the corners and edge middles) the plane is selected, drags from anywhere on it, resizes from the handles
  (never under 320 × 200), and its name is a field (Enter or leaving it keeps it, Escape puts it back). Edit stays on
  through clicks elsewhere: it's switched off only by pressing `edit` again. Delete removes a plane only while it's in
  edit mode. Moves and resizes are one undo step each (`placePiece`). Viewers get no `edit`.
- *User:* "board demeyelim, ismine de plane diyelim. Bütün kod tabanında da bu ismi kullan … console'a bir de edit düğmesi
  ekle, buna bastığımızda kullanıcı plane'in adını değiştirebilsin ya da resize edebilsin ya da taşıyabilsin … edit moddan
  çıkmak için edit'i kapatması gerek … mouse board'un üstüne gelince artık kullanıcı board'un içini kontrol etmeye başlayacak".
- *Verified* headless: a drag without edit leaves it (0, 0) and Backspace doesn't delete it; with edit: moved (80, 40),
  resized from the bottom-right (−200, −100) and the top-left (x/y +50/+30, size −50/−30), renamed, still in edit after a
  click on empty canvas, edit off shows the name, ⌘Z undoes the rename. `npm run test:rules` 353/353; Firestore rules deployed.

### D-181 · 2026-10-20 · Accepted (changes D-179's console and D-180's edit look)
- *Decision:* chosen from four variants shown side by side on a local preview (A corner marks, B tab and dock, C terminal,
  D quiet): the terminal look (C) with A's edit mode. At rest a plane has a thin `--line-hover` frame with its name set
  into the top edge; its console, outside under the bottom-right corner, is a terminal line: the plane's name, a magenta
  `▸`, `zoom [−] 100% [+] [full] [edit]` (zoom and full screen still only drawn). On hover the cards' corner marks
  (D-150) show grey just outside the corners. In edit mode: a faint dashed cyan frame, the corner marks long (22 px),
  2 px and cyan, and they are the resize handles; short cyan bars on the edge middles resize one side; the console turns
  into a cyan status line `EDIT ▸ 710 × 470 · drag to move · corners to resize [done]` (the live size sits here rather than
  under the left corner, where a narrow plane's console would cover it); `[done]` ends edit mode. No magenta selection
  colour on planes any more: a plane is selected only while in edit mode.
- *User:* "C - terminal görünümünü seviyorum ancak edit kesinlikle A gibi olmalı. Bu bizim card'larda uyguladığımız köşe
  çizgileri baya güzel duruyor".
- *Not taken yet* (suggested on the preview, waiting for the user): console and name at a fixed screen size; moves and
  resizes snapping to the 25 px marks; `e` to toggle edit and arrows to nudge; `[× delete]` in the console.
- *Verified* headless: hover marks, edit frame and status line screenshots; drag without edit (0, 0); in edit moved,
  resized from both corners, renamed; `[done]` leaves edit; ⌘Z undoes the rename; build.

### D-182 · 2026-10-21 · Accepted (changes D-181's console; adds delete, snapping)
- *Console:* no plane name in it any more (it's on the plane): `▸ zoom [−] 100% [+] [full] [edit]`. In edit mode the
  status line has `[delete]` (magenta) before `[done]`.
- *Delete asks first, as a failing screen* (its look replaced by D-183's hazard tape; `MeltdownConfirm` is gone): a full-screen native <dialog>;
  the screen flickers dark with scanlines; the box builds cell by cell (D-034's cells, 520 ms) but every cell not there
  yet is a corrupt glyph in magenta/cyan/ink, with static over the screen for the first 240 ms; the box tears sideways
  (steps, skew) with its title's colours split while it builds and in short bursts every 1.6–4.2 s; `!! FAULT 0xDE1E7E`
  (the `!!` blinks), `delete "Pricing"?`, "The plane and everything on it goes. ⌘Z brings it back.", `[cancel]`
  (focused) `[delete]`. Leaving, it breaks apart cell by cell (200 ms). Escape cancels. The Delete key in edit mode opens
  it too. Reduced motion (the app's setting): no canvas, no flicker, blink or tearing. Its pointer events don't reach the
  canvas through the portal.
- *Tried and dropped:* the screen melting while it's open (ASCII drips from the top of the screen and magenta drips from
  under the box). The user: "harika duruyor ama eriyormuş gibi yapmamız biraz overkill oldu … onun dışındaki her şey çok güzel".
- *Snapping:* moves, resizes and new planes land on the canvas's 25 px grid (a plane's `+` step), so planes side by side
  line up mark for mark; alt held = free. The minimum is 325 × 200, gaps between new planes 75.
- *User:* "console içine adını yazmamıza gerek yok. Edit dediğimizde ayrıca silme de koyalım. Silmeye tıklayınca … kare kare
  animasyon ile emin misiniz modal'ı … sanki bir şeyler ters gitmiş ve bozulmuş gibi … cyberpunk", "snap olayı da mantıklı".
- *Verified* headless: frames at 40 ms (corrupt glyphs over the box) and 3.6 s; a move of (+37, +11) lands (+25, 0), a
  resize gives 825 × 525; cancel keeps the plane, Delete opens the confirm, delete removes it, ⌘Z brings it back; build.

### D-183 · 2026-10-21 · Accepted (changes D-182's delete confirm look)
- *Decision:* the confirm's entrance is hazard tape (`src/ui/HazardConfirm.tsx`, replacing `MeltdownConfirm`), picked from
  seven entrances on a local preview (today's corrupt cells, rain, CRT power-on, kernel panic, gathering glyphs, VHS
  band, hazard tape). The screen darkens (200 ms); the box comes in four hard steps (260 ms, from 0.96); a band of ASCII
  `╱` three cells wide wraps round it from the box outwards (380 ms, on the screen's 9 px cell grid), its stripes magenta
  and faint grey, runs along for 1.5 s and stops, staying there; the title and lines decode out of glyphs (DecodeText,
  500 ms). No `!! FAULT` line. Leaving: the box breaks apart cell by cell, tape and dark fade (200 ms). API: `title`,
  `lines`, `confirm`, `onConfirm`, `onCancel`. Reduced motion: no steps, decode or running, the tape drawn still.
- *User:* "F güzel. '!! FAULT …' falan yazmaya gerek yok. Onun dışında iyi duruyor".
- *Not chosen* (kept for other moments if wanted): rain into the box, CRT power-on, kernel panic (hex dump + ASCII frame
  traced + typed text), glyphs gathering into the box, VHS band.
- *Verified* headless: frames at 120 ms, 300 ms, 2.4 s; cancel, Delete key, delete, ⌘Z; build.

### D-184 · 2026-10-21 · Accepted (changes D-179's `full screen` into `focus`; its transition replaced by D-185)
- *Decision:* the console's `full screen` is `focus`. It makes the plane the view, "as if passing from one plane into
  another": the plane grows from its place on the canvas to the whole screen and becomes the main view, like the old
  board page. In the address as `?focus=<id>` on the canvas's path: the back button leaves, a reload stays (no
  transition then), a plane deleted while in focus drops it.
- *Transition* (`src/views/workspace/FocusedPlane.tsx`): a layer with the plane's look animates (WAAPI, 900 ms,
  cubic-bezier(0.65, 0, 0.35, 1)) from the plane's screen box to the canvas's whole box, its `+` marks from 25 × zoom px
  to 25 px (a registered `--mark` length) and its edge to nothing; the canvas behind (a `.lens` wrapper round `.world`)
  scales ×2.6 round the plane's middle, blurs 2 px and fades out, then is hidden; 220 ASCII streaks (`- \ | /` by their
  direction, a `·` tail, mostly grey, some cyan and magenta) burst out from the middle, strongest halfway. Once there, the
  layer is held by CSS (inset 0), so resizes are fine. Leaving: `[unfocus]` or Esc, the same backwards in 700 ms onto
  where the plane is now, streaks falling back in. While in focus the canvas ignores the wheel, the breadcrumb ends with
  the plane's name (the workspace's crumb links back), and the side nav's `+` is gone. Reduced motion: no transition.
- *Inside:* empty for now, the plane's marks at 25 px and its console in the screen's bottom-right corner
  (`▸ zoom [−] 100% [+] [unfocus]`). The user said there will be one difference from the old board page, to come.
- *User:* "o button'u focus olarak adlandıralım … sanki başka bir evrene geçiş yapıyormuş gibi ya da bir düzlemden başka bir
  düzleme geçiş yapıyormuş gibi plane'in giderek büyüyüp en sonunda bizim ana view'umuz haline gelmesini istiyorum …
  board page'inde gibiymiş olalım … ancak bir farkımız olacak".
- *Verified* headless: frames stepped at 200/450/700 ms (paused animations): the plane growing, the canvas fading behind,
  streaks out of the middle; the address gets `?focus=`; a reload stays in focus; Esc leaves (a frame mid-way back shows
  the plane shrinking with streaks); breadcrumb `… / Focus / plane`, no `+`; build.

### D-185 · 2026-10-21 · Accepted (replaces D-184's transition)
- *Why:* D-184's zooming transition "çok kötü duruyor": the plane scaled with its marks, the canvas behind scaled and
  faded, and the `+` marks slid about. The user: "focus olmadan önceki halimizde gördüğümüz artılar olduğu gibi duracak.
  Plane nerede olursa olsun, sağa sola, yukarı aşağı açılarak ekranı dolduracak. Sanki uzanıp beni yutuyormuş gibi …
  console güzel olmuyor geçiş sırasında. Ekranın sağ tarafını başka bir şey için rezerve ediyorum".
- *Picked* from six on a local preview, all with fixed marks (straight unfold; sides then up-down; gulp; ink; corners reach;
  ASCII fronts): **ink** ("mürekkep süper olmuş").
- *Decision:* a layer the size of the canvas, solid `--bg`, carries the plane's `+` marks on the plane's own grid at the
  canvas's zoom (`--mx`, `--my`, `--mark` from the plane's screen box). Going in it's cut (clip-path of merged cell runs,
  as in Appear) to the 9 px cells the ink has reached: a cell's moment is its distance from the plane's box over the
  farthest corner's (× 0.82) plus `cellHash` (× 0.18), cells inside the plane at once; 820 ms, cubic in-out. Then the cut
  goes, the canvas behind is hidden. Nothing zooms: the canvas stays put and is swallowed. Leaving runs it backwards in
  700 ms onto where the plane is. The marks keep the canvas's zoom in focus (no jump). The plane's own console hides the
  moment focus starts and comes back after; the focused console (`▸ zoom [−] 100% [+] [unfocus]`) appears in three steps
  once arrived, bottom left right of the side nav's foot (level with the gear), and goes the moment it leaves.
  Reduced motion: no ink, no steps. Streaks, lens scaling and the registered `--mark` property are gone.
- *Verified* headless with time driven by hand: frames at 200/400/600/900 ms, the marks in the same columns and rows
  before and mid-spread; the console bottom left once there; Esc draws it back and the address loses `?focus`; build.

### D-186 · 2026-10-21 · Accepted (changes D-180's "a press on a plane is the plane's" and D-181's console)
- *Decision:* out of focus, panning and zooming are always the canvas's: a press on a plane (out of edit mode) pans the
  canvas like empty space, and the wheel over it zooms the canvas. In focus they pass to the plane: its own view
  (`planeCam` in canvasView.ts: where its (0, 0) is on screen and its zoom, 0.1–4) zooms round the pointer and pans by
  drag, its `+` marks following; leaving focus it glides home (to how it sat on the canvas) while the ink draws back.
- *Fit:* the old board's fit-all (D-060) comes back as an icon button in the side nav under the `+` (frame corners round a
  square), and the `0` key: on the canvas it glides the camera to frame every plane (zoom ≤ 1, 96 px round, 420 ms eased
  both ends); in focus it fits the plane's contents to the screen, and arriving in focus does the same. A plane always
  shows what's in it centred and fitted to its own box. Planes hold nothing yet, so fitting a plane means its starting view.
- *Console:* no zoom any more: `▸ [focus] [edit]`, in focus `▸ [unfocus]`.
- *User:* "ben focus yapmadığım sürece zoom ve drag yaparken hep ana ekran üzerinde yapıyorum. Focus atınca focus attığım
  component'e geçiyor bu özellikler … zoom olayını console'dan çıkaralım … component'ler her zaman içinde ne varsa onları
  sığdırmaya çalışsın … önceden ortalama tuşumuz vardı ya board'da, o hem focus olmadığı durumda olsun hem de focus sonrası
  yine content ortalansın".
- *Verified* headless: a drag on a plane moved it (−100, −50) with the canvas; the wheel over it zoomed the canvas; fit
  centred it; in focus the wheel changed only the plane's marks (25 → 39 px) and the canvas didn't move, a drag panned
  them, `0` took them home; Esc left; the console reads `▸ focus edit`; build.

### D-187 · 2026-10-21 · Accepted (first plane-specific items: cards)
- *Decision:* cards come back, on planes. They stay in their collections (`customers`, `problems`, `competitors`, `ideas`,
  `features`; a competitor's title is `name`) so links, the matrix and the panel can come back on them, and gain
  `pieceId` (the plane they're on; rules: optional text ≤ 128 on validCard and validCompetitor) with x/y in that plane's
  px, top-left. Cards from the old board have no `pieceId` and aren't shown. `src/data/cards.ts`: add (centred on a
  point, snapped, moved right past any card it would cover), move, retitle (typing merges), delete, all undoable;
  `src/data/grid.ts` holds GRID/snap. `deletePiece` takes the plane's cards in the same batch.
- *Look:* every card 200 × 100 plane px (8 × 4 marks, so a snapped card has a mark on each corner), D-152's card: the
  type as a 3 px left edge and an uppercase mono label in its colour (customer green, problem magenta, competitor yellow,
  idea ink, feature cyan), the title in Geist up to three lines, a type-specific placeholder when empty, `--bg-raised`.
  Corner marks (D-150): grey on hover, in the type's colour when selected.
- *Where:* in focus the side nav's `+` lists the five card types; a new card lands at the middle of the plane's view
  with its title field open (Enter keeps, Escape doesn't). In focus a click selects, a drag moves (5 px first, snapped,
  alt free, held where dropped), a double-click retitles, Delete removes, Escape lets go then leaves focus; a press on the
  plane lets go. On the canvas a plane shows its cards as a picture, all of them centred and fitted inside it (never past
  1), its marks following them; the pointer goes through to the canvas (D-186). Fit in focus fits the cards, and so does
  arriving; focus starts from, and goes back to, the plane's fitted view.
- *User:* "plane'e plane specific item'ları geri getirmeye başlayalım. Card ekleme olayını getir bu tarafa".
- *Not yet:* status/evidence, tags, links, competitor features, viewers' cursors in focus. The side panel a card click
  opened stays out: the user will have it refactored before it comes back ("card'lara tıklanınca açılan side paneli daha
  getirme buraya. Onu sonra refactor edip getireceğiz").
- *Verified* headless: in focus `+` → problem/customer/feature, each typed; a drag moved a card (+50, +150); Delete then
  ⌘Z; Escape back to the canvas shows the three fitted in the plane; still there after a reload. Rules 356/356, deployed 2026-10-21; build.

### D-188 · 2026-10-21 · Accepted (text anywhere: headings, paragraphs, sticky notes, sections, project title)
- *Decision:* the old board's text (D-050, D-130, D-156–D-158, D-118) comes back, not bound to a component: each item
  sits on the canvas (`pieceId: 'canvas'`, the constant CANVAS) or on a plane (its id), at x/y = top-left in that
  space's px. Same `labels` collection and field names (size heading/subheading/minor/note, kind sticky/section/title,
  scale, w/h, bold/italic/caps, color, uid/author) so the rules barely change: `pieceId` optional text, and w/h may
  reach 100000 (they were ≤ 2000 board units). Old labels have no `pieceId` and aren't shown. `src/data/labels.ts`
  (add, update with typing merged, delete, moveMany as one undo step); a plane's delete takes its text too.
- *Look* (board units × 80 = px): H1 48, H2 29, H3 22 px Geist, left-aligned, an H1's rule fading right; paragraphs light
  Markdown (`src/ui/LightMarkdown.tsx`), S/M/L 11/13/16 px, 500 px wide until its right edge is dragged; sticky notes
  darker paper, a 2 px colour bar (yellow default), `AUTHOR · DATE` head, mono S/M/L; sections a thin frame (its colour
  mixed with the line), `01 NAME` (number in magenta) set into the top edge; the project title a ✦ PROJECT kicker, the
  workspace's name 40 px, a rule, what it's building, corner brackets, width from its right edge. Corner marks on hover
  and selection. Colours: ink, magenta, cyan, yellow, green, blue.
- *Use:* the side nav's `+` has a `text` group in both spaces: heading, paragraph, sticky note (typed at once, at the
  middle of the screen), section (a crosshair: press, drag, release, then its name), project title (one per workspace;
  edits the workspace's name and description in place). On the canvas they're always live; on a plane only in focus
  (out of focus they're part of its picture, fitted with its cards). Click selects, a drag moves (5 px, snapped, alt
  free), a section carries what's fully inside it (text, planes on the canvas, cards on a plane) as one undo step,
  double-click types (Enter, or ⌘Enter in a paragraph/note; Escape puts it back; an empty heading/paragraph goes),
  Delete removes, Escape lets go. A bar under the selected one, at screen size: H1/H2/H3 or S/M/L, B I AA, colours,
  delete. Canvas sections draw over planes (no fill) so they're never hidden. Fit and a plane's fitted picture include text.
  The canvas never selects text while dragging (`user-select: none`).
- *Not yet* (the old board had them): the jump list `go to`. Kickers over headings, quarter turns, a section's name up
  its left edge, section name sizes and the title folding came back in D-194, which also changed the look above.
- *User:* "let's bring things not only about board … threads, notes, headings, paragraph, section and project title. These
  can be also added to plane but these stuff is not bounded by a component but they should be working workspace wide";
  text first, then live cursors, follow ("total follow", into focus too), comment threads, selection marks.
- *Verified* headless: on the canvas a heading, a paragraph with bold and bullets, a sticky note, the project title; a
  section drawn round the heading and dragged by its edge carried it (+96, +49); H2 from the bar; a sticky note in a
  focused plane; all still there after a reload. Rules 360/360, deployed 2026-10-21; build.

### D-189 · 2026-10-21 · Accepted (changes D-181's console place and D-185's console in focus)
- *Decision:* in focus, `unfocus` moves from the bottom left to the **focus dock**: a tab standing on the screen's
  bottom edge, in the middle (no bottom border, magenta marks on its top corners), `[unfocus] esc`. It's the place for
  whatever else can be done in focus later: more actions go in before `unfocus`. No plane name in it: the breadcrumb has
  it. `src/views/workspace/FocusDock.tsx` (`FocusDock`, `DockAction`). It rises in 3 steps once the plane has arrived;
  reduced motion: just there.
- The plane's console takes the same look, smaller, **inside** the plane's bottom-right corner (16 px in), standing on
  its bottom edge, over its cards; cyan in edit mode. Edit mode's `· drag to move · corners to resize` hint is dropped
  (it doesn't fit a small plane).
- The magenta `▸` before the console's actions is gone, in edit mode too (`EDIT 960 × 600 [delete] [done]`): it meant
  nothing to the user ("Amacını anlamış değilim").
  Then gone everywhere ("bunların hepsini kaldıralım"): the text bar (D-188's) lost it too. No magenta `▸` before a row
  of actions anywhere. A `▸`/`▾` that opens or folds something (archived chat steps, parts, report sections) is a
  different thing and stays when those come back.
- *Alternatives (previewed on a local page):* dock: a framed line in the middle (A), the plane's bottom edge drawn
  across the screen with the actions set into it (C), key caps with no frame (D). Console: set into the bottom edge like
  the name (2), a box flush in the corner (3).
- *User:* "focustan çıkmak için olan düğme … sayfanın altında çıkmasını istiyorum ve farklı bir dizayn"; picked B "but do
  not need to add the name of the plane … it is already showed in breadcrumbs"; console: "put it to right bottom corner,
  inside of the component", picked 1.
- *Verified* on the emulators, headless: a plane focused shows the dock at the bottom middle; on the canvas the console
  in the corner, and in edit mode cyan with size, delete, done. Typecheck.

### D-190 · 2026-10-21 · Accepted (changes D-188's title and typing look)
- *Decision:* the project title is the canvas's only: a plane's `+` doesn't offer it. Typing doesn't change how text
  looks: the title's fields keep its type (`.field` had taken the block's own font and lost the 40 px name), keep its
  rule between name and description, and grow with what's written; every field shows the same placeholder an empty item
  shows and no focus frame (the caret is the only sign). A soft shade of the page (78 % `--bg`, blurred 12 px, 10 × 16
  px past the edges, under the text) sits behind headings, paragraphs and the title, so the moving backdrop dims under
  them and they read; sticky notes have their own paper.
- *User:* "Project title'ın plane'e eklenmesini istemiyorum … ilk konduğundaki edit modu görüntüsü ile edit modundan
  çıkıldıktan sonraki görüntüsü farklı … edit modundayken bile component'in görüntüsü normal görüntüsü gibi olsun … bir bg
  eklenebilir … ya da direkt text component'inin arkasındaki animasyonun parlaklığı düşürülsün".
- *Verified* headless: the title cropped while typing and after, the same apart from the selection marks and the width
  handle; the canvas with text over the moving backdrop; a focused plane's `+` lists no project title; build.

### D-191 · 2026-10-21 · Accepted (collaboration on the canvas, part one: cursors, total follow, selection marks)
- *Decision:* presence (RTDB, unchanged rules) now says which space you're in: `plane` = the plane in focus, absent =
  the canvas; `x`/`y` = your pointer in that space's px (re-sent when the view moves under a still pointer, cleared
  when it leaves or while the ink runs); `sel` = your selected card, text or plane. `src/views/workspace/collab.tsx`.
- *Cursors:* everyone else's in your space, an arrow and a name tag in their colour, drawn on a curve a little in the
  past (D-169's `cursorAt`), placed on screen by the canvas's camera or the focused plane's own view.
- *Total follow* (the user: "since we also added focus, people following someone should also experience this. I want
  total follow!"): a click on someone's square in the HUD (or a row of the `+N` list) follows them; the tooltip says
  where they are (on the canvas / in <plane>). You go into the plane they focus (the ink from where it is on your
  canvas; from another plane straight across) and back out when they leave; their cursor is kept in the middle of your
  screen at your own zoom, eased; their selection becomes yours (no panel). Your own pan or zoom (canvas or plane),
  Escape (heard first), or a second click stops it. While following: the page framed in their colour and a tag
  `following <name> · <where> esc to stop` at the top middle (the bottom middle is the focus dock's, the right is kept free).
- *Selection marks* (D-067, D-068): what someone in your space has selected gets a 1 px frame in their colour just
  outside, their name over its corner; a second person's sits 4 px further out. On cards, text and planes.
- *Verified* headless with Alice and Bob in separate browser contexts (Bob joined through the invite code): Bob saw
  Alice's cursor at her point (400, 350) with her name and a frame on the plane she'd selected; following, the tag read
  `following Alice · on the canvas`; Alice's focus took Bob into the plane (address `?focus=`), her cursor in his middle;
  her Escape took him back out; his Escape stopped following; build.
- *Next:* comment threads (D-159, D-165–D-171) on the canvas and in planes.

### D-192 · 2026-10-21 · Accepted (collaboration, part two: comment threads on the canvas and in planes)
- *Decision:* D-159 and D-165–D-171's threads come back, workspace-wide. `src/data/threads.ts` returns from the archive
  as it was (same collections and rules: `threads/{id}` + `messages`, `threadReads/{uid}`); a thread's `planeId` is now
  its space, `canvas` or a plane's id, and is always written; threads without one (the old board's) aren't shown.
  `Threads.tsx`, `Threads.module.css`, `ThreadInbox.tsx` come back too (moved to src/views/workspace/); only the pin
  layer was rewritten (it was drei <Html>).
- *Pins:* inside each space's world (so they sit on what they're on), scaled back to the screen's size: at a card's
  top-right corner, a text item's (its box), or the spot; the comment mark and a count, magenta when new for you, `@`
  when it mentions you, ✓ resolved. A plane's pins show only in focus. A thread on something deleted has no pin and
  stays in the panel marked so (D-171). `c` shows or hides them.
- *Starting one:* right-click a card, a text item or a spot, on the canvas or in a focused plane (anyone, viewers too).
  The thread opens beside its pin on screen (a screen overlay that follows the pin as the view moves; flips left near the
  window's edge), as before: messages with names and times, a `>` prompt, `@` suggesting the workspace's people,
  resolve/reopen, a writer edits or deletes their own message, owners delete a thread.
- *The threads panel:* the side nav's comment icon under fit (unframed like the others; a magenta count of new
  mentions, or a dot while anything is new) opens it at the top left, right of the side nav (the right of the screen
  stays free). all · new · mentions · resolved; a row takes you to its space (into the plane, or back out, as following
  does), puts its pin in the middle and opens it; rows in another space say `on <space> ↗`. Escape closes an open thread
  or the panel before the canvas hears it.
- *Verified* headless with Alice and Bob: Alice right-clicked a heading, `@Bo` suggested Bob, she sent; Bob's pin read
  `@1` (new) and his side nav button "1 new mention"; Bob opened it from the panel and replied; Alice's spot comment in a
  focused plane showed in Bob's panel as `a spot on a plane … on a plane ↗`, and the row took him into the plane with it
  open; `c` hid the pins; build.

### D-193 · 2026-10-21 · Accepted (changes D-192's pins and panel place, D-191's follow feel, D-175's corner)
- *Right-click menu:* on a plane (on the canvas), a card or a piece of text (`data-target` on each), a framed mono list at
  the pointer (`ContextMenu.tsx`), only `comment` for now; empty space gets nothing (no browser menu either). Closes on a
  click outside, Escape or the wheel.
- *Comments on components only:* no new spot threads (old ones still list). One open conversation per component:
  `comment` opens its newest unresolved thread, or starts one. Threads can be on a plane now (`on: 'plane'`, rules
  updated and tested 362/362). A component's comments show as a chip under its bottom-right corner, set like a plane's
  console (a framed mono tab: the comment mark and its message count; magenta when new, `@` when it mentions you), at
  screen size; it opens the thread beside it. Cards' and text's chips show where they're live (the canvas, a focused
  plane).
- *A plane's console* shows `[💬 N]`, the conversations on it and in it, without going in (magenta when something's
  new, `@` for a mention); it opens the threads panel scoped to that plane (`threads · <plane>`, `[all]` lifts it).
- *Bottom-left corner:* top to bottom: the people here (moved from the top right; a column of overlapping squares,
  names to the right on hover, the `+N` list opening to the right, a click follows), the threads button, a rule, your
  square, the gear. The rule stays just above your square, as asked in D-175. The threads panel sticks to the bottom left,
  right of these buttons, never over them.
- *Smoother following:* cursors go out 10 times a second (was ~16) and are drawn 200 ms behind on a curve. While you
  follow, the view doesn't move as long as their cursor is within ±22 % of your screen's middle; when it leaves, the
  view glides (eased by time, 0.45 s) until it's centred, like following in Figma. Zooming (the wheel) no longer stops
  following; your own drag, Escape or a click on their square still does.
- *User:* "her şeye right click paneli ekleyelim … sadece comment … plane içinde yorumlar varsa … focus olmamış halinde
  de görmek istiyorum … console'u kullanabiliriz … threads paneli … sol alta, profil resminin üstüne … component üzerine
  comment yapılınca … sağ alt tarafında (console ile aynı görünümde) bir mesaj iconu … component üzeri dışında thread
  başlatamayalım", "workspace'te olan insanların ikonu da sağ üstten sol alta … thread ikonunun üstüne", "mouse takip
  edilirken çok ani … figmadaki gibi … saniyede 15 kez göndermemize gerek yok", "zoom out ya da zoom in yapabileyim, bunu
  yapmak beni takipten çıkarmasın". Also: "user kendi seçtiğinde kendi ismini görüyor": not reproduced (presence leaves
  you out; Alice saw no frame on her own selection, Bob saw hers); a guard now skips your own uid in the selection marks.
- *Verified* headless with Alice and Bob: no menu on empty space; `comment` on a heading, its chip under its corner; a
  comment on a plane and on a card inside it, the plane's console then read `💬 2`; Bob's threads button at the bottom
  left, the panel at x = 60 stuck to the bottom; the console's button opened it scoped to the plane (2 rows); following:
  a small move left Bob's view still, a far one glided it (368 → 100 px over 1.5 s), Bob's wheel zoom kept following.

### D-194 · 2026-10-21 · Accepted (changes D-188's section, title and heading look)
- *Decision:* what D-188 left behind of the old board's text comes back, set as the old board drew it (board units × 80 = px).
  - *Sections* (D-130, D-157, D-160): the name is set like a heading (Geist, H1 48 / H2 29 / H3 22 px, B/I/AA), in the
    top edge or up the left one (`side: 'left'`, reading upwards), the line breaking round it (a short lead, the name,
    the rest of the line); cut with `…` when too long for its edge. The number before it is the section's `kicker`
    (mono, magenta, typed in its own field before the name, Tab between); none unless someone types one (D-188's
    automatic `01` dropped: the old board never numbered by itself). Name in `--fg` (not white), the line in the old
    board's edge grey (`--edge`, #6a6a6a; #8a8a8a light) or its colour. Hover and selection are a card's corner marks,
    bigger (32 px, 2.4 px thick, 13 px out on hover, 6 px selected, on the corners and 40 px long while pressed), the
    line keeping its colour; the resize grip is an L in the corner, shown on hover and selection; the grab bands along
    the line are 18 px (the old 0.22 units). Its bar: H1–H3, B I AA, `⌐ top` / `⌊ left`, colours, rename, delete.
    The number is centred on the name (both on the line's middle, as the old board set them). Checked against the old
    board itself (the pre-archive commit run beside the new one, the same sections in both).
  - *Headings* (D-156): the small line over it (`kicker`, ≤ 60: `02 who we beat` → `02 ── WHO WE BEAT`, the number in
    magenta or the heading's colour, the rest small grey mono caps, 0.3 of the heading's size, hidden under 6 screen px),
    typed in a field over the heading's; an H1's rule 130 % of the text, grey (or its colour), as thick as the size asks.
  - *Turns* (D-156): a heading or paragraph turns a quarter from its bar (`↺` reads upwards, `↻` downwards, again =
    level). It's laid out level, turned round its top-left, and its box (sides swapped) keeps x/y as its top-left; a turned
    paragraph's width drags along the text (one reading upwards keeps its start, the bottom, in place).
  - *Paragraphs*: a hairline down the left edge (its colour when it has one), the box's own edge so it sits on the
    grid's marks when snapped, the text 0.6em in from it; B I AA; the field's hint shows the Markdown.
  - *Project title* (D-118, D-132): the old sizes: the name 92 px (tracking −0.045em), what it's building 26 px at 86 %
    of the width, `PROJECT` 18 px grey with a drawn magenta four-pointed star, a rule of a 96 px magenta lead then a
    hairline, 44 px inside 48 px corner brackets (3 px; they are its hover and selection marks, cyan when selected);
    800 px wide by default (500–2400). Too far out to read the description (26 px under 6 screen px) it folds in 320 ms
    eased both ends: the caption, rule and description shrink away and fade early, the star moves beside the name's
    first line, the name grows into the room, as big as fits the unfolded height without breaking a word
    (`src/views/workspace/titleLayout.ts`). Reduced motion: no transition.
  - *All*: corner marks 2.4 px thick, a little clear of text (7 px; a sticky note's on its paper), close in onto the
    corners, longer, while pressed, and take the item's colour once selected (were always cyan); plain text is `--fg`
    as on the old board (ink was white); the bar has `edit` (or `rename`). The selected one is lifted over everything
    else in its space and its bar takes the pointer (a section's frame lets clicks through, so its bar didn't), over
    any comment chip.
- *Why:* the user found D-188's section, title and paragraph "not looking like they used to" and asked for a list of what
  was lost, then to start with three: section name size + selection look, the title's sizes + fold, kickers + turns.
- *Not yet* (on the list given to the user): right-click menu entries for text, shift-click / group drag, alignment
  guides, the cell-by-cell entrance, remote moves gliding, the sticky note's ▚▚▚ mark and `NAME · 5m` head, the paragraph
  width strip's old look, the title's separate name/description editing, the jump list `go to`.
- *Verified* headless (emulators): all of the above drawn on the canvas at 0.6 and 1.2; a section renamed and renumbered
  by typing (`04 MONEY` / `Who pays now`, saved); the fold sampled frame by frame: name 92 → 117 px over ~300 ms, the
  block never taller than when it started. Typecheck. No rules change (`kicker`, `rotate`, `side` were already allowed).

### D-195 · 2026-10-21 · Accepted (changes D-193's plane console count and the panel's scope)
- *Decision:* a comment on a plane and the comments inside it are different things, kept apart. The plane's own
  conversation (`on: 'plane'`) gets a chip under the plane's bottom-right corner like any component's, and opens there.
  The plane's console counts only what's inside it (`planeId` = the plane), labelled `[💬 N inside]`, and opens the
  threads panel on just those; the plane's own conversation is on the canvas, not inside, so it isn't in that list.
- *The threads panel says what it's showing,* always, on a row under its header: `WHOLE WORKSPACE`, or (cyan) `INSIDE
  "<plane>"` with `[whole workspace]` to go back. The corner button opens the whole workspace.
- *User:* "plane'in içinde comment olması ile plane'e comment yapılması farklı şeyler … bunun ayrımını iyi yapalım … thread
  panelinde şu an bütün workspace'inkine mi bakıyorum yoksa bir plane'inkine mi bakıyorum çok belli olmuyor".
- *Verified* headless: a comment on a plane showed its chip `💬 1` under the corner and left the console without a
  count; a comment on a card inside then made the console `💬 1 inside`; that opened the panel `INSIDE "plane"` with
  only the card's thread; `[whole workspace]` showed both under `WHOLE WORKSPACE`; build.
