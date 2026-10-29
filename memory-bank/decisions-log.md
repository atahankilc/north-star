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
*D-248:* domains are gone entirely: the rules no longer read or delete them, the cards no longer carry their fields.
**No domains.** The user found them unnecessary: a workspace already is one idea space, and customers (the `for:` filter) plus
text labels cover slicing and naming areas. Removed tabs, pickers, unsorted marks and the domain filters on Table/Matrix.
Rules refuse new `domains` docs but keep read/delete for clean-up; old `domainId`/`domainIds` fields are tolerated and ignored.

### D-049 · 2026-10-17 · Accepted (reverses D-047; frames return as sections, D-130)
*D-248:* the `groups` collection is gone entirely from the rules.
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
*D-177, D-248:* gone with 1.0 (`src/data/example.ts` deleted); there is no example workspace.

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
*D-248:* old `#/` links are no longer upgraded, and old view paths no longer open the canvas.
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
  *Since D-246:* version 2, carrying the canvas (pieces, cells, documents) and every reference remapped on import; v1 still imports.
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
*D-248:* removed with 1.0: no `attachments` collection in the rules or the code, `storage.rules` allow nothing; files return as documents' (D-232).
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
- *Since D-249:* scored in the generic matrix's own cells, a feature unfolding into its criteria; the panel calls them
  `judged on`; `comparisons.criteria` no longer written.
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
*D-248:* `src/archive/` is deleted; the code is in git at `493bf87`.
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
*D-248:* `board` pieces are no longer accepted by the rules.
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
    hairline, 44 px inside 48 px corner brackets (3 px, the canvas's `--edge` grey, cyan when selected or held; they
    are its marks); the description at 72 % of `--fg` (the old fill opacity); the right edge drags with nothing drawn;
    800 px wide by default (500–2400). Too far out to read the description (26 px under 6 screen px) it folds in 320 ms
    eased both ends: the caption, rule and description shrink away and fade early, the star moves beside the name's
    first line, the name grows into the room, as big as fits the unfolded height without breaking a word
    (`src/views/workspace/titleLayout.ts`). Reduced motion: no transition.
  - *Sticky notes* (D-158, D-162): the old sizes (units × 80): text S/M/L 6.8 / 8.4 / 10.4 px (under a card title),
    padding 7.2, a 2 px bar, the signed line 5.2 px mono `ATAHAN · 2m` (first name in capitals, `ago`), three little
    checks (▚▚▚, 2.8 px squares) in its colour on the right; paper `--card-behind` (#0e0e0e; #e9e9e9 light); bullets `•`
    (also in paragraphs: `LightMarkdown`'s `mark`); no plain colour in its bar (yellow is its default).
  - *Width strip* (D-163), paragraphs and sticky notes: a 1.2 px strip 4 px inside the right edge, 60 % of the height,
    shown only while hovered (grey; its colour if selected) or dragged, never just for being selected (the user's
    call); the pointer takes a 19 px band round it. The project title has it too (the user asked).
  - *Planes in edit mode* (changes D-182's corners): each corner is a section's resize grip, an L just inside it (29 px
    arms, 2 px, 5 px in, a 34 px grab square), in cyan; the edge middles keep their short bars; the edit console
    stands 40 px from the right so the bottom-right grip is clear (the user: "the only one that still looks different");
    the faint dashed cyan edge is gone, the plane keeps its own edge in edit mode (the user asked).
  - *All*: corner marks 2.4 px thick, a little clear of text (7 px; a sticky note's on its paper), close in onto the
    corners, longer, while pressed, and take the item's colour once selected (were always cyan); plain text is `--fg`
    as on the old board (ink was white); the bar has `edit` (or `rename`). The selected one is lifted over everything
    else in its space and its bar takes the pointer (a section's frame lets clicks through, so its bar didn't), over
    any comment chip.
- *Why:* the user found D-188's section, title and paragraph "not looking like they used to" and asked for a list of what
  was lost, then to start with three: section name size + selection look, the title's sizes + fold, kickers + turns.
- *Not yet* (on the list given to the user): right-click menu entries for text, shift-click / group drag, alignment
  guides, the cell-by-cell entrance, remote moves gliding, the title's separate name/description editing; headings and
  paragraphs not yet compared with the old board side by side. (`go to` came back in D-196.)
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

### D-196 · 2026-10-21 · Accepted (brings back D-050/D-116's go to for every space)
- *Decision:* go to is back, for the canvas and for a plane in focus. On the canvas: its planes (by name), each followed
  (set in) by the headings and sections inside it, the project title (under the workspace's name), its headings (H1, H2)
  and named sections; in a focused plane: its own headings and sections. A place inside a plane, picked on the canvas,
  takes the plane into focus (the ink, D-185), and on arriving the view glides to it instead of fitting. Paragraphs, sticky notes, H3s and unnamed sections aren't places (as D-116). One list in reading order (top
  to bottom, then left to right), each row marked by kind (`▦` plane, `✦` title, `⬚` section, `↳` heading). Opened from
  a grey go-to icon (`↳` drawn) in the side nav under fit, with a search field (`find a place`, Enter takes the first);
  1–9 go to the first nine, as before. The icon is a compass (a circle, its needle north, the north half filled); the
  first one (a drawn `↳`) wasn't clear to the user. The view glides there (420 ms, as fit): a plane, section or the title framed
  whole (≤ 100 %, 96 px round); a heading at 100 %, centred, its top at 28 % of the screen so what's under it shows.
  Going somewhere stops following. Code: `src/views/workspace/goTo.ts` (`placesIn`, `goToPlace`), `GoToButton` in
  WorkspaceLayout, which asks the canvas through `useGoTo`; the keys and the going in CanvasView; `Menu` takes `quiet`
  (an icon trigger in grey like fit) and `indent` on an item.
- *Why:* the user: "go to özelliğini geri getircez ama her şey için … workshopda isek plane isimlerine, title cardına
  yada header/sectionlara … aynısı plane için de geçerli".
- *Not yet:* cards as places.
- *Verified:* headless Chrome on the emulators: canvas list (title, heading, two planes, section, no H3), search +
  Enter framed the section, `2` landed the heading; in focus the plane's section and heading, `2` landed it at 100 %.
  From the canvas, `5` (a heading in a plane) focused the plane and landed on it; searching `inside sec` + Enter framed
  a section inside the plane.

### D-197 · 2026-10-21 · Accepted (changes D-193's threads panel)
- *Decision:* the threads panel is design D of four shown on a local preview (A a tall tab from the bottom edge, B a
  drawer grown out of the side nav, C a one-line terminal log, D list + conversation in one tab). One wide tab (≤ 840
  px) on the bottom edge, right of the bottom-left corner's buttons and never over them, flush with the edge like the
  focus dock and a plane's console: no bottom border, magenta marks on its top corners. Left (≤ 340 px): the header,
  the scope row (D-195), the views, the rows. Right: the conversation picked there (the same thread view as before,
  `ThreadPanel docked`: no frame or offset, all its height), or one being started, or "Pick a conversation…". A row
  opens it on the right, it doesn't jump the view; `↗` in its header (with where it is) takes you there, into its plane
  if need be, the panel staying open. While the panel is open, a component's chip and right-click → comment open the
  conversation there; while it's shut, beside the component as before (changed by D-199: never on the canvas, the
  thread opens alone in the panel). With no conversation picked the tab is only the
  list (340 px); picking one widens it to hold both (840 px). Its top edge drags its height (≥ 220 px, up to the
  breadcrumb), kept in this browser (`localStorage`, a viewer's convenience). Where the open conversation is gets its
  own row under its header: the place faint (`on the canvas`, `on Pricing`) and a framed cyan `⌖ go there` (a target
  icon) instead of a bare `↗`, which didn't say you could go. Fixes found trying it: the canvas's wheel no longer
  cancels scrolling over the threads panel, an open thread or a menu (`SCROLLS_ITSELF`), so the conversation and the
  list scroll; the reply field is `readOnly`, not `disabled`, while a message sends, so it keeps the focus and messages
  can be written back to back (before, everything typed after the first was lost).
- *User:* "açılacak olan paneller hangi kenara yakın ise ora ile bağlantı kursun, sıfıra sıfır olsun (unfocus gibi) …
  console gibi gözüksün", then "D güzel, onu yapalım".
- *Verified* headless with Alice and Bob: the panel at x = 60, 0 px from the bottom, 840 × 558; empty right half until a
  row was picked, then the conversation there and no popover on the canvas; Bob's reply sent from it; `↗` kept the panel
  open; then: 340 px wide with no conversation, 840 with one; its top edge dragged up 150 px → 708 px tall, still that
  after a reload; 15 messages sent back to back, the wheel scrolled the conversation (410 → 110 px) and left the canvas
  still; build.

### D-198 · 2026-10-21 · Accepted (adds to D-184's ways into focus)
- *Decision:* a double-click on a plane on the canvas takes it into focus, the same as its console's `[focus]` (the
  ink, D-185). Not in edit mode (there a press moves and resizes it), not through canvas text over it, a comment chip,
  a button or the name field; a double-click on empty canvas does nothing. It stops following, as any going does. The
  plane is found by the point under the pointer (`elementFromPoint`), since the pan's pointer capture sends the click
  to the canvas.
- *Why:* the user: "bir panele iki kez tıklanırsa paneli focusa al".
- *Verified:* headless Chrome on the emulators: double-click on empty canvas and on a plane in edit mode stayed on the
  canvas; on a plane out of edit mode the ink spread and the address took `?focus=`.

### D-199 · 2026-10-21 · Accepted (changes D-197's threads panel)
- *Decision:* no conversation opens on the canvas any more: the popover beside a component (`OpenThread`) is gone, and
  every thread opens in the threads panel at the bottom left. The panel has two halves that work apart: the list and
  the thread. A component's chip or right-click → comment opens only the thread (a 500 px tab); `[all threads]` at the
  start of its header opens the list beside it (340 px, on the left, the thread pushed right); a row in the list opens
  the thread beside it. Closing the list (its ×, Esc with no thread open, or the threads button) closes both; closing
  the thread (its ×, Esc) leaves the list open. Motion: our own cell-by-cell build-up and break-apart (D-034,
  D-035, `runCells`), no new kind: the tab builds as it opens (320 ms) and breaks apart as it shuts (0.6 of that), what
  was in it kept still while it goes; a half opening beside the other builds on its own (a thread again when another is
  picked) and breaks apart as it closes; the widths just change. A first try slid the tab up from the edge and the
  halves' widths open: the user turned it down ("bizim kareli animasyonu kullan, yeni animasyon türetme"). Reduced
  motion: none of it. Go there moved
  from its own row under the header into the header, after the title, which now reads `heading "Pricing" · on the
  canvas` (the place faint). Its look, a cyan framed target icon, was changed by D-220. Esc: the thread's handler takes the key
  (`preventDefault`), so the list's never closes with it, whichever listened first.
- *User:* "canvas üstünde thread componentlerini sil, zaten bir panel yapıp koyduk sol alta boşuna mı? … liste kapanırsa
  ikisi de kapanır, thread kapanırsa liste açık kalmaya devam edebilir", "go there butonunu üst sectiona taşı ve sadece
  icon button kullan", animations for the panel and for a thread opening and closing.
- *Verified* headless (Alice, 1440 × 900): right-click → comment rose a 502 px tab (top 900 → 887 → 793 → 588 → 390 →
  344 at 60 ms steps; with the cells: clip-path runs 7 → 583 → 864 → 503 → whole), list 0; `[all threads]` added
  the list (tab 502 → 842) building in cells; the thread's × broke it apart, the list kept; a row built it back; chips
  on the canvas (text, plane) and in a focused plane (text, card) each opened their thread alone; Esc closed only the thread; the list's × broke the whole tab apart, widths unchanged
  as it went, gone by 240 ms; a chip opened the thread alone; go there kept the panel; the threads button with a thread
  open added the list, pressed again sank both; no console errors; build.

### D-200 · 2026-10-21 · Accepted (changes D-196's list on the canvas)
- *Decision:* in go to on the canvas, a plane's own headings and sections start folded under it. The plane's row says
  `▸ N` on its right (N = places inside); a click there opens them (`▾ N` shuts them) without going anywhere, a click
  on the rest of the row still goes to the plane; → on the row opens, ← shuts. What's open is kept for the tab's life
  (`useGoTo.open`). Searching finds folded places too. 1–9 count through what the list shows, so the numbers always
  match. `Menu` takes `fold` (the `▸ N` toggle) and `folded` (shown only while searching) on an item.
- *Why:* the user: "go to da sub alanlar collapsed gelsin, tıklanırsa gözüksün".
- *Verified:* headless Chrome on the emulators: the list opens with the plane's places hidden (`▸ 2`), the toggle shows
  them and renumbers, ← and → shut and open, searching `inside` lists both while folded.

### D-201 · 2026-10-21 · Accepted (changes D-196's keys, D-200's fold look)
- *Decision:* go to has no keys any more: 1–9 do nothing and the list shows no numbers (only the side nav's compass and
  its search). A plane's fold is a framed button on its row, `[▸ 2 inside]`, the caret a size up; open it reads
  `[▾ 2 inside]` in cyan (frame and text) and the plane's name goes bright; the places inside hang off a thin
  `--edge` line down from the plane's glyph.
- *Why:* the user: "tuş ile hızlı gitmeyi kapat. Collapse olayını da biraz daha belirgin yap ki anlaşılsın".
- *Verified:* headless Chrome on the emulators: `3` on the canvas does nothing; folded and open lists look as above.

- *Later:* D-236 makes go to part of the finder, which ⌘F opens (the compass too); with nothing typed it lists the places.
### D-202 · 2026-10-21 · Accepted (adds to D-186's fit)
- *Decision:* opening a workspace the first time in a tab frames everything on its canvas at once (no glide), as fit
  does (planes and canvas text, ≤ 100 %, 96 px round). Only then: the camera is kept per workspace for the tab's life
  (D-176), so going into a plane and back, or leaving the workspace and coming back, finds the view where it was left.
  A reload is a first open. Before this the camera started at the canvas's origin at 100 %, so a canvas whose things
  sat away from (0, 0) opened onto empty space. `fitCanvas(…, instant)`.
- *Why:* the user asked why the screen isn't centred on first open, then: "sadece ilk kez açılırken yap bunu, yoksa
  planeler arası gidip gelmede önceki konumu koruması iyi".
- *Verified:* headless Chrome on the emulators: a reload framed the title, planes, headings and section; panned, into a
  plane and back out, the camera was exactly where it was panned to.

### D-203 · 2026-10-21 · Accepted (brings D-150's card motion back, on planes; first step of the plane's old board back)
- *Decision:* a plane's cards move as the old board's did (D-150), in the DOM: a card that arrives while you look (made
  by you or anyone) builds up cell by cell (D-034's `runCells`, 320 ms); on the canvas a plane's cards build with the
  page; in focus the ones already there are just there. Corner marks at the old sizes (80 px a unit): 17.6 px arms
  2.4 px thick; hover grey 9.6 px out; selected the type colour 4.8 px out; pressed (or dragged) on the corners inside
  the card, 25.6 px, the type colour; they glide between (160 ms). A drag (after 5 px) shrinks the card to 0.8 round
  the point held, following the pointer freely, the marks on where it lands (snapped) at full size; let go, it grows
  into them. No fade while dragged (the 0.85 before was new, the old board had none).
- *Code:* `PlaneCards.tsx` splits a card into its box (place, marks, chips) and its face (`.card`, the part that shrinks).
- *User:* "plane i eski gücüne kazandıralım. Yavaş yavaş plane ile ilgili olan her şeyi reintroduce edelim".
- *Verified* headless: hover, press, drag (small card + landing marks), drop (selected), a card added in focus building
  up; no console errors; build.
- *Seen, not from this:* reloading with `?focus=` showed an empty black screen (no marks, no cards), on the committed
  card code too; the user had seen it as well. Cause: with no ink, arriving ran the fit in the same frame the focus
  mounted, before the screen size was measured (0 × 0), so the plane's view went to zoom 0.1 at (0, 0). Fixed: arriving
  waits for the size, and without the ink it fits at once (no glide from a wrong start).

### D-204 · 2026-10-21 · Accepted (brings the matrix back as a generic canvas piece; D-133/D-136's matrix becomes one setup of it)
- *Decision:* a **matrix** is a piece on the canvas (`kind: 'matrix'`), made from the side nav's `+` under `matrix`,
  from a template: features × competitors (the old matrix: coverage ○◐●★, not relevant, how sure, reading),
  problems × customers (low → high), ideas × criteria (1–5, criteria typed), blank (named rows and columns, yes / no).
  Generic, so it serves any comparison:
  - *Rows and columns* (each an axis): every card of one type (on any plane, or one plane's), joining by themselves,
    sorted by title; then entries added by hand, each a typed name or one card. A card's row shows its live title and
    its type's colour. `×` takes one out: a typed one goes with its cells, a type's card is hidden (cells kept;
    `[N taken out]` brings them back).
  - *Cells:* one kind for the whole matrix: a **scale** of steps (glyph, name, colour; presets coverage, yes / no,
    low → high, 1–5; ≤ 9 steps, edited in the setup), a **number** (with a unit) or a short **text**. Any cell can have
    a note. Options: `not relevant` (—, left out of the readings), how sure (`~` inferred, `?` guess), the reading
    (each row and column summed up: a scale's steps as a bar in their colours + `set/of`, numbers' average, texts
    written). A value of another kind is kept when the kind changes, so changing back finds it.
  - *Use:* (its canvas look and way into focus changed by D-206) on the canvas a picture fitted in its box, like a plane's cards. In focus (the ink, D-184) it's live: click
    selects a cell (cyan `[ ]`), again steps a scale on; arrows move; 1–9 set a step; Backspace clears; `-` not
    relevant; Enter or a double-click types a number or text. Under the selected cell, at screen size, its bar (steps,
    not relevant, how sure, note). The focus dock gets `[setup]`: a framed panel over the bottom middle (templates,
    rows, columns, cells, options). Escape lets go of the cell, then closes the setup, then leaves focus. No `+` in a
    matrix's focus. Fit frames the table.
- *Data:* the setup on the piece (`matrix: {rows, cols, cell, steps, unit?, notRelevant?, confidence?, reading?}`, each
  axis `{type?, plane?, hide?, items[{id, name? | cardType + cardId}], noun?}`); cells in `cells/{matrixId}_{row}_{col}`
  (`value` a step id, number or text ≤ 200; `notes`, `notRelevant`, `confidence`), so a cell can't be made twice.
  Deleting the matrix takes its cells (one undo step); a workspace delete takes `cells`. Rules `validMatrix` / `validCell`.
  The old `comparisons` stay as they were (archived).
- *Not yet:* a feature's criteria scored per cell (D-133), the `gap / table stakes` verdict and white space, presence
  marks on cells, reordering rows and columns, the matrix in the export, the assistant writing it.
- *User:* "Bu matric tablosunu olabildiğince generic yap ki, başka türlü de kullanılabilsin"; picked mixed rows (cards or
  names), one cell kind per matrix, the old matrix's extras made generic, a piece of its own on the canvas.
- *Alternatives:* rows only from cards, or only typed; one scale for all; a cell kind per column (more a spreadsheet);
  inside a plane. Not taken.
- *Verified:* rules tests 372 passed (new: matrix piece, cells, viewer); headless Chrome on emulators: the canvas
  picture, focus, cell bar, keys 1–9 / arrows, number typing, a typed row, a column taken out and brought back, the card
  picker, a new matrix from `+`, Escape order; no console errors; typecheck.

### D-205 · 2026-10-22 · Accepted (brings D-152's card inside and D-153's zoomed-out looks back, on planes)
- *Decision:* a plane's card shows what the old board's did: the type label; right of it a customer's, problem's or
  idea's status (`validated !` in magenta when the evidence doesn't back it, also with none), a competitor's regions
  (`US · Germany +1`), a feature's priority; the evidence as cells (filled = supports, outlined = against, up to 5
  each, magenta on a clash); the title (≤ 80 characters, 3 lines, 2 above tags); the facts line; tags as framed chips,
  `+N` when they don't fit. Facts: customer `0 tagged for them`, problem `0 solve it · vs 0`, idea `solves 0 · 0
  features`, competitor `vs 0 · N features` (its competitor features counted), feature its status · impact · effort.
- *Only shown:* nothing on a plane sets these yet; the side panel will (the user: "Şimdilik sadece göster"). The counts
  that come from links read 0 until links are back (the user: "Şimdi 0 olarak göster").
- *Sizes* (in plane px; the card is 200 × 100, and the old 80 px a unit would make 6 px text at zoom 1): small text 8 px
  mono, title 14 px Geist (line 1.12), 7 px inside, a 4 px type edge, cells 6 px, chips 7.5 px text.
- *Zoomed out* (D-153), by the size on screen (in focus the plane's zoom, on the canvas times the canvas's): full while
  the 8 px text is ≥ 4 px; then the title alone at 24 px, top-aligned, ≤ 3 lines ending at a whole word with `…`;
  below 5 px for that, each line a grey bar 0.6 its height. 10 % more to go back up.
- *Data:* cards read tags, validation, regions, priority, status, impact, effort; the workspace also loads `evidence`
  and `competitorFeatures` (`cardFacts.ts`). New token `--chip`.
- *Verified* headless (emulators, 2x): six cards with statuses, evidence, regions, priority, tags, an empty one, at
  zoom 1.6, 0.45 and 0.15; no console errors; build.

### D-206 · 2026-10-22 · Accepted (changes D-204's look on the canvas and its way into focus; its canvas look changed again by D-208, the focus stands)
- *Decision:* a matrix isn't a plane. On the canvas it's just its table at its own size: no edge, no fill, no `+`
  marks; the piece's box is the table's (worked out from its rows and columns, whatever `w`/`h` its doc holds), so
  fit, a canvas section carrying it and its comment chip use the table's size. Its name sits in the table's corner
  (what it crosses while unnamed), its console `[focus] [edit]` over its top-right end. Edit mode only moves it and
  names it (the name field over it), no grips: there's nothing to resize. `[focus]` still makes it the whole screen,
  but without the ink and marks: the table stays whole and glides (420 ms, fitPlane's fit) from where it sits to the
  middle of the screen while a solid page builds behind it cell by cell in random order (D-034's cells); leaving runs
  it back (the table home, the cells breaking). The canvas's copy hides meanwhile. Reduced motion: just there.
- *User:* "neden matrixler plane gibi arka planda +ları var? Bu direkt konan bir tablo olsun. Focus diyince de tam
  ekrana geçsin ama bunun için illa plane gibi mi olması lazım?"
- *Alternatives:* the plane's ink kept for the matrix (it's the plane's motion); a zoom of the canvas into the table
  (D-185 turned zooming down for planes). Not taken.
- *Verified:* headless Chrome on emulators: canvas look, edit mode (move, name), focus in mid-way and arrived, leaving
  mid-way and back, a reload in focus; no console errors; typecheck.

### D-207 · 2026-10-22 · Accepted (brings D-059/D-108/D-113/D-147/D-154's links back, on planes)
- *Decision:* links come back on planes, in the old `edges` collection (no rules change); a link has no plane, a plane
  draws the ones whose two cards are both on it (in focus and in its picture on the canvas). Drawn as on the old
  board: a straight line from card edge to card edge (4 px clear of each), an arrowhead (12.8 plane px), its kind's own
  colour (D-147's `--link-*`), 1.5 px wide, 2.2 when its card is hovered or selected, 3 when selected, the rest at 0.22
  while something is in focus; a framed chip at its middle with its kind (8 px mono, a card's small text, drawn while
  that is 4.5 px or more on screen), its own label instead while it's in focus (D-135), filled when selected. Several
  links between two cards sit side by side, 25.6 px apart (within 80 % of a card's height), chips moved along steep
  lines so they don't sit on each other (D-113). Lines follow cards being dragged and carried by a section.
- *Making one:* a hovered card shows `›` just right of it (dim, bright under the pointer, cyan while linking; a band
  over the card's right edge takes the pointer); dragged onto another card (its corner marks cyan) it makes a link of
  the old default kind (customer → `for`, idea → problem `solves`, competitor → problem/idea `competes`, feature → idea
  `inspired by`, else `relates`), selected with the cursor in its label (D-154). Onto a card it's already linked to, that
  link is selected instead.
- *Editing:* a click on a line or chip selects it; a bar under its chip at screen size: kind (Select with colour
  swatches), label, `⇄ reverse` (not for `for`), `× remove`; Delete removes, Escape lets go. Deleting a card or a plane
  takes its links in the same undo step.
- *Facts line* (D-205) now counts from links: `N tagged for them`, `N solve it · vs N`, `solves N · N features`,
  `vs N` (distinct rivals), and a card's customers as `[Name]`.
- *Not yet:* bend points (D-155, a link keeps any it has), the LINKS filter and D-128/D-135's hidden-by-default groups
  (`for`, `relates`, `competes`: all shown until the filter is back, or a link drawn as `relates` would vanish), the
  right-click menu, shift+drag, links to competitor features.
- *Then* (the user: "sağ tıka comment ekle. Bir de label ı hover ederken görebiliyim"): a hovered link shows its own
  label on its chip, lights up (2.2 px) and the rest dim; right-click a line or chip → `comment` (D-193), a thread
  `on: 'link'`, its chip under the link's chip (shown even when the chip is too small), its title `link "A" → "B"`,
  pinned at the middle of the cards' centres for go there. Bends, filters and links to competitor features: later.
- *User:* "evet, bağlantılarla devam et".
- *Verified* headless (emulators): `›` drag idea → problem made `solves` with the label field focused, typed label on
  the chip; two links on a vertical pair side by side with chips apart; a selected competitor lights its links and dims
  the rest; deleting it removed its 2 links, ⌘Z brought all 3 back; the plane's picture on the canvas draws them; no
  console errors; build.

### D-208 · 2026-10-22 · Accepted (changes D-206's canvas look; D-206's focus stands; a matrix's table is fitted whole in the window since D-214)
- *Decision:* a matrix is a **window** on the canvas, not a bare table and not a plane. It has a plane's edge and solid
  fill, its name in the top edge at the left, its console inside the bottom-right corner, and its own `w`/`h` again:
  in edit mode it moves, resizes from the corner grips and edge bars (≥ 325 × 200, snapped) and takes a name, as a
  plane does. No `+` marks: there's no canvas inside it. Its table sits at its own size (zoom 1) from the window's
  top-left, cut by the edge when the window is smaller; nothing scrolls on the canvas. The table's corner says what it
  crosses again (the name is on the edge). Focus is still D-206's: the table glides to the middle of the screen while
  the page builds cell by cell behind it.
- *User:* "şimdi de alanı belli olmuyo, şuna bir çerçeve verip sol üste adını yazar mısın? Boyutu da edit edilebilir
  olmalı. Sadece plane gibi bir canvas gerekmiyor matrix için, o normal resize edilebilir bir pencere gibi çalışcak"
- *Alternatives:* the table fitted (scaled) into the window like a plane's cards; scrolling inside the window on the
  canvas (the canvas takes the wheel there, D-186). Not taken.
- *Verified:* headless Chrome on emulators: the window on the canvas, a corner resize to 375 × 225 (table cut at the
  edge), focus mid-way and arrived, back; no console errors; typecheck.

### D-209 · 2026-10-22 · Accepted (the first lens: a table piece; rows by rules, a source matrices can take on later)
- *Decision:* a **table** is a piece on the canvas (`kind: 'table'`), made from the side nav's `+` under `table` from a
  template (every card · features · competitors · blank). Generic, a lens on the cards:
  - *Rows:* from a **rule list** (`src/data/source.ts`): each rule a field (`plane`, `type`, `status`, `tag`, `title`),
    `is` / `is not` (`has` / `lacks` for title words) and the values it takes (any of them); every rule must hold; none
    is required (no rules = every card on every plane; a rule with nothing picked doesn't narrow yet). Then cards and
    typed names added by hand. `[ ] cards that meet the rules` off = only what's added by hand (a list of names).
    Ordered by the chain (D-045), then title. `×` on a row hides a rules' card (`N taken out` brings them back) or drops a
    typed one with its cells.
  - *Columns:* first always the row's name (a card's live title, double-click retitles it; or the typed name). Then the
    cards' own fields, read-only as D-205 shows them (type, plane, status, tags, regions, priority, impact, effort,
    evidence `+2 −1`), and columns of its own, each with its own kind: a scale (presets from the matrix's), a number
    with a unit, a short text, a check. Moved ‹ ›, renamed, taken out (with their values). A head's click sorts by it:
    up, down, off (shared; empty ones last).
  - *Look and use:* a window like the matrix (D-208): a plane's edge, fill, name in the top edge, console, moved and
    resized in edit mode, no `+` marks, its table at zoom 1 from the top-left, cut by the edge; focus as D-206 (the
    table glides to the middle while the page builds cell by cell). Live in focus: click selects a cell (cyan `[ ]`),
    again steps a scale on or flips a check; arrows move; 1–9 set a step; Backspace clears; Enter or a double-click
    types a number or text; space flips a check. `[setup]` in the focus dock: templates, the rules, `+ card`, `+ name`,
    the columns, `+ column`, `+ card's field`.
- *Data:* the setup on the piece (`table: {rows: {rules[{field, not?, values[]}], hide?, items[]}, manual?, cols[{id,
  field? | name, kind, steps?, unit?}], sort?: {col, desc?}}`); own columns' values in `cells/{tableId}_{row}_{col}` like
  a matrix's (`matrixId` holds the table's id). Deleting the table takes its cells. Rules `validSource`, `validTable`.
- *Next (the user's direction, not built):* a lens sticks to a plane's edge (dropped near it, the edge lights cyan) and
  is then bound to it: its plane rule set to that plane by itself (`oto`, still changeable), moved with the plane; pulled
  away it lets go. In the plane's focus the dock lists what's stuck to it; each opens **beside** the plane, the screen
  split, and each half manages its own area (a card's panel opens at the right of the plane's half, a matrix cell's at
  the right of the matrix's half). Selections look across (a card selected lights its row). Not bound: later. The
  matrix's axes move onto the same rule list (tell north-star-5e's matrix work first).
- *User:* chose Table first, rules ("Kurallar (filtre listesi)") over several types + planes; looked at A (inside the
  plane) and B (stuck beside it) on a preview: "B gibi olsun ama birbirine bağlı olan componentler var ise ben focus
  yapınca bunları yan yana açabiliyim … Bu controlü de console a koyarız"; "focus sırasında sol ve sağdaki componentler
  kendi alanını yönetebilir".
- *Alternatives:* a lens inside a plane like a card (A); one type + one plane per axis (the matrix's today); a filter
  language. Not taken.
- *Verified:* rules tests 377 passed (new: a table piece, a plane with a table setup, a table without rows, rules not
  a list, a table cell); headless Chrome on emulators: two tables (every card, features) beside two planes on the
  canvas, focus on one, a number typed into `cost`, sorted by it, the setup with a type rule and the columns; no
  console errors; typecheck.

### D-210 · 2026-10-22 · Accepted (D-209's *Next*, first half: lenses stick to planes; letting go, the `⇆` and the plane-only binding changed by D-215)
- *Decision:* a matrix or a table (not a plane) moved in edit mode within 48 screen px of a plane's edge **sticks**
  there: the plane's edge lights cyan while it's near, the piece snaps one grid step (25 px) out from that edge (its top
  or left lines up with the plane's when that's near too), and on the drop it's bound to the plane (`stuckTo`). Alt
  held: free, no sticking. Pulled away and dropped elsewhere, it let go (D-215: no more; it stays linked, far).
  - *What it shows:* a table gets a rule of its own, first in its list, `where plane is <the plane> · auto` (cyan);
    changing that rule by hand makes it yours (no longer `auto`, kept when it lets go); letting go takes the `auto`
    rule away. A matrix's typed axes take the plane (only where they had none, or the one sticking gave them; a plane
    picked by hand stays) and lose it on letting go.
  - *Moving together:* a plane moved or resized carries what's stuck to it (kept on the same edge, moved along it
    with the plane), live while dragging and in the same undo step. A `⇆` chip in cyan, at screen size, sat in the
    gap between them (D-215 replaced it with faint `· ›` cells). A plane deleted leaves its pieces where they are (`stuckTo` kept, so ⌘Z binds them again).
- *Data:* `pieces/{id}.stuckTo` (a plane's id; matrices and tables only, rules allow it); a table's rule may carry
  `auto: true`.
- *Next:* D-209's second half: in the plane's focus the dock lists what's stuck to it; each opens beside the plane,
  the screen split, each half its own area.
- *User:* "tamam çalıştı, commit at ve 2. adıma geç" (step 2 of the three: stick to a plane's edge, bound, moved with it).
- *Verified:* rules tests 379 passed (new: a table stuck to a plane, a plane stuck to a plane denied); Firestore rules
  deployed; headless Chrome on emulators: a table dragged near a plane's right edge lit it and snapped, its rows went
  from 7 (every plane) to that plane's 5, the setup showed `where plane is … · auto`; the plane dragged 150 px down
  carried the table and the `⇆`; the table dragged away let go (7 rows), ⌘Z stuck it back (5); no console errors;
  typecheck.

### D-211 · 2026-10-22 · Accepted (D-209's *Next*, second half; narrows D-185's "keep the right of the screen free")
- *Decision:* in a plane's focus, the focus dock lists what's stuck to it (D-210), one switch each before `[unfocus]`:
  `[⇆ table · name]`, `[⇆ matrix · name]`, cyan while open. A switch opens that piece **beside** the plane: the screen
  splits, the plane keeps the left part, what's open takes the right, stacked top to bottom when there are more. What's
  open is in the address (`?focus=<plane>&beside=<id>,<id>`), so a reload keeps it; leaving focus closes it all.
  - *Each part its own area:* the plane's fit and its dock are in its part (the dock sits at the middle of the plane's
    part); each pane has its own view (the wheel zooms round the pointer, a drag on empty space pans, fitted on opening
    and when its box changes), its own dock, and its setup opens inside it. Things a part opens on its right open at the
    right of that part (a card's panel later).
  - *One dock, configured:* a pane's dock is the focus dock itself (no new component), at the bottom middle of the pane,
    named first and set off by `|`: `TABLE · every card | [setup] [close]` (a long name up to 44 characters, then `…`).
    The plane's dock keeps `[unfocus]` and its `⇆` switches (cyan for what's open); while something is open beside it,
    `[unfocus]` just has no `esc` (Escape closes what's beside first).
  - *`esc` where it acts:* the `esc` hint shows on the one action Escape does next, in whichever dock it is: an open
    setup's `[setup]`, else the last opened pane's `[close]`, else the plane's `[unfocus]`. The key goes in the same
    order (a selection is let go of first, with no hint).
  - *The lines:* the one between the plane and the panes drags (25–75 % of the width, kept in this browser); the ones
    between stacked panes drag their heights (each ≥ 15 % of the screen; even again when what's open changes).
  - *Looking across:* a card selected on the plane lights its row in a table beside it (cyan wash); a click on a card's
    row name selects that card and the plane's view glides to put it in the middle of the plane's part.
  - *Escape:* lets go of a cell or card, then closes a setup, then closes what's beside, the last opened first, then
    leaves focus (shown by the `esc` hint above).
- *Not yet:* not-stuck pieces opened beside (the user: "buna sonradan geliriz"); a matrix's rows and columns looking
  across like a table's; a card's side panel (it'll open at the right of the plane's part); presence (following doesn't
  open panes).
- *User:* "B gibi olsun ama birbirine bağlı olan componentler var ise ben focus yapınca bunları yan yana açabiliyim …
  Bu controlü de console a koyarız"; "focus sırasında sol ve sağdaki componentler kendi alanını yönetebilir … matrix
  cell ine tıklanınca sağ da açılan şey matrix selinin focus alanının sağında açılır"; "tamam çalıştı, commit at ve 3.
  adıma geç"; then: "console neden view ın ortasında açılmıyor … her view ın kendi consolu buna adapte olabilmeli. Plane
  consolundan unfocus butonu gitmeli, açık olan side view mavi ile gösterilmeye devam etsin. Esc ile hangisi kapancak
  ise ona gelsin esc shortcut gösterimi … yeni componentler yazmaya gerek yok, sadece bu console componentini configure
  edilebilir kılmak yeterli … ismin daha uzun bir gösterimine izin verilebilir bir de "|" ile console tuşları ve isim
  birbirinden ayrılabilir"; and, when `[unfocus]` was taken away with panes open: "ana viewdan neden unfocus u aldın?
  sadece esc gösterimini çıkar dedim zira esc önce sideviewları kapatıyordu".
- *Verified:* headless Chrome on emulators: a plane in focus with a table and a matrix stuck to it; the dock listed
  both; opening the table split the screen (plane refitted to its half), then the matrix stacked under it; picking
  "Mobil bildirim" in the table selected the card and glided the plane to it, the row lit; the line dragged to 64 %;
  a reload kept both open; Escape closed the pane, then left focus; then the docks: each pane's named dock at its
  bottom middle; the table's setup opened in its pane with `esc` on its `[setup]`, then
  each Escape moved `esc` to the matrix pane's `[close]`, the table pane's `[close]`, the plane's `[unfocus]`; the line
  between two stacked panes dragged 200 px down (heights 651 / 250); no console errors; typecheck.

### D-212 · 2026-10-22 · Accepted (changes D-204's look and setup; D-206's focus and D-208's window stand)
- *Decision:* the matrix's table, "cards crossed" (picked from four looks on a local preview: a quiet grid, a plotter
  on the canvas's `+` marks, a terminal printout, cards crossed):
  - *Heads:* a card's row or column head is drawn as a plane's card (raised paper, its type's colour down the left, the
    title in Geist), no type name on it (the colour says it); a typed name is mono over a dashed rule. Lit while its
    row or column is under the pointer or selected; `×` in its top-right corner on hover.
  - *Cells:* a scale's step is a 14 px square filled from the left to the step (first an outline, last full) in the
    step's colour, or its glyph when the setup says `glyphs` (`marks`); empty is a faint outline; doesn't apply a short
    rule; numbers and words as before. A note folds the top-right corner, how sure (`~` `?`) sits in the top-left: neither
    moves what's in the middle. Hover washes the row and column and shows grey corner marks; selected, cyan corner
    marks just outside (D-150's), not `[ ]`.
  - *Adding:* each axis ends in a dashed card (`+ competitor`, `+ row`): click, type a name, Enter adds it and the field
    stays for the next; cards that match what's typed are listed under it to pick instead; Escape or leaving closes it.
    No separate `+` buttons, no empty column for them.
  - *Totals* (were `reading`): on or off; where: in the heads (under a column's name, at a row head's end), at the ends
    (a `total` column after the cells, a row under them) or both; as: squares (one per cell in its step's colour,
    outlines for unset; past 10 in a head or 14 at an end, the line), a number (`3/5`) or a line of the steps' shares.
    Numbers show their average, words how many are written. Setup fields `totalsAt` (head|end|both, head when unset),
    `totalsAs` (squares|number|bar, squares when unset), `marks`.
  - The selected cell's bar stays on the screen (it ran off the right edge).
- *Setup (S2, picked on the preview):* `+ → matrix…` opens a wizard over the screen (page dimmed): four steps as tabs,
  start from (the templates, or my own), rows, columns, cells, any in any order; a preview beside it shows the first
  rows and columns as they'll come and how many; `make the matrix` puts it at the canvas's middle, named
  `<rows> × <columns>`, selected; nothing is written before. After, `[setup]` opens a tabbed panel over the bottom middle
  of its space (the screen, or a pane beside a plane, D-211): rows (with their count) · columns · cells · options,
  `start over from ▾` (a template; replaces rows, columns and cells; ⌘Z) and `done`. Rows / columns: all cards of a
  type (framed choices with counts, again for none), on which plane, `N hidden · show`, added by hand (cards and names
  as chips with `×`, `+ a card`, a field for a name), what one is called. Cells: a mark / a number / a few words (framed
  choices with a sample), the scale's presets and steps, show as squares or glyphs, the unit. Options: allow "doesn't
  apply", mark guesses, totals (where, as what), each with a line saying what it does. `useMatrixUi.setup` is `false` or
  a tab (`true` = rows); helpers `openMatrixSetup`, `closeMatrixSetup`, `toggleMatrixSetup`.
- *User:* "F süper duruyo. Column headerları için zaten renkler gosteriliyor bir de ne olduklarını yazmamıza gerek yok.
  Yenı row ve column ekleme de cok guzel duruyor. Cellerin içi güzel duruyo. Sadece "?" yada diğer belirteçler cellerin
  kenarında dursun yada cellin main contentinin ortalamasını bozmasın. Bir de … totalleri … hem headerda hem satır ve
  sutunların en sonunda gosterılebılır sekilde ayarlayalım, bir de hem tek tek kareler ile gösterim olabilsin hem de
  direkt sayı olsun, yada … bir çizgi içinde dağılımların görünümü (D deki gibi) … setup panelinde seçebilmeli
  kullanıcı"; S2 for the setup. Before that, on the first round: "+ row/column buttonları oyle yerlestırılmıs, tablonun
  sonunda neden extradan bır column var … üstüne çok düşünülmediğini belli eden detaylar var".
- *Alternatives:* the quiet grid (A2), the plotter (D), the terminal printout (E); setup in place on the table (S1) or
  as lists (S3). Not taken.
- *Verified:* rules tests 382 passed (new: totals where / as, marks; unknown values refused); Firestore rules deployed;
  headless Chrome on emulators: the focused matrix (card heads, squares, `?` / `~` and the note's fold in the corners,
  hover and selected corner marks), a typed column added from the dashed card, the setup's four tabs, totals at both
  ends as a line, the wizard's steps and preview; no console errors; typecheck and build.

### D-213 · 2026-10-22 · Accepted (adds to D-209)
- *Decision:* a table can be **paged**. Its dock (in its own focus and in its pane beside a plane, D-211) holds the
  page controls before `[setup]`: `‹ 2 / 5 ›` and how many rows a page (`all N`, `10 / 25 / 50 / 100 a page`, a Select).
  The page size is the table's own (`table.pageSize`, shared, one undo step; changing it goes back to page 1); which
  page you're on is yours (this tab). The table draws only that page (sorting runs over all the rows first), fit frames
  the page, and the canvas's picture shows the page you're on. Viewers see the size but can't change it.
- *User (through north-star-5e):* "pagination ekleyelim ve bu pagination console da dursun, kullanıcı isterse seçebilsin
  kaç itemda bir paginate olacağını (aslında bu normal tablolar için daha mantıklı. O yüzden matrix yerine bu
  paginationı oraya getirebiliriz)".
- *Not yet:* arrows stepping from a page's last row onto the next page; a page's controls on the canvas console.
- *Verified:* headless Chrome on emulators: a focused table of 17 rows, `all 17` → `10 a page`: `‹ 1 / 2 ›` and 10 rows;
  `›` → `2 / 2` and 7 rows; no console errors; typecheck. No rules change (validTable takes extra fields).

### D-214 · 2026-10-22 · Accepted (changes D-208's matrix window and D-212's adding; adds sticky heads)
- *Decision:*
  - *On the canvas* a matrix's window shows the whole table fitted in it (never past 1, 12 px round), as a plane shows
    its cards; a table still sits at zoom 1 from the top-left, cut by its edge (D-208). Focus glides from that fitted view.
  - *Sticky heads in focus:* panned or zoomed so the column heads would leave the screen, they stay 64 px from its top
    (under the breadcrumb's bar), and the row heads 160 px from its left (clear of the side nav's shade); the cells move
    under them on the page's paper; the corner stays over both; they never go past the last row or column. Drags and
    the wheel still move the cells' view as before.
  - *A row or column added* from its dashed card: the view glides (420 ms) to bring it to the middle, a row up or down,
    a column across (on the focus's own view; a pane beside a plane keeps its view).
  - *The add field:* no frame, no cyan box: typed as it will read, mono, on a dashed line, a magenta caret, `enter adds
    it` under it; a column's field is wider than its card (220 px) while typing.
  - *Typed column heads* start at the top like a card's, the totals at the bottom.
- *User:* "yeni row yada column eklenince vertical yada horizontal olarak orayı ortalama efekti ekleyelim"; "input box
  çok kötü duruyor. Mavi kutu içinde mavi input box ve çok dar bi alan. Bu input alanını border ile göstermeyelim";
  "columlarda card adları en üstten başlarken normal free text olanlar kutunun altında duruyor"; "matrix componentinin
  unfocuslu hali bütün matrixi sığdurmaya çalışmalı"; "belli bir noktadan sonra headerlar fixlensin ve sadece drag
  lemek celleri kaydırsın … sticky header gibi". (Their pagination ask went to the table, D-213.)
- *Verified:* headless Chrome on emulators: the canvas window fitting the whole matrix; a typed row and column added,
  each glided to the middle; the add field's look; zoomed in and panned right, the row heads held at 160 px with the
  cells passing under; no console errors; typecheck.

### D-215 · 2026-10-22 · Accepted (changes D-210: how a link shows, far links, letting go)
- *Decision:* a matrix or a table linked to a plane (`stuckTo`) shows it quietly, in grey, and lights cyan while the
  plane or the piece is under the pointer. Nothing moves (no flow, no glow).
  - *Which is the main one:* the plane; the piece hangs from it, never the other way. Its console says so
    (`⇆ 01 Pazar ▾`); its name in its top edge stays just its own (a `01 PAZAR ▸ TABLE · …` prefix was tried and dropped:
    "linkli componentlerin sol üstte adının önüne nereyle link olduğunu yazmamıza gerek yok zaten console da yazıyor").
  - *Touching* (one grid step out, alongside): the 25 px gap along what they share holds faint `· ›` cells, 9 px each,
    pointing away from the plane (`‹ ⌄ ⌃` on the other sides), and the plane's edge a notch there (`--edge`, 2 px). The
    old `⇆` chip in the gap is gone.
  - *Apart* (a far link): a thin straight line (1 screen px, `--line-hover`, never dashed) from the middle of the plane's
    side facing the piece (kept 30 px from its corners) to the piece's facing side, with a notch where it leaves the plane.
    Lines and gaps are drawn under every piece, so a line never crosses one ("Linkler componentlerin üstünden geçiyor");
    the notches over the plane's edge.
  - *Linking:* moving it to a plane's edge still links it there (D-210); a dropdown in its console does the rest:
    `link ▾` when it isn't linked, `⇆ 01 Pazar ▾` when it is, listing every plane (`⇆ name`) and `unlink`. Viewers see
    `⇆ 01 Pazar` without the dropdown. Dragging never lets go any more (moved away it stays linked, far); dropped at
    another plane's edge it links to that one.
  - *Moving together:* a plane moved or resized carries everything linked to it: what touches it stays on its edge
    (D-210), what's apart moves as the plane's top-left corner does.
  - *A matrix's axes:* both of its typed axes take the plane (D-210), so features × competitors linked to a plane with
    no competitors shows no columns; asked whether only the rows should, the user kept it: "şimdilik böyle iyi".
  - *Live:* while a plane or a linked piece is dragged, its link is drawn where they are at that moment, turning from
    touching (`· ›`) to apart (a line) and back at once as the piece goes (the user: "component taşırken yada yukarı
    aşşaı kaydırırken iki bağlantı durumunun da anlık değişmesi … iyiydi"; only pulsing motion was unwanted).
- *User:* chose from two previews on a port (V2 "künye + çentik", then G1 "ASCII akış" + F1 "ince çizgi"): "Üst üste
  binince oluşan bağın plane borderı üzerinde çizgi olarak gösterilmesi güzel ancak mavi parlaması her zaman güzel
  olmamış, daha az dikkat çeken ama yine de bağlı oldukları gösteren bişi lazım"; "Uzaktaki bağlantılar için de kesik
  çizgi kesinlikle olmaz"; "Uzaktan bağlamak da kesinlikle dropdown ile yapılmalı"; "G1 F1 harika duruyo. Ama
  animasyonlara gerek yok".
- *Alternatives:* a line with a filled square at the plane and a ring at the piece (V1); lines only on hover (V3); a
  bridge or stitches in the gap (G2, G3); an elbow line (F2); a `⇆` handle dragged onto a plane (L1); flowing squares
  and a glow wave. Not taken.
- *Verified:* headless Chrome on emulators: a table touching a plane's right edge and a matrix its left, both named
  `· ›` gaps; hovering the table lit its gap and notch; the matrix dragged far in edit mode
  stayed linked, drawn with a thin line; the table's dropdown listed `unlink | ⇆ 01 Pazar | ⇆ 02 Rakipler`, picking 02
  moved its link (its rows followed; `unlink` let it go, its console back to `link ▾`); the far matrix dragged to the plane's edge showed the `· ›` gap mid-drag,
  then the line again as it went on; no console errors; typecheck.

### D-216 · 2026-10-22 · Accepted (adds to D-212 and D-214)
- *Decision:*
  - *Long head names* use the head's room before they're cut: a column's card name three lines (line height 1.2, the
    head's padding 6 px), a typed name four; a name over 30 characters (a column's) or 40 (a row's) is set a size smaller
    and gets four lines (a row's three); a row's two lines otherwise. The full name stays in the head's tooltip.
  - *Added by hand* in the setup (D-212) is one set of pills, as tall as the type choices: a card's with a square in its
    type's colour, a typed name's with an outline square, `×` on each; then one dashed pill, `+ a card, or type a name`:
    typing lists `"…" as a name` and the cards that match (the axis's type first), focused empty it offers the axis's
    type's cards not on it yet; arrows move, Enter or a click takes the lit one, the list opens upward. The `+ a card ▾`
    menu and the separate name field are gone; `called` is a pill-shaped field too.
  - *Sticky heads* (D-214) never stick further in than where fit puts them (fit's 96 px round): at fit they don't cover
    the first row or column. Each head layer is cut where the other's heads begin, so nothing shows past the corner.
- *User:* "column ve row adı uzun olunca trancated oluyo … bu alanı biraz daha kullanmaya çalışalım. Yani sığdığı kadar";
  "added by hand kısmı daha güzelleştirilebilir … farklı farklı üç ui parçası yan yana … ui parçalarını birbirine yakın
  tutmaya çalışabiliriz".
- *Verified:* headless Chrome on emulators: long typed and card names in column and row heads; the setup's columns tab
  with pills, the add pill's list for `Cr`, a name added by Enter; focus at fit with nothing covered, then panned up and
  left with both head layers stuck and the corner clean; no console errors; typecheck.

### D-217 · 2026-10-22 · Accepted (changes D-214's stick line; adds to D-186's pan in focus)
- *Decision:*
  - *Panning from a cell:* in a matrix's focus a press on a cell is the cell's until it moves 5 px (a card's drag
    threshold, D-150): a click still selects it (no letting go of the selection on the press), a drag pans the view.
    Elsewhere on the focused layer the press pans at once and lets go of the selection, as before. The same in a pane
    beside a plane (D-211): the matrix's cells don't keep the press there either, and the pane's own pan follows the
    rule (Beside.tsx, north-star-67, who also made tables' cells match).
  - *Held row heads* stop 56 px from the screen's left, just past the side nav's tools (was 160); while they're held the
    side nav's shade fades out (`html[data-held-heads]`, Hud.module.css), since the heads sit on their own paper. Still
    never further in than where fit puts them (D-216). The selected cell's bar hides while its cell is under the heads.
- *User:* "mouse celllerin üstündeyken matrixi dolaşmak için hold&drag yapmak çok zor, cellerin arasındaki boşluğa
  getirmek gerekiyor"; "çok zoom olunca sticky'e dönüşen row headerları sol tarafa biraz daha yaklaşabilir".
- *Verified:* headless Chrome on emulators: a click on a cell selected it; a drag started on another cell panned the
  view 400 × 150 px and kept the selection; the row heads held at 56 px, the shade gone; no console errors; typecheck. In a pane
  (north-star-67): a click on a table's cell selected it, a drag from it panned the pane 100 × 80 px.

### D-218 · 2026-10-22 · Accepted (changes D-209's making and setup, after D-212's matrix)
- *Decision:* a table is made and set up as a matrix is (D-212), with the same parts and look:
  - *Making:* the canvas's `+` has one `table…` (no list of templates), as it has one `matrix…`. It opens a wizard in the
    middle of the screen: 1 start from (every card, features, competitors, blank, or my own), 2 which rows, 3 which
    columns, any step at any time; a preview beside it (the first rows and columns, how many); `make the table` puts it
    at the canvas's middle, selected, named after the template (or `table`). Escape or a click outside leaves; nothing
    is written until it's made.
  - *Setup:* a tabbed panel over the bottom middle of its space (focus, or its pane beside a plane), above the dock:
    `rows · columns · view` with counts, `start over from ▾`, `done`. Rows: `[x] the cards that meet these rules`, one
    line a rule (`where type is …` as framed choices, `is / is not`, `· auto` when linking set it), `+ plane + status
    + tag + title` to add a rule, and what's added by hand as pills with one field that finds a card or takes a name.
    Columns: the card's fields as on/off choices, `its own` as four kinds to add (a mark, a number, a few words, a
    check), then the columns in order (‹ ›, name, kind, unit or steps, ×). View: rows a page (all, 10, 25, 50, 100) and
    the order (a column, up or down). The table's `+` column head opens the setup on columns.
  - Shared with the matrix: `Row`, `Toggle`, `Choices`, `AddPill` (MatrixSetup.tsx) and its panel and wizard classes
    (Matrix.module.css); north-star-5e keeps those names.
- *User:* "ana canvas da … çok fazla table itemi var onu sadece 1 table diye belirleyelim. Matrix de aynı şekilde";
  "matrix oluşturmaya bakarken, ilk başta soruyor nasıl bir matrix istersin diye. Table da aynı şekilde olsun. Hatta
  tablo setup ekranını da değiştir eğer ordan ilham alıcağın bişeyler var ise".
- *Verified:* headless Chrome on emulators: `+` listed `plane | matrix… | table… | …`; the wizard opened, `features`
  picked, the rows step showed `where type is feature`, the columns step the fields on (status, priority, impact,
  effort) and `cost`; `make the table` placed it; in its focus the setup's three tabs, `view` → `10` paged it
  (`‹ 1 / 1 › 10 a page` in the dock); no console errors; typecheck.


### D-219 · 2026-10-22 · Accepted (the right panel's look and place, for every panel that opens on the right; first use: a plane's cards, D-187's "side panel" now back as a shell)
- *Decision:* one right panel for everything that opens on the right, whatever fills it (`src/ui/SidePanel.tsx`:
  `SidePanel`, `PanelSection`, `PanelAction`). Picked from four on a scratch preview (port 5196; A terminal column, B the
  card opened as a floating sheet, C a tab hanging from the top edge, D a terminal log with a `>` prompt): A.
- *Look:* a column flush with the right edge of its space, 400 px (narrower if the space is), the screen's full height
  (the user: "side panel neden en tepeye kadar uzanmıyor?"; it's in a portal over the HUD's bar, whose shade had dimmed
  its top line, and nothing of the bar's sits on the right), `--bg`, a `--line-hover` line on its left with 7 px
  magenta marks on its two left corners (a plane console's, the focus dock's). Along the top the kind in uppercase in
  its colour and `[×] esc`; the title in Geist 22 px under it and a rule; then sections under rules that carry a number
  and a name (`01 STATUS ────`), the body scrolling; `[verb]` actions at the foot over a rule. It builds up cell by cell
  as it opens and breaks apart as it closes (`<Appear>`, D-034); one panel stays while what it shows changes.
- *Where (the user):* a panel belongs to its component: a piece in focus opens it at the right of its own view, and
  with something open beside it (D-211's split) at the right of its own part, never over the other part; a thing on the
  canvas itself opens it at the screen's right edge. It's a dialog to the canvas (its wheel scrolls it, a press doesn't
  pan). What it's for, if it would be covered, glides left clear of it (48 px).
- *First use:* a plane's selected card (in focus) opens it: its type and colour, its title, `[comment]` (its thread, or
  a new one) and `[delete]` (editors; with its links). Closing (`[×]`, Escape, a press on the plane) lets go of the
  card. What fills a card's panel is next, with the user.
- *User:* "Öncelikle burda alacağımız kararlar bütün sağda açılan paneller için geçerli olucak … Paneller componentlere
  bağlı olcak … sağ panel açılması o componentin kendi viewı içinde gerçekleşcek … ana canvas da ise … en sağda
  açılcak", then "A ile devam et".
- *Verified* headless (emulators): a click on a card opens it cell by cell, another card swaps its content without a
  rebuild, a card under it glides clear, with `beside` set it sits at the right of the plane's part, Escape closes it;
  no console errors; build.

### D-220 · 2026-10-22 · Accepted (changes D-199's go there)
- *Decision:* the thread header's go there is no longer a cyan framed target icon. The place in the header is the
  button, bracketed like the other actions: `[on the canvas ↗]`, grey as they are, the `↗` always there and a size up
  (`--text-md`), all of it cyan on hover or focus. No ` · ` before it: the bracket parts it from the title. When the
  line is short of room, what it's on is cut with `…` first; the place stays whole.
- *Why:* every other control in that header is bracketed mono text (`[all threads]`, `[resolve]`, `[delete]`, `[×]`);
  a 22 px cyan box with an SVG didn't match in shape, colour, size or line. The place is already written there, so
  making it the link takes a control away.
- *Alternatives:* `[↗ go there]` as its own action; a bracketed glyph `[⌖]`; the same icon unframed at text size.
  The user picked the place as the link ("o icon buttonu diğer buttonlarla çok uyuşmuyo"). First built unbracketed,
  faint, the `↗` only on hover; the user then asked for a bigger arrow and brackets ("oku daha büyük yapabiliriz bence.
  Bir de bunun bir buton olduğunu gösterelim. diğerleri gibi köşeli paranteze koy").
- *Verified* headless (emulators): at rest the header reads `[all threads] heading "Pri… [on the canvas ↗] [resolve]
  [delete] [×]`; hovered, the place and arrow turn cyan; a click glides the canvas to the heading; no console errors;
  typecheck.

### D-221 · 2026-10-22 · Accepted (what fills a plane card's right panel, D-219's shell; brings back the old side panel's content)
- *Decision:* every card type reads in one order: what it is (status / profile / plan) → what backs it (evidence /
  parts) → what it touches (links by meaning, then the rest) → tags → notes; `[comment] [delete]` at the foot. Under
  the title, the card's quick facts (D-205's head and facts line). Planned on a scratch preview (port 5196,
  `cards.html`) with all five types and a part; the user liked it and changed two things: a section's add sits at the
  right end of its rule (`02 EVIDENCE ──── + evidence`), and `for` rows look like every other link, not chips.
- *Sections:* customer: status, evidence, tagged for them (`for` links to it; `+ tag a card`), links, tags, notes.
  Problem: status, evidence, for, solved by · competed for (`+ idea that solves it`), other links, tags, notes. Idea:
  status (with D-137's `!` line), evidence, solves, features, for, other links, tags, notes. Competitor: profile (does,
  for, pricing, where = regions, site), features, competes for, other links, tags, notes. Feature: plan (priority,
  status, impact, effort), parts, must do (≤ 8 criteria), rests on (ideas linked, the problems they solve, a confidence
  = the weakest of them: invalidated none, a guess or a status the evidence doesn't back low, testing medium, validated
  high; replaced by D-253's one rule, built in D-271; a part with none shows its parent), for · matched by (`≈ theirs` rows from competitors' features), other links,
  tags, notes. A part's panel has `part of ↑ parent [detach]` under the header.
- *A competitor's features* (the basic cards inside it, D-164): by category in grey caps (none first), each row its
  name, how it's offered, `≈ our …` in cyan with a cyan bar when it matches one of ours. A row opens in place (one at a
  time): its name, about, category, offered (free / paid / enterprise / beta), ours (a Select of the plane's features),
  seen at, `[remove]`. `+ feature` opens the whole of it as a form, like evidence (the user: "Add bütün cardı
  göstersin"): name, about, category (the ones in use as pills), offered, ours, seen at; Enter or `[add]` adds it and
  its match in one undo step. Which of ours one matches is the old
  matrix's comparison doc (`<feature>_<competitor>`'s `competitorFeatureId`): one of theirs per feature and competitor.
- *Editing:* the title is typed in place; choices are `[pills]` (a click picks, a click on the picked one clears);
  evidence has a small form (text, for / against, kind, from, when, link; Enter adds), its cell turns it round, its text
  edits it; link rows go to their card (selects it, glides it into view clear of the panel), `×` on hover unlinks; a
  section's add opens a card finder over the plane's cards (arrows, Enter), which can make a new card of the first type
  from what was typed (placed under this one); a plain `+ link` opens the new link's bar with its label ready (D-154);
  tags and regions as chips (`×` on hover; Enter adds); notes (`body`, a competitor's `notes`) save as you type. One
  undo step each, typing merged. Viewers read only.
- *Then* (the user): text fields don't save while typing ("daha yazmayı bitirmemiş olabilirim"): Enter or leaving the
  field keeps it, Escape puts it back, shift+Enter a new line where it may have several; notes keep on leaving (Enter is
  a new line); leaving the panel with something typed keeps it (`useCommit`). And the card is no longer typed on
  ("Cardın üstüne tıklayıp isim değiştirme olayını kaldıralım"): no double-click title on the card; a new card opens
  its panel with the title field ready (`cardEditing`).
- *Then* (the user asked for a part's side and the old must-haves): a feature without a parent shows `part of + a
  feature` under its header (a finder; not itself or its parts); each must-have reads `met by N` (cyan), `◇ open`
  (yellow: scored, nobody meets it) or `score`, and opens the plane's competitors to score it `[met] [part] [no]`,
  kept in the comparison doc's `criteria` map (D-133's cell scores); taking one away takes its scores in the same undo
  step. And `[delete]` sits in the far right corner of every panel's foot (the user), `[comment]` left.
- *Left out:* files (attachments, not live until Blaze), `on N planes`, packages; `[unfold onto the plane]` waits for
  folding parts on planes (D-164).
- *Verified* headless (emulators): a problem filled end to end (status, evidence, a customer, a new idea that solves
  it, two tags, notes; all in Firestore), a row going to the customer; a competitor's profile, regions, four features
  in two categories, one opened, made paid and matched to our feature; that feature's plan, a new part, two
  must-haves, `≈ theirs` showing; the part's panel with its parent; no console errors; build.

### D-222 · 2026-10-22 · Accepted (every dropdown, picker and right-click menu in the prompt look; changes D-053's and D-093's lists)
- *What:* the lists that open from a click (the side nav's `+` and go to, `start over from` in a matrix's or table's
  setup, the right-click menu, every `Select`) share one look, the **prompt**: page black, a `--line-hover` edge, built cell
  by cell. A `>` line on top has focus on open (`add…`, `find a place…`, `a template…`, `do with this customer…`): typing
  narrows the list, the typed part lit magenta, Enter picks the first. Sections are comment lines (`# text`). Each row: a
  magenta `›` where Enter goes, the item's letter `[p]` when it has one, its glyph, label, a faint hint; dangerous ones red.
  A foot counts what's shown. Letters: plane p, matrix m, table t, heading h, paragraph a, sticky note n, section s,
  project title i; cards customer c, problem r, competitor o, idea i, feature f; right-click comment c. A letter typed
  alone puts its item first (so `+` `p` Enter makes a plane), it doesn't pick at once (typing `pa` must still find
  paragraph). `Select` keeps its compact rows: a cyan `•` on the current value, the `›` + wash on the row under the
  pointer or keys, the `>` line only past 7 options, a short list jumps by first letter.
- *Why:* the user asked for a design refactor of the menus that open from a click or a right-click. Five directions were
  shown on a scratch page (console like D-219's panel, TUI box drawing, tiles with ASCII drawings, prompt, list with a
  preview beside); the user picked the prompt: "prompt baya iyi olmuş, onu uygulayalım".
- *Where it's used now:* `Menu.tsx` (`MenuPanel` is the list alone), `ContextMenu.tsx` (uses `MenuPanel` at the pointer,
  kept inside its space), `Select.tsx` (10 places: link kind, a piece's `⇆` link, a table's rows a page, table setup's rule
  field / scale steps / sort, matrix setup's plane, people's role, a competitor feature's "ours"). Not changed: the
  find-as-you-type lists under a field (the card finder in the card panel, the matrix's add field, its setup's add list,
  `@` mentions); they could take the same rows later.
- *Verified* headless on emulators: `+` opens with the field focused, `p` Enter made a plane, `tab` narrowed to `table…`
  with the match lit, right-click on a plane says `do with this plane…`, go to shows `find a place…`, a 10-option Select
  (matrix wizard's plane) shows the `>` line and the `•`; no console errors; build.
- *Fix after trying it:* a click on the canvas or a plane didn't close an open menu (they stop their presses from
  bubbling), so it took two clicks. Menu and Select now hear an outside press on the way down (capture). Checked: `+` and
  go to close on one click on the canvas and on a plane.

### D-223 · 2026-10-22 · Accepted (a piece's name readable at any zoom; changes D-180's name field)
- *What:* the name in the top edge of a plane, matrix or table stays where it was but is held at a size on the **screen**:
  13 px × the canvas's zoom, never under 11 or over 15 (`--z` on the piece, the font size divided by it). `--fg`, weight
  500, caps, tracked; named, its kind follows faint (`PAZAR ARAŞTIRMASI · PLANE`); unnamed, the kind alone, faint. When it
  doesn't fit in the piece, the kind gives way first, then the name is cut with `…`; hovering the piece shows all of it.
  Edit mode: the name is a field framed in cyan on the edge, a cyan `>` before it, what's typed in its own case, and
  `17/80` after it (faint); the app's focus outline is off there since the frame says it.
- *Why:* names were hard to read on the canvas. The name scaled with the canvas: 11 px was 5 px on screen at 45 % and 3 px
  at 25 %. Five options on a scratch page (A on the edge, bigger; B outside above in Geist; C a tab mirroring the console;
  D a heading with `01 ── PLANE`; E a title bar inside the top), each with its edit mode beside; the user picked A
  ("A yı yap"). Before, edit mode was the same label with a faint underline, so it wasn't clear it could be typed in.
- *Not changed:* the console still scales with the canvas.
- *Verified* headless on emulators: four planes, one named; at 10 % zoom the name computes to 11 px on screen and is cut
  `PAZAR…`, unnamed ones read `PLANE`; at 100 % `PAZAR ARAŞTIRMASI · PLANE`; edit mode shows the framed field with
  `> name this plane 0/80` and typing works; tsc.

### D-224 · 2026-10-22 · Accepted (a table follows what you add; its columns' widths dragged)
- *What:* a row or column you add to a table (its `+ row`, `+` column → setup, or the setup's rows and columns tabs) is
  followed in, as the matrix's (D-214): the view glides 420 ms to put a new row in the middle of the screen (turning to
  its page if it lands on another, D-213) and a new column across to the middle, its head brought down into sight
  (64 px from the top) if it was above, since the setup sits over the middle. In focus and in a pane beside a plane
  (D-211). Only your own adds (a `follow` mark in `useTableUi`, 4 s); others' don't move you.
  Columns' widths: each head's right edge (the name column's too) is a grip, live in focus for editors: a faint tick at
  the head's foot, a cyan line down the whole table while hovered or dragged, at screen size at any zoom. Dragging
  widens or narrows the column (48–640 px of the table), written once let go (one undo step), shared;
  a double-click puts it back to its kind's width. Stored as `width` on the column, `nameWidth` on the table (no rules change:
  `validTable` doesn't look inside columns).
- *Why:* the user asked: "table viewında yeni column yada row ekleyince table onları takip etsin matrixdeki gibi. Bir de
  table columlarının boyu ayarlanabilir olsun".
- *Verified* headless on emulators: a 14-row table zoomed in; `+ row` glided the new row to the middle with its name field
  open; adding `impact` from the setup glided it to the middle, head above the panel; a drag widened `tags` with the
  cyan line showing, kept after a reload; a double-click put it back; tsc.

### D-225 · 2026-10-22 · Accepted (brings D-164's competitor features and folded parts back on planes, inside the card; changes D-164/D-173's names beside it)
- *Decision:* picked from three looks each on a scratch preview (port 5196, `inside.html`: A names beside the card, the old
  board's; B inside the card; C a deck under or behind it): B for both, "a card that holds cards". The user: "ikisinde de
  B ile devam et. Competitor da mouse hover edince expand olup çıkınca eski görünümüne döncek … Feature da da fold/unfold
  düğmesine basınca cardlar açılıp kapancak".
- *A competitor's features:* closed, a strip over its facts line, a cell per feature (8 × 4 px, the first twelve; cyan
  when it matches ours) and `6 features · 2 ≈ ours`. Hovered (in focus, cards showing everything, not while dragged),
  the card grows down 280 ms (eased both ends) to hold its features as small cards by category (grey caps name and count
  over them; 18 px rows, the competitor's yellow strip, cyan when matching ours, how it's offered on the right), and
  shrinks back when the pointer leaves. It grows over the cards below (z above them) rather than pushing them, since
  hover would make them jump. A small card's click opens the competitor's panel with that feature open (`cfOpen`).
- *A feature's parts:* its facts line ends in `[−] 3 parts` (sky, the part-of colour; all the way down); a click folds
  them (`folded: true`, shared, undoable): each part's card shrinks into its row inside the parent (280 ms) and the parent
  grows to hold them as a tree (`├ └`, indented by depth, status on the right, Geist 9 px, 15 px rows); `[+] 3 parts`
  unfolds, the cards growing back out to their own places. A row click selects that part (its panel). A part folded on
  its own stays folded inside. Dragging a folded feature carries its parts (one undo step, `moveCards`).
- *Links:* drawn to each card's real box (`drawLinks`' `boxOf`): a grown card's whole box; a folded part's row, so its
  links end at the row; `part of` lines inside a fold left out.
- *Sizes* (`cardInside.ts`): lists start 56 px down (the title keeps two lines' room while holding something); a folded
  feature is 56 + 15 per part + 25 tall (at least 100); an open competitor 56 + 13 per named category + 21 per feature + 25.
  Zoomed out (compact, far) neither grows.
- *Not yet:* links to a competitor's features, and dropping a link on a small card; the assistant doesn't write `folded`.
- *Verified* headless (emulators): a competitor with five features in two categories grew from 100 to 212 px on hover and
  back on leaving; a feature with three parts (one a part of a part) folded mid-frame into its rows and then held them
  (126 px), a part's `inspired by` link starting at its row; dragged +100, +50 with its parts carried; unfolded back
  out; no console errors; build.

### D-226 · 2026-10-22 · Accepted (D-225's parts for customers, problems and ideas; a competitor stays open while selected)
- *Decision:* any card but a competitor can have parts of its own type and fold them as a feature does (D-225): a
  sub-problem under a problem, a narrower idea under an idea, a smaller segment under a customer. A `part of` between two
  types isn't a part (an idea that answers a problem `solves` it), and a competitor holds its features instead. Their
  panels get the same `part of + a <type>` / `↑ parent [detach]` line under the header and a `parts` section after the
  evidence (a tree, `+ part` finds or makes one of its type); rows show a status (a feature's, else the validation).
- *And:* a competitor stays grown (its features showing) while it's selected, not only while hovered (the user:
  "competitor hover dışında tıklı kaldığı sürece de expanded kalsın").
- *User:* "ben bu part of olayını çok sevdim. Bunları problem, idea, customer a da getirsek nasıl olur?"; same type only
  was offered with it (the recommendation).
- *Verified* headless (emulators): a selected competitor kept 200 px with the pointer away and shrank on Escape; a
  problem folded its two sub-problems; a customer made a part of another from its panel (the line drawn, `[−] 1 part` on
  the parent); no console errors; build.

### D-227 · 2026-10-22 · Accepted (brings D-108/D-124's multi-select back, on planes)
- *Decision:* in a focused plane, shift+click puts a card in or out of the selection (no drag), alt+drag on the plane
  draws a dashed cyan box and selects the cards it touches (shift+alt adds); two or more are `cardMulti` (one stays
  `cardSelected`). A press on a selected card drags them all: the one held goes 0.8 under the pointer as before (D-150),
  the others 0.8 round their middles, following by the same snapped step; dropped, they (and parts folded into them)
  move in one undo step. Arrows nudge the selection a grid step (25 px), shift four; ⌘C / ⌘V / ⌘D copy, paste and
  duplicate in this tab (each paste two steps further, the links between them copied, the copies selected); Delete takes
  them all with their links (one undo step); Escape lets go of several before it would leave focus. A press on the plane
  or on text lets go.
- *Panel:* the right panel (D-219) shows `N selected` (kind `selection`, cyan): what they are (`2 problems · 1 idea`),
  `01 LINE UP` [left] [centre] [right] [top] [middle] [bottom], `02 SPACE OUT` [↔ across] [↕ down] (three or more, evenly
  from the first to the last), `03 TAGS` on all of them (add one to all, `×` takes it off all); foot `[copy]
  [duplicate] … [delete]`.
- *Keys:* heard before the canvas's (window, capture), never from a field, the panel, a menu or a list.
- *Not yet:* text in the selection, presence `more` (others seeing the whole selection), `package these`.
- *User:* "çoklu seçimi yapalım".
- *Verified* headless (emulators): three cards by shift+click (panel `3 selected`), dragged together +100, +50, lined
  up top, nudged right 25, duplicated (7), the copies deleted (4) and undone (7), Escape with several kept focus, an
  alt box selected one card; no console errors; build.

### D-228 · 2026-10-22 · Accepted (a matrix or table opened onto the canvas; adds to D-208's window)
- *Decision:* a matrix or table can be taken out of its window onto the canvas: `[unframe]` in its edit-mode console,
  `[frame]` to put it back (the user picked the names from four pairs: spread/window, unframe/frame, on canvas/in
  window, a window ⇄ canvas switch; first built as a pressed `[open]`, "çok açıklayıcı değil"). Open, its edge and fill go, its contents lie on the canvas at their own size a
  grid step in from its corner (two under them, where its console is) on a feathered page so the backdrop stays out
  from under the text, and it's live there as in focus: cells (click, keys, the bar under a cell at screen size),
  heads, the dashed add cards, a table's column widths; its console gets a table's pages and `[setup]`, which opens the
  setup panel at the bottom of the screen (Escape closes it, then lets go of the cell). Its heads don't stick on the
  canvas (focus does that). Shared (`open: true` on the piece, rules: matrix/table only, a bool), one undo step.
- *Size:* open, its box is its contents' (`shownBox.ts`), not stored: the stored w/h stay the window's, so closing
  brings the window back as it was. Fit, go to, sticking, links to a plane, comment chips and a new piece's place all
  use the drawn box. Open, it only moves in edit mode (no grips, the corners thin cyan marks); a move writes x/y only,
  and a plane carrying it writes only its x/y too.
- *Live:* not in edit mode (a press moves it) and not while a plane is in focus. Drawn counter-scaled (a layer at
  1/zoom holding a view at the canvas's zoom), so what's at screen size stays so. A press on a cell pans the canvas
  only after 5 px (D-217's rule), so a click selects; a double-click on it types, never focuses. A cell's selection now
  carries its matrix's or table's id (`cell|<piece>|row|col`), since more than one can be live at once.
- *User:* "tablo ve matrixleri bounded oldukları yerden ana canvasımıza açabilir miyiz? Mesela default olarak olmasın
  ama edit düğmesine tıklayıp seçersek table ve matriximizin bütün içi canvasa çıksın ve canvastan control edilebilsin";
  shared for everyone and focus kept were the recommendations, taken ("ikisi de dediğin gibi olsun").
- *Not yet:* a far zoom's simpler drawing (it draws every cell, as the window did); a big matrix isn't capped; a
  table's follow (D-224) doesn't move the canvas.
- *Verified* headless (emulators): an open matrix took 3 then → and 2 from the keys (full, partial) with its bar at
  screen size; a table cell selected; edit → `[open]` (now `[frame]`) closed it back to its 400 × 250 window and reopened; a drag moved
  it 175, 100 with w/h still 400 × 250; `[setup]` opened the panel, Escape closed it; focus and back; rules tests 385
  passed (3 new), Firestore rules deployed; tsc.

### D-229 · 2026-10-22 · Accepted (D-227's selection takes in everything on the plane; no jump after letting go)
- *Decision:* the selection on a focused plane holds cards and text alike (headings, paragraphs, sticky notes,
  sections): shift+click and the alt box pick text too, and a press on any selected thing drags them all (each 0.8
  round its middle while carried, by the same snapped step, alt free; parts folded into a card come along); the arrows,
  Delete, ⌘C / ⌘V / ⌘D and the panel's line up / space out (by each thing's own box) take text with the cards, all one
  undo step each. `N selected` counts text by kind (`1 paragraph · 1 heading`); its tags only touch the cards. A text's
  own bar shows only while it's selected alone. The user: "planedeki her şeyin birlikte taşınabilir olmasını istiyorum".
- *No jump:* after a drag of several, or a section's, each thing stays where it was let go (`landing`) until its own
  data comes back, then lets go of it; before, the carry was dropped as the write finished, so things showed their old
  place for a moment before the new one arrived (the user: "taşımadan sonra kartlar saniyelik bir yerlere sıçrıyor").
- *Code:* `selection.ts` holds the shared drag (`startGroupDrag`), what's on the open plane (`onPlane`), `land` /
  `landed`; `moveMany` (labels.ts) writes cards and text in one batch; `deleteCards` and `copyCards` take text too.
- *Verified* headless (emulators): an alt box over two cards, a heading and a paragraph selected four; dragged from the
  heading, all moved +100, +100 and the paragraph read the same place at 0, 30, 80, 150, 300, 600 and 1200 ms after
  letting go; the text bars hidden with several selected; no console errors; build.

### D-230 · 2026-10-22 · Accepted (others see a selection of several; a right panel stays open through a pan)
- *Decision:* a selection of several on a plane (D-227, D-229) goes out in presence as before for one (`sel`, the first)
  plus `more` (the rest, D-124's field, no rules change): others in the space see a frame in your colour with your name
  round each card and text you have selected, and someone following you takes the whole selection. The user asked:
  "collaborative çalışırken de insanlar görecek mi multi selecti", then "evet yap".
- *And:* a press on a focused plane lets go of what's selected only as a click (let go within 5 px); a pan (a drag on
  the plane) no longer does, so a card's right panel stays open while you look round the plane. It closes on another
  card, Escape, `[×]` or a click on the plane. The user: "side panel açık kalması lazım ben başka carda, esc'ye ya da
  canvasa tıklamadığım sürece. Şu an drag yaptığımda direkt kapanıyor".
- *Verified* headless (emulators, Alice and Bob in two browser contexts, Bob invited and accepted): Alice selected two
  cards and a heading, Bob saw Alice's frame and name round all three and not round the fourth; with a card's panel
  open a pan kept it open and a click on the plane closed it; no console errors; build.

### D-231 · 2026-10-22 · Accepted (brings D-112/D-117/D-148's alignment guides and snapping switch back, on planes)
- *Decision:* while something is dragged on a focused plane (a card, text, or a selection of several as one box), a
  thin magenta line (1 screen px, a little past both ends) wherever its left, middle or right, or top, middle or
  bottom, lines up with another card's or text's on the plane. With snapping on (the default) positions keep to the 25 px
  grid and the lines only show what already lines up; with it off (`g`) or alt held, what's dragged is pulled onto the
  nearest line within 6 screen px on each axis. `a` turns the guides off and on, `g` the snapping; each says so in the
  toast and is kept in this browser (`north-star:snap`, `north-star:guides`). Canvas text has none yet.
- *Also fixed:* only the plane in focus fills `onPlane` (what's on it, for the selection and the guides); the plane
  pictures on the canvas had been writing over it as they drew.
- *Then* (the user: "iki ayar için bir menü şart … Console'a koy ama menüyü kullan"): the focus dock (a plane's console
  in focus) has `[grid ▾]` before `[unfocus]` (editors, planes only), opening the shared menu (D-222) with two checkboxes,
  `snap to the grid` (g) and `alignment guides` (a), toggled in place. Then (the user: "grid dropdownumuzu setup gibi
  generic bir şeye çevirip içine commentleri kapama gibi butonlar da eklemek istiyorum") it became `[view ▾]`
  (`ViewMenu.tsx`), for anyone in a plane's focus: ARRANGE (editors) with those two, SHOW with `comments` (c, the
  comment chips, D-159). New switches go here, not in the dock.
- *User:* "hizalama çizgilerine geçelim".
- *Verified* headless (emulators): with snapping on, a card dragged level with another showed a guide along their tops;
  `g` said "snapping to the grid off", then a card let go 2 px off another's left landed on it (x −100 like the other);
  no console errors; build.

### D-232 · 2026-10-22 · Accepted (documents: replaces "reports" as a word and a collection, D-090/D-091/D-098's data moved over)
- *Decision:* everything the workspace keeps as a file is a **document** (`documents/{id}` summary +
  `content/body`): kinds `markdown | image | pdf | report`. Private until shared (only the author shares, unshares,
  renames; deletes, or an owner a shared one). Two canvas pieces: `documents`, a list shown as a **table** or a
  **shelf** of sheets (switched from its console or focus dock, shared), and `document`, one document's content in a
  window. Putting a private document on the canvas on its own asks first, inside the dashed piece where it lands
  ("Show … to everyone?"); sharing and placing are one undo step. Old `reports/*` are moved to `documents/*` once, by
  each author's browser (an owner's moves the shared ones). Spec: `docs/specs/documents.md`.
- *Free plan:* `.md` text lives in Firestore and works now; images and PDFs need Storage (Blaze), so only the emulators
  take them (`filesAvailable`, `FILES_LIVE = false`), but the data already has `path`/`thumbPath`/`width`/`pages`.
- *Looks* (picked from a preview page of options): the list as a table lens (kind · title + first words · by · length ·
  added, heads sort, paged) and a shelf of sheets (folded corner, first lines); kind marks a small square + short name
  (`md` white, `img` sky, `pdf` orange, `rep` violet, the links' quieter hues); one document as a window (03 A), title
  in its edge, cut with a fade; far away its title alone, then bars. In the list's focus a click opens the document
  beside it (the D-211 split, scrolling like a page); in a document's focus the wheel scrolls it and an outline of its
  headings sits on the left. A row's `⇱` grip drags it out onto the canvas; a `.md` dropped on the empty canvas is
  uploaded and placed there (asked first).
- *Also:* `isLens` (matrix, table) now decides sticking (D-210) and opening onto the canvas (D-228); documents are bare
  pieces but neither. Summaries load with the workspace (two queries, shared and yours), bodies only where read — a
  change from D-098's "reports load where shown" now that documents sit on the canvas. A full Markdown renderer
  (`src/ui/Markdown.tsx`: headings, lists with tasks, quotes, code, tables, rules; nothing as HTML, nothing fetched).
- *Alternatives shown, not picked:* an `ls -l` listing; glyph-only or extension kind marks; a document as a sheet of
  paper or open on the canvas; placing a private document blurred until shared.
- *User:* "Document olcak ve bu her şeyi kapsicak, imagelardan pdflere ordan da .md lere kadar … kurguyu baştan doğru
  yapalım"; "private until shared ama document tek başına sergilencekse ilk önce onay alınmalı"; "Move them once";
  "everything you recommended is perfect … implement Table lens and Shelf of sheets for the list view. Maybe we can
  switch the view from console."
- *Not yet:* files (step 4), writing documents in the app, renaming from the UI, the assistant writing documents,
  viewers uploading (the client's read-only mode refuses it though the rules allow it), documents in the export.
- *Then* (the user, 2026-10-22): framed and not in focus nothing on the list takes a click, so its `⇱` grips show
  only once it's unframed; the shelf is only as wide as its sheets (up to five a row), so fit centres it; with a
  document open beside it the list is pinned to the top-left of its part at its own size (fitted to the part's width,
  never over 100 %) and the document takes what's left (no 50/50 split; the line drags, the list refits at once); the
  document beside it has "on this page" (its sections, the one being read lit, a click scrolls there; a row on top when
  the part is narrow), as the old reports reader had; zoom `[−] 100% [+]` in the document's dock beside the list (its
  text, ctrl+wheel too) and in a document's own focus (its view round the middle), which now arrives at 100 % with its
  top near the top. The user: "Split viewa geçince liste solda tam alan kaplayıp sol üste sabitlensin … Documentlara
  zoom etme eklememiz lazım. Yine default olarak 100% ile gelsin".
- *Then:* the table has no empty grips' column at its end (grips only unframed) nor a margin under it; switching table
  and shelf (or kinds, a page) fits it again. Documents beside the list: `[delete]` in each one's dock (its author, an
  owner a shared one; asks first); `[hide list]` in the list's dock puts the list away (the documents take the screen
  right of the side nav, `[≡ list] [unfocus] esc` top-left bring it back or leave); `[⧉ side by side]` in the list's
  dock makes a click open a document next to the ones open (up to four, equal columns; a narrow one's dock is marks, its
  words in the tips), right-click `open next to the others` too. From an unframed list on the canvas a click opens the
  document on the whole screen, the list put away; with the list put away Escape goes straight to the canvas.
- *Then:* Escape: with the list there it closes the document (the last opened); with the list put away, a framed list
  comes back (they all close), an unframed one goes straight to the canvas; closing the last document with `[close]`
  does the same. No unfocus button top-left: the list's button is `[≡ list]` in the first document's dock, and no line
  stays down the left with the list put away. Each row (and sheet) in the list's focus has its actions as marks on its
  right: ✎ rename (its author; typed over in place, Enter keeps, Escape puts back), ◐ share/unshare, ↗ place, ↓ download,
  ⌫ delete; rename is in the right-click menu too. The marks are bigger (28 px, a size up), no frame: hovered, a faint
  wash and the mark lit. Side by side, the line between two documents drags (each at least 280 px; a double-click
  shares the width evenly again). The `⇱` grips are gone (a click on them only opened the document): unframed, a row's
  `↗` places it where you're looking on a click and drags it out where it's let go on a press that moves. A
  document's own focus has "on this page" on the right as beside the list (one look for both; it had been "outline"
  top-left).
- *Verified:* rules 419 pass (34 new: private reads, lists by shared/uid, author-only share/rename, owner deletes a
  shared one and restores it, moving a shared report as its author's, body size, file paths under its own id, the two
  piece kinds); headless on the emulators: two .md uploaded into a new list (◐ private), shelf and table switch, a row
  dragged out asked to share and placed the piece, the list's focus opened a document beside it and a seeded old report
  moved over and read with its sections and sources, a document's focus scrolled with its outline lit; no console
  errors; build.

### D-233 · 2026-10-22 · Accepted (brings the old board's filters back for planes: SHOW, FOR, TAG, REGION, LINKS)
- *Decision:* one `[filter]` in the focus dock (anyone; `[filter · N]` lit while N filters narrow); pressed, the filter
  opens right on top of the dock in the console's look (its edge, magenta marks on its top corners, sitting on the dock's
  top edge), pressed again or Escape it closes. The user picked one menu over five ("tek bir dropdown olsun ancak oraya
  basmak consolun üstünde filtre alanını açsın … direkt consolun üstüne açılsın").
- *Then* (the user: the archived filter bar's look, "her filtrenin kendi dropdownu var ve sıralanmış şekilde … direkt
  consolun üstüne"): the strip on the dock holds the old filter bar (D-053, D-066), one framed `LABEL value ▾` after
  another, each its own menu (D-222's, opening upwards), lit cyan while it narrows: SHOW with a swatch per type, FOR
  `any` / a name / a count, TAG with how many cards carry each, REGION, LINKS with a swatch per kind, then `[reset]`.
  Escape closes an open menu first, then the strip.
- *What they do* (checked = kept): SHOW the five card types; FOR the plane's customers (keeps the chosen ones and
  what's tagged `for` them); TAG the plane's tags (keeps cards with one of them); REGION where its competitors are
  (narrows competitors only, a place counting inside the bigger ones: D-145's rules, now `src/data/regions.ts`); LINKS
  each kind in its colour; `[reset]`.
- *Links:* `for`, `relates` and `competes` start hidden as on the old board (D-128, D-135; the user: "eskisi gibi gizli
  başlasın"); a hidden kind still shows on the card hovered, selected, being linked from, and for the selected link.
- *Kept* (changed by D-308: only while the focus is open) per plane in this browser (`north-star:filter:<plane>`); the plane's picture on the canvas shows it filtered
  the same way. Filtered-out cards aren't drawn, boxed or lined up against; text isn't filtered.
- *Verified* headless (emulators): links started as `solves` only; hiding ideas, FOR Owners (Owners + its problem),
  TAG #ops (the problem) and REGION Germany (Resmio kept, OpenTable in the US dropped) each narrowed as said; no console
  errors; build.

### D-234 · 2026-10-22 · Accepted (D-228's unframe for documents; adds to D-232)
- *Decision:* the documents list and a document on its own can be taken out of their windows onto the canvas like a
  matrix or table: `[unframe]` / `[frame]` in the edit-mode console, shared (`open: true`, rules now allow it on
  `documents` and `document`). Open, the edge and fill go and the contents lie on a feathered page at their own size,
  live there: the list's heads sort, its `⇱` grips drag documents out, its console has the full tools (kinds, per
  page, table/shelf, upload), a click on a document takes the list into focus with that document beside it; a
  document shows the whole of its text (never cut, never shrunk to its title by zoom), links work, a press on it pans
  only after 5 px (D-217). Their open size isn't known from the data, so it's measured as drawn (`useOpenSize` in
  shownBox.ts) and feeds the drawn box (fit, go to, a new piece's place); until measured, the window's size.
- *Also:* `canOpen` (lenses + the two document kinds) decides `[unframe]`; sticking to planes stays lenses only.
- *User:* "diğer agentlar frame unframe gibi bişi implemente etmişlerdi … Onu bi araştır ve documentsı o hale getir".
- *Verified* headless (emulators): both unframed from edit mode, the open list sorted by title from the canvas, a row
  click went into the list's focus with the document beside it, the open document showed its whole text; both framed
  back to their windows; rules 421 pass (2 new); tsc; no console errors.
- *Then* (a bug the user found: a very long document unframed, the canvas panned along it, turned the whole screen
  black until a reload; fine zoomed all the way out): an unframed document draws at most 6000 px of itself (one huge
  layer was too much for Chrome's GPU), cut with a fade and `[continue reading ↗]`, which reads it in focus. Not
  reproduced headless (software drawing); the cut keeps the layer a size the GPU takes. Seen in the user's own Chrome
  afterwards: panned eight screens down, no black. Also there: an unframed document's box stayed its window's (the text
  ran out of its frame) when the piece came before its document and text, so its measuring now runs again once they're in.
- *Then* (the user: "canvasa çıkarılan documente tıklanınca açılanla documents listesinden açılan documentın UI'ı" the
  same): a document piece's focus is the very page a document beside the list is (DocPane in focus mode, DocFocus):
  the whole screen right of the side nav, scrolling as a page, "on this page", its dock `DOCUMENT | [share] [download]
  [delete] [−] 100% [+] [unfocus] esc`; the view-based focus (wheel scrolling the view, its own outline) is gone.
- *Then* (the user: "Canvasa konmuş bir documentın unshare olmaması lazım yada olursa canvasdaki componentlerin
  silineceği bildirilmeli"): unsharing a document that's on the canvas on its own asks first, in the hazard confirm
  ("It's on the canvas N times … taken off the canvas"), and takes those pieces off in the same undo step (⌘Z shares it
  again and puts them back); a viewer is told an editor has to take it off first. From a row's ◐, the right-click menu
  and a document's dock alike (`shareOrAsk`).
- *Then* (the user: "frame içinde olan bir document zoom out yapınca yazılar falan gidiyor … yazılar diğer her şey gibi
  hep gözüksün"): a framed document draws its text at every zoom, as everything else on the canvas; the title-alone
  and grey-bar levels are gone.
- *Then* (the user: "frame iken upload yada table shelf seçimi sunma. Onu focus da ayarlanabilir yap"): framed, the
  documents list's console is only `[focus] [edit]`; upload, table/shelf, kinds and pages are in its focus dock, and in
  its console once unframed.

### D-235 · 2026-10-22 · Accepted (what's linked to a plane leaves the focus dock for a strip over it, like the filter; changes D-211's dock buttons)
- *Decision:* the pieces stuck to a plane (D-210) no longer sit in the focus dock as `⇆ table · name` buttons; the dock
  has `[linked · N]` (when there are any), and it opens a strip over the dock in the console's look holding those
  buttons (each still opens its piece beside the plane, lit while open, D-211). The user: "split view yapılacak
  bağlantılı olan componentleri de direkt console'a koymak yerine consolun üstüne bir alana çıkartalım".
- *Strips:* what opens over the dock (the filter, D-233; what's linked) stacks upwards from 8 px over it (the user: the
  filter and the dock "biraz üst üste geliyor"), what's linked nearest the dock, the filter over it; each no wider than
  the plane's own part of the screen less 72 px a side (its half with something open beside it; clear of the side nav),
  wrapping onto a second line when it doesn't fit. Escape closes the filter first, then what's linked (an open menu in
  them first of all). `PlaneDockExtras` in FilterDock.tsx; one store (`useShelf`) for both.
- *Region filter:* the user said it doesn't work; headless it narrows as D-145 says (Germany keeps a German or
  Europe-wide or Global competitor, drops a US one, leaves other cards). What the user sees isn't known yet: asked.
- *Verified* headless (emulators): a table stuck to a plane gave `[linked · 1]`; its strip's `⇆ table` opened it beside
  the plane; with the filter open too the two stacked and fit in the plane's half; no console errors; build.

### D-236 · 2026-10-22 · Accepted (one finder for the workspace; it is go to too, replacing D-196's menu)
- *Decision:* ⌘F (ctrl F) anywhere in a workspace, or the side nav's compass under fit, opens the finder: a prompt in the
  middle of the screen (the menus' look, D-222) over the scrim. Opened empty it is only its `>` line, in the middle;
  typed into, it grows (width and height glide 320 ms, eased both ends) to its matches and a preview, staying centred.
  The browser's own ⌘F is never used in a workspace. The user first asked for find inside tables, matrices and
  documents "webstormdaki find gibi" (built as a bar on each piece's top edge plus dock and side nav buttons); then:
  "findın böyle hem nav barda hem de console olmasını beğenmedim … iki türlü de en üste açılıyor … finder ile de bir
  bağlantısı yok"; shown three options on a local preview, picked A (the finder in the middle with a preview under its
  list): "preview gerçek preview olmalı. Yani gittiğimde göreceğim şey … boş açılırken ortaya açılsın, içine bişey
  yazınca animasyon ile kendini yine ortalasın sonuçları ile birlikte".
- *What it finds:* every space's text, in reading order, grouped `# name · kind` with a count: the canvas's text (all
  kinds, the project title by the workspace's name and description); each plane's card titles and text; each table's
  heads, row names and cells (a card's fields as shown, its own cells' step label, number, text), every page; each
  matrix's heads and cells (what a cell shows, then its note); each documents list's titles, first words and who
  added it; each document's page text (its title, then its Markdown or report, read while something's typed, up to 60).
  A document no piece shows on its own is found beside the first documents list. Pieces by name come first as
  `# places`. With nothing typed it is go to as before (D-196, D-200): the places at once, narrow, no preview; a plane's
  own folded under it until its `▸ N inside` (or →) opens them; a click goes.
- *here / everywhere* (Tab): here is the space you're in, each other space folded to one row (`N inside`, Enter goes
  to its first match); everywhere opens them all. Match case, whole words, regular expression: `Aa W .*` (alt C W X).
- *Preview:* what the screen shows once you're there, drawn small by the same pieces at the same view: a table, matrix
  or list as its focus draws it, at the view it lands on (fitted as focus fits, then glided to the match when it's off
  the screen or too small, clear of the breadcrumb, dock, side nav and a matrix's held heads; its page turned); a
  plane's cards and text with its `+` marks at go to's camera; a document at its focus's 100 % scrolled so the match is
  40 % down; a document beside its list with the list pinned on the left; on the canvas, a copy of the canvas as it is
  under go to's camera. Drawn still (`Still`, nothing live; detail read as in focus). Every match lit, the picked one
  solid. It zooms (the wheel over it, or `[−] 100% [+]` in its head, 100–600 %) round the picked match, and keeps that
  zoom for every match in the same space while the finder's open (the user: "matrixte 5 sonucum var … aynı zoom
  seviyesinde bakmaya devam etmek isterim"). The pointer passing over a row shows nothing; a click shows it in the
  preview, a double-click (or Enter) goes ("1 tık preview, 2 tık gitme"); a row under the pointer gets a lighter
  wash (go to's too), picked only on a click. The wheel zooms ~2× a notch (a pinch more finely).
- *Speed* (the user: "ilk yükleme biraz fazla kasıyor … laglı"): what's typed is looked for 160 ms after typing pauses,
  behind the field (`useDeferredValue`), `searching…` meanwhile; a table's, matrix's and list's items built once while
  their data stays the same; at most 150 rows drawn (`N shown: type more`); the list drawn again only when it or the
  pick changes; the preview memoised, following the pick after it rests 90 ms (`drawing…`), the canvas copied a frame
  later, a plane's cards not building cell by cell in it; the zoom's focal point measured only while zoomed. Headless on
  the Huge workspace: typing went from two ~240 ms stalls a search to one ~110 ms the first time.
- *Going:* Enter or a click. A place glides as go to does (into its plane first when it's in one; out of a focus first
  when it's on the canvas); a match in a table, matrix, list or document goes into that piece's focus (the list's, with
  the document open beside it) and lands where the preview showed. Unframed pieces (D-228, D-234) go into focus too.
  Nothing stays lit there: the highlights are the preview's only (the user: "highlight sadece previewda gözüksün").
- *Removed:* the find bar on pieces' top edges, `[find]` in docks, the side nav's lens, go to's own menu (the compass
  opens the finder), and the highlights left on the page after going.
- *How:* `find.ts` (matching, painting with the CSS highlight API so nothing is drawn again, where a match lands),
  `findIndex.ts` (the groups, from data: `tableFindItems`, `matrixFindItems`, `documentsFindItems`), `Finder.tsx`,
  `FindPreview.tsx`, `still.ts`; `data-find` / `data-find-box` on what a table, matrix or list draws; CanvasView's world
  `data-canvas-world`; a document's line of who and when `data-find-skip`.
- *Verified* headless (emulators): empty it opens in the middle (601 × 79), typed it grows over ~300 ms to 1040 × 867
  with its middle held at 450 px; a table row's preview matched the focus it went to (page and position), lit there;
  a matrix cell found by its step's label previewed and landed the same, its cell framed; a report's match previewed
  and landed scrolled the same, the match solid; a plane card previewed with its marks and landed lit; ↓ with nothing
  typed listed the canvas's places, the preview the canvas copy; tsc.

### D-237 · 2026-10-22 · Accepted (the right-click menu inside a focused plane; adds to D-193's `comment`, brings back D-117's)
- *Decision:* right-clicking in a focused plane offers what can be done with what's under the pointer, `comment` second:
  a card `open` (its panel), `fold / unfold N parts` (when it has parts), `copy`, `duplicate`, `delete`; text `edit`,
  `copy`, `duplicate`, `delete`; a link `add / edit its label`, `turn it round` (not `for`), its kind as a checked list
  in each kind's colour, `remove`; something in a selection of several, only `N selected` with `copy them`,
  `duplicate them`, `delete N` (no comment). On the plane itself: `paste … here` (when something's copied, its top-left at
  the pointer), then a card of each type and a heading, paragraph or sticky note right there (a card's title or the
  text ready to type). Changes are editors'; anyone gets `open`, `copy` and `comment`. Each item has the `+` menu's
  letter where it has one. The user: "sağ tık menüsüne geçelim".
- *Code:* `planeMenu.ts` builds the items (`planeCtx`, `planeItems`); CanvasView's right-click adds them.
- *Verified* headless (emulators): on the plane, `problem` made a card at the pointer with its title typed; on a card,
  `duplicate` made a copy; on a link's chip, `contradicts` changed its kind; no console errors; build.

### D-238 · 2026-10-22 · Accepted (changes D-176's "moved right past any it would cover"; adds to D-232's place)
- *Decision:* anything added to the canvas (plane, matrix, table, documents list, a document placed from its list)
  lands where you're looking: centred on the middle of the screen, or the nearest clear spot round it within about its
  own size (grid steps, nearest first, `nearClear` in pieces.ts), else on top there; and it starts in **edit mode**,
  selected, to be moved where you want it. A document placed from a list's focus brings the canvas back to show it.
  The row's `↗` and the dock's `[place ↗]` place there (asking first when private); dragged out of an unframed list,
  where it's let go, in edit mode too.
- *Why:* with many pieces a new one was slid right past all of them, out of view, and lost.
- *Alternatives:* gliding the view to it after adding (go to); the user preferred it placed in view, in edit mode.
- *User:* "Ben canvasa bir şey koyduğumda … görüş alanımın dışına koyuyor ve kaybediyorum. Yada direkt baktığım yere
  koysun componenti ve edit modda başlasın ki istediğim yere taşıyabiliyim. Bu ikincisi daha mantıklı geldi".
- *Not yet:* a big piece's nearest clear spot can sit partly past the screen's edge (still in view, in edit mode).
- *Verified* headless (emulators): a plane added with the middle taken landed beside it on screen, in edit mode; a
  shared document placed from its list's focus left focus and showed on the canvas in edit mode; tsc.

### D-239 · 2026-10-22 · Accepted (packages on planes; brings back D-141 in the new look)
- *Decision:* a package is a slice of the chain as one thing to rate and rank, made only from a selection (`package
  these N` in the `N selected` panel, `package these` in its right-click), never from `+`. Named `Package N`, it holds
  its cards by id (≤ 60; gone ones skipped). **Unfolded** (how it starts) it has no card: a thin blue frame round its
  members, under every card, the pointer going through, and a band on top that is the package (`PACKAGE`, its name,
  impact · effort, a cell per member in its type's colour, `[−] N`); the band selects it (its panel), drags all its
  members (and what they carry), takes links, comments and peers' marks. **Folded** (`[−]`) it is a blue card where the
  band was, its members inside as rows (a bar in their colour, name, status or priority) and `[+] N inside` to lay them
  out again where they were; dragged, it carries them. Its panel: rating (impact, effort), `holds` (rows going to the
  card, `×` takes one out, `+ card` adds one from its plane), other links, tags, notes; the line under the title says
  what it holds by type and its confidence (high / medium / low / broken, from the status of its customers, problems
  and ideas, D-138's rule). SHOW lists packages too. A folded card's members can be in other packages (shown in the
  first).
- *Why:* the user picked B folded and C unfolded from three looks (packages.html): "folded looks like B, unfolded
  like C".
- *Alternatives:* the old board's card plus a dashed frame (A: confusing when members are far apart); only a card that
  holds cards (B), only a frame (C).
- *Code:* `packages` collection (rules already allow it, D-141; no rules change), `AnyType` in cards.ts, `addPackage`,
  `foldPackage` (one undo step each), `packageThese` in selection.ts; cardInside's `members`, `packageBox`; PlaneCards'
  `PackageFrame`; cardFacts' `confidenceOf`.
- *Not yet:* a card in no package but inside a frame looks like a member; the assistant doesn't make packages; packages in
  the priorities view (not back yet).
- *Verified* headless (emulators): four cards selected → `package these 4` made a framed package, selected with its
  panel; the band dragged all four (100, 50); `[−]` folded them into a card at the band; the card dragged them all;
  `[+] 4 inside` laid them out; a click on the band opened the panel (`1 problem · 1 idea · 2 features · confidence
  low`); four ⌘Z put everything back; no console errors; tsc.

### D-240 · 2026-10-22 · Accepted (adds to D-239)
- *Decision:* a package also comes from the side nav's `+` in a focused plane: `package` (blue, `[k]`, `select`) starts
  picking, as `section` starts drawing: clicks put cards in or out, a drag on the plane boxes them in (no alt), a
  package isn't picked, what was selected starts picked; a strip in the console's look (blue corner marks) over the
  focus dock says `PACKAGE  2 picked  [package 2] [cancel] esc`; Enter or `[package N]` makes it (selected, its
  panel), Escape stops; the right panel stays shut meanwhile; the pointer a cell cursor. And a card put in a package
  brings its parts (same-type `part of`, all the way down): they're in its frame, move with it, fold into it (a part
  under its parent, `└`; a folded member's parts stay in it, `+N` on its row), count in `N inside`, its panel's
  `holds` (under their parent; `×` only on what was put in, taking its parts out with it) and its facts.
- *Why:* the user: "package folded olmuş featurelara respect etmiyor … Eğer bir parent feature ı koyuyorsam package a,
  onun partları da bu package a dahil olmalı"; "package yapmayı daha intuitive yapalım. + düğmesine ekleyelim ve
  sectionda oluştururken nasıl draw diyosak, bunda da select diyelim".
- *Code:* `packing` in canvasView, `PackPick.tsx`; cardInside's `packageTree` and package rows with depth; parts are
  derived, never written into `memberIds`.
- *Verified* headless (emulators): `+` → package, clicked an idea and a feature with two parts, Enter: `Package 1`
  with two named members framed with the parts too; panel `holds 4` with the parts under their parent; folded, rows
  `Deposit, Card hold, └ Hold part A, └ Hold part B`; no console errors; tsc. Not tried: the box drag while picking, a
  folded parent's `+N`.

### D-241 · 2026-10-22 · Accepted (adds to D-239, D-240)
- *Decision:* packages hold packages: a package can be picked (`+` → package, shift-click, `N selected`, right-click,
  `holds`' `+ card`; never one it's inside), what's named under another named one goes under it; an unfolded package
  inside one is its own frame and band inside the outer's (the outer's band above it, no overlap), a folded one a row
  with `+N` (later D-243: the whole tree). Folded, a package's rows stopped at anything itself folded (D-243 changes it). A
  box drag takes an unfolded package only when all of it is inside the box. Links with both ends folded into the same
  thing (a feature's parts, a package's cards) aren't drawn. A card's panel says `in package ↑ Package 1 ↑ Package 2`
  (blue, nearest first) under its parent line; a click goes there (an unfolded package framed by its whole box).
- *Why:* the user: "package fold olunca, paketin içindeki cardların linklerinin labelını … görüyorum"; "paket içinde
  paket varsa headerları üst üste geliyor … Paket içinde paket yapılabilmeli"; "paket içinde bir cardda üstündeki
  paketi … bir şeyin partı olan feature sağ panelinde nasıl görüyosam görsem ve tıkladığımda gitse".
- *Open:* telling members from other cards inside an unfolded frame: five looks on members.html (A dimmed outsiders,
  B tabs, C a line hugging the members, D a spine, E plates); the user picked A (D-242).
- *Verified* headless (emulators): package 2 holding package 1 + a problem: frames nested, bands apart; package 1
  folded: its inside link (inspired by) gone, the link out of it (solves) from its card; Deposit's panel `in package ↑
  Package 1 ↑ Package 2`; package 2 folded: rows `Package 1 +3`, `No-shows`; no console errors; tsc.

### D-242 · 2026-10-22 · Accepted (adds to D-239)
- *Decision:* a card inside an unfolded package's frame that isn't in that package is drawn faint (32 %) with a dashed
  edge 3 px out; it comes back while hovered, selected or pressed. Packages' frames themselves aren't dimmed; a folded
  package's card can be.
- *Why:* in an unfolded package, cards that only sat in its area looked like members. The user picked A from
  members.html: "dimmed olması ok benim için".
- *Alternatives:* tabs on members (B), a line round the members only (C, my pick), a spine (D), plates (E).
- *Verified* headless (emulators): a competitor placed inside a package's frame, not in it, drawn faint with the
  dashed edge, the members full; no console errors; tsc.

### D-243 · 2026-10-22 · Accepted (changes D-241's folded rows)
- *Decision:* a folded package shows all it holds as a tree, as a folded feature shows its parts: a package inside it
  with what that holds under it (indented, each row's type colour; D-245 drops the `├ └`; a package's row says `N inside`), a card's
  parts under it, all the way down, whether those inner things are folded or not. A folded package inside a folded
  one has no rows of its own: it's in the outer's tree.
- *Why:* the user: "package lar içindekileri partlar bulunduran feature lar gibi gösterebilsin … şu an sadece birinci
  package ı görüyorum ama altında ne var belli olmuyo folded ise".
- *Verified* headless (emulators): package 2 (package 1 + a problem) folded: rows Package 1 `3 inside`, ├ Deposit,
  └ Card hold, └ Part A, No-shows; no console errors; tsc.

### D-244 · 2026-10-22 · Accepted (adds to D-239)
- *Decision:* an unfolded package's frame sits on the plane's `+` marks on every side: a grid step (25 px) round its
  members, each edge pushed out to the next mark (so a member off the grid, or a card grown taller, still gives edges
  on marks), the band one grid step tall over it; nested frames land a step apart.
- *Why:* the user: "package ın çizgileri griddlere diğerleri gibi tam oturmuyor … sağdan ve soldan az kalıyorlar. Grid
  snap açıkken bile + ların tam hizasında değiller" (the pad was 20 px and the band 30).
- *Verified* headless (emulators): a package inside a package, both frames' four edges on marks; tsc.

### D-245 · 2026-10-22 · Accepted (changes D-164/D-225's folded part rows and D-243's)
- *Decision:* every folded list on a plane card (a feature's or other card's parts, a package's tree) draws each row
  with a short upright bar in that row's own card colour (a feature's part cyan, a package blue, a problem magenta…),
  no `├ └`; each level down sits 10 px further in (`INDENT`, also where a folded part's card tucks into its row), so
  what's under what shows by the bars' steps. A row's right side: its status, validation or priority; a package's
  `N inside`.
- *Why:* the user: "renkleri kaybetmeyelim bu arada folded listesinde. Yeni karar: card içinde bir part varsa dik ve
  part cardının kendi renginde çizgi. Eğer onların içinde de partlar var ise yine part cardın kendi renginde ama bi
  tık indentli".
- *Verified* headless (emulators): a folded package holding a package (blue bar), its idea (white) and feature (cyan)
  a step in, the feature's part a step further, a problem (magenta) back at the start; no console errors; tsc.

### D-246 · 2026-10-22 · Accepted (changes D-080's bundle to version 2; the agreed first step of 2026-10-22)
*D-248:* the old board's data (cards and text without a space, `planes`, `placements`) no longer travels, and version 1 files are refused.
**Export and import carry everything the canvas has now.** User: "lets do export/import implementation. We have changed a
lot and i want our new export/import to work perfectly with our current features and structure".
- *Where:* Settings → workspace → export (`[download .zip]`, then a line saying what was packed); an `import` strip under the
  create and join forms on the workspaces page (as D-080's). TSV and PNG stay archived with the old board.
- *Bundle v2* (`src/io/bundle.ts`): `workspace.json` with every content collection whole, read fresh at export time
  (`src/data/exportWorkspace.ts`; the workspace keeps only what it shows): pieces, cards of every type and packages,
  competitor features, comparisons, edges, evidence, labels, cells, and the old board's `planes`/`placements` and its
  cards and text without a space, so nothing is lost before the step that brings the old board onto a plane. `documents`:
  the shared ones and yours, `.md` and reports, each with its content as `body`, without the author's uid. Images and PDFs
  stay behind until Storage is live (counted on the page). Never members, roles, codes, comment threads (D-159), AI.
- *Import* (`src/data/importWorkspace.ts`): new ids for everything first, then each doc rebuilt from known fields in the
  rules' shapes with every reference mapped: cards' `pieceId`, text's space (`canvas` kept), packages' members and home
  (a plane piece or an old plane), matrix axes (plane, hide, card items), table rules (plane values), hide and card rows,
  `stuckTo`, `docId`, cells (`matrixId_row_col` re-derived; typed rows/columns keep their ids), comparisons, report
  implications. Anything pointing at what isn't in the file is left out and counted ("N things were left out"), as is a
  `document` piece whose document didn't come. A `board` piece becomes `plane`. Documents become the importer's, shared as
  they were, the author's name kept. Batches cut at 450 writes or ~4 MB; documents 6 to a batch (their content's rule
  reads the summary); a failed write deletes the half-made workspace. Version 1 files still import: the old board's cards
  and text as they were, reports as documents, attachments counted as left out. No rule change.
- *Alternatives:* exporting only what's shown on the canvas (would lose the old board before it's brought over); `.md`
  files as separate zip entries (the bodies in `workspace.json` keep one source; maybe later for reading outside the app);
  threads in the export (D-159 keeps them out; ask the user if wanted).
- *Verified* on the emulators in headless Chrome: a workspace with two planes (one a `board`), a matrix stuck to a plane and
  open, a table with plane rule, hidden card and card row, a documents list, a document piece, cards of every type with
  every field, a package (one member gone), competitor feature + match + criteria scores, three links (bends, part-of, from
  a competitor feature), evidence, six labels (canvas heading and title, section, sticky, turned paragraph, old board's),
  four cells (card × card, typed × typed, table card × own column, typed row), a .md and a report, an old plane and
  placement: exported, read back, imported, exported again: same counts in all 16 lists and every reference the same once
  ids are named; only differences: `board` → `plane`, the gone member dropped, `notRelevant: false` dropped, document
  sizes recounted. A v1 file through a .zip: old cards stay without a space, the report a shared document under its
  author's name with its card mapped, the dangling link and the attachment counted. A non-export refused. The export
  button downloaded the .zip; both screens checked. `npm run build`.

### D-247 · 2026-10-22 · Accepted (adds to D-204, D-209, D-221)
**A card's head in a matrix or table opens its panel with one click, as on its plane.** User: "table ve matrixlerde eğer
plane deki cardları kullanıyosak tek tık bana sağ paneli açsın aynı plane de oldugu gibi".
- *What:* a click on a card's row or column head (a matrix) or a card's row name (a table) selects the card
  (`cardSelected` = its id) and its D-221 panel opens, wherever the lens is live: its own focus, beside a plane (D-211; the
  plane still glides to it when it's there), open on the canvas (D-228). Not through the head's `×`, nor while a typed
  name is being edited. The head (a matrix's) or row band (a table's) stays lit while it's the card selected. Typed
  names (no card) do nothing on a click. Escape or a press elsewhere lets go, as before.
- *Then a cell* (user, the same day: "eğer row yada column başka bir card ile paylaşılmıyosa side panel açık kalmaya
  devam etsin"): with the panel open, a cell picked whose row or column, only one of them, is a card keeps it open on that
  card (a table's rows are its only cards, so going down a table's rows the panel follows them; a matrix of ideas ×
  typed criteria the same). A cell crossing two cards (features × competitors) or none closes it. Closed, a cell doesn't
  open it again, only a head does; its `[×]` there closes the panel and leaves the cell selected.
- *How:* `LensCardPanel` (CardPanel.tsx) shows CardPanel with every card when the selected card isn't on the plane in
  focus (that plane's own panel shows those); kept mounted so the panel breaks apart as it closes; rendered inside a
  focused piece and, out of focus, at the canvas's root. CardPanel glides the view clear of the card only on the card's own
  plane (in a lens's focus the view is the lens's).
- *Verified* on the emulators in headless Chrome: a features × competitors matrix and an every-card table in their focus;
  a head's click opens the feature's / competitor's panel; Escape closes it (focus stays). Then: table row 0's head, its
  cell (panel stays), row 1's cell (panel goes to its card), `[×]` (cell still selected), a cell (stays closed); matrix
  head then a feature × competitor cell (closes). `tsc -b`.

### D-248 · 2026-10-22 · Accepted (drops 1.0: changes D-048, D-049, D-070, D-083, D-177, D-180, D-246)
**Nothing of North Star 1.0 stays, except moving old reports to documents.** User: "aslında önceden kalma bütün her şeyi
droplayabilirim … 1.5 diyoruz, deprecated bişey bırakmasak da olur … db de dahil … Raportları documents a taşımak dışında
bir şey bırakma geride". Instead of the agreed v1 step (bringing the old board onto a plane), 1.0's data is dropped.
- *Code:* `src/archive/` deleted (in git at `493bf87`); no old-URL upgrade or old view paths (App.tsx, paths.ts); no
  attachments (Storage files, the workspace delete's sweep); presence only `canvas`; join requests without `ownerId`;
  packages without `homePlaneId`; threads always on a component (`spot` gone) with a `planeId`; `Workspace.joinCode` gone.
  The live code still skips a card, text or thread without a space when one is read (those docs stay in old workspaces).
- *Rules:* `firestore.rules`: cards, competitors and text need `pieceId` (competitors x/y too); no `color`, domain fields,
  label `planeId`; no `planes`, `placements`, `attachments`, `domains`, `groups` (not even read or delete: old docs left in a
  workspace stay there, unseen); no `board` piece; comparisons only `competitorFeatureId` and `criteria`; reports only read
  and delete (for `moveReports`); threads `on` card/label/link/plane with `targetId` and `planeId`; join requests without
  `ownerId`. `database.rules.json`: `view` only `canvas`. `storage.rules`: nothing allowed until documents' files.
- *Export/import:* only 1.5's shape: cards and text without a space stay out of an export, are left out of an import;
  version 1 files refused ("comes from North Star 1.0").
- *Kept:* `moveReports` (D-232) and what it needs; the Cloud Functions in `functions/` and the `ai`/`aiUsage`/`aiSecrets`
  rules (the assistant's server side, D-079, waiting for Blaze; not 1.0 data); comments in code that say where a look came
  from ("as the old board did").
- *Not deployed:* the live site (`main`) is still 1.0 and shares the Firebase project; these rules would break it. Deploy
  them (`npm run deploy:rules`) together with merging 1.5 to `main`, with the user's yes.
- *Alternatives:* the agreed v1 step (move the old board's cards, text and threads onto a plane), not wanted; deleting 1.0
  docs from workspaces (not asked; they're unseen and cost nothing).
- *Verified:* rules tests on separate emulators: 365 pass, 0 fail (1.0 shapes now denied: cards/text/threads without a space,
  spots, board pieces, old planes/placements/attachments/domains/groups, old presence views, report writes; old reports
  seeded past the rules still read and delete). Export/import round trip in headless Chrome: same counts in all 14 lists,
  references the same; an old report seeded past the rules moved into documents by `moveReports`; a version 1 file refused.
  `npm run build`.

### D-249 · 2026-10-26 · Accepted (brings D-133 back onto D-204's matrix; changes D-221's must-haves)
**A matrix axis can unfold its cards into what they're made of; first, a feature into what it's judged on (its criteria).**
User: "şu anda feature cardlarında criterialar yok … Must do var ama anladığım kadarıyla onlar Acceptance criterialar olmuş
artık", then "önce criteria'yı matrix'e geri getirelim. Ama … matrix olabildiğince generic de tutulmalı". The panel's
`must do` was D-133's `criteria` all along, scored per competitor in a fold of the panel; the generic matrix (D-204) never
read them, so the white space was nowhere to be seen. Picked (asked): scores in the matrix's own cells; the name `judged on`.
- *Axis:* `unfold: 'criteria'` and `open: string[]` (the cards shown open, shared, one undo step each). Its features with
  criteria carry `[+] N` / `[−]` in their head. Open, each criterion is a row (or column) of its own under the card, keyed
  `card~criterion`, numbered, mono, a faint line in the card's colour, renamed by a double-click (written to the card), no
  `×`; a click opens the card's panel (D-247). Works on either axis and against any other axis (competitors, customers,
  typed names), with any scale, numbers too.
- *Cells:* what a criterion is scored at is an ordinary cell (the matrix's scale, note, `—`, how sure). The card's own
  cell reads from them (`rollUp`): a scale's step at the average of theirs rounded down (one `none` among `full`s isn't
  full), numbers' average, words not summed; shown as one small square per criterion filled to its step (D-133's blocks),
  folded or open. Until any is set the card's own value shows and can be set (as D-133's unscored cells kept theirs); once
  rolled, only `-` is its own and its bar says `full · read from what it's judged on, 3 [unfold to score]`. Totals across
  count each card once, never its criteria.
- *White space:* a criterion is met by a cell in the scale's upper half (`full`, `better`; `yes`; `high`; 4–5); scored
  somewhere and met nowhere = `◇` on its head, the card's head `◇ N open` (magenta). Scales only.
- *Panel:* `must do` → **judged on** (`what users judge it on`, add `criterion`); each says `met by N` / `◇ open` read from
  every scale matrix's cells on it, nothing while unscored; the competitor pills are gone; with no unfolding matrix a quiet
  line says where they're scored. `×` takes a criterion with its cells in every matrix (and any old comparison scores).
- *Template:* features × competitors unfolds by default. Setup → rows/columns: `unfold [x] features into what they're
  judged on`, `open all`, `fold all`.
- *Data:* rules' `validAxis` takes `unfold` (`criteria`) and `open` (≤ 200); cell ids hold `~` (no rules change). Export
  keeps `unfold`/`open` (open ids remapped); import maps `card~criterion` to the card's new id, the criterion's id kept.
  `comparisons.criteria` is no longer written or shown (still read by rules and the bundle; old scores aren't moved).
- *Generic on purpose:* `UNFOLDS` is a list; later a card's parts (`part of`) or a competitor's features can unfold the same way.
- *Alternatives:* scores on the feature × competitor pair (`comparisons`): same everywhere but only that crossing and a
  fixed met/part/no scale; a separate acceptance-criteria list (later, if at all: a part's "done when", the user's call).
- *Verified* headless (emulators): seeded 3 features (3, 2, 0 criteria) × 3 competitors; open feature showed its three
  rows, `◇ 2 open`; `[+] 2` unfolded the other; a criterion cell set with `3` rolled its feature's cells (`full, read from 2`);
  a rolled cell ignored `1`; the panel read `met by 2 / ◇ open / ◇ open`; removing criterion 2 there deleted its cells.
  Rules 368 pass (3 new). `npm run build`. Rules not deployed (D-248: main is still 1.0; validAxis has no hasOnly, so the
  deployed rules already take these fields).

### D-250 · 2026-10-26 · Accepted (adds to D-046, D-187, D-188, D-212, D-218, D-221)
**Something just made and named: Enter makes it, Escape takes it away as if never made.** User: "başlık ekledikten
sonra enterla direkt oluşturabilme/esc özelliği. Bu bütün cardlar ve textle ilgili şeyler için geçerli olmalı".
- *What:* a card or text made from `+`, right-click or a drawn section is `fresh` (canvasView) until its first typing
  ends. A card: Enter keeps the title and shuts its panel, the card still selected (`panelShut`, cleared when the
  selection changes or the card is clicked again); Tab keeps it and makes the next card of its type a grid step to its
  right (or the first clear spot past it), its title ready; Escape, or Enter or leaving with nothing typed, removes it.
  Text: a heading, section, paragraph, sticky note or the project title just made goes on Escape; a heading, paragraph
  or sticky note also when left empty (a section may stay unnamed). Paragraphs and sticky notes keep ⌘Enter (the user:
  Enter stays a new line). Things that already exist are as before: Enter (or leaving) keeps, Escape puts it back.
- *Undo:* making and the first name are one step (`addCard`/`addLabel` keyed as the title/text is, the first save
  `mergeAlways`); a removed fresh item takes its step with it (`discardNew` in history.ts), so nothing is left to undo.
  A card made from a picker's "new …" row is one step too.
- *Wizards* (matrix, table): Enter goes to the next step, on the last makes it; ⌘Enter makes it from any step; inside a
  field Enter is the field's own.
- *Already so, left alone:* matrix/table add fields and names, piece names, link labels, tags, regions, evidence,
  competitor features, criteria, documents' titles (Enter keeps or adds, Escape puts back or closes).
- *Not taken (offered):* Enter on a selected card or text starts typing it; an `enter make · esc cancel` hint.
- *Verified* on the emulators in headless Chrome: idea + "Hello" + Enter (panel gone, card selected, a click on it opens
  the panel again); + idea Escape and + idea Enter-empty leave nothing; "A" Tab "B" Enter makes two cards side by side;
  heading and sticky note Escape leave nothing; paragraph ⌘Enter kept; heading "Head" Enter then one ⌘Z removes it,
  as does one ⌘Z after a card made and named; the matrix wizard steps on with Enter and the last Enter makes it. `tsc`.

### D-251 · 2026-10-26 · Accepted (adds to D-176, D-208, D-219, D-228, D-246)
**A kanban: the team's tasks in columns, a piece on the canvas.** User: "kanban/task planner eklemek istiyorum
uygulamaya". Asked first and picked (all the recommended ones): a new `task` type (not the cards themselves); a canvas
piece like a matrix or table; ready columns you can change; a task has who it's given to, a due day, the card it's for
and a checklist.
- *Data:* `tasks/{id}` (src/data/tasks.ts): `pieceId` (the kanban), `col`, `order` (a number between its neighbours',
  so a move writes one doc), `title` (≤ 200, required), `notes?`, `assignee?` + `assigneeName?` (kept beside it so the
  card needs no member lookup), `due?` (`YYYY-MM-DD`), `cardId?` + `cardType?`, `checks?[{id, text, done?}]` (≤ 50),
  `uid`. The piece (`kind: 'kanban'`) holds `kanban: {cols[{id, name, done?}]}` (1–12; `todo · doing · done` to start,
  `done` marked finished). Rules `validKanban`, `validTask` (hasOnly); members read, editors write. Deleting the kanban
  takes its tasks (one undo step); deleting a workspace too.
- *Look:* a window like a table's (D-208, no `+` marks); columns 264 px, a head of faint caps and a count over a rule (the
  finished one green with `✓`), tasks as raised paper 84 px high: the title in Geist (two lines), a mono line under it:
  the person's square with initials, `◷ 28 oct` (`today`, `tomorrow`; magenta once past, unless in the finished
  column), `☑ 2/5` (green when all), `▌card title` in the card's colour. Hover and selection: a card's corner marks,
  cyan when selected. Focus: its own (D-206's glide), `[unfocus]` in the dock. Unframes onto the canvas (D-228).
- *Live (focus, unframed):* a press on a task drags it after 5 px (the card under the pointer framed in cyan, a dashed
  cyan slot where it lands, the others sliding 160 ms; reduced motion: no slide), a click opens its panel; viewers only
  click (the press pans). `+ task` at a column's foot types new ones (Enter makes one and keeps typing, Escape stops,
  as D-250). A head: double-click renames; on hover `‹ ›` move it, `✓` marks it finished, `×` takes it away (its tasks
  go to the end of the column before it; the last column never goes). `+ column` after the last (≤ 12). Delete takes the
  selected task away, Escape lets go of it (before Escape leaves focus).
- *Panel* (D-219's shell, kind `task`, cyan): the title typed in place, then `01 COLUMN` (pills), `02 GIVEN TO` (a
  Select of members, or nobody), `03 DUE` (the browser's date field, `[clear]`, a magenta line when past), `04 FOR` (the
  card: a click opens that card's own panel in its place, LensCardPanel; `+ card` picks one from any plane, `×` lets
  go), `05 CHECKLIST` (`[x]` rows, a click on the text types over it, `+ step`), `06 NOTES`; `[delete]` at the foot.
- *Export/import* (D-246): `tasks` travel with their kanban (columns kept, a task in a missing column goes to the
  first), the card they're for when it came over too; who it was given to stays behind (people don't travel).
- *Not yet (offer later):* others don't see your selected task or a drag in progress; the assistant doesn't read or write
  tasks; tasks aren't in the finder; no sticking to a plane; no swimlanes, labels or filters; open on the canvas its size
  is the window's, not measured.
- *Verified* on the emulators in headless Chrome (1600 × 1000): `+ → kanban` makes one with the three columns; in focus
  three tasks typed with Enter, one dragged from todo to doing (slot and ghost seen mid-drag), one dragged to the top of
  doing; a click opens the panel; two steps added and one ticked (`1/2` on the card), a past due day (magenta on the card
  and in the panel), given to Alice (`AL`); Escape closes the panel and stays in focus; unfocused, the canvas picture
  shows them. Rules tests 382 pass (14 new). `tsc`. Rules not deployed (D-248: main is still 1.0).

### D-252 · 2026-10-26 · Accepted (changes D-251's look)
**The kanban's look: the ledger.** User: "kanbanın UI'ı iğrenç gözüküyor. Hiç mi güzel gözükmez?" Three looks were
shown on a local page with the same tasks (A ledger, B section frames, C terminal rows); the user picked A ("A'yı yap").
- *Columns:* no frame, no fill; whitespace (28 px) between them. The head is the right panel's section rule:
  `01 TODO ──── 5` (number faint, name in caps, the finished column's name green). Live, the tools (`‹ › ✓ ×`) come in
  after the count on hover; a double-click renames. A task held over a column lights its rule cyan.
- *Tasks:* raised paper, no border, as tall as their text (title Geist 14 px, up to three lines). The left edge (2 px) is
  the colour of the card it's for; none without one. Under the title, only when there's something: the card's name on
  the left; its due day, its checklist as cells (`▮▮▯▯▯ 2/5`, up to 8, green when all), the person's square on the
  right. Finished: a green `✓` before the title, the title grey. Overdue: the due text magenta, nothing else.
- *Adding:* `+ add a task` is a faint line under the last task; a click turns it into a sheet in place with a cyan edge
  and the menus' `>`. `+ column` is a faint head after the last column. Empty column: `· nothing yet`.
- *Drag:* the drop place is a 2 px cyan line with a tick at each end between two tasks (no dashed box); the held task
  follows the pointer framed in cyan; hover marks hide while holding. Tasks are laid out by the page now (no fixed
  heights), so where it lands is read off the drawn tasks' middles, and the window hears the pointer while it's held.
  Fit uses the kanban's measured size.
- *Not taken:* B (each column a section frame with `+ task` as a tab in its bottom edge), C (one line per task, a `>`
  prompt at each column's end). Either could come back as a "dense" switch.
- *Verified* on the emulators in headless Chrome: seeded tasks with cards of five types, due days, checklists and
  people; dragged a task to another column and to the top of the finished one (line, lit rule, `✓` after); typed a task
  with Enter; selected one (panel); canvas window with room round it; light theme. `npm run build`.

### D-253 · 2026-10-27 · Accepted (plans D-138's priorities onto D-251's kanban; spec docs/specs/priorities.md)
**Priorities come back as the kanban holding cards, its columns and rows from two of their fields; no grid piece.**
User: asked for priorities next; on a local preview of a generic grid vs a priorities-only piece, "grid ile matrix
arasındaki fark ne?", then "grid i kanban componenti ile entegre edebilir miyiz? … aynı şeyin üstüne kurulabilir mi?";
after reading docs/specs/kanban.md, a plan beside it; "ikisinde de önerin olsun".
- *Why one piece:* a kanban and an impact × effort grid are both things in boxes, the box a thing's value, dragging it
  changing that value; a kanban is one axis, priorities two. A matrix differs: cards on its edges, the pair's value in a
  cell (D-204).
- *Plan* (sessions P1–P3 in priorities.md, after kanban session 1): a kanban holds tasks or cards, never both; for cards
  its columns (and later rows) come from a field (status, impact, effort, priority; never type) and which cards from the
  table's rules (D-209); a `no value` lane; no hand order for cards; task-only things (given to, due, checklist, WIP,
  timeline) stay task-only. Kanban session 5's swimlanes are built as "rows by a field" for both. P3: the priorities
  template (features + packages, effort × impact, corners named) and the suggested order (D-138's score, `P2 → P1`,
  never written to the card).
- *Dragging sets the field* (recommended, taken): dropping on a box sets the card's values, one undo step.
- *One confidence rule* (recommended, taken): D-138's share for features and packages (validated 2, testing 1, else 0;
  ≥ 0.75 high, ≥ 0.34 medium; any invalidated `!`, score 0), replacing the feature panel's weakest-link (D-221's
  `RestsOn`) and the package's own share (D-239's `confidenceOf`) when P3 is built.
- *Alternatives:* a separate generic grid piece (a second "things in boxes" piece beside the kanban); a priorities-only
  piece (fixed, quicker, nothing else); a board that only shows (values set in panels).
- *Not built yet:* plan only.

### D-254 · 2026-10-27 · Accepted (adds to D-137, D-221, D-251; kanban session 2, docs/specs/kanban.md)
**Tasks and cards, both ways: a card's panel lists its tasks and makes them; the card counts them; a finished test asks
what it taught and logs it as evidence.**
User: picked ideas 1 and 2 of the kanban list (2026-10-26); this is session 2 of docs/specs/kanban.md.
- *A card's panel* gets `tasks` (before tags, every type): its tasks on every kanban, unfinished first, `[ ]`/`[x]`
  (finished = in the finished column), title, due day (magenta past it), `kanban · column` (the kanban's name only when
  there are several). `+ task` types into a kanban's first column, at its end, for this card (Enter makes one and keeps
  typing, Escape stops); with several kanbans, pills above the field pick which (the last one used is kept per tab).
  No kanban: a faint line says to put one on the canvas.
- *A row opens the task's panel in place of the card's* (the card's selection goes); the task's `for` row brings the
  card's back. So TaskPanel is mounted in every piece's focus (planes too) and on the canvas; a card picked closes it,
  leaving a focus closes it, Escape closes it (unless typing).
- *The card's facts line* ends with `☐ 2/5` (finished/all), its own span so the line's `…` never cuts it; green `☑`
  when all are finished. Counts from `taskTally` (tasks + kanbans' finished columns), memoised on the counts only.
- *Validation tasks:* a customer, problem or idea with no status, `hypothesis` or `testing` ("still being tested", also
  unset: an unset status is a guess too) offers `+ test it`: "Test: <title>", made at once with one kanban, typed first
  with several; hidden while an unfinished `Test:` task of it is open.
- *What it taught:* a task for such a card, in a finished column and not asked yet, shows a cyan `+ log what it taught`
  on its sheet and a `learned` section in its panel ("Finished. What did it teach about …?" `[not now]`). It opens the
  card's evidence form (D-137) filled with "title: notes", today, `observation`, supports; adding writes the evidence and
  the task's `learned` (the evidence's id) as one undo step (`logLearned`). `not now` sets `learned: 'skip'`. Logged, the
  section shows the evidence with its cell. A status changed to validated/invalidated also ends the offer.
- *Rules:* `learned` (text ≤ 128) on tasks; tests added.
- *Alternatives:* opening the task panel by itself when a task lands in done (too pushy); going into the kanban's focus
  from a card's row (loses the card's place); a toast after the drop (gone before it's read).
- *Verified:* headless on the emulators: counts on cards, the section, `+ test it` with two kanbans, row → task panel →
  `for` → card panel, the sheet's offer → form prefilled → evidence on the card + `learned`; drag into done shows the
  offer; light theme; rules 384 pass; build.

### D-255 · 2026-10-27 · Accepted (adds to D-210, D-211, D-215, D-251; kanban session 3, docs/specs/kanban.md)
**A kanban sticks to a plane like a table: it then shows that plane's tasks, and opens beside the plane in its focus.**
User: picked idea 4 of the kanban list (2026-10-26); this is session 3 of docs/specs/kanban.md.
- *Sticking:* `sticks()` (a lens or a kanban) takes D-210's path as is: moved in edit mode within 48 screen px of a
  plane's edge it snaps a grid step out and is linked (`stuckTo`; alt = free), the console's `link ▾` / `⇆ Pazar ▾`
  links and unlinks, the plane carries it, the quiet link (D-215) shows. Nothing else changes on the kanban when it
  sticks (no rule written, unlike a table's `where plane is`).
- *What it shows (`shownTasks`):* stuck, only tasks whose card is on that plane, tasks for no card, and tasks whose card
  is gone (so nobody loses them). `[this plane only · N hidden]` in its dock (its focus, its pane beside the plane),
  lit while on; off it shows every task. Shared, on the kanban (`kanban.everyPlane`), editors switch it. On by default
  once stuck. Hidden tasks keep their place: a new one goes after every task in its column, a deleted column moves them too.
- *Beside (D-211):* the plane's `[linked · N]` strip lists it; open, it's a pane like a table's (its own view, dock
  `KANBAN · ROADMAP | [this plane only] [close]`, no setup). A task picked there opens its panel over the plane's part
  and glides the plane so its card sits in the middle of what the panel leaves (the card isn't selected: that would
  close the task's panel, D-254).
- *Columns now written as `kanban.cols`* (not the whole `kanban`), so the switch survives renaming a column.
- *Rules:* `stuckTo` allowed on kanbans; `everyPlane` (bool) in the kanban setup. Export carries both.
- *Alternatives:* the switch per browser (others would see different tasks on the same kanban); hiding tasks for gone
  cards; selecting the card when a task is picked (closes the task's panel).
- *Verified:* headless on the emulators: dragged next to a plane in edit mode → `stuckTo`, console `⇆ Pazar`, the other
  plane's task hidden on the canvas; in the plane's focus, `[linked · 1]` → the pane, `this plane only · 1 hidden`,
  switched off shows it; a task clicked opens its panel and the plane glides to its card; rules 387 pass; build.

### D-256 · 2026-10-27 · Accepted (adds to D-233, D-251; kanban session 4, docs/specs/kanban.md)
**A kanban's filters, task labels and priority, and column limits.**
User: picked ideas 5, 10 and 9 of the kanban list (2026-10-26); this is session 4 of docs/specs/kanban.md.
- *Filters:* `[filter]` in the kanban's dock (its focus, its pane beside a plane) opens a strip over it in the plane
  filter's look (D-233): `GIVEN TO ▾ DUE ▾ FOR ▾ LABEL ▾ [reset]`, each a checkbox menu with counts. Given to: me, nobody,
  each other member. Due: past its day (not finished), today, this week (to Sunday), no day. For: no card, a card type,
  a card (those its tasks point at). Label: its tasks' labels. Within one menu any pick, across menus all; nothing
  picked, everything. `[filter · N]` while narrowing. Kept (changed by D-308: only while open) per kanban in this browser (`kanbanFilter.ts`, like
  `planeFilter.ts`), yours only. It narrows the canvas picture too; on top of D-255's plane-only.
- *Labels:* `labels` on tasks (≤ 20, ≤ 40 letters), a line of `#labels` under the title; set in the panel's `labels`
  section like a card's tags, the kanban's other labels offered as you type.
- *Priority:* `priority` `P1 | P2 | P3` before the title (P1 magenta, P2 as the text, P3 faint); `[P1] [P2] [P3]` in the
  panel (a click on the picked one clears it). The panel now reads column, given to, due, priority, labels, for,
  (learned), checklist, notes.
- *Limits:* a column's `limit` (1–99), typed from the head's `≤` tool (Enter keeps, empty takes it away, Escape leaves).
  With one, the count reads `4/3`, counting every task in the column, filtered or not; over it, the column's name and
  count turn magenta. Nothing stops a drop past it.
- *Rules:* `labels` (list ≤ 20) and `priority` on tasks; columns aren't checked one by one, so `limit` needed no rule.
  Export carries all three.
- *Alternatives:* filters shared on the kanban (one person's view would change everyone's); a limit that refuses drops;
  the limit counting only what's shown.
- *Verified:* headless on the emulators: labels, priority and an over-limit DOING on the sheets; filter strip, DUE "past
  its day" leaves the late task, `[filter · 1]`; panel: P1 set, a label offered from the kanban's others and one typed;
  `≤` on TODO typed 1 → `2/1` magenta; light theme; rules 391 pass; build.

### D-257 · 2026-10-27 · Accepted (changes D-158, D-162's look; D-194's sticky sizes kept)
**A sticky note is paper in its colour: solid, dark ink, a glue band a shade darker along the top holding the signature,
its foot lifting off the space. Never tilted.** (Its size: D-259.)
User: "improve how sticky notes look like. Right now they do not look like sticky notes"; shown six directions on a
preview page (today, A paper, B folded corner, C glyph paper, D taped & tilted, E glue band, F pad), picked "A yap ama
tiltsiz" (A, without the tilt).
- *Paper:* `color-mix(colour 92%, black)` in dark, a pastel `color-mix(colour 34%, white)` in light; yellow always the
  bright `--sticky-yellow` (the light theme's yellow is ochre). Text `--sticky-ink`, signature and checks ink at 62/70 %,
  placeholder ink at 40 %. Tokens `--sticky-mix`, `--sticky-base`, `--sticky-yellow`, `--sticky-ink`, `--sticky-shadow`.
- *Glue band:* the top 13 px a shade darker (86 % of the paper with black), the signed line inside it; text starts at the
  same 17.64 px as before.
- *Shape:* superseded by D-259 (6 × 5 grid steps, growing down, foldable); 4 / 3 of its width at first.
- *Shade:* a 1 px contact shadow and a soft one under its foot (`--sticky-shadow`); on black it barely shows, by design.
- *Alternatives:* the tilt (±2° from its id) — the user said no; B/E stayed dark (less like a note); C's ▓ tape and ░
  dither, D's tape, F's pad edges.
- *Verified:* headless on the emulators, six notes on the canvas (each colour, a list, a long one, an empty one) in dark
  and light; build.

### D-258 · 2026-10-27 · Accepted (adds to D-227, D-251; kanban session 5, docs/specs/kanban.md)
**Lanes on a kanban (by who a task is given to, or the card it's for), and several tasks selected at once.**
User: picked ideas 6 and 8 of the kanban list (2026-10-26); this is session 5 of docs/specs/kanban.md.
- *Rows by a field* (`rows.ts`, as priorities.md asks): a field says which lane an item is in, which lanes there are,
  and what dropping into one writes. Tasks have two: given to (you first, always there; the others by name; nobody last)
  and the card (the cards its tasks point at in chain order then by title; no card; tasks whose card is gone in a lane
  that takes nothing). Cards' fields (priorities P2) plug in the same way.
- *Look:* the column heads in a row on top, then each lane: its head across the columns (`▾`, a member's square or the
  card type's bar, the name in caps, a rule, its count; a click folds it, `▸`), its cells under it. `+ add a task` in a
  lane only while the cell is hovered; a task typed there gets the lane's person or card. Without lanes it looks as before.
- *Choice:* `[LANES ▾]` in the kanban's dock (its focus, its pane beside a plane): no lanes · by given to · by card.
  Shared, on the kanban (`kanban.rows`); folds are yours, per kanban per browser.
- *Dragging:* lands in the nearest cell of an open lane (2D), dropping into another lane writes its field; into an
  empty cell the task goes after the column's last task (other lanes' too), so turning lanes off keeps an order.
- *Several:* shift+click adds a task or takes it out; alt+drag on empty space draws a cyan box, what it touches is
  selected (shift keeps what was). A press on one of them drags them all, in the board's order, contiguous where they
  land, a `+N` badge on the held one; one undo step. Delete takes them all away, Escape lets go.
- *Panel `N selected`:* how many in which column; move to (pills; to the column's end, in their order), given to (a
  `several` value when they differ), due (set or clear); `[delete N]` at the foot. Each one undo step for all of them
  (`moveTasks`, `updateTasks`, `deleteTasks`).
- *Rules:* `rows` (`assignee | card`) in the kanban setup. Export carries it.
- *Alternatives:* lanes per browser (others would see a different board); every member as a lane (crowded; only those
  with tasks, and you); a box drawn without alt (it would take the pan).
- *Verified:* headless on the emulators: lanes by given to (me, two people, nobody), a drag into Bob's lane gives the
  task to him, shift+click two → `2 selected`, dragged together into done/nobody, alt box over three → `3 selected`, a
  lane folded, lanes by card (problem, feature, no card); rules 395 pass; build.

### D-259 · 2026-10-27 · Accepted (changes D-257's shape, D-158's width)
**A sticky note starts 6 grid steps wide and 5 tall (150 × 125), grows down as its text does, and a long one folds back
to the 5.**
User: "sticky notelar default olarak çok büyük açılıyor. Bence 6 kare widthi yeterli olcaktır ... height 5 ile başlasın
ve yazı uzadıkça alta büyüsün. Ama insanlar isterse collapse yapabilsin ve 5 height a geri kapansın"; the width strip
not showing is fine as it is ("gözükmese de olur").
- *Size:* `STICKY_W.initial` 150 (was 200), `STICKY_H` 125 as its least height; no aspect ratio. Notes already made keep
  their width. The `+` puts a new one's middle at the view's.
- *Fold:* `folded` (bool) on the label, shared. Only when the text is longer than fits the 5 (measured), or it's folded,
  the band shows `▾` (fold) / `▸` (open) before the checks, for editors where it's live; the press doesn't select or drag.
  Folded, it's held at 125, the text cut and fading over its last 40 %; typing shows all of it. `labelBox` reads 125.
- *Rules:* `folded` optBool on labels (2 tests). Export carries it on sticky notes.
- *Alternatives:* folding per browser (others would see a different size on a shared canvas); a `[−]` in the bar under it.
- *Verified:* headless on the emulators: a short note at 150 × 125, a long one grown down, folded with `▾` to 125 and
  faded, a folded one opened with `▸`; rules 395 pass; typecheck.


### D-260 · 2026-10-27 · Accepted (adds to D-169, D-191, D-192, D-193, D-251; kanban session 6, docs/specs/kanban.md)
**Working together on a kanban: others see the tasks you've picked and the one you're dragging, a follower takes your
pick, and tasks take comment threads.**
User: picked ideas 11 and 12 of the kanban list (2026-10-26); this is session 6 of docs/specs/kanban.md.
- *Picked:* your picked task, or several (D-258), is your presence selection (`sel` + `more`) while it is, instead of a
  card's; others see a frame in your colour with your name round it (`PeerTaskRing`), wherever that kanban is drawn
  (its focus, beside a plane, open on the canvas: a task is on one kanban only, so no space check).
- *Dragging:* presence `drag` = `<task> <x> <y> <how many>` (its top-left in the kanban's px), sent with the cursor
  (10 a second) and cleared on letting go; others see a ghost of the task in your colour with your name (`· 3` for
  several), gliding 110 ms between updates (none with reduced motion). RTDB rule: `drag` string ≤ 200.
- *Following:* the leader's selection, when it's tasks, is picked for the follower (their panel opens); otherwise a
  task pick lets go.
- *Comments:* `THREAD_TARGETS` gets `task` (rules too); its thread's `planeId` is the kanban, so it's counted in the
  kanban's `[N inside]` and the threads panel's `on Roadmap ↗` goes into the kanban's focus and picks the task (a
  `pending` pick, taken once that kanban is live). Right-click a task → `comment` (only that); its chip sits inside
  the task's top-right corner (under it, as on a card, it lay on the next task), the title keeping clear of it.
- *Fixed along the way:* a task pick is let go when the space changes (focus, unfocus, back), not when the task panel
  unmounts: React's development double mount cleared a pick made just before. Dev hook `window.__kanbanUi`.
- *Alternatives:* the ghost drawn from cursors alone (the kanban's px aren't the space's beside a plane or on the
  canvas); a chip under the task (covered the next one).
- *Verified:* headless on the emulators with two browsers (Alice, Bob): Bob sees Alice's pick framed in her colour and
  her held task's ghost; Alice right-clicks → comment → Bob sees the chip (new) and the threads count; Bob follows Alice
  and gets her pick with its panel; from the canvas, the thread's go there opens the kanban with the task picked;
  rules 398 pass; build.

### D-261 · 2026-10-27 · Accepted (adds to D-166, D-175, D-236, D-251; kanban session 7, docs/specs/kanban.md)
**Tasks given to you by your square, new ones counted in magenta; and the finder finds tasks.**
User: picked ideas 13 and 16 of the kanban list (2026-10-26); this is session 7 of docs/specs/kanban.md.
- *Given:* a task records when it was given and by whom (`givenAt`, `givenBy`), stamped by the data layer on every write
  that sets `assignee` (panel, `N selected`, a lane drop, a task typed in a person's lane); taken back, both go.
- *Looked at:* your read marks (`threadReads/{you}`, D-166) get `tasks`, the time you last opened the list. New = given
  to you by someone else after that (giving yourself one is never new).
- *The button:* `☐` under the corner's rule, right above your square (the HUD's new `mine` slot: yours, not the
  workspace's), shown once a task is given to you; a magenta count of the new ones (as a mention's), else a faint total.
  A click opens the list on its right, a prompt like every menu (D-222): `# new · N` first (a magenta `●`), then
  `# given to you` by due day; each row the title and `column · due` (`was due 25 oct`, magenta), the kanban's name
  too when they're on several; finished ones aren't listed. Opening it marks them looked at; a row goes there.
- *Going to a task* (`goToTask`, shared with the finder): the kanban's focus, landing on the task's guessed place
  (`taskBox`: its column, the tasks above at their guessed heights; lanes not counted), the task picked once the
  kanban is live (D-260's `pending`).
- *Finder (D-236):* a kanban is a group; a task matches by its title, notes or a checklist step, one row a task
  (`title — …snippet` and `column · in notes/step`); the preview draws the kanban with the task lit (`data-find`);
  Enter or a double-click goes there, the task picked.
- *Rules:* `givenAt` (number), `givenBy` (text) on tasks; `tasks` (number) in read marks.
- *Alternatives:* a collection of its own for the mark (the thread marks' doc already has the rules and the cleanup);
  `updatedAt` as "when given" (any edit would make it new); a count on your square itself (it opens settings).
- *Verified:* headless on the emulators with Alice and Bob: Alice's `☐ 1` for the task Bob gave her (not the one she
  gave herself, not the finished one); opening it wrote the mark and the badge went; Bob drops a task into Alice's lane →
  `givenBy` Bob, her badge back to 1; a row goes into the kanban with the task picked; ⌘F "empty state" finds a step,
  the preview lights its task, Enter picks it; rules 402 pass; build.

### D-262 · 2026-10-27 · Accepted (adds to D-210, D-211, D-251, D-256; kanban session 8, docs/specs/kanban.md)
**A timeline is a piece of its own (`+ → timeline`): kanbans' tasks on a row of days, stuck beside a kanban; and a
kanban gets a "soon" band over its columns.**
User: on a local preview of three ways (a switch on the kanban, recommended; a new piece; a ruler of days under the
columns), picked "B: a new piece".
- *The piece:* `kind: 'timeline'`, a window on the canvas (fitted in it, as a matrix), live in its focus. Its setup
  (`timeline`): the kanban it's stuck to, else every kanban (D-289: the hand-picked `kanbans` and its `shows ▾` gone;
  old data's list is ignored); `rows`: by kanban (default), by who it's given to, by the card it's for (rows.ts).
- *Inside:* two weeks from Monday (`‹ today ›` steps a week, yours per tab), a day 150 px, weekends a shade darker, today
  a cyan line; a task a sheet on its day in its card's colour (`P1` before its title); past its day and not finished it
  sits on today, magenta, `← 25`; finished faint with a green `✓`; `N →` / `← N` for tasks outside the two weeks; tasks
  with no day in a tray under the rows. Drag a task (or a tray pill) onto a day: its due day; onto another row by person
  or card: that too; rows by kanban keep it on its kanban; one undo step. A click opens its panel. Its own filter (the
  kanban's strip, D-256, over its kanbans' tasks).
- *Sticking:* a timeline sticks to a kanban as a lens to a plane (D-210): `hostKind` (lens and kanban → plane, timeline
  → kanban), `isHost` (plane, kanban); a kanban is both stuck and a host, so its move carries its timelines
  (`placeLens` takes followers). In the kanban's focus, `[⇆ timeline · name]` in its dock opens it beside (D-211), one
  week there (half the screen); a task picked there is picked on the kanban.
- *Soon (on the kanban):* over the columns, unfinished tasks due by Sunday as pills: `was 25 oct` magenta, `today` cyan,
  `thu`; a pill picks its task; `▾ SOON` folds to `1 past · 1 today · 2 this week` (yours, per kanban per browser);
  nothing due, no band.
- *Rules:* `timeline` kind and setup (`kanbans` ≤ 20, `rows`), `stuckTo` on timelines. Export carries it (its kanbans
  that came over).
- *Alternatives:* A, a switch on the kanban (fewer parts, one kanban at a time); C, a ruler under the columns (crowds).
- *Not yet:* a plane moved carries its kanban but not that kanban's timeline (one level); no comments or presence on
  the timeline's sheets; go there (finder, your tasks) lands on the kanban, not the timeline.
- *Verified:* headless on the emulators: on the canvas fitted beside the kanban; in focus a drag to Friday sets the
  due day, a tray task dragged onto Wednesday gets it, a click opens the panel, rows by given to; stuck to the kanban
  by dragging in edit mode (`⇆ Roadmap`), opened beside in the kanban's focus at one week, a task picked there picked on
  the kanban; the soon band; rules 406 pass; build.

### D-263 · 2026-10-27 · Accepted (changes D-176's, D-180's and D-208's piece background; plan, docs/specs/consistency.md)
**Pieces get a surface of their own: graphite layers over the black page, and a 2 px band in their kind's colour on the
top edge.**
Feedback the user got: the components' background shouldn't be black. Every piece used `--bg` (the page's #000), so on
the full-strength backdrop they read as holes, and cards (#0b0b0b) barely stood off a plane.
- *Picked:* on a local preview of six (today; A graphite layers; B a tone by kind; C an ASCII texture with plates under
  text; D smoked glass, the backdrop dimmed through; E light paper; F a mix), the user: "türe göre componentin üst
  borderını boyamak mantıklıymış. Ayrıca grafit de kötü durmadı". So A's layers + B's colour as a top band only.
- *Values:* `--piece` #121315, `--piece-head` #17181b, `--piece-card` #1d1e22, `--piece-edge` #2f3136, a shadow and a
  1 px top highlight; `+` marks #3b3e44; light #fff / #f7f7f8 / #fff / #d4d5d8. Band: plane `--fg`, matrix
  `--link-solves`, table `--link-part`, kanban `--link-draws`, documents and document `--link-depends`, timeline
  `--link-competes` (the kinds share hues with link kinds; the band is thin and never where links are).
- *Alternatives:* B over the whole body (a third colour system beside types and links), C (noise against an ASCII
  backdrop, close to D-019), D (motion behind reading, the plane's `+` marks mixing with glyphs), E/F (bright areas in
  the dark default).
- *Not yet built:* session 4 of the spec.

### D-264 · 2026-10-27 · Accepted (changes D-179/D-181's always-open console; plan, docs/specs/consistency.md)
**The console stays where it is, shows only while the pointer is on the piece, and grows as the canvas zooms out.**
Feedback: the focus button is hard to find. Shown four ways on the preview (today; the console in the corner nearest the
pointer, with a dead zone and cell moves; the top edge as a window title bar, `[⤢ focus]` at its right end; title bar +
nearest bottom corner), the user: "şimdiki gibi kalsın. ancak console uzaklaşınca büyüsün ki tıklaması kolay olsun. Bir
de console sadece hover edince ortaya çıksın".
- *Hover:* built cell by cell (170 ms, 6 steps) as the pointer comes on, broken (90 ms) as it leaves; kept in edit mode,
  while its setup is open, with focus inside it; touch: first tap shows it, second goes in. Something new (comments, a
  mention) stays alone as a small magenta tab, so hiding the console never hides it.
- *Size:* `11 px × min(1.4, zoom^-0.5)`; padding, gaps and marks by the same factor; a first try capped at 1.6 (17.6 px)
  looked too big beside small pieces.
- *Alternatives:* see Rejected (nearest corner/edge, title bar).

### D-265 · 2026-10-27 · Accepted (replaces D-150's, D-203's, D-194's and every component's own marks and grips; plan, docs/specs/consistency.md)
**One set of corner marks for everything selectable, with one motion, one drag rule and one resize language.**
The user: hover and selection L's differ from component to component (length, distance, animation); found that a
drag's landing marks are on plane cards only ("bu tarz inconsistency'lerin olmasını istemiyorum"); wants the click felt
and the right / down / both resizes to show the same way.
- *Found in the code:* six implementations (piece 14/1 hover only; plane card 17.6/2.4 in plane units, type colour;
  kanban task 12/2 cyan; matrix cell 7→9 inside; table cell `[ ● ]`; documents row a wash; text 16/2.4 at 17 → 12 with
  no motion; section 32), four drags (card: landing marks; text: marks shrink with it; task: ghost + cyan line; piece:
  full size, no marks), four resize looks (piece: cyan L grips + bars; section: a grey L; paragraph/sticky/title: a
  thin grey line on hover; table column: a tick and a cyan line).
- *The rules:* three tiers in screen px (S 6/1.5, M 12/2, L 18/2) by the thing's short side on screen; distance is the
  state (hover out and grey, pressed on the corners and longer, selected just out in the tone); tone = what it is,
  cyan = what you can do to it; press 70 ms, release a 300 ms spring, hover 160, leave 140; drag: the thing at 0.8
  under the pointer, the L's in a landing box where it lands; resize: cyan handles on the ring only when selected, the
  moving edge lit along its length with a readout; box select cyan L's; peers' selection as L's in their colour + a
  name tag. Values in the spec.
- *Verified on the preview:* hover, press/release, deselect, drag (card, heading, sticky), resize (paragraph, section,
  plane in edit), box select, in both themes.
- *Not yet built:* sessions 1–3 of the spec.

### D-266 · 2026-10-27 · Accepted (adds to D-093, D-157, D-194, D-223; plan, docs/specs/consistency.md)
**One language for names and lines: two voices, magenta numbers, two edges, two bands.**
On the preview the user: "tek dil güzel duruyo".
- *Two voices:* the system's in Geist Mono caps (piece names, type labels, column heads, panel sections, headings' small
  lines, consoles), the user's in Geist (card titles, headings, paragraphs, section names, the title).
- *Numbers* magenta wherever there is one (piece names were white, kanban columns faint).
- *Edges:* containers have one (pieces, sections), the name cut into it with the same lead (16 px) and gap (8 px); held
  things have none (cards, tasks, rows, cells). *Bands:* held things' on the left, containers' on top (D-263).
- *Asked, not decided:* text's shade hugging each line, and one family of rules (spec, "Asked, not decided").

### D-267 · 2026-10-27 · Accepted (changes D-228's unframed look; plan, docs/specs/consistency.md)
**Framed is a window, unframed is ink on the canvas (option A, without a scale).**
The user wasn't satisfied with the first proposals ("hala şu ankinden daha iyi bir framed ve unframed ui designı
sunamamışsın"); three directions on the preview, built on what the two are: framed is closed (its contents fitted into
it, D-214, used by going in), unframed is open and live (its own size, used right there, D-228). The user: "A ile devam
et".
- *Framed:* D-263's surface, band and shadow, the name in the edge, the console. A scale readout (`· 82%`) was turned
  down ("ölçek olmadan").
- *Unframed:* no edge, band or shadow; on the page's black since D-289 (it was no fill); under each row a shade hugging it (page at 80 %, feathered 16/10 at 72 %);
  its name a heading's small line (`04 ── RIVALS · TABLE`, mono 11 screen px, the number magenta, 8 px over it); its
  console the same, on the same hover rule, hanging 10 px under the contents' right end.
- *Between:* the window breaks cell by cell (320 ms) while the contents grow to their own size; framing the reverse.
- *Alternatives:* B, a block (a hatched ╱ thickness on the right and bottom, world units) and its unframed contents in a
  clearing of page-coloured cells thinning to dots (focus's ragged ink edge); C, unframed printed onto a light sheet
  line by line. See Rejected.
- *Not yet built:* session 6 of the spec.

### D-268 · 2026-10-27 · Accepted (adds to D-251, D-253; priorities session P1, docs/specs/priorities.md)
**A kanban holds tasks or cards. Holding cards, its columns are one of their fields' values, and dragging a card to
another column sets that field.**
The user asked for P1 of the priorities plan, built on the kanban (D-253's two settled points: dragging sets the field;
one confidence rule, P3).
- *Data:* `kanban.holds: 'cards'` (unset: tasks), `kanban.source` (the table's source, D-209: rules + cards by hand + hidden),
  `kanban.colField` (`status | impact | effort | priority`); its own `cols` stay on the piece, unused, so switching back
  keeps them. Rules: `validKanban` takes the three (source checked as a table's); export/import carry them (plane rules
  and cards follow their new ids, `cleanSource` shared with the table).
- *Which cards:* the source's cards the field applies to (status: customers, problems and ideas by their validation,
  features by their own; impact and effort: features and packages; priority: features, as the rules allow); typed names
  never. Stuck to a plane: that plane's cards, with the kanban's own `[this plane only]` switch (`everyPlane`).
- *Columns:* `no value` first, then the values (a status kanban with both kinds shows both lists, the validation one
  first); `shipped` and `validated` green as a finished column, `invalidated` magenta. No hand order: by type, then title.
- *Drag:* after 5 px, as a task (a click still picks); columns that don't take the card (another kind's status) go
  faint; the nearest that does lights its rule and gets a cyan line; dropped, `updateCards` writes the field (validation for
  c/p/i), one undo step; into `no value` it takes the value away.
- *Sheet:* the task's sheet (D-252) edged in the type colour, the type in that colour and the priority (`P1` magenta) on
  top, the title, then confidence (`◆ high`, `! broken` magenta; packages by what they hold, features by the ideas linked
  to them and the problems those solve, both with D-239's share until P3 makes one rule) and its other values.
- *Click:* selects the card (`cardSelected`), its panel opens through LensCardPanel (D-247's way); beside a plane, the
  plane glides to it.
- *Made and set up:* `+ → kanban…` opens a wizard as the table's (start from: tasks, features by status, my own; holds;
  columns; a preview of the columns with their counts; Enter steps, ⌘Enter makes). `[setup]` in its focus dock, its
  pane beside a plane and its console once unframed: holds · cards (the table's rows editor, cards only) · columns.
- *Left out (P1):* the task filter and lanes are hidden on a card kanban; no several-at-once, no presence of a held card.
- *Verified:* headless on the emulators: a seeded features-by-status kanban in focus (five columns, sheets with P1–P3,
  `◆ medium`, `! broken`); a drag from `no value` to `planned` set the status, ⌘Z put it back; a click opened the
  feature's panel; setup switched the columns to impact; the cards tab; the wizard (features by status, preview `6 cards
  in 5 columns`, ⌘Enter made it on the canvas in edit mode); the canvas picture; light theme. Rules 410 pass (4 new).
  Build.

### D-269 · 2026-10-27 · Accepted (adds to D-258, D-268; priorities session P2, docs/specs/priorities.md)
**A kanban holding cards takes rows from a second field: a grid of boxes, a drop setting both fields; boxes can be named.**
The user asked for P2 of the priorities plan.
- *Data:* `kanban.rowField` (status, impact, effort or priority; never the columns' own: picking that field for the
  columns drops it from the rows), `kanban.names` [{col, row, name ≤ 40, tone?: good | bad}] (≤ 40). Rules: both on
  `validKanban`; export/import carry them (`boxNames` keeps only named or toned boxes).
- *Rows:* `no value` on top, then the values; impact runs high → low down (the best on top), low → high across. A card
  shows only when both fields apply to it (the setup's count says how many). Each row is the tasks' lane head (D-258:
  `▾ IMPACT HIGH ──── 2`), folding per browser.
- *Drag:* to a box, whose column and row both take the card (others go faint, rows' heads too); a cyan edge on it; one
  undo step writes both fields (`set a card to effort S, impact high`). The held card keeps its room, hidden, so rows
  don't move up under the pointer as it leaves (found when a drop meant for `S × high` landed in `S × medium`).
- *Boxes:* a name small in the box's top-left corner (mono caps, dim); `good` washes the box green and the name, `bad`
  sets the name magenta. Set in the setup's new `boxes` tab: a grid of columns × rows, a name field and a tone button
  (`·` → `wash` → `warn`) per box. Only with rows; tasks' lanes get no names.
- *Where it's set:* the dock's `[rows ▾]` (a card kanban's form of `[lanes ▾]`), the setup's columns tab (`rows from`), the
  wizard's last step (`columns · rows`, its preview the grid of counts).
- *The sheet* no longer repeats the row's field (the column's already wasn't).
- *Verified:* headless on the emulators: a seeded features + package kanban, effort × impact, named corners (quick
  wins washed, money pits magenta); a drag from no value × no impact to S × high set both and ⌘Z put both back; a
  row folded; a box named from the boxes tab showed on the board; the wizard's rows and grid preview; light theme.
  Rules 413 pass (3 new). Build.


### D-270 · 2026-10-27 · Accepted (builds D-265 for plane cards and text; consistency session 1, docs/specs/consistency.md)
**One `Marks` component, used by plane cards, packages and every kind of text; a dragged text lands like a card.**
The user asked for session 1 of the consistency plan (D-263–D-267).
- *The component:* `src/ui/Marks.tsx` + `Marks.module.css`, tokens `--mark-{s,m,l}-{len,th,hover,sel,rest,press}` and
  `--mark-spring` in `tokens.css`. Four L's, sized in screen px (`--zs` = 1 / the space's zoom), state from props
  (`selected`, `pressed`, `dragging`, `target`, `hover` or the parent's `:hover`), tone from the thing; a peer's
  selection the same L's in their colour (a step further out each) with their name on a tag at the top-left
  (`usePeersOn` in collab.tsx; replaces `PeerRing` on cards and text). `<Landing>`: where something dragged lands, the
  pressed L's at full size, stepping 80 ms. `<BoxSelect>`: alt+drag's box, a cyan wash with cyan L's.
- *Tiers, an interpretation:* D-265 says "by the short side on screen", its table by kind (text M, sections L). Taken
  literally a one-line paragraph got S and a 200-tall section M at 100 %. So: the kind's tier (cards, text, sticky
  notes, the title M; sections and an unfolded package's frame L), a step down while small on screen (L under 120 px,
  M under 24 px). Text's short side counts its 7 px clearance.
- *Motion:* as D-265: hover in 160 ms from further out, press 70 ms (colour 40), release a 300 ms spring overshooting,
  leave 140 ms; selected without a press (box, shift+click, a peer, a follow) drawn on the corners for a frame, then the
  spring; after a drop the L's stay on the corners 180 ms while the thing grows back, then spring. Reduced: no
  transitions, no phases (checked: hover, press, release, drop land at once).
- *Drag, one rule:* a text's own drag now goes 0.8 round the point held, following the pointer, its L's at full size
  where it lands (fixes the text marks that shrank with it). A selection's drag (cards and text) the same: each goes
  0.8 round the point held in the one pressed (`dragShift` gains `free` and `at`; `heldAt()` in selection.ts), each with
  its own landing L's; before, they shrank round their own middles at the landing spot. Let go, they grow back 180 ms.
  A section still moves whole, unscaled (its carried planes and cards too); its landing L's come with session 3.
  Landing L's are drawn only where it's live (a focused plane's cards are drawn twice, D-174's picture under it).
- *Left as they are:* the project title's corner brackets stay, edge grey, never cyan now (its state is its marks,
  outside them); the resize grips and strips (session 3); a link's target is the hover distance in cyan.
- *Verified:* headless Chrome on the emulators, no-preference and reduced: a card's hover (7 out, grey), press (on its
  corners, 18 long, green), release (overshoots to 4.5 out at 150 ms, settles at 3); heading, paragraph, sticky note,
  section and the title hover / press / select; heading and sticky note drags (item at 0.8, one landing box at full
  size, snapped; after the drop the L's on the corners, then sprung); alt+drag box; a card + heading + card dragged
  together (a landing each); Bob's selection of a card and a sticky note seen by Alice (pink L's + `Bob` tag); a canvas
  heading's drag. Build.

### D-271 · 2026-10-27 · Accepted (builds D-253's last part; replaces D-221's and D-239's confidence; priorities session P3, docs/specs/priorities.md)
**The priorities template, the suggested order beside it, and one confidence rule for features and packages.**
The user asked for P3 of the priorities plan.
- *One rule* (`cardFacts.ts`, D-253 as planned): of the customers, problems and ideas it rests on (a feature: the ideas
  linked to it and the problems they solve, or its parent's when it has none; a package: what it holds), validated 2,
  testing 1, else 0; share ≥ 0.75 high, ≥ 0.34 medium, else low; nothing behind it low (D-138); anything invalidated
  `broken`. With a `why` ("of the 2 it rests on: 1 validated, 1 testing"; `"Voice notes" is invalidated`). Used by the
  feature panel's rests on (was the weakest link, D-221; the evidence clash no longer lowers it, it still shows as `!`
  on the row), a package's facts (was validated-only at 0.67, D-239), the kanban's sheets and the order.
- *Template `priorities`* in `+ → kanban…`: features and packages, effort S · M · L across, impact high → low down,
  corners named: quick wins (S × high, washed green), big bets (L × high), fill-ins (S × low), money pits (L × low,
  magenta).
- *Suggested order* (D-138): score impact × confidence ÷ effort, each 1–3, 0 when broken; rated (impact and effort set)
  cards best first, split in thirds as P1–P3, equal scores alike; a column beside the grid inside the kanban (`SUGGESTED
  ORDER ──── 6`, `impact × confidence ÷ effort`, rows: place, type bar, title, score with `!` magenta when broken, the
  suggestion, `P3 → P1` yellow where the card's own priority differs; `N not rated yet`). A row picks the card (its
  panel). Never written to the card. Shown while columns are effort and rows impact; `[order]` in the dock hides it
  (yours, per kanban per browser, on to start).
- *Boxes sort by score* (unrated last), then type, then title (P1 sorted by type and title).
- *No rules change.*
- *Verified:* headless on the emulators: a seeded priorities kanban (features + a package, statuses on ideas and
  problems): order 3.0 Offline sync P1, 2.0 Decision templates `P3 → P1`, 1.5 Launch pack, 0.5 Slack import, `! 0.0`
  Voice capture (rests on an invalidated idea); a row opened the feature's panel with `confidence high · of the 2 it rests
  on: 1 validated, 1 testing`; `[order]` hid and showed it; an unrated card dragged into quick wins joined the order and
  the thirds moved (`P2 → P3`); the wizard's priorities template and its grid preview; light theme. Build.


### D-272 · 2026-10-27 · Accepted (builds D-265 for everything but plane cards and text; consistency session 2, docs/specs/consistency.md)
**`Marks` everywhere else: kanban tasks and card sheets, matrix cells and heads, table cells and rows, documents rows and
sheets, link chips, pieces, timeline sheets and pills, the SOON band, the suggested order; others' selections as L's.**
The user asked for session 2 of the consistency plan.
- *Tiers:* S for matrix cells and heads, table cells, rows and names, documents rows, link chips, timeline pills, SOON
  pills, the suggested order's rows; M for tasks, card sheets, timeline sheets, documents sheets; L for pieces (D-270's
  rule: the kind's tier, a step down when small on screen).
- *Tones:* a task's card (cyan with none), a sheet's card type, a piece's kind (D-263's colours, `KIND_TONE` in
  CanvasView), a link chip its kind, a documents row `--link-depends`; cells cyan (they have no tone of their own).
- *What each replaced:* matrix cells' gradient corners; table cells' `[ ● ]` and their hover wash; the table row's cyan
  wash for the card selected (now the band's L's in the card's colour, D-247's picked card the same); documents rows'
  hover wash and the open one's cyan wash + left bar, sheets' hover edge; link chips' fill when selected; pieces'
  hover corners; timeline sheets' and pills' outlines, the over cell's cyan box; SOON pills' cyan edge; the order's
  cyan inset; tasks' and card sheets' own corner marks; `PeerRing` and `PeerTaskRing` (both gone; `usePeersOn(id,
  space?)`, no space for tasks and card heads).
- *Kanban drag:* the cyan slot line is now a gap as tall as the held task (or card) opening where it lands, its L's on
  the gap's corners in its card's colour (`Gap`, shared with CardKanban); a card over its own box shows them on the room
  it keeps. The held one (ghost) goes 0.8 round the point held, no cyan frame. The timeline's held sheet the same, its
  `<Landing>` on the day's first slot.
- *Others' selections in every view:* a card someone has selected (anywhere) shows their L's on its matrix head and its
  table row's name; a task or card sheet someone picked, on it; a piece, on the canvas.
- *Zoom:* `Marks` takes `--zs` from its space when not given a zoom (`zsOf(screen)` on the matrix's, table's,
  documents', kanban's and timeline's worlds), so memoised cells don't draw again as the view zooms.
- *Clipping:* L's stand outside what they mark, so the timeline's sheets and pills and the SOON pills cut their text in
  an inner span now, and a documents sheet sits in a wrapper (`sheetAt`) holding its marks.
- *Left as it is:* a piece in edit mode keeps its cyan grips and bars and shows no selection L's (session 3 gives it
  the resize handles and the landing L's); matrix/table "hot" heads (the hovered cell's row and column) stay a
  highlight, not marks.
- *Verified:* headless on the emulators, no-preference and reduced: a matrix on the canvas hovered (L, its kind's
  colour); a matrix cell hovered and selected, a card head picked (its L's in the card's colour); a table cell, a row
  picked (the band's L's); a documents row hovered; a task hovered and picked; a task dragged to another column (a
  64 px gap with green L's, the ghost at 0.8); a tray pill dragged onto a day (landing L's); a link chip hovered
  (gliding in), clicked (from the corners, sprung), reduced (at once); Bob's picks seen by Alice on a table row's name
  and on a task. Build.

### D-273 · 2026-10-27 · Accepted (builds D-265's resize language and its drag rule for pieces and sections; consistency session 3, docs/specs/consistency.md)
**One resize language: cyan handles on the ring, only when selected (a piece in edit mode); the moving edges lit and the
size beside them. Pieces in edit mode and sections move like everything else: 0.8 under the pointer, L's where they land.**
The user asked for session 3 of the consistency plan.
- *Handles (`Marks`' `handles`, `onHandle`, `resizing`, `readout`):* a corner's is its L in cyan, `len + 2 × 5 px` to
  grab; an edge's a bar at its middle, the L's stroke wide, `1.2 × L` long, 5 px of grab round it; both on the ring
  (the selected L's place); hovered or held they grow like a pressed L (120 ms). While one's dragged the edges it moves
  are a 1 px cyan line their whole length on the ring, and a cyan tag says the size (`410`; `560 × 340`): right of the
  middle for a width, beside the bottom-right corner when the height moves too (clear of a text's bar and a console).
- *Which:* paragraph, sticky note, project title: the right bar (a turned paragraph's along its text: the top reading
  upwards, the bottom reading down); a heading none; a section: right, bottom, bottom-right; a piece in edit mode: all
  four corners and edges (an unframed one only moves). Only while selected: hovering never shows them (before, a
  paragraph's strip showed on hover and an unselected one could be resized by accident).
- *A table column:* not a selectable thing, so its handle shows where it's found: under the pointer at its head's right
  edge, as D-265's edge bar (cyan, 2 px × 14.4, growing while dragged); dragged, the cyan line down the table (as
  before) and the width beside it. The grey tick at rest is gone.
- *Removed:* text's width strips (`.edge`), the section's corner grip (`.corner`), the pieces' grips and bars (`.mark`,
  `.bar`), the open piece's edit-mode corners, the title's `resize` prop.
- *Pieces in edit mode:* their L's selected in their kind's colour under the cyan handles. Moved, the piece goes 0.8
  round the point held and follows the pointer, a `<Landing>` (tier L) where it lands (snapped, stuck to a plane's edge
  when it will stick); let go, it grows back (180 ms). What it carries (stuck matrices and tables) still moves at full
  size by `following`.
- *Sections:* moved, they now shrink too, with what they hold (cards, text, planes on the canvas, which read
  `dragShift`'s `free`/`at` now), the section's landing L's at full size.
- *Verified:* headless on the emulators, no-preference and reduced: a paragraph hovered (no handle), selected (`e`),
  widened by its bar (edge lit, `450`, stored); a section's three handles, its corner dragged (`500 × 250`, stored);
  a section moved (0.8, one landing); a table column widened (`180`, the line down the table); a plane in edit mode
  (eight handles), resized from its corner (`1325 × 800`, edges lit) and moved (0.8, landing L's, back to 1 after).
  Build.

### D-274 · 2026-10-27 · Accepted (builds D-263; consistency session 4, docs/specs/consistency.md)
**Pieces on a graphite surface with their kind's band; in focus, beside, and under the HUD the same surface.**
The user asked for session 4 of the consistency plan.
- *Tokens* (`tokens.css`, mirrored in `tokens.ts` `palette.piece`): `--piece` `#121315`, `--piece-head` `#17181b`,
  `--piece-card` `#1d1e22`, `--piece-edge` `#2f3136`, `--piece-mark` `#3b3e44`, `--piece-hi` (1 px top light),
  `--piece-shadow`, `--piece-band` 2 px, `--piece-card-edge` (transparent; `#e6e6e8` in light, where the surface is as
  white as what's held on it). Light: `#fff`, `#f7f7f8`, `#fff`, `#d4d5d8`, `#c9cbd0`, a soft shadow.
- *How it reaches everything:* a framed piece (`.piece:not([data-open])`) sets `--bg` → `--piece`, `--bg-raised` → `--piece-card`, `--grid-mark` → `--piece-mark` for what's
  inside them, so the cards, tasks, sheets, heads, the matrix's paper and bands, text's shades and bars, the name's
  notch and the console all sit on the surface without each file changing (`CellDots` reads them from its canvas's
  computed style). Since D-289 a piece in focus (`.focused`), a pane beside one (`.pane`) and an unframed piece keep the
  page's `--bg` (black) and take only `--bg-raised` and `--grid-mark`; the focus dock takes `--bg` and `--piece-edge`.
- *The piece:* `--piece` fill, `--piece-edge` edge, the shadow and top light; `::after` the band, 2 px over the top
  edge in `--kind` (plane `--fg`, matrix `--link-solves`, table `--link-part`, kanban `--link-draws`, documents and
  document `--link-depends`, timeline `--link-competes`); the name's notch cuts it. Unframed pieces keep none of it
  (D-267 is session 6).
- *Held things in light theme:* plane cards, packages' bands, tasks and card sheets, timeline sheets, matrix card heads
  get `0 0 0 1px var(--piece-card-edge)` with their type edge (the preview's).
- *The HUD in focus:* was `html[data-in-focus]` turning the HUD's shades to `--piece`; gone with D-289 (the focus is
  the page's black again).
- *Not changed:* `--piece-head` has no user yet (no piece has a separate head row's fill); the plane console, name and
  marks look are sessions 5–6.
- *Verified:* headless on the emulators, dark and light: the canvas (six pieces graphite / white with their bands, the
  page round them), a plane in focus (graphite page, `+` marks, cards a step lighter; light: white, hairlined cards),
  a matrix and a kanban in focus, the HUD's shades on the surface. Build.

### D-275 · 2026-10-27 · Accepted (builds D-264; consistency session 5, docs/specs/consistency.md)
**A piece's console shows only while the piece is pointed at, built and broken cell by cell; it grows as the canvas
zooms out; something new in its comments stays as a small magenta tab; a first tap shows it, a second goes in.**
The user asked for session 5 of the consistency plan.
- *When:* `PlaneConsole` takes `shown` (the pointer on the piece, a tap, or its setup open when unframed, D-228) and
  shows anyway in edit mode or with keyboard focus inside it (focus in, focus out of the whole console). Coming on it
  builds with D-034's cells (`runCells`, 170 ms), going it breaks (90 ms); hidden it takes no pointer. Reduced motion:
  at once. Every piece's console, framed or open.
- *Fresh:* while hidden, comments inside with something new for you (`fresh`) keep a small tab of their own on the
  same spot, a magenta edge, the icon (or `@`) and the count, opening the threads panel on them.
- *Size:* `--cs` on the piece, `min(1.4, max(1, zoom^-0.5)) / zoom`: 11 px on the screen at 100 % and over, 13.1 at
  70 %, 15.4 at 50 % and under; padding, gaps, the magenta marks, its edge, the dropdown's text and the comment icon
  by the same factor. Before, it shrank with the canvas. It stands on the bottom-right corner, `16 × --cs` in, and on a
  piece narrower than it runs past the left edge. Edit mode no longer steps it 40 px clear (the grips are on the ring
  now, D-273).
- *Touch:* a tap (under 5 px of travel) on a piece out of edit mode shows its console; a second tap focuses it; a
  press anywhere else lets go.
- *Verified:* headless on the emulators: hidden at rest (clip-path, no pointer), pointed at: part built at 80 ms, whole
  at 380, gone on leaving; Bob's comment inside the plane gave Alice the magenta `▢ 1` tab; zoomed out to the floor its
  height stayed 40 screen px (1.4 ×); edit mode kept it with the pointer away; reduced: on and off at once; two taps:
  shown, then `?focus=p1`. Build.

### D-276 · 2026-10-27 · Accepted (builds D-266 and D-267; consistency session 6, the plan's last, docs/specs/consistency.md)
**Names and lines: magenta numbers, one edge-name geometry; unframed pieces as ink on the canvas, a small line for a
name, the console hanging under them, and a cell-by-cell turn between framed and unframed.**
The user asked for session 6 of the consistency plan.
- *Numbers (D-266):* a piece's name taken apart when it starts with a number (`01 Pazar` → magenta `01`, then `PAZAR ·
  PLANE`; `numberOf` in CanvasView, the heading kicker's pattern); kanban column numbers and the suggested order's
  (`Kanban.module.css .n`) and the right panel's section numbers (`SidePanel.module.css .n`) magenta, faint before.
  Sections' and headings' small lines were magenta already.
- *Edge-name geometry (D-266):* a piece's name in its edge: `16 px` lead, `8 px` clear each side, in screen px (`/ --z`);
  a section's: the same in its space's px (lead line 16, padding 8; before, both grew with the name's size).
- *DESIGN.md:* "Names and lines on the canvas" holds D-266's two voices, numbers, edges, bands, and D-267.
- *Unframed (D-267):* no fill, edge, shadow or band (D-274's surface already skipped open pieces); the feathered paper
  box under the contents is gone except for a single document (a page of text); instead each head and cell of a
  matrix, a table's rows and heads, a kanban's heads and tasks, a list's rows, head row and sheets have a `::before`
  shade under them (page 80 %, `0 0 16px 10px` at 72 %, z-index −1 so no neighbour's covers another's text); a table's
  and list's solid fill off. The name: `04 ── RIVALS · TABLE`, mono 11 screen px, caps, .14em, the number magenta, a
  short rule after it (only with a number), 8 px over the contents at their left, on a hugging shade. The console:
  hanging 10 px (× `--cs`) under the contents' right end, its own edge all round, on D-275's hover rule.
- *Going between (D-267):* `PieceBox` sees `open` change (from anyone) and for 320 ms draws the window as it was
  (`.ghostWindow`: the surface, edge, shadow, band) breaking (unframing) or building (framing) with `runCells`, while
  the contents' view is eased (both ends) from fitted in the window to their own size, or back (`between`); framing,
  the piece shows no frame of its own until the copy has built. Reduced motion: at once.
- *Verified:* headless on the emulators: `01 PAZAR`, `02 WORK`, `04 RIVALS` with magenta numbers; a table unframed and
  framed again (frames 40 ms apart: the window's cells going, then coming; reduced: no copy at all); unframed table,
  kanban, list and matrix on the canvas with their small-line names and row shades; the hanging console. Build.
- *Still asked, not decided:* text's shade hugging each line (`<Ink>`) and one family of rules (spec "Asked, not
  decided").

### D-277 · 2026-10-27 · Accepted (the consistency spec's "Asked, not decided", chosen by the user: "İkisi de, önce <Ink>"; changes D-190's shade behind text)
**Text on the canvas sits on ink, line by line; one family of lines: straight holds, fading opens, dashed separates
rows, a magenta lead starts something numbered.**
- *Ink:* `src/ui/Ink.tsx` (`<Ink>`, `inkClass`): an inline shade on each line of text, as long as the line
  (`box-decoration-break: clone`), the page (or the piece's surface inside one) at 84 %, feathered `0 0 12px 8px` at
  70 %. On a heading's text and its small line, a paragraph's lines (`LightMarkdown`'s `ink`), the project title's
  PROJECT, name and description, a section's number and name. It replaces D-190's one feathered box per item (a box as
  wide as the longest line, its holes in the backdrop); that box stays only while the text is typed in
  (`data-typing`), since its fields have no ink. Sticky notes keep their paper; unframed pieces' rows their D-267
  shades.
- *Lines:* an H1's fading rule starts with a 24 px magenta lead, as the project title's does; a panel section's rule
  (`01 STATUS ──`) starts with a 12 px one. Containers' edges (straight, edge grey), the title's and H1's fading rules,
  dashed rows (tables, lists) were that way already.
- *Verified:* headless on the emulators: the canvas's title, heading and a three-line paragraph on ink; a plane in
  focus (its text's ink the surface, so unseen); the H1's and the panel's magenta leads. Build.

### D-278 · 2026-10-27 · Accepted (a speed fix; the user: "sorun zoom da")
**While the canvas zooms, only its transform changes; what's held at screen size (piece names, consoles, marks, text's
bars, chips) follows once the zoom stops.**
- *Why:* every wheel step wrote the zoom into the pieces' and text's styles (`--z`, `--zs`) and props, so the browser
  restyled everything on the canvas and React drew every piece's contents again: 131 ms a step in a 7.5k-node
  workspace. Now 10 ms.
- *How:* CanvasView's `useShownZoom`: the camera's zoom 120 ms after it last changed, taken at once on a pointerdown
  (`flushSync`) so a drag always reads the zoom it's under. Spaces inside pieces take `--zs` from the piece's `--z` in
  CSS (`zsIn` in Marks.tsx), never by subscribing to the camera. The Marks' L's transition only unscaled registered
  lengths (`--mo`, `--ml`), so a change of `--zs` never starts a transition.
- *Seen:* during a wheel or pinch (and a glide) names and marks grow and shrink with the canvas, then settle to their
  screen size in one step. Alternatives: updating them every step (the lag), throttled every ~100 ms (a hitch each
  time).
- *Not yet:* a focused space's own zoom (`planeCam`) still redraws its contents and restyles them each step (its pans
  no longer do, D-279).

### D-279 · 2026-10-27 · Accepted (a speed fix, nothing visible changes; the user: "tasarımı ve davranışı değiştirmeden")
**A pan, on the canvas or in a focus, changes only the world's transform: nothing inside it is drawn or restyled
again. A value written on every pan or zoom step never goes on an element that holds the contents.**
- *Why:* measured on the emulators (3 planes × 25 cards, text, matrix, table and kanban unframed, timeline, documents;
  2560 × 1300 at 2×, production build): a focused plane's pan restyled everything in it each step, because the plane's
  `+` marks' `--mark/--mx/--my` sat on the layer holding the cards (custom properties inherit), and every card, Marks
  and link was drawn again, because PlaneCards took the whole view; kanbans and timelines the same; on the canvas
  CanvasView and every PieceBox were drawn again on each step because CanvasView read the camera.
- *How:* FocusedPlane's marks are an element of their own (`.focusMarks`) under the contents; PlaneCards, the task and
  card kanbans and the timeline are a thin shell that moves the world, the contents memoised on the zoom
  (`PlaneInside`, `TaskBoard`, `CardBoard`, `Days`; the card panel memoised too); CanvasView no longer subscribes to
  the camera: `World` renders the transform, `useShownZoom(wid)` listens to the store, `DocPlaceHere` follows the
  camera for a document being placed. PieceBox didn't need memo once CanvasView stopped drawing on a pan.
- *Measured (prod, per 60 steps):* focused plane pan: style 152 → 10 ms, script 83 → 44, main thread 5.2 → 1.7 ms a
  step; kanban pan: script 115 → 42; timeline pan: 90 → 49; canvas pan: script 77 → 45. Screenshots before and after
  pixel-identical (dark, light, reduced motion); card drag, alt box select, task drag and click, zoom settle (16.5 /
  18 px) and a drag 20 ms after a zoom (200.4, 100.2 px) unchanged.
- *Not yet:* zooming in a focus still writes `--zs` each step on the world: 18.7 ms of style a step in a focused table
  (450 Marks), 10.6 ms in a matrix. Settling it as D-278 does on the canvas is visible (marks grow and shrink with the
  zoom, then settle): asked the user. One Firestore write still draws nearly every piece (~1,100 components, 20–30 ms
  of main thread on the watching page): `useWs` is one context and each snapshot makes new arrays. Zoom in a focus:
  done by D-280.

### D-280 · 2026-10-27 · Accepted (the user, asked about D-279's *Not yet*: "evet uygula")
**Zooming in a focus settles as on the canvas (D-278): a wheel step moves only the view's transform; marks, chips and
handles inside grow and shrink with it and go back to their screen size 120 ms after it stops, at once on a press.**
- *Why:* every wheel step in a focus wrote `--zs` on the world, restyling every Marks inside: 18.7 ms of style a step
  in a focused table (450 Marks), 10.6 in a matrix; a plane and a kanban drew all their cards or tasks again on each
  step (their contents were memoised on the zoom).
- *How:* `useSettledZoom(view.zoom, live)` (`src/ui/Marks.tsx`, with `ZOOM_SETTLE_MS`, shared with CanvasView's
  `useShownZoom`): the zoom as shown while live, the zoom itself otherwise. Each space's `zsIn` and its memoised
  contents (`PlaneInside`, `TaskBoard`, `Days`) take it; the transform, culling, the detail level, a matrix's dots and
  a table's width grips keep the live zoom.
- *Measured (prod, 60 wheel steps, 2560 × 1300 at 2×):* main thread table 1924 → 461 ms (style 971 → 48; it dropped
  frames before: 194 frames for 60 steps, now 138), matrix 1089 → 217 (style 597 → 19), plane 312 → 123, kanban
  304 → 123. Marks' L 12 px → 17.2 during a zoom in, 11.98 after 300 ms, 11.99 at once on a press; the same in table,
  matrix and timeline. Settled screenshots identical (plane, table, matrix, kanban; light; reduced motion); card drag
  after a zoom, alt box select, pan, task drag and its panel unchanged.


### D-281 · 2026-10-28 · Agreed, not built (brings D-139/D-140's cards on many planes back, on 1.5's planes; spec docs/specs/shared-cards.md)
**One card on many planes: bring existing cards from other planes in, by search.** User: "planedeki cardlara başka
planelerde oluşturulan cardları eklemek. Buna bütün cardlar dahil. Ya yeni card ekleyebiliyorsun da existing cardlardan
search yapıp ekleyebiliyorsun". The user took every recommendation:
- *The same card, not a copy:* one card, its own spot on each plane; moving here (off the plane it came from) offered too.
  Data: the card's `pieceId`/x/y stay its home, every other plane a `places/{planeId}_{cardId}` doc (not `placements`:
  1.0's docs still sit under that name, D-248). The home is never shown; taking a card off its home moves the home.
- *Delete* on a card also elsewhere takes it off this plane; `delete everywhere` via right-click and the panel, hazard confirm.
- *Parts and members come along* (a `part of` tree, a package's members), their layout kept.
- *Extras:* a `⧉ N` mark, `≈ … [use that one]` while naming a new card, folding per plane, a `PLANES` panel section.
- *Alternatives:* copies (⌘C/⌘V already; they drift apart, links split); move only (a card still on one plane); a map of
  spots on the card doc (rules can't check a map's values, and undo restores the whole card).
- *Not yet:* built in five sessions (the spec); ⌘V of the same cards across planes (⇧⌘V) left for later.

### D-282 · 2026-10-28 · Accepted (D-281's session 1: the data layer)
**Places, the data under one card on many planes.** Built as docs/specs/shared-cards.md's session 1 says:
- *Data:* `places/{planeId}_{cardId}` `{ planeId, cardId, type, x, y, folded?, createdAt }`, loaded with the workspace
  (one whose card or plane is gone skipped). `src/data/places.ts`: `cardsOn` gives a plane's cards with their spot there
  (`on` set on placed ones; the same object while nothing changed, D-279), `bringIn` (parts and members along, layout
  kept from the first card's home, clear of what's there; `move` moves the home instead), `takeOff` (off its home: the
  home moves to the earliest other plane, its spot and fold with it), `planeGoes` for `deletePiece` (cards also elsewhere
  stay, with their links). Moves and folds of a placed card write its place (`cards.ts` `spotRef`); deleting a card
  takes its places. Export/import carry them (new ids; a place on the card's home, or whose card or plane didn't come
  over, left out).
- *Rules:* `validPlace`: keys, the id fixed by the two, `type`, x/y. Existence of the plane and card is not checked: a
  batch's rules may read at most 20 documents, and placing a tree of parts or undoing a plane's delete writes more.
- *Verified:* rules tests 429/0 (16 new: editor writes, moves, folds, takes off; wrong id, unknown type, no spot, a title,
  a string fold denied; viewer denied). In headless Chrome through the app's own modules on the emulators (26 checks):
  a feature brought with its part, the part's offset kept, clear of a card there; a package with its member; nothing
  twice; `cardsOn` same objects; a move and a fold on P2 touch only the place; take off and ⌘Z; off its home moves the
  home with spot and fold; a card on one plane only not taken off; move here; deleting P1 keeps the three cards also on
  P2 (home moved) and their links, takes the card only there and its link, ⌘Z brings it all back exactly; delete
  everywhere takes places; export → import keeps every place under new ids. The workspace page opens without errors.
  `npm run build`.
- *Not yet:* sessions 2–5 (nothing draws a placed card yet). Rules not deployed.

### D-283 · 2026-10-28 · Accepted (D-281's session 2: planes draw and move placed cards)
**A plane shows the cards brought from other planes as its own; Delete takes a shared card off this plane only.**
Built as docs/specs/shared-cards.md's session 2 says:
- *Drawing:* CanvasView's per-plane lists come from `cardsByPlane` (places.ts), so a plane's picture, its focus,
  fit, guides and box select take placed cards; `planeCtx`, the layout's fit and `+`, the finder's preview and Beside's
  glide go through `cardsOn`. Others' selections by `planeOf`. LensCardPanel no longer opens a second panel for a
  card placed on the plane in focus.
- *Writing:* a drag, a group move, line up / space out and a fold of a placed card write its place (`spotRef`;
  `moveMany` leaves `updatedAt` off a place); `foldCard` replaces the folded `updateCard`. A package is made at home on
  the plane it's made on.
- *Delete (the user's rule):* `deleteHere` (selection.ts): cards also on another plane come off this one, the rest are
  deleted with their links, text too, one undo step; the toast says `Took "Shared idea" off this plane · still on 01
  Pazar`. The right-click on a shared card: `take off this plane` (⌫, not red) and `delete everywhere` (red, through
  the hazard confirm, `useCanvasView.deleting`); several: `take N off this plane` / `remove N` + `delete everywhere`;
  the panel: `delete everywhere` for a shared card, its several's button the same as Delete. A plane's delete confirm
  says `3 cards on it are on other planes too and stay there.`
- *Verified* in headless Chrome on the emulators (dev, 1400 × 900): the canvas draws F, its part and an idea on both
  planes; a drag on Rivals moved the place +100, +50 and not the card; Delete on a shared idea took it off with the
  toast above, ⌘Z back; Delete on a card only there deleted it and its link, ⌘Z back; the menu's items; `fold 1 part`
  folded only the place; `delete everywhere` asks (screenshot), cancel leaves it; shift-select of a shared and an only-
  here card, Delete: one off, one gone, one ⌘Z for both; the plane delete's line. Pan, 60 steps, React components
  rendered (DevTools' way, bailed-out subtrees skipped): Rivals (placed cards) 180, Pazar (none) 180, the shells only,
  no card. Writes from a workspace tab reach the emulator late (state.md's known issue): the check waits for each.
  `npm run build`.
- *Not yet:* sessions 3–5 (bringing cards in from the UI, the panel's PLANES and `⧉ N`, the rest of the app).

### D-284 · 2026-10-28 · Accepted (D-281's session 3: bringing cards in)
**`existing card…` in the `+` and in the right-click's `add a card here` turns the menu into the list of cards on other
planes, where it was.** Built as docs/specs/shared-cards.md's session 3 says:
- *The list* (`BringCards.tsx`): every card not on this plane, `# customers … # packages` in the chain's order, by
  title; a row `› ▌ Parent feature   +1 part · 01 PAZAR` (type colour, what comes along, the planes it's on, caps);
  typed, it narrows by title, type, tags and plane names. Opened beside the `+` (as its menu was) or where the
  right-click menu was, through `ContextMenu` with its own prompt (`> bring a card from another plane…`), 400 px wide,
  the foot `6 cards · ↵ bring · ⇧↵ more · ⌥↵ move here`. Closes on Escape (focus stays), a click outside, the wheel, or
  a change of plane.
- *Enter* brings the card with its parts or members to the view's middle (from the `+`) or round the pointer (from the
  right-click), clear of what's there, selected; the view glides only when it lands off screen. *⇧Enter* brings it and
  keeps the list open (the card leaves the list). *⌥Enter* moves its home here instead.
- *Menu:* `MenuPanel`'s `onSelect` gets `{ shift, alt }` (Enter on the field or an item, or a click) and may return
  `'keep'`; items may carry `words` to be found by; a `keys` line for the foot. Other menus unchanged.
- *Data:* `bringIn` says at once what came and the box it lands in; the write goes on behind (`written`).
- *Verified* in headless Chrome on the emulators (20 checks): `+` → `e` → Enter opens it; the order; a card already here
  left out; `+1 part`, `+1 inside`, `01 PAZAR`; the foot; `crm` finds Crewly by its tag; Escape closes, focus kept; Enter
  brought a feature with its part 150 px under it near the view's middle, clear of the card there, selected; ⇧Enter kept
  the list and the card left it; ⌥Enter moved a competitor's home; the right-click's list opened at the pointer and a
  package came with its member round it; one ⌘Z took both off; all drawn on the plane. `npm run build`.
- *Not yet:* sessions 4–5 (the panel's PLANES, `⧉ N`, `use that one`; the rest of the app).

### D-285 · 2026-10-28 · Accepted (D-281's session 4: the panel and the marks)
**A card says it's on several planes, its panel lists them, and naming a new card offers the same one from another
plane.** Built as docs/specs/shared-cards.md's session 4 says:
- *`⧉ N`* at the end of a card's foot when it's on more than one plane, the number magenta (D-276), titled `On 2
  planes: the same card on each`; `factsOf` takes how many planes each card is on.
- *PLANES* in the card's panel, after the links (numbered with the rest): a row per plane in the link rows' look, its
  leading number magenta, `here` on the one in focus, `×` on hover while it's on two or more (off that plane; off the one
  in focus lets go of it). A name goes there: the one in focus glides to the card, another goes into that plane's focus
  and glides to it (`useGoTo`). `+ place on` lists the other planes; one picked brings the card (with its parts or
  members) right of that plane's cards, the toast `Brought "Parent feature" to 03 Ops`. The head counts them when two or
  more.
- *`use that one`* (D-250's naming): under the new card's title field, up to three cards of its type on other planes
  whose title holds what's typed (two letters on): `≈ Crewly  01 PAZAR  [use that one]` (cyan). `↓` goes into them,
  Enter or a click brings that card where the new one was, selected, and the new one goes as if never made: one undo
  step, the bringing. Nothing alike: Enter keeps the new card as before.
- *Verified* in headless Chrome on the emulators (23 checks): `⧉ 2` with the number in the magenta token, none on a card
  on one plane; PLANES with both and `here`, counted, `place on` → `03 Ops` brought the feature with its part and said
  so, three rows then, `×` took it off Ops only; naming a competitor `crew` offered Crewly from `01 PAZAR`, a click
  brought it, the new competitor gone, Crewly selected, the last step `bring a card here` and no `add a competitor`, ⌘Z
  took it off with nothing left; `↓` Enter the same; `Zebra Labs` offered nothing and Enter kept it; `01 Pazar` in PLANES
  went into Pazar's focus. `npm run build`.
- *Not yet:* session 5 (matrix, table, kanban, finder, comments and the panel's own lists counting placed cards).

### D-286 · 2026-10-28 · Accepted (D-281's session 5: the rest of the app; the feature complete)
**Everything that asks "the cards on this plane" counts the ones brought there.** Built as docs/specs/shared-cards.md's
session 5 says:
- *How:* a card carries `planes` (every plane it's on, its home first) when that's more than its home, set where the
  workspace's cards are built (`workspaceData`; cards on one plane stay the same objects); `isOnPlane(card, plane)`
  (cards.ts) answers it without passing places around.
- *Where:* a matrix's one-plane axis (`entriesOf`, and its setup's counts); the table's `plane is` rule (`meets`: on any
  of the planes; `is not` the rest) and its plane column (every plane, home first); a kanban stuck to a plane, its cards
  (`heldCards`) and its tasks (`shownTasks`), the timeline through it; the panel's `≈ our` features and `in package` (on
  the plane looked at) and a package's holds picker; making a card from the panel (`make`, Tab's next) on the plane looked
  at, under the card's spot there. The finder lists a card under every plane it's on, at its spot there.
- *Comments:* a card's chip was already drawn wherever the card is; now `threadIn` makes a card's thread inside every
  plane the card is on, for the plane's `[💬 N inside]` and the threads list's `inside "<plane>"`; its pin is its spot on
  the plane in focus, so "go there" from a plane the card is on stays there. A new comment's `planeId` is the plane it's
  made on (D-283). The list's row still says where it was started (`on 01 Pazar ↗`).
- *Verified:* through the app's modules in headless Chrome (cards with `planes`): features on Rivals = the one at home
  there + the brought one; ideas on Rivals = only the brought one; `plane is Rivals` = B, F, I and `is not` = X; a card
  kanban stuck to Rivals holds the brought feature; a task kanban stuck to Rivals shows the brought card's task and not
  the one of a card only on Pazar; `threadIn` true for Rivals, false for a third plane. On the emulators: the finder found
  "Parent feature" under 01 Pazar and 02 Rivals; the threads list `INSIDE "02 Rivals"` showed the thread made on Pazar,
  its chip under the card on Rivals (screenshot). `npm run build`.
- *Not yet* (the feature's leftovers): ⌘V of the same cards across planes (⇧⌘V); a thread's row saying where the card is
  as well as where it was started.

### D-287 · 2026-10-29 · Accepted (D-279's *Not yet*: one write drew every piece; the bundle one chunk. The user: "4 ü yapalım")
**A change draws what it changed; the workspace's code is its own chunk.** Nothing visible changes.
- *Why:* measured on the emulators (3 planes × 25 cards + links + text, a matrix of features × competitors, a table of
  every card, a kanban with 12 tasks, a timeline; dev, React components rendered the DevTools way): one write from
  someone else drew 918 components on the canvas, 1110 in a plane's focus, an idea renamed or a heading retyped on another
  plane alike (393 / 585). Three causes: every snapshot made a new object for every doc in its collection; the context
  value changed with any data (every `useWs()` reader drew again: each card reads `wid`); lists were built again whole
  (per-plane cards, a matrix's heads and cells, a table's rows, a kanban's tasks).
- *How:*
  - `useQuery` (hooks.ts) keeps an unchanged doc's object (`docChanges()`); `toCards` keeps its card (WeakMap); the derived
    lists (`useSame` in workspaceData: places, labels, threads, cards with `planes`) and the data object are kept while
    the same; CanvasView keeps each plane's lists (`keepLists`).
  - `useWs()` (context.ts) reads from a store and notes the fields a component reads; it draws again only when one of
    those changes. A field read later (a handler) is the current one. `useWsNow()` reads without listening (a card's link
    drag reads every card and link only then).
  - Memoised on what they show: a plane's cards (`CardBox`, props compared two levels down), a table's rows (`RowName`,
    `RowCells`, names then cells as before so the page's order is the same), a matrix's heads (`Head`, `alikeProps`), a
    kanban's tasks (`Slotted`). Their handlers read a ref (`acts`, `headActs`, `taskActs`), so two handlers do the same.
    A matrix's and a table's rows are kept while each is the same (`useKept`, kept.ts).
  - Code split: the workspace route is `lazy` (`src/app/chunks.ts`); while it loads the curtain holds (D-025); signed in,
    it's fetched when the page is idle. Pages drops old chunks on deploy: a tab that can't load the chunk reloads once (not
    again within a minute). A failed fetch ahead only waits.
  - `SCALES` and `newId` moved to `src/data/scales.ts` (no run-time imports): `matrix.ts`, `pieces.ts` and `table.ts`
    import each other, and with the split `table.ts` ran before `SCALES` existed (the landing crashed in the build).
- *Measured (dev, components on one write; before → after):* canvas: an idea renamed 918 → 194, a feature renamed 918 →
  208, a heading on another plane 393 → 95; in a plane's focus 1110 → 243, 1110 → 257, 585 → 109. What's left is each
  piece's frame and the HUD (CanvasView draws again). Production, script per write (backdrop off, median of three):
  8 → 5 ms, 9 → 5, 4 → 3; in focus 11 → 6, 8 → 5. Bundle: 2.69 MB (778 KB gzip) → main 2.22 MB (649 KB) + the workspace
  467 KB (148 KB).
- *Verified:* screenshots of the production builds before and after pixel-identical (canvas, a plane in focus, the table,
  the matrix); a feature renamed from outside shows on its card, its table row, its matrix head and its three tasks, a
  second rename too, the old name nowhere; a table row's name and a matrix head pick their card; a task dragged to the
  next column; a link drawn from a card's handle; D-284/D-285's checks pass again. Split (production builds, a server
  that can drop files): fetched ahead once signed in, a deep link opens, the list opens one, and after a "deploy" (the old
  chunk gone) opening a workspace reloads once onto the new version and opens. `npm run build`.
- *Found:* on the emulators Chrome stalls the 6th page load in one tab ~60 s (connections per host), the old build too.
- *Not yet:* each piece's frame still draws on any change (CanvasView reads the cards; PieceBox isn't memoised); three.js
  and Firebase stay in the main chunk (the landing needs both).

### D-288 · 2026-10-29 · Accepted (D-287's *Not yet*; the user: "şimdi geri kalanları hallet")
**A piece's frame draws only when it changed; the libraries are files of their own that survive a deploy.**
- *Frames:* `PieceBox` is memoised on what it shows (`alikeProps`), its `onFocus` reading a ref. Its `[💬 N inside]`
  count reads the plane's own cards (its `cards` prop, brought ones too) instead of every card: listening to every card
  drew every frame on any card's change. Measured (dev, one write from outside): a heading retyped on another plane
  95 → 51 components, a card renamed 186 → 145, a feature 255 → 159; no other plane's frame draws.
- *Libraries:* `vite.config.ts` puts three.js (+ @react-three), Firebase and React (+ react-dom, the router, motion,
  zustand) in chunks of their own (Rolldown `codeSplitting.groups`), named by their contents: a deploy that changes the
  app renames only the app's files (checked: a word changed on the landing, the three library files kept their names).
  The landing still needs all three at once, so the first load is the same size (the app's own entry 137 KB, 50 KB gzip;
  React 123, Firebase 230, three 246 KB gzip; the workspace 148 KB); a returning visitor after a deploy downloads ~200
  KB instead of ~800.
- *Verified:* production screenshots pixel-identical to the build before D-287 (canvas, a plane in focus, the table, the
  matrix); the split check (fetched ahead, a deep link, the list, a deploy in between: one reload onto the new version);
  D-287's behaviour check (a rename shows everywhere and the old name nowhere, picks, a task dragged, a link drawn) and
  D-284's. `npm run build`.
- *Found:* on the long-running Firestore emulator (8080) one workspace's live updates stopped (writes never reached a
  watching tab); a fresh workspace on the same emulator was fine (86 ms).

### D-289 · 2026-10-29 · Accepted (changes D-262's `shows`, D-267's unframed fill, D-274's focus surface; the user's list of small details)
**Unframed pieces sit on a black page and are only as big as what they show; a piece in focus is on black; the timeline
unframes and loses `shows ▾`; dropdowns in a console or dock are plain text.**
The user, six points: unframed pieces have no background ("sometimes it can be hard to see the components inside, so
please make them have a black background"); the timeline's `shows` dropdown isn't needed ("I can link components if I
want ... there is also an individual link button"); the dropdown with a search in a console has a black fill and a border
("It should look like how link dropdown is looking"); the timeline has no unframed look ("lets add it like the others");
unframed, pieces take more room than they need ("check kanban ... actually all of them"); framed pieces are lighter
(graphite) on the canvas, but "their bg should switch to black when they are focused".
- *Unframed on black:* `.piece[data-open]` fills with the page's `--bg` (black; `#f5f5f5` in light), its edge feathered
  (`0 0 14px 8px`, never a box); what it holds takes `--bg-raised: --piece-card` and `--grid-mark: --piece-mark`
  (cards and tasks on #0b0b0b vanished on black). The document's own feathered paper (`openPaper`) went: the piece is
  the paper now. The rows' hugging shades stay.
- *Unframed size:* a kanban's box was its window's (shownBox only knew matrix, table, documents); it now reads the
  kanban's measured board (`useKanbanSizes`, which fit already used); the timeline writes its days' size (`useOpenSize`);
  an empty table no longer reserves a row (`tableBounds`). Both stores live in a leaf module `sizes.ts` (no import
  cycle: one crashed the split build, D-287). CanvasView redraws only when an unframed kanban's size changes. Measured
  (headless, every kind unframed): each box is its contents plus the 25 px margin and 50 px foot, nothing more.
- *Timeline unframed:* `canOpen` and the rules' `open` take `timeline`; on the canvas it's live at its own size, its
  console `link ▾ [‹] [today] [›] [focus] [edit]` (its filter and rows stay in its focus), `[unframe]`/`[frame]` in edit
  mode, the same cell-by-cell morph.
- *`shows` gone:* `timelineKanbans` = the kanban it's linked to (its console's `link ▾`), else every kanban. The
  `timeline.kanbans` field stays readable (rules, export) and is ignored.
- *Plain dropdowns:* `Menu`'s `plain` look, `label value ▾` in text like the link `Select` (no frame, fill or rule;
  active value cyan), for the dropdowns in a dock: a plane's `view`, a kanban's `lanes`/`rows`, a timeline's `rows`. The
  filter strips over a dock keep framed dropdowns (a row of filters, not a console). No console on the canvas has a
  `Menu` now (`shows` was the only one).
- *Focus on black:* `.focused` and `.pane` no longer set `--bg` → `--piece`; the focus dock's fill is `--bg`; the HUD's
  `html[data-in-focus]` rule and its marker went. On the canvas framed pieces stay graphite (D-263).
- *Verified:* headless on the emulators, dark and light: every kind unframed (sizes measured as above, the page black
  under them, stars kept out), a plane, a kanban and a timeline in focus (black, docks plain), the timeline unframed and
  framed again from its console with no errors; rules tests 430/0 (a new one: a timeline opened onto the canvas);
  the production build loads a workspace.
- *Rules:* `firestore.rules` changed (`open` on timelines): **not deployed yet**.
- *Not yet:* a paged table's last page is still sized for a full page; a viewer's table keeps the `+` column's width.

### D-290 · 2026-10-29 · Accepted (D-286's *Not yet*: one card on many planes closed; the user: "4 ü yapalım. Bir kart birden fazla olayını da kapatalım")
**⇧⌘V brings the cards copied as the same cards; a card's thread says where the card is.**
- *⇧⌘V* (`pasteSame`, selection.ts): the cards copied (⌘C, in this tab) come to the plane in focus as the same cards
  (`bringIn`), with their parts and members, laid out as on the plane they were copied on (`bringIn`'s `layout`), at the
  view's middle, selected; one undo step; the toast `Brought the same 2 cards here`. Those already here: `That card is
  already on this plane`. Text isn't shared: with text copied too the toast adds `text isn't shared: ⌘V copies it`. ⌘V
  still copies. The right-click on the plane offers `the same card here ⇧⌘V` next to `paste it here`, round the pointer.
- *Threads:* a card's thread is where the card is (`threadSpace`, CanvasView): the plane in focus when the card is on it,
  else the plane the thread was started on while the card is still there, else the card's home. The threads list's row
  says that plane, `+N` when the card is on more (`on 02 Rivals +1`), nothing when it's here; "go there" goes there.
- *Verified* on the emulators in headless Chrome, in a worktree with only these changes (another session was editing
  the same files): ⌘C on Pazar, ⇧⌘V on Rivals brought the feature with its part (places, 150 px apart as on Pazar),
  selected, the toast; again: `already on this plane`; ⌘V made one copy; the right-click's `the same card here` brought
  it round the pointer on Ops; the card taken off Pazar (its home to Rivals): from Pazar the row reads `on 02 Rivals +1`,
  from Ops (where the card is too) no other plane. `npm run build`.

### D-291 · 2026-10-29 · Accepted (the user's list for the plane: "+ butonuna basınca çıkan existing cardları seçince çıkan dropdown scroll olmuyor…")
**Plane details: the existing-card list scrolls, `existing card…` last under a rule, card faces a dark tone of their type,
a paragraph's landing L's on the grid, a section or package dragged shrinks as one.**
- *Scroll:* the right-click menu (`ContextMenu`, also the cards-to-bring list) closed on any wheel; now only on a wheel
  outside it, so its list scrolls (the canvas and plane already skip `[role=menu]`).
- *Order:* in the `+` (focus) and the plane's right-click, `existing card…` is the last item, under a plain rule. A
  `MenuEntry` heading with empty text draws as that rule (`Menu.module.css .rule`, `role=separator`).
- *Card faces:* the user's feedback: "arka plan da soldaki şeridin daha koyu bir tonu olabilir". `--card-tint` (16 %, light
  9 %) of the type's colour over `--bg-raised` on plane cards, a competitor's feature rows (`.mini`), a package's band and a
  matrix's card heads. Idea's colour is white, so its face is a lighter grey. Kanban sheets, table rows and timeline bars
  are unchanged.
- *Paragraph:* its marks had `pad` 7 like headings, so its landing L's were 7 px outside the box and never on the grid's
  `+`. A paragraph's hairline is its left edge on the grid, so its marks go on its edges (`pad` 0) like a sticky's.
- *Shrinking as one:* the scaling already shared one point; what looked separate was each carried item's own landing
  L's, cards easing to 0.8 in 160 ms while text and sections jumped, and an unfolded package's frame and band not
  shrinking. `dragShift.lead` (a section's own drag, a package's band drag via `startGroupDrag`'s `lead`) is what holds
  the rest: only its `<Landing>` shows. The package's frame goes 0.8 round the point held with its members and has its
  own landing L's. Carried text eases its scale in 160 ms like cards. A selection of several (no lead) is unchanged.
  A package inside a package (the user: "içinde package olan bir package ı taşıyınca, içteki package küçülmüyor") shrinks
  when all its members are carried (an inner package stands in through its members); the outer frame stays full size
  while only the inner one is dragged.
- *Verified:* headless Chrome on the emulators, mid-drag screenshots. A paragraph's L's on the `+` marks. A section with 4
  cards, and an open package with 2 members, shrink together with one set of L's. The bring list scrolled 0 → 517 px and
  stayed open. Faces checked in dark and light. `tsc` clean.
- *Not yet:* kanban card sheets (cards mode) and table rows keep the plain face. Ask before tinting them too.

### D-292 · 2026-10-29 · Accepted (changes D-207's *Not yet*; 1.0's D-155 dropped. The user: "link bükülme noktalarını tamamen çıkar, istemiyorum onu")
**Links are always straight: bend points are gone, not "not yet".** 1.0's board let you put bend points on a link
(D-155); planes never drew them, but links kept any they had and the plan listed them as left to bring back.
- *Removed:* `bends` from the `Edge` type and from `reverseEdge`; an import leaves bend points in an older file out
  (`cleanEdge`); `firestore.rules`' `validEdge` no longer checks `bends` (and its three tests went: 427/0); PRODUCT.md,
  ARCHITECTURE.md, ROADMAP.md, DESIGN.md and the plan say links are straight. Old links in the database that still carry
  `bends` keep the field, unread.
- *Not to propose again:* bend points on links (decisions.md, Rejected).
- *Rules:* changed, not deployed yet.

### D-293 · 2026-10-29 · Accepted (changes D-278's look while zooming; the user: "bu tarz componentleri zoom yaparken render etmesek? … isimler kalsın diğerleri gözükmesin")
**While a space zooms, what's held at screen size is hidden, except piece names.** D-278 lets those things follow the
zoom only 120 ms after it stops, so during a wheel or a glide they grew and shrank with the world; entering a focus the
fit glide left comment chips huge, then they snapped small.
- *How:* each world (the canvas's `World`, and a focus's plane, kanban, card kanban, matrix, table, timeline, documents)
  sets `data-zooming` while its camera's zoom isn't the zoom shown (`useShownZoom` / `useSettledZoom`): written once
  when a zoom starts and once when it settles, never per step (D-279). What's at screen size carries `data-screen-sized`
  and `global.css` hides it under `[data-zooming]` (`visibility`, nothing redrawn), unless the keyboard is in it
  (`:focus-within`). Marked: Marks (L's, handles + readout, peers' L's and tags, `Landing`, `BoxSelect`), consoles (and
  the fresh-comments tab), `ThreadChip`, `LinkBar`, `LabelBar`, a matrix's `cellBar`, `Bond`'s line and notch, guides.
  Piece names stay (the user's choice: a canvas without names while zooming is hard to read). Link chips are in plane px,
  untouched. They come back at once, no cell build (it would play after every wheel stop).
- *Verified:* headless Chrome on the emulators: a plane chip and a card chip `hidden` 40 ms into a wheel zoom on the
  canvas and in focus, `visible` at the right size 400 ms later. `npm run build` clean.
- *Cost:* the user felt a short hitch as a zoom starts. Traced headless (6 planes × 30 cards): hiding adds ~1 ms of
  style and a few ms of paint on the first frame. A Marks span carries `data-screen-sized` only when drawn (not on
  every card); `will-change` on them didn't help. *Not yet:* if it's still felt, measure on the user's machine.

### D-294 · 2026-10-29 · Accepted (D-291's *Not yet*; the user: "kanban ve tablo kartlarını da aynı şekilde boya. Headingi de tam oturt")
**Kanban card sheets and a table's card names get D-291's face; a heading's landing L's sit on the grid all round.**
- *Faces:* a card on a kanban (`.task[data-ccard]`, cards mode, D-268) and a table's name cell for a card
  (`.name[data-card]`) use `--card-tint` of the type, as on a plane. A task sheet (even one for a card, edged in its
  colour) keeps the plain sheet, so tasks don't read as cards.
- *Headings:* their marks went 7 px out, so they never sat on the `+` marks. Now every text's marks are on its edges
  (`pad` 0; only the project title keeps 7). Where a heading or paragraph lands, its box is rounded up to the next
  25 px step (`onGrid`), so all four L's sit on the grid's marks. The top-left was already snapped. Its size comes from
  its text, so only where it lands is rounded, not the item itself.
- *Verified:* headless Chrome on the emulators. A cards kanban and an every-card table on the canvas show tinted sheets
  and name cells. A heading dragged mid-way shows its L's on the grid's marks. `tsc` clean.

### D-295 · 2026-10-29 · Accepted (D-291's tint made some text hard to read; the user: "card içindeki gri yazılar, yada competitor cardındaki featurelar, ayda tagler, vesaire… hepsini kontrol etmeni istiyorum")
**On a tinted card the greys and the type's colour lean to the ink, so every line reads (WCAG ≥ 4.5, dark and light).**
- *Measured:* headless Chrome on the emulators. Every text in plane cards, a competitor's feature rows, a package's
  band, kanban card sheets, table card names and matrix card heads: its shown colour (opacity included) against the
  background behind it, with and without the tint. Before: `--fg-dim` (status, facts, regions) 2.0 in dark (3.1 even
  untinted), `--fg-faint` (a competitor's category counts) 1.3, type labels 3.3–4.2, kanban `◆ low` 1.4, its facts 2.2.
- *Inside `.card`, `.band` and `.task[data-ccard]`:* `--fg-dim` = `--fg` 70 %, `--fg-faint` 62 %, `--placeholder` 52 %
  over the face (transparent mixes, so both themes). The type label (`--type-ink`) and `[+]` are the type 75 % with the
  ink. A clash `!` and a kanban card's `P1` are magenta 60 % with the ink. A competitor's feature rows (`.mini`) are
  `--fg` 7 % over the face (12 % on hover), so they stand apart from it.
- *After:* everything ≥ 4.5 in both themes. An empty card's placeholder ("What hurts?") is 4.2 dark and 3.5 light, a
  hint kept lighter on purpose. Tag chips were already 14–17.
- *Not yet:* a table's `untitled …` name placeholder is still faint (1.8 dark). Table.module.css was left to the table
  fixes another session was about to start.

### D-296 · 2026-10-29 · Accepted (D-207's, D-225's and the table's *Not yet* dropped; the user: "2 yi dropla", "1 çok önemli değil droplayabilirsin")
**No links to a competitor's features, and no dropping a link on a small card: not wanted.** Planes' last leftovers from
1.0's board, listed as "not yet" since D-207/D-225, are dropped rather than built. A competitor's features stay inside
it (D-225) and meet ours through the match (`≈ our`, D-221) and a matrix (D-204, D-249), not through links. Links join
cards, as now.
- *Docs:* PRODUCT.md's "everything can link to everything" and its flow say a competitor's features are matched, not
  linked; ROADMAP.md and the plan drop the line.
- *Also dropped (not important):* the table's small leftovers: a paged table's last page sized for a full page (D-224),
  arrows not stepping onto the next page (D-213), a viewer's table keeping the `+` column's width (D-291), the faint
  `untitled …` name (D-295's note).
- *Not to propose again:* decisions.md, Rejected.

### D-297 · 2026-10-29 · Accepted (changes D-185's "nothing zooms" on the way in; the user: "focustan çıkınca renkler bi anda değişiyor… animasyonla gelsin" and "focus in de ilk önce focus animasyonunun bitmesi bekleniyor, sonra ortalama işlemi yapılıyor. Bunu aynı anda yapamaz mıyız?")
**Going into focus, the view fits while the ink spreads, and the page's colour turns with the ink both ways.**
- *Fit:* `FocusedPlane`'s `onSpread` (once only a matrix's) now runs `arrive` for every piece as the ink starts: the
  view glides to its fit, or the place the finder or a go-to picked, as going out already glided home; `onArrived`
  doesn't go again (`arrivedEarly`). Without the ink (a reload, reduced motion) it's as before.
- *Colour:* in focus `--bg` is the page's black, on the canvas a piece's graphite (D-289), so leaving snapped. `.focused`
  starts with `data-shade='piece'` (`--bg: var(--piece)`) and drops it the next frame; leaving sets it again. `--bg` is
  a registered colour (tokens.css), so it eases (`--shade-ms`: 820 in, 700 out, 420 a matrix) and everything inside on
  `--bg` follows. Reduced motion: no transition.
- *Verified:* headless Chrome on the emulators, sampled per frame: going in, `--bg` rgb(18,19,21) → 0 over ~850 ms and
  the zoom 0.32 → 1.0 by ~450 ms (was: after the ink); going out the reverse. `npm run build` clean.

### D-298 · 2026-10-29 · Accepted (D-262's *Not yet*; the user: "4 ü yap")
**A plane carries what's stuck to it all the way down; going to a task from a timeline stays on the timeline.**
- *Moving:* a plane dragged (or resized) carries what's stuck to it and what's stuck to those (`stuckChain`,
  CanvasView): its kanban and that kanban's timeline, each following the one it's stuck to as before (on its edge when
  touching, by the same move when apart); one undo step. A kanban moved still carries its timeline.
- *Going to a task* (the finder, your tasks, `goToTask`): in the focus of a timeline that shows the task's kanban and
  draws the task (`[data-timeline][data-live]`), it stays there: the task picked (its panel), the view glided to it when
  it's off the screen, the finder closed. A task the timeline doesn't draw (another two weeks, filtered out), or of a
  kanban it doesn't show, goes to its kanban as before; from anywhere else, as before.
- *Verified* in headless Chrome on the emulators, in a worktree with only these changes: a plane dragged in edit mode
  moved its kanban and the kanban's timeline by the same amount, a kanban stuck to nothing stayed, one ⌘Z put all
  three back; from the timeline's focus the finder's "Write the offer" stayed on the timeline, picked, the finder
  closed (screenshot); a finished task with a day stayed too (the timeline draws it); one due next month went to the
  kanban, picked; one of another kanban went to that kanban; from the canvas, to the kanban. `npm run build`.

### D-299 · 2026-10-29 · Accepted (the user: "for kısmında package ekliyeceğimde sadece bikaç tane gösterliyor, ne scroll var ne öneri var. Benim adını önceden bilip yazmam gerekiyor"; then "1 ve 2'yi yap, başla. 3 ü de not düş")
**Picking a card in a panel is the prompt: every card, scrolling, suggestions first.**
- *Why:* `CardPicker` (every picker in a card's or a task's panel: `for`, solves, parts, part of, holds, rests on, a
  task's card) showed the first 8 titles, unsorted, no scroll, no plane; you had to know the name. It said "nothing on
  this plane matches" while a task's picker looked at every plane.
- *Now:* `MenuPanel` (D-222) in place in the panel, framed, at most 360 px, the rest scrolling. Before anything is
  typed: `# suggested` (up to five, with why), then `# customers · 3`, `# problems · 2`… in the chain's order, by title;
  each row `▌ title  planes` (a package `3 inside · 01 PAZAR`). Typed, it narrows by title, type, tags and plane
  (`pack` lists the packages); where a card can be made, `+ "what's typed"  NEW IDEA` comes after what it finds.
  The foot counts every card (`24 cards`).
- *Suggested:* a task's: what this kanban's other tasks are for most (`2 on this kanban`), then the cards on the plane
  the kanban is stuck to (`on 01 Pazar`). A card's: the four nearest on its plane (`nearby`). A suggestion is listed
  again in its type and hidden while typing (`MenuEntry.browse`); `MenuPanel` takes `more(typed)` for the made row.
- *Not yet:* picking on the canvas: with a kanban beside a plane, `[pick on the plane]` turns the cursor into a
  crosshair, cards light on hover, a click sets it, for when you see the card but don't remember its name.
- *Verified* in headless Chrome on the emulators: a task's `for` opened the list (suggested by kanban and plane, then
  each type, 24 cards), `pack` showed the four packages with what they hold and their planes, Enter set "Later"; a
  problem's `+ customer` with "Hotels" offered the new customer row. `tsc -b` clean in the changed files.

### D-300 · 2026-10-29 · Accepted (the user: "kanban setup kısmında tasks ve cards arasında direkt gidip gelebiliyor ancak … önceki tasklar yok olmuyor … 'kaybolmuş' gibi olabiliyor"; offered options in a preview: "01 A, 02 şuanki gibi kalsın …, 03 A ile devam et")
**A kanban (a deck, D-301) never hides tasks; a tasks side view opens from anywhere.** Begun by session 0b4cdc69
(closed by accident before it wrote this entry); recorded from its transcript and finished by the D-301 session.
- *03 A, built, uncommitted:* switching a kanban with tasks to cards asks first (`it holds N tasks`): `[make a new deck
  for cards]` (default: a new one beside it, named `<name> · cards`, setup open on which cards; the tasks stay), or the
  tasks moved to another task kanban (same-named column, else the first) and this one holding cards, one undo step
  (`moveTasksAway` in tasks.ts; the rules already let a task change kanban). One that hid tasks before this shows a
  magenta `☐ N tasks from before` in its dock, opening the same box (move them, or hold tasks again).
- *02:* a link stays as it is: linked means it cares only about what it's linked to, and changes there show by
  themselves (D-255, D-262 unchanged).
- *01 A, built (the D-301 session took it over):* `TasksSide.tsx` + `sideState.ts`. `☐` by your square (now shown once
  there's a deck; its count still tasks given to you, the magenta badge the new ones; it opens on MINE when there are)
  or `t` opens it from anywhere: the canvas or any focus. On the right with beside's line (D-211, the same `split`),
  one or the other: opening it closes what's beside (and documents open beside a list), opening something beside
  closes it; it counts as beside, so the plane's part, its dock and a task's panel move left of it. Tabs under the
  breadcrumb's bar (its shade would cover them): `01 ROADMAP · 3` per deck holding tasks (reading order, unfinished
  ones it shows), `MINE`, `ALL DAYS`. A deck's tab: its board, or `[days]` (the timeline linked to it with its own
  tools, else one of its own that's never stored: `tasks-side:<deck>`, rows by who, `‹ today ›` and its filter);
  the deck's filter, lanes and `[setup]` in the dock. Boards and days sit top left at most
  their own size. MINE: your unfinished tasks by deck, new ones `●`, seen once shown; a row takes you to its deck's
  board with the task picked (`pending`, as going to a task does). A task picked: its panel; in a plane's focus the
  plane glides to its card (`glidePlaneTo`, shared with beside, as `usePaneView`). Escape closes it after setups; it's
  remembered per workspace in this browser (open, tab, board/days), never in the address. Card decks aren't tabs.
- *Changed from the proposal:* with 02 "as now", the side view keeps each deck's link (no "where you are" filter,
  no line about what it hides, D-303).
- *Verified* in headless Chrome on the emulators (1600 × 1000): `☐` opened MINE (2 decks, 3 tasks given, 1 new marked
  and then seen); Roadmap's board top left, 3 shown of 4 (one for a card on another plane); `[days]` rows by who; ALL DAYS
  both decks plus the no-day tray; Escape closed it, `t` opened it; in Pazar's focus a task clicked opened its panel
  left of the split and glided the plane to its card; two Escapes closed the panel, then the side view, focus kept;
  a MINE row opened Sprint 3's board with the task picked. 03 A: a deck with 2 tasks switched to cards showed `IT
  HOLDS 2 TASKS … [make a new deck for cards] [move the tasks to ▾] [keep tasks]`. `tsc -b` clean.
- *Then, its leftovers (the user: "o eksiklikleri hallet"):* the canvas keeps the left part while it's open: opening
  glides the camera so what was in the screen's middle is in that part's middle (back on closing; behind a focus at
  once), `0` fits into it, a new piece goes to its middle (`fitCanvas`, `canvasCenter` read `planeArea()`). A follower's
  opens and closes with the leader's, on their tab and board or days: presence carries `tasks` (`<tab>` or `<deck>
  days`, ≤ 140, database.rules.json, two rules tests), and the leader's cursor is kept in the middle of the part you
  see (with beside too, which had the same slip). Days read well since D-304's strip (screen-sized); its dock, longer
  now, stays inside the side view: the name gives way (`…`), never the actions. Verified in headless Chrome on the
  emulators, on HEAD plus only these changes (the tree had another session's half-built canvases): the camera
  -614 → -1014 → -614 opening and closing; fit with it open put the planes in 96–704 of the left 800; the canvas's
  middle at screen x 400; Bob following Alice: closed, then Sprint 3, then its days, then closed, as she did; the dock
  inside at 50 % and 30 %. The RTDB rule was tested by hand on the emulator (accepted `deck1 days`, refused 141
  characters and an unknown field); `test:rules` couldn't run (the emulator ports were another session's).
- *Deployed:* the RTDB rules (presence `tasks`), by the user, 2026-10-29.
- *Not yet:* the canvas isn't shifted again when the line is dragged while it's open.

### D-301 · 2026-10-29 · Accepted (the user: "biz kanban diyoruz ama buna task planner desek olur mu?", then, offered flow, ledger, stages and deck: "Deck diyelim ozman")
**The kanban piece is called a deck on screen.** Everything the user reads says deck: the `+` menu's `deck…` (letter
`k` kept), the kind in a piece's name (`PAZAR · DECK`, `KIND_NAME`), the finder's hint, `⇆ deck · …` in a plane's dock,
the delete confirm, the setup and wizard (`make the deck`, `a deck holds tasks or cards`), a card's tasks section
(`no deck yet`), a timeline's rows `by deck`, task hints and every undo line (`change a deck`).
- *Why:* "task planner" fits only half of it (a kanban holds tasks or cards, D-253) and "planner" promises dates, which
  are the timeline's; the other kinds are one word. Deck: one word, a deck of cards (its cards mode) and a ship's deck
  (North Star's way-finding). Its risk, read as a slide deck, accepted.
- *Kept:* code, data and rules say `kanban` (`kind: 'kanban'`, `Kanban.tsx`, `piece.kanban`, the timeline's
  `rows: 'kanban'`, localStorage keys), so no data moves and old exports import; docs and specs keep the word kanban
  with a note (PRODUCT.md, specs/kanban.md).
- *Alternatives:* task planner, tasks (+ cards in cards mode), flow (recommended first), ledger, stages; board is
  taken by D-180.
- *Verified:* `tsc -b` clean; strings checked by grep (no user-facing "kanban" left in src). Not run in the browser.

### D-302 · 2026-10-29 · Accepted (changes D-174's one canvas per workspace; the user: "bir marketin canvası farklı olabilir, bir engineering canvası … default olarak bir section olur ancak başka bir section eklemek isteyen için", then "canvaslar arası dokuman ya da sayfa/pano transferi olmalı … Finder'daki tabı 3'e bölelim … adı canvas olsun, ve ortaklıklar component ve itemlar olarak olabilir")
**A workspace has one or more canvases** (spec: docs/specs/canvases.md). It starts with one (`main`, implied, named
by the workspace); more are added from the breadcrumb's prompt (`North Star / Pazarlama ▾`), never as tabs. Items
(cards, links, packages, tasks, documents) stay the workspace's, so a card can sit on planes on different canvases;
components (pieces) move between canvases (`move to canvas`, taking what's stuck to them) and can be on several at
once (`also on canvas`, `pieceSpots/{canvasId}_{pieceId}`, like cards' places, D-281). Pieces and canvas text get
`canvasId` (missing = `main`); `?canvas=` in the path. The finder's scope is `here | this canvas | everywhere`.
- *Why:* teams look at the same idea from different sides (marketing, engineering); one canvas gets crowded, and
  planes and sections don't give "our area". Shared items keep the links between them, the product's point.
- *Name:* canvas, not section (taken by framed text, D-130).
- *Not in the first version:* per-canvas roles or visibility; loading only the open canvas.
- *Not yet:* all of it; four sessions in the spec.

### D-303 · 2026-10-29 · Accepted (changes D-255's switch; the user: "this plane only buttonu ekleyip basarsan bütün her şeyi gösteriyor nacak ben bunu istemiyorum. Link varsa sadece o plane ile ilgilieri görsün ve bu durum sadece unlink ile kapansın. Yoksa akıl karıştırıcı oluyor", then "deck ten only plane 1's - 4 hidden gibi şeyleri kaldıralım. Eğer linklendiyse linklenmiştir … Zaten linkli olduğunu gösteriyoruz")
**A deck linked to a plane shows only that plane's tasks (or cards), and only unlinking ends it; nothing more is said.**
D-255's `[this plane only]` switch is gone (`setEveryPlane` deleted); `shownTasks` and `heldCards` no longer read
`everyPlane` (still in the type, the rules and export so old data reads, ignored). No note of what it leaves out
either (a `only 01 Pazar's · 1 hidden` line was tried and taken out the same day): the link already shows (`⇆`, the
console's link), and that's the answer.
- *Why:* a link meaning "only that plane" with a switch beside it that undid it was two answers to one question; a
  count of what's hidden was a third.
- *Verified:* `tsc -b`; in headless Chrome the side view's Roadmap tab counted 3, not 4 (a task for a card on another
  plane left out), its dock without any note.

### D-304 · 2026-10-29 · Accepted (changes D-262's two weeks; the user: "timeline componenti çok kullanışlı değil gibi … taskların bitiş tarihleri var ancak bir period görmüyoruz … iki haftalık gösteriliyor ama bunu daha güzel gösteremez miyiz? Mesela sağa sola kaydırarak yada farklı gösterim opsiyonları seçerek", then, offered a preview of four (docs/specs/timeline-preview/): "şimdilik sadece A yı yapalım, baya iyi duruyor")
**A timeline is a strip: tasks run from a first day to their due day, and time moves on sideways without end, at a
scale you pick.** Option A of the preview: B (a month calendar), C (load per person as ASCII cells) and D (a roadmap by
card, "galiba … epic gibi bişi") not now.
- *Data:* tasks get `start` (optional, `YYYY-MM-DD`, at most `due`; rules + 2 tests; import copies it). The task panel's
  `when` section: `start → due` (a first day after the due day takes it along, and back), `28 oct → 4 nov · 8 days`.
- *The strip:* yours, per tab (`useStrip`: its first day, px a day, its rows' scroll), never written to the piece, so the
  tasks side view's unstored timeline works too. Scales `day 150 · week 48 · month 18 · quarter 7` px a day in the dock
  (eased round the middle), a pinch or ⌘-wheel in between round the pointer; a sideways wheel (or shift) moves along,
  up/down scrolls the rows (or moves along when they all show); a drag on empty space does both, a flick keeps going.
  Never the view's zoom: text stays its size. On top an overview of the whole span (load as `▁▂▃▅▇`, months, today, the
  window shown: a press glides there, its window drags). Head: months (number magenta) over days, labels thinning with
  the scale (`THU 29`, `T 29`, Mondays, `W45`). `‹ N` / `N ›` per row for tasks past an edge, a click glides to the
  nearest. `‹ today ›` steps a week. Three screens of days are drawn round the one shown; moving writes only transforms.
- *Tasks:* a sheet from first to due day (D-291's tinted face, its card's colour on the left; its name outside when
  short, kept on screen when it starts off the left edge; its checklist a line on its foot); only a due day: a `◆` on it
  (the preview's "point"; "one day" and "since added" not taken). Late: it stays on its days, hatched magenta to today,
  `+3d late`. Lanes fit in px. Live: picked, cyan grips on its edges move its first or due day (a ◆'s `⟵` gives it a
  first day); a drag moves it at 0.8 with landing L's and its days in a readout, edges of the screen scrolling; onto
  another row by person or card that too. An empty day's `+` (in a free lane) pressed and drawn across days makes a
  task (named in place, Enter; in its deck's first open column, with the row's person or card). A tray task dropped on
  a day gets it as its due day.
- *Size:* it fills what it's drawn in at its own size: framed, its window (`timelineBounds` is the window); in focus the
  screen less 96 px (CanvasView's fit for a timeline); beside a deck or in the tasks side view, its pane from the top
  left (`usePaneView(…, true)`); unframed, its width. Going to a task (D-298) asks the live strip (`stripReveal.ts`),
  which glides its days and rows to it.
- *Alternatives:* B, C, D above (kept in the preview); a strip of fixed weeks with paging (today's, too stiff).
- *Not yet:* B, C and D; dependencies between tasks; the side view's own timeline remembers where it was only per tab.
- *Verified* in headless Chrome on the emulators (1600 × 900): focus filled the screen at 100 %, the overview and months
  drawn; a sideways wheel moved along, a pinch went to quarter (W36…W5), `week` and `today` came back; a picked task's
  right grip dragged three days (`28 oct → 4 nov` → `7 nov`, the panel's `when` following), a body drag moved one two
  days (`30 oct → 2 nov` → `1 nov → 4 nov`) at 0.8 with landing marks; a drawn `+` made "Hotel demo call" 29 oct → 1 nov
  on Roadmap's first column; the tray task dropped on 2 nov; beside the deck the strip filled its pane; on the canvas the
  window shows the strip. `npm run build`; rules tests 446/0 (run by the D-305 session with this rule in).

### D-305 · 2026-10-29 · Accepted (D-302's session 1; the user: "1. oturuma başla")
**Canvases themselves, built** (docs/specs/canvases.md, session 1). `canvases/{id}` (`name`, `order`, `createdAt`,
`createdBy`; src/data/canvases.ts); the first is `main`, implied and named `Main` until its doc is written (with the
second canvas, or a rename). Pieces and the canvas's own text carry `canvasId` (missing = `main`), set by every writer
from the canvas shown (`canvasField()`: addPiece, placeDocument, addLabel on the canvas, a paste onto the canvas); text
on a plane has none. `?canvas=<id>` (`canvasParams`/`canvasPath` in paths.ts); a focused piece's own canvas wins.
- *Breadcrumb:* one canvas: `Solo ▾` (the workspace's name opens it); more: `Canvas Test / Marketing ▾`. The prompt:
  `# canvases` (`[1] • Marketing  2 pieces`), a rule, `[n] + new canvas`, `[r] rename "…"`, `move it up/down`,
  `[x] delete "…"` (editors; delete only with two or more). Typing a name nobody has offers `+ new canvas "…"`;
  `new canvas` and `rename` turn the prompt into a naming line (`make "…"` / `rename to "…"`).
- *Switching:* the canvas breaks cell by cell (200 ms), the cameras swap (`swapCam`: each canvas's kept under
  `wid canvasId`, a new one fitted at once, D-202), CanvasView is made anew (`key`), and builds (320 ms); reduced
  motion and the first canvas a load finds, at once. Selection and edit mode let go.
- *Delete:* the hazard confirm (`1 piece on it goes, and the text on it.`; cards on planes elsewhere stay, their home
  moved as D-282); one undo step brings all of it back; on it, you go to the next canvas first.
- *Finder:* scopes `here` (a focus only) · `this canvas` · `everywhere` (two canvases or more); one alone, no tabs.
  Everywhere looks through each canvas, the shown one first, another's groups `Engineering / on the canvas`, its pieces'
  hint `plane · Engineering`; its preview says where it is (`… · on Engineering`), not a copy. Going there: the canvas
  first, then on as before (Finder's `waiting`).
- *Presence:* `canvas` beside `plane` (RTDB rules); cursors on the canvas only from the same canvas; people here say
  `on Engineering`. New pieces avoid only this canvas's pieces. A thread on a plane or text elsewhere isn't `gone`.
- *Verified:* rules tests 446/0 (on other ports: another session's emulators held the usual ones); `npm run build`;
  headless Chrome on the emulators: a two-canvas workspace showed only Marketing's planes and text, the prompt listed
  both, picking Engineering broke and built and showed `Backend` + `Engineering roadmap` with `?canvas=eng`; the finder
  in Marketing found nothing in `this canvas`, Tab → `everywhere` found `Engineering / on the canvas`, Enter went there.
  A one-canvas workspace: `Solo ▾`, typed `Engineering` ↵ made it (and `main`'s doc, `Main`), `+ → plane` wrote
  `canvasId`; rename to Build; delete through the confirm took its plane and went back to `Solo`; ⌘Z brought both back.
- *Not yet:* sessions 2–4 (moving and sharing pieces, pickers grouped by canvas, a thread's go-to across canvases,
  following across canvases, ⌘1–⌘9, export/import of canvases).

### D-306 · 2026-10-29 · Accepted (D-302's session 2; the user: "2. oturuma başla")
**Pieces move to another canvas** (docs/specs/canvases.md, session 2). A piece's right-click on the canvas has
`[m] → move to canvas…`, and its edit console `[move to…]` (before `[delete]`); the canvas's own text too (right-click).
The prompt (D-222) opens where it was asked: `# canvases` with the others (`[1] → Engineering`), a rule, `+ new canvas`;
a name typed that nobody has offers `+ new canvas "…"`, made and moved to in one go (src/views/workspace/MoveToCanvas.tsx).
- *What goes:* every piece in edit mode when the one asked for is one of them, else it alone; what's stuck to them, all
  the way down (`withStuck`: a plane's deck and that deck's timeline, D-298); a section takes the pieces and text wholly
  inside it. A plane's cards, text and links are the plane's, so they go with it untouched; a piece stuck to one that
  stays lets go (`stuckTo` removed).
- *Where:* all by one offset, at the same spot or the nearest clear place on that canvas (`nearClear(…, canvas)`).
- *How it looks:* they break cell by cell where they were (200 ms; reduced motion: at once; shown again if the write
  is refused), then the toast says `Moved "Pazar" and 1 more with it to Engineering [go there]` (6 s; the toast takes
  an action now, `say(text, action)`); `go there` puts that canvas's camera on where they landed, at your zoom, and goes.
- *Undo:* one step (`move 2 things to Engineering`); a new canvas made from here is a step of its own before it.
- *Verified:* `tsc -b`, `npm run build`; headless Chrome on the emulators: right-click Pazar (a deck stuck to it) →
  Engineering moved both, its card stayed the plane's, the toast read as above, `[go there]` showed Pazar, Tasks and
  its idea at `?canvas=…`; the section `Later` → typed `Later stuff` ↵ made the canvas and moved the section, its
  heading and the plane inside (`and 2 more`); ⌘Z ⌘Z took the move and the new canvas back; Rakipler's edit console
  `[move to…]` → Engineering moved it; a screenshot caught the plane breaking cell by cell.
- *Not yet:* sharing a piece on several canvases (session 3); text over a plane doesn't follow it (only a section's).

### D-307 · 2026-10-29 · Accepted (D-302's session 3; the user: "3. oturuma başla")
**One piece on several canvases** (docs/specs/canvases.md, session 3). A piece's home is its `canvasId` and x/y;
every other canvas it's on is a `pieceSpots/{canvasId}_{pieceId}` doc (`canvasId`, `pieceId`, `x`, `y`, `createdAt`;
rules: keys only these, the id its two ends). Size, frame, name and contents stay the piece's, so a plane's cards, a
table's cells, a deck's tasks are the same everywhere.
- *Shown:* `piecesOn(canvas, pieces, spots)` gives a canvas's pieces with a spot copy (`spot` set, the same object while
  unchanged); every piece on more than one says them (`canvases`, built in workspaceData like a card's `planes`).
  Moves and resizes of one here through a spot write its spot's x/y and the piece's size (`placeAll`, `setSpotted`,
  `posRef`; a section's carry too). Focusing it stays on the canvas you're on (`?canvas=…&focus=…`).
- *Asked for:* right-click `[a] ⧉ also on canvas…`, and `[also on…]` in the edit console: the other canvases or a new
  one (MoveToCanvas, `share`); what's stuck to it comes too; it lands where it is or the nearest clear place there;
  toast `Put "Pazar" on Engineering too [go there]`. Shared, its name ends `⧉ 2` (magenta) and its console starts
  `[⧉ 2]`: where it is (`• Marketing here`, `→ Engineering go there`), `also on canvas…`, `take it off this canvas`,
  `delete everywhere`. Right-click has the last two too; `move to canvas…` isn't offered where it's only a spot.
- *Delete:* (D-313: Delete now asks first, `only from here` or `delete everywhere`.) On a shared piece Delete (edit mode)
  and `[delete]` take it off this canvas, the toast `Took "Pazar" off this
  canvas · still on Engineering` (on its home, the home moves to its first other canvas, that spot goes; one undo step);
  `delete everywhere` is the hazard confirm, saying it's on 2 canvases, its spots going with it. Deleting a canvas
  keeps a piece also elsewhere (its home moves) and says so; moving a piece onto a canvas it's spotted on drops that
  spot. Unsharing or deleting a document now takes its pieces on every canvas (session 1 only took this one's).
- *Verified:* rules tests 457/0 (other ports); `npm run build`; headless Chrome on the emulators: right-click Pazar →
  also on Engineering wrote a spot (moved clear of Backend), `⧉ 2` in its name, `[go there]` showed it with its idea;
  focusing it there kept `?canvas=eng` in and out; take off from Engineering left it on Marketing with the toast, ⌘Z
  brought the spot back; on Marketing its console read `[⧉ 2] [focus] [edit]`, `⧉ 2` listed both canvases; Delete in
  edit mode moved its home to Engineering, ⌘Z back; `delete everywhere` removed the piece and its spot.
- *Not yet:* export/import of spots (session 4, done D-309). (A piece stuck to a shared plane follows it on every
  canvas where both are, D-311.)

### D-308 · 2026-10-29 · Accepted (changes D-233's and D-256's keeping; the user: "filtreler şu anda kalıcı olarak apply ediliyor, biri mesela bir link ekleyip componentten çıkarsa o filtre orda kalmaya devam ediyor, yada sayfayı yenilediğinde … Sadece kullanıcı için olması mantıksız çünkü diğerlerin değişikliklerini falan kaçırabilir. Kalıcı olması da iyi değil … sadece o anlık mı yapsak", then, offered a preview of new filter looks and the lifespan: "beğenmedim önerilerini, şu anki gibi kalsın ama filtreler o anlık olsun", "önerilerini de uygula")
**Filters are a passing look: a plane's or a deck's filter lasts only while it's open, and what's added after it's set
shows anyway.**
- *Lifespan:* a plane's filter is held while its focus dock is there; a deck's (and a timeline's) while one of its
  filter docks is (its focus, its pane beside a plane, the tasks side view, a timeline). Once none is, it goes, a tick
  later so a remount keeps it (`useHoldFilter`, `useHoldKanbanFilter`). Kept in the tab's memory only: a reload starts
  over; the keys the browser kept before (`north-star:filter:*`, `north-star:kanban-filter:*`) are removed on load.
  Never shared. The plane's picture on the canvas is therefore never filtered.
- *New things show:* what's on the plane or deck when a filter is set is what it narrows; a card, link or task added
  after (yours or anyone's) shows anyway until the filter changes again (then it narrows that too). This covers a link
  of a kind hidden to start (`for`, `relates`, `competes`): drawn, it stays on the plane until you leave, and a task
  typed into a filtered deck (kanban.md's leftover) stays.
- *Start-hidden links:* still the plane's start, not counted as a filter; the LINKS menu marks them `starts hidden`.
- *Look:* unchanged (D-233's strip of menus). The preview's other looks (one flat sheet, a prompt, a line at the top
  with ghosts of hidden cards) were turned down; no mark on what shows because it's new.
- *Alternatives:* shared on the plane (one person's look changes everyone's; D-256 turned it down too); kept per
  browser (the old way: a filter forgotten for weeks hid others' work).
- *Verified* headless (emulators): ideas hidden (`[filter · 1]`), then an idea and a `relates` link written from outside
  both showed; out to the canvas all cards back; in again `[filter]` with nothing narrowing; a deck filtered to
  `nobody`, a task given to Alice written after showed; out and in, every task; no filter keys in localStorage; build.

### D-309 · 2026-10-29 · Accepted (D-302's session 4; the user: "4. oturuma başla")
**Canvases all round** (docs/specs/canvases.md, session 4, the last).
- *Where a plane is named:* the card pickers (D-299), `existing card…` (D-281) and a card's `PLANES` section say a plane
  on another canvas with that canvas first, `Engineering / Backend` (`planeTitle`); one here (through a spot too), or
  with one canvas, by its name alone.
- *Threads:* a thread on another canvas (its text, its plane, a card on a plane there) goes to that canvas first, then
  on as before (`threadCanvas`, `waitingThread`); with two canvases or more the panel's line offers `on this canvas`
  (`on Marketing` + `whole workspace`) beside `whole workspace` and a plane's `inside "…"`.
- *Following:* you go to the canvas the person you follow is on (presence `canvas`), into the plane they focus there;
  their cursor is followed only on the same canvas.
- *Keys:* ⌥1–⌥9 go to the first nine canvases (not in a field); not ⌘1–⌘9 as the spec said: the browser keeps those
  for its tabs. The breadcrumb's list says them (`2 pieces · ⌥2`).
- *Export/import:* `canvases` and `pieceSpots` travel (bundle v2 stays; a file without them is all on the first);
  import gives the canvases new ids (the first keeps `main`), pieces and the canvas's text their canvas, spots their
  canvas and piece (one on its own canvas, or whose piece or canvas didn't come, is left out).
- *Verified:* `tsc -b`, `npm run build`; headless Chrome on the emulators: the threads panel on Marketing read `whole
  workspace [on this canvas]`, then `on Marketing … No open threads`; a thread on Engineering's heading → `on the canvas
  ↗` went to `?canvas=eng`; ⌥1 back to Marketing; a card on Pazar and on Engineering's Backend listed `Pazar here ·
  Engineering / Backend`; Alice following Bob (a second browser) went to Engineering when he pressed ⌥2 and saw him
  `on Engineering, following`; exported and imported: the new workspace's canvases `main=Marketing`, Engineering under a
  new id, Backend, the Roadmap heading and Pazar's spot on it.
- *Not yet:* the export settings' note still says "everything on the canvas" (WorkspaceLayout, another session's area).

### D-310 · 2026-10-29 · Accepted (adds to D-238; the user: "yeni bir component koyarken direkt baktığım yere koyuyor ya, bazen başka bir componentin üzerindeyken yeni component koyma yapabiliyor ve bu durumda mesela yeni gelen component coktan var olanın arkasına düşebiliyor. Bu yüzden yeni gelen componenti oynatmak da imkansız oluyor", then "Direkt yeni eklenen en üste çıksın desek olmaz mı?")
- *Decision:* pieces on a canvas are drawn oldest first (`createdAt`, then id), so the newest is always on top; one
  added over another (nearClear found no clear spot, D-238) is never under it and can be moved at once.
- *Why:* they were drawn in Firestore's order (random ids), so a new piece fell behind an older one about half the
  time, and the older one took its presses.
- *Alternatives:* also lifting the selected or edited piece on top: turned down by the user, since edit mode stays on
  for several pieces at once and an older one in edit mode would cover the new one; a stored order (`z`), bring to
  front / send back: not needed for this.
- *Verified* headless (emulators): pieces whose ids sort against their age (`aa_new` newer than `yy_old`) drew
  oldest first, the newer one taking the overlap; with the screen's middle inside one 8000 px plane (nearClear found
  nothing clear) a plane added from `+` landed on it, on top, in edit mode, and dragging it moved it (the big one
  stayed); tsc.

### D-311 · 2026-10-29 · Accepted (the user: "bitti mi işin? doğruluğunda emin ol. Sonrada kalan işleri yap")
**Canvases, checked again** (D-302's sessions 1–4, D-305–D-309): an independent read of the code found these, fixed.
- A shared piece focused on the first canvas jumped to its own canvas (`?canvas=` was left out for `main`): with a focus
  the canvas is always in the address now (`canvasParams`), so a piece shown through a spot stays where you are.
- A section holding a piece shown through a spot couldn't be moved (the batch put `updatedAt` on the spot; the rules
  refuse it): spots get none, like a card's places.
- The first canvas (`main`) isn't offered for deletion: every workspace has it (deleted, it came back, implied and empty).
- Deleting a workspace now takes its `canvases`, `pieceSpots` and `places` too (they were left, unreachable).
- A new piece (`+`, the wizards, a document placed) keeps clear of everything drawn on the canvas shown, pieces shown
  through a spot too (`setShownHere`); moving to a canvas keeps clear of what's shown there through spots.
- `move to canvas…` on a piece that's here only through a spot says so ("its own canvas keeps it") instead of nothing.
- Unsharing or deleting a document takes its pieces' spots too.
- A canvas on its way out shows no focus from the next one (`focused` is only this canvas's; a focus is cleared only
  when its piece is gone); a thread waiting for its canvas survives a mount done twice (dev); a finder match waiting
  for its canvas is given up after 4 s; the breadcrumb's list counts pieces shown through spots.
- The export settings' note says every canvas. D-307's *Not yet* was wrong: a piece stuck to a shared plane follows it
  on every canvas where both are (the moves write each one's spot there).
- *Verified:* headless Chrome on the emulators: the shared Backend focused on Marketing kept `canvas=main&focus=…` and
  `Marketing / Backend`, back out to Marketing; the canvas list had no delete for Marketing and counted Backend; `+ →
  plane` landed at 25,-700, clear of Backend's spot at 0,0; dragging the section moved its spot with it (125, 25).
- *Not yet (small):* a deck stuck to a shared plane, the plane then taken off the deck's canvas, stays linked to it.

### D-313 · 2026-10-29 · Accepted (the user: "biri bir compoennti canvasdan silerken şeyi de sor, bunu bitek burdan mı silmek istersin yoksa her yerden mi?")
**Deleting a piece on several canvases asks which** (changes D-307's Delete, which took it off at once). Delete in
edit mode, the console's `[delete]`, right-click `delete everywhere` and the where-list's open the hazard confirm:
`delete "Pazar"?`, `It's on 2 canvases: Marketing, Engineering.`, `Only from here: it stays on the others, as it is.`,
`Everywhere: the plane and everything on it goes.`, `⌘Z brings it back.`; answers `[cancel] [only from here] [delete
everywhere]`, `only from here` focused first (Enter takes it). `only from here` is D-307's take-off (the toast says where
it still is); right-click `take it off this canvas` still does that at once. A piece on one canvas asks as before.
- *How:* HazardConfirm takes `also` (a second, gentler answer, focused instead of cancel).
- *Verified:* headless Chrome on the emulators: Pazar on Marketing and Engineering, Delete in edit mode showed the
  lines and buttons above with `only from here` focused; Enter took it off Marketing (its home moved to Engineering,
  the toast `still on Engineering`); ⌘Z back; Delete → `delete everywhere` removed the piece and its spot.

### D-314 · 2026-10-29 · Accepted (D-300 reworked; the user's list, then from a preview: "1 -> A, 2 -> columns over a time bar, 3 -> A, 4 -> A ama ayrıca tam ekran yapma özelliği de olsun … geri dönme buttonu, 5 -> … prompt open ilerleyelim")
**Decks and their days open in one side view, left to right: plane → deck → days.** What the user asked: the deck
icon read as an empty square; MINE sat badly between decks and ALL DAYS; ALL DAYS, a deck's days and timeline pieces
were three confusing things; a plane's linked deck opened in a different pane than the side view; the side view
blinked going in and out of a focus; a task's panel took the plane's place; picking a task on days jumped to the
board; a timeline couldn't make a task for a card.
- *Side nav:* the side view's button moved from by your square (`☐`, gone) to the side nav's tools after `+`, fit and
  the compass: columns over a time bar, the magenta count of tasks given to you, cyan while open; shown only while the
  canvas has a deck or a timeline (`TasksButton` in MyTasks.tsx).
- *Tabs:* decks only (this canvas's, `⇆` on a linked one); `MINE · 3 ●1` and `ALL · DAYS` as chips in the top right
  corner. A MINE row picks its task (panel here), nothing else moves.
- *1 A, three columns:* a deck's `[days ›]` adds its days as a column right of it, the left part narrowing to its own
  share (`splitDays`, a third to start; both lines drag; the canvas glides to keep its middle), `[‹ close]` takes them
  away; below 1300 px the days slide over the deck (`‹ back to the board`). In a deck's own focus only its days show.
  Decks and timelines never open beside a plane any more (matrices and tables still do): a plane's dock `⇆ deck`
  opens the side view on it with `⇆ LINKED TO 01 PAZAR · ITS CARDS ONLY [all decks]` under the tabs; `⇆ timeline`
  opens its deck with its days (or, a plane with no deck, ALL · DAYS of that plane). Escape: a task's panel, the days,
  the side view, then the focus. Presence carries `<tab>` or `<deck> days` for followers.
- *Flicker:* one side view drawn above any focus (z 5), never inside it (a180666).
- *3 A, a timeline is always the days of something:* linked to a deck, that deck; linked to a plane (timelines stick
  to planes now, `hostKinds`), the plane's deck when it has one (first in reading order; one linked later too, read
  in `timelineKanbans`, nothing written, so unlinking the deck turns it back), else every deck but only the tasks for
  that plane's cards (`cardsOnly`, no card-less tasks); linked to nothing, every deck (ALL · DAYS is the same with no
  piece). A deck's days use its timeline (`timelineOf`, through its plane too), else rows by who.
- *4 A:* with the side view open a task's panel opens inside it, over its right 330 px (`SidePanel` got `width` and
  `tools`): `[full]` fills the side view, `‹ back` narrows it again; `[show on board]` `[show on days]` in its foot go
  there on purpose. Cards' panels keep the plane's part.
- *5:* drawing days on a timeline opens the card prompt (D-299's `CardPicker`, portaled under the days drawn, over
  every panel): `# suggested` the cards of its deck's plane (`on 01 Pazar`), then every card by type; a card makes a
  task named after it, for it; what's typed, last, `“…” A TASK WITH NO CARD`. Also: no `+` over the rows' names (it sat
  off the strip and went as the pointer reached it).
- *Verified* in headless Chrome on the emulators (1600 × 1000 and 1200 × 900): the icon in the side nav, `☐` gone;
  tabs and corner chips; `[days ›]` → left part 0.33, side view 533–1600, back to 0.50 on close; narrow: days over the
  deck with `‹ back to the board`; a board task's panel 1270–1600 inside it, `[full]` 533–1600, `‹ back`; Escape:
  panel, days, side view; from Pazar's dock the strip and `[all decks]`; deck focus `⇆ timeline` → days only; a
  timeline stuck to Pazar (which has Roadmap) opened Roadmap's days and showed in Roadmap's focus dock; Ops (no deck)
  showed only `t10`, its card's task; the prompt in a timeline's focus and in the side view, a card picked made
  "Small shops" for c1 on Roadmap with its days, typing offered `“Buy stamps” A TASK WITH NO CARD`; following Bob saw
  Alice's Sprint 3 then its days (Deck, Days columns) then closed; the canvas kept its middle; no frame without the
  side view going in or out of a focus. `tsc -b` clean.
- *Then (the user: "elmas adlarını da ◆'in yanına al"):* a late task's name stays right beside it (a ◆'s, or one whose
  bar is too short for it), over its hatch on the page's colour, `+Nd late` at the hatch's end; a hatch too short to
  show past the name puts `+Nd late` after the name. Its box (lanes) counts both. Checked headless at week and quarter:
  every name beside its ◆ or bar, `+1d late` after "Bundle price test", `+7d late` at the end of the long hatch.
- *Then (the user: "e kart tutanları neden göremiyorum?", "timeline … sayfaya dikey olarak ortalasak"):* decks holding
  cards are tabs too (D-300 had left them out; with decks opening only here a plane's linked card deck fell to MINE):
  `03 PRIORITIES ⇆ · 2 CARDS`, its card board (a card picked: its panel, the plane glides to it), no `[days ›]`; MINE and
  timelines leave them out (no tasks, no days). A timeline shorter than what it's given stands in its middle (its
  board as tall as its rows, the rest above and under), in a focus, a pane or the side view; a focused timeline fits
  its part of the screen with the side view open, and a focus's dock stays inside its part (scrolling sideways).
  Checked headless: the card deck's tab, strip and 2 cards; the side days' board 324–756 in 96–1000; a focused
  timeline 367–633 of 1000 in the left part.
- *Not yet:* Beside.tsx still holds its deck/timeline pane code, unused now; the canvas isn't shifted again while the
  side view's line is dragged.

### D-315 · 2026-10-29 · Accepted (plan only; the user: "yeni biri geldiğinde bi anda bilgi bombardımanına tutmak istemiyorum … kimin ne zaman onboarding olduğunu, sıfırdan ise bütün ekranların, önceden kullanıyor ise de yeni versiyonla nelerin geldiği anlatılmalı … step by step introduction … animasyonlar … componentler elimizde var, bunları kullanarak mock data ile animasyon oluşturabiliriz sonsuz döngüde … ai dışındaki her şeyi kapsasın … senden sonraki agent yapıcak")
**Onboarding: plan written** (docs/specs/onboarding.md, onboarding-lessons.md, onboarding-run.md; reference:
onboarding-inventory.md, onboarding-research.md). Not started; built by an overnight lead with builder/reviewer
subagents (onboarding-run.md), beside the agent's run (D-312).
- *Decision:* taught at the moment of use, one thing at a time, short (≤ 4 pages, ≤ 25 words a page): a 4-page
  **welcome** on a person's first canvas (variants: invited into a filled workspace, viewer); the **kind guide**, a
  column glued to the `+` menu explaining the row under the pointer/keys; ~60 **lessons**, each shown once beside what
  was just opened (first piece, console, focus, card, link, unframe, stick, beside, deck, timeline, comments…);
  **what's new** for people who used it before (releases since their last); at most one **nudge** a session; `?` the
  **guide** (replay any lesson, keys, tips on/off); empty states that teach. Seen-state per person
  (`users/{uid}/private/onboarding`, localStorage fallback), ids versioned. No seen-state = new, old accounts too. **Demos are the real components** drawn from a made-up workspace inside a same-origin
  iframe (`demo.html`, its own copy of every module, no Firebase), played by a scripted director, 3 loops then paused,
  a still poster under reduced motion. Events from store subscriptions and the agent run's `onTracked` (S3), not new
  calls in hot files; agent writes never trigger lessons.
- *Why:* research (onboarding-research.md): short, action-started help is finished ~3× more than tours that start by
  themselves; up-front tutorials can make apps feel harder; live components beat video. A demo in the same page would
  share the camera/selection stores with the person's canvas, hence the iframe.
- *Alternatives:* one long up-front tour; a checklist; hint dots; videos/GIFs; hand-made look-alikes; per-instance
  stores in the same page (a rewrite of hot files).
- *Q-025 and Q-026, answered the same day:* seen-state per person in Firestore ("evet"); people who used North Star
  before see everything too, since nothing was recorded ("eski kullanıcılar için de tutulan bir kayıt olmadığına göre
  önceden, onlar da görcek"), so what's new is only for releases after onboarding ships. On the look the user asked
  whether the run builds everything just to show it: the ~60 lessons are data a few frames draw; then, going to sleep:
  "gerekirse her opsiyonu her biri için implemente et, umrumda değil", so the run builds every frame option behind a
  dev-only switch and the user picks in the morning (Q-028).
- *Q-027, answered the same day* ("Q-027'yi CLAUDE.md'ye ekle"): a hard rule in CLAUDE.md: every new user-facing
  feature, or a real change to one, ships with its lesson in `lessons.ts` and a line in `releases.ts`,
  `check:lessons` passing; until onboarding is built, in onboarding-lessons.md.
- *Open:* Q-028 (the look): every option built, the user picks in the morning.
- *Not yet:* everything: onboarding-run.md's steps O0–O16.
