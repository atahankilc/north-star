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
Was: competitors as profile pages, not on a map. Competitors are cards on the board with their features stacked behind (D-058); the profile (fields + features by category) is their side panel (`CompetitorProfile.tsx`).

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

### D-049 · 2026-10-17 · Accepted (reverses D-047)
**No groups.** Replaced by text labels (D-050) to mark areas. Rules refuse new `groups` docs, keep read/delete for clean-up.

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
midpoint ("solves", "competes", "inspired by"…; "relates" stays unwritten unless it has a label). Line pattern by kind;
no flowing animation. Colours by meaning, chips on solid plates and thicker lines for the selected card: D-108.

### D-060 · 2026-10-17 · Accepted
**Opening a workspace frames everything** (all cards and labels, within zoom limits 9–150; room left for the HUD and toolbar).
Switching between views inside a workspace keeps your place. (The Matrix frame is as tall as its content, D-106.)

### D-061 · 2026-10-17 · Accepted
**Calmer board.** No double-click to create (the `+` menu is the only way; double-click still edits a text label). Cards don't lift
or scale on hover, selection or drag: the lift moved a dragged card toward the camera, so it looked bigger and dropped away from
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
- *Colours* (`src/views/canvas/linkKinds.ts`, `--link-*` tokens, `palette.link`): violet solves / part of, salmon competes /
  contradicts, sand inspired by / depends on, grey relates / for. The type, people and diff colours fill most hues, so eight
  distinct colours weren't possible; groups by meaning plus the existing patterns (solid / dashed / dotted) tell kinds apart.
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
- *Edge handle:* a hovered card shows a `○` on its right edge; dragging from it links like shift+drag. The handle doesn't stop
  the card's hover events (doing so made the card think the pointer left and the handle vanished under it).
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
  units away, shrinking to a one-pixel dot by 70, fading out between 80 and 120 (the zoom-out limit is 150). A first pass
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
  title alone, bigger and centred (0.28, 26 characters) down to 5 px; `far`: a star (`FarNode`): a ring in the type's colour
  round a small core in `--fg`, an outer ring when hovered, selected or marked, built up cell by cell (D-034); coming back,
  the card builds up again (`CardReveal` restarts on remount). Links end at the star's circle. A competitor's fanned
  features (FeatureChip) follow the same levels: compact = the name alone in Geist 0.26 (13 characters), far = small yellow
  stars (`SMALL_NODE_R`) in a column beside the competitor's star (`chipSpot(…, far)`). Notes and headings follow
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
  quarter of the `+` grid). Every card is the same size (D-055), so centres on the grid put edges in line too. A group drag
  (D-108) snaps the piece you hold and moves the rest by the same step, keeping their layout. Holding alt while dragging
  moves freely for that drag. Positions only change when something is dragged; nothing already on the board moves.
- *Switch:* a framed square beside the fit-all button (cyan while on, `aria-pressed`) and the `g` key; on by default,
  remembered in this browser (`north-star.board-snap`). Viewers don't get it (they move nothing). The hint line says
  `drag: move on the grid (alt: freely)` and `g: snap`.
- *Grid:* while snapping is on, faint dots mark the quarter points between the `+` marks when close up (gone by 34 units
  away, so they never crowd); off, the grid is as in D-110.
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
  keep it (`cleanLabel` accepts the empty text for a title). The assistant's context skips it (empty text), as before.
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
