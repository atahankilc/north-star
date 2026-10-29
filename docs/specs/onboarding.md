# Onboarding: research and plan

_Written 2026-10-29. Status: **plan written (D-315), not started.** Build it with [onboarding-run.md](onboarding-run.md)
(the protocol and the log). Read this whole file, then [onboarding-lessons.md](onboarding-lessons.md) (every lesson and
its words) before any onboarding work. Reference: [onboarding-inventory.md](onboarding-inventory.md) (every surface and
where it's first met in code), [onboarding-research.md](onboarding-research.md) (what other apps do, numbers, sources)._

**What the user asked (2026-10-29), short:**
- The app is getting very good, but a new person must **not be buried in information** at once.
- Know **who is onboarded and when**: someone new hears about every screen; someone who used it before hears **what
  came with the new version**.
- **Step by step**: landing on the canvas, a modal in the middle, **paged**: what you see, then what you can do.
  Press `+`: every kind of component explained. Place a piece: its console, framed/unframed, linking, focus, moving…
  "At every step and every newly opened or discovered feature, take the person by the hand, without loading
  everything at once, and tell them about as much as possible."
- **Animations**, made from **the components we already have with mock data**, looping forever (not videos).
- Everything **except the AI agent** (being built by another session, D-312).
- Built overnight by another agent with **checks and agent pipelines**; this file and the run file prepare that.

---

## 1. The idea in one picture

```
first sign-in ─► workspaces page: an empty state that teaches (create · join with a code · import)
                    │
first canvas  ─► WELCOME (a modal in the middle, 4 short pages, each with a live demo)
                    │  then nothing until the person does something
                    ▼
a first time  ─► a LESSON beside the thing just opened (1–3 short pages, a demo each), one at a time
  (first `+`        `+` → the KIND GUIDE: a column glued to the menu; the row under the cursor/keys explains itself
   first piece      first piece → edit mode, moving, the console, focus
   first focus      first focus → inside a plane: + makes cards, pan, Esc
   first link …)    … ~60 lessons in onboarding-lessons.md, each shown once
                    │
returning     ─► WHAT'S NEW (one modal: the releases since you last came, a demo each)
                    │
any time      ─► `?` THE GUIDE: every lesson by area (seen / not yet), replay, shortcuts, tips on/off
```

Three rules hold it together:
1. **Explain what was just opened, never what wasn't.** A lesson appears because the person *did* something (opened
   `+`, made a piece, focused…), right then, next to it. Nothing is taught up front except the welcome.
2. **One thing on screen at a time, short.** ≤ 4 pages, ≤ 25 words a page, one demo a page. "More" lives in `?`.
3. **Demos are the app itself.** The real components, drawn from a made-up workspace inside a sealed frame, playing a
   short script on a loop. They follow the theme, the motion setting, and every future change of the components.

---

## 2. What the research says (short; details and sources in onboarding-research.md)

- Short wins: 1–3 steps ~72 % finish, 5 steps ~22 %, 9+ ~8 %. ~23 words a step on average.
- **Started by the person (a click, an action) ~69 % vs started by itself ~23 %.** So lessons fire on actions.
- Up-front tutorials can make an app feel *harder* (NN/g). Contextual help at the moment of use works.
- Passive hint dots: ~0.1 % opened. Checklists: ~10–20 % finished. Don't rely on either.
- **Live components with mock data beat video** (sharp, themed, nothing to download, never out of date).
- A loop that moves > 5 s beside other content needs **pause** (WCAG 2.2.2); reduced motion → a still frame + caption.
- Invited people never "created a workspace": teach from what they meet. Viewers get no editing lessons.
- Seen-state **per person, not per device**; ids versioned so a changed feature can be taught again.

**Where this plan goes past the research, because the user asked:** the app is wide, and the user wants it *all*
explained. The research's limits are kept *per moment* (short, one at a time, at the right time), but the number of
lessons is large (~60): a person meets them over days, one at a time, as they discover things.

---

## 3. Rules (kept like the hard rules once built)

### 3.1 For what people see
1. **Only after the curtain** (`useCurtain.revealed`) and never over the ASCII effect over text (the hard rule).
2. **One at a time.** A lesson never opens while another lesson, the welcome, what's new, a wizard, the hazard
   confirm, Settings, the finder, a menu (except the kind guide, which is part of the `+` menu), a drag, a focus
   transition, typing, or following someone is going on. It waits in a queue (§5.4) and shows when the person is free.
3. **Short.** ≤ 4 pages a lesson (the welcome 4), a title ≤ 6 words, a body ≤ 25 words, one demo or none. Keys are
   written as the app writes them (`⌘F`, `esc`, `0`). Lowercase actions, uppercase labels, the app's two voices.
4. **Next to what it explains, never over it.** An anchored lesson sits beside its anchor (`src/ui/floating.ts`), and
   never covers the anchor, the piece being taught, or the right panel. When there's no room, it goes to the middle
   bottom as a card.
5. **Always skippable.** `×`, `esc`, `[got it]`; on every lesson a quiet `don't show tips` (asks nothing, undo in `?`).
   The welcome has `[skip]` on every page.
6. **Never twice by itself.** Seen = shown and closed, or skipped. A lesson's id carries a version (`focus@1`): only a
   real change of the feature bumps it, and then it shows once more (as "changed").
7. **By role.** Lessons have roles; a viewer gets the viewer welcome and read-only lessons. An owner gets the owner ones
   (people, codes) on top.
8. **The person's language is English** (the app's). Lesson words live in `lessons.ts`, ready for a later translation.
9. **Keyboard and screen readers.** The welcome and what's new are dialogs (focus inside, back on close, `esc`); `←` `→`
   / `Enter` page through. An anchored lesson doesn't take focus from the canvas: it's announced politely
   (`aria-live`), and `?` then `Enter` reaches it. Demos are `inert` + `aria-hidden`; the caption is the text.
10. **Motion.** Lessons build cell by cell (`<Appear>`, 320 ms; title `DecodeText` 260). Demos loop 3 times then
    pause on their poster frame with `[▶ play]`; `[❚❚]` always there. Reduced motion: the poster frame, no loop.
    Light theme through tokens and `usePalette()`.
11. **No theme/motion/background controls in onboarding** (CLAUDE.md hard rule): the welcome may *say* Settings has them.
12. **Unprompted things are rare.** Only three things open without a direct action: the welcome (once), what's new
    (once per release), and **nudges** (§4.5; at most one per session). Everything else answers an action.

### 3.2 For the code
1. All reads/writes of the seen-state go through `src/data/onboarding.ts` (the hard rule: all DB access in `src/data/`).
2. **Hot files are touched as little as possible**: events come from store subscriptions (`useCanvasView`,
   `useKanbanUi`…), `tracked()` labels and the URL (inventory §0), not from new calls in CanvasView.tsx. Where a
   one-line hook is unavoidable (`+` menu open is local state), it is one line: `learn('plus-open')`.
3. Anchors: `data-learn="<name>"` attributes on the few elements lessons point at (`plus`, `fit`, `finder`,
   `people`, `threads`, `square`, `gear`, `crumb`, `console`, `dock`…), added in one pass.
4. A lesson is data (`lessons.ts`), not code: id, version, roles, trigger, anchor, pages (title, body, scene), after,
   since. The renderer is one component. `npm run check:lessons` lints the data (§8).
5. Demos never touch Firebase: the demo frame has no Firestore, RTDB, Auth or Storage traffic (checked, §8).
6. Every new user-facing feature after this ships with its lesson and a release line (proposed for CLAUDE.md,
   see §11 Q-027).

---

## 4. The formats

### 4.1 The welcome (once per person, on their first canvas)
A modal in the middle (the wizard shade, z 40, `role="dialog"`), framed like the wizards: `01 / 04` in magenta at the
top left, a Geist title, one line of body, a demo filling the top two thirds (16:10), `[skip]` left, `[‹ back]`
`[next ›]` right, `←` `→` `Enter`. Four pages (words in onboarding-lessons.md §1):
1. **The canvas** — everything for this startup lives on one canvas; drag, scroll, `0`.
2. **Pieces hold the work** — a plane of cards (customers → problems → competitors → ideas → features), and pieces
   that read them (table, matrix, deck, timeline, documents).
3. **Add with `+`** (editors) / **Find your way** (viewers: `⌘F`, `0`, focus) — "every kind explains itself the first
   time you meet it".
4. **Together, live** — people bottom left, cursors, right-click `comment`; "`?` shows any explanation again".

Variants, picked by what's true when it opens:
- **Invited into a filled workspace** (the person didn't make it and it has pieces): page 1 says "<owner> started
  this workspace" and suggests `0` to see it all.
- **Viewer**: page 3 is "Find your way"; the last line says what a viewer can do (read, comment, own documents).
- **Empty canvas, editor**: after the welcome, an Excalidraw-like **empty-canvas hint** (not a modal: faint text in the
  middle of the canvas, `press + to add your first piece`, an arrow toward the `+`) that leaves at the first piece.

### 4.2 The kind guide (the `+` menu, explained)
The first times the `+` opens (until every row has been seen, or `don't show`), a **guide column is glued to the
right of the menu**, the same height, the same prompt look: the row under the pointer or the keys shows its demo and
two lines (what it is, when to use it), changing as you move through the list. It never blocks: typing, Enter and the
letters keep working; the menu works exactly as before. A small `[hide guide]` at its foot. In a plane's focus it
explains the plane's items (customer, problem, competitor, idea, feature, package, existing card, text). It's the
user's "a modal with every component explained", but tied to the menu so nothing extra is opened.

### 4.3 Lessons (the first time something is met)
A card beside its anchor (a piece, the console, the dock, a panel, a corner button): the prompt's look (`┌ LESSON ·
FOCUS`, magenta corner marks like the right panel), a demo on top when it has one (small, 4:3), title, body, a
`1 / 3` and `[next ›]` / `[got it]`, `×`. It points at its anchor with a short magenta lead line (the app's line
family, D-266). It stays until closed or until the person does what it teaches (then it closes itself with
"✓ done" for a moment). It never moves with the camera: it is anchored to a *screen* rect sampled when it opens and
re-sampled on pan/zoom end.

### 4.4 What's new (returning people)
For someone who used North Star before, once per release they haven't seen: a modal like the welcome, one page per
change (the biggest 3–4 first, `+ N more` as a list page), each with its demo and a `[show me]` that closes it and
goes there when it makes sense (e.g. opens the side view). Then those features' lessons are *armed* (they'll show
on first use, marked `NEW`), the rest of the lessons are marked known (a returning person isn't taught what they know).
It opens only on the canvas, after the curtain, never in a focus or a drag; if the person is busy, it waits.

### 4.5 Nudges (pointing at something not met yet)
A single line by the side nav or the corner (`try ⌘F to find anything · ×`), at most **one per session**, only after
≥ 3 minutes in the workspace and 10 s without input, only for a short list of high-value things (focus, finder, `?`,
following, side view), and **retired** as soon as the person does the thing, even if never shown (TipKit's rule).

### 4.6 `?` the guide
`?` (free, bound nowhere; ignored while typing) or a `?` in the side nav under the compass opens a prompt in the
middle like the finder: `# start` (replay the welcome, what's new), then a section per area (`# canvas`, `# planes and
cards`, `# links`, `# text`, `# matrix and table`, `# documents`, `# decks and days`, `# together`, `# canvases`,
`# settings`), each lesson a row `› ✓ focus · work inside a piece` (✓ seen, • not yet, `NEW` armed). Enter plays it
in place (as a lesson in the middle). Typing narrows. Also `# keys` (every shortcut, from the inventory §C) and the
switch `tips: on | off`. A magenta dot on `?` while something new is unseen.

### 4.7 Teaching empty states (workspaces page, empty canvas, empty pieces)
Not modals: the empty states themselves teach, then vanish.
- **Workspaces page, no workspaces**: three framed choices `create a workspace` / `join with a code` (a line: "an
  owner lets you in") / `import a .zip`, each one line.
- **After a join request**: the pending row says "waiting for an owner to let you in" (it may already).
- **Empty canvas**: §4.1's hint.
- **An empty plane in focus**: `press + or right-click to add a card` faint in the middle until the first card.
- **A deck without tasks, a documents list without documents, a timeline with nothing**: one line each saying how.
  (Check what exists first; several pieces already have empty lines.)

---

## 5. How it works

### 5.1 The parts

```
src/data/onboarding.ts       seen-state: read/write own doc (Firestore) + localStorage cache; the only DB access
src/onboarding/
  lessons.ts                 every lesson as data (id@v, roles, trigger, anchor, pages, scene, after, since, area)
  releases.ts                releases: id, date, title, items → lesson ids (what's new)
  audience.ts                who is this person: new | invited | returning; role; first canvas?
  events.ts                  learn(event), and the watchers: store subscriptions, tracked() labels, URL → events
  queue.ts                   one at a time: busy detection, cooldown, priorities, nudge budget, retire-on-done
  progress.ts                zustand store over data/onboarding.ts: seen, armed, tipsOff, lastRelease
  Coach.tsx                  mounted once in WorkspaceLayout (and Workspaces): renders whatever the queue gives
  Welcome.tsx WhatsNew.tsx   the two modals (one Pages component)
  Lesson.tsx                 the anchored card
  KindGuide.tsx              the column beside the `+` menu
  Guide.tsx                  `?`
  Nudge.tsx                  the one line
  Demo.tsx                   the frame in the app that shows a scene (an iframe, §6)
src/demo/                    the demo realm (its own entry, demo.html)
  main.tsx                   boots the stage: no Firebase, fake user, the scene from the URL / postMessage
  Stage.tsx                  WorkspaceContext over fixtures, the real views, a fake cursor and key chips
  director.ts                plays a scene's script on a clock that can seek (headless) and loop
  fixtures/                  made-up workspaces (a real-looking startup: "Pazar", customers, problems, rivals…)
  scenes/                    one file per scene: setup + steps (≤ 6 s), poster time
scripts/check-lessons.mjs    the lint (§8)
```

### 5.2 Who is new, invited, returning (audience.ts)
- **The seen-state doc exists** → we know them; use it.
- **No doc, Auth account created after `ONBOARDING_START`** (`user.metadata.creationTime`; the constant is the date
  onboarding ships) → **new**. If their first workspace was made by someone else → **invited** (variant texts).
- **No doc, account older than `ONBOARDING_START`** → **returning**: no welcome; what's new from `RETURNING_BASELINE`
  (the release they're assumed to know, §11 Q-026); every lesson whose feature is older than that baseline is marked
  known; newer ones are armed.
- **Role** comes from the workspace (`canEditIn`, owner list), so it's per workspace: a viewer here can be an owner
  elsewhere. Lessons check the role at the moment they'd show.
- The first time the doc is written, it records `startedAt`, `audience` and `lastRelease`.

### 5.3 The seen-state (data/onboarding.ts)
- **Firestore `users/{uid}/private/onboarding`** (a new top-level `users` collection; only `request.auth.uid == uid`
  may read or write; shape checked by the rules; ≤ ~20 KB):
  `{ v: 1, audience: 'new'|'invited'|'returning', startedAt, seen: { 'focus': 1, … }, armed: ['side-view'],
  tipsOff: false, lastRelease: '2026-11', welcome: 'done'|'skipped', nudges: { last: <ms> }, updatedAt }`.
  Writes are not `tracked()` (not undoable, not content), batched (≤ 1 write / 2 s), merged per field.
- **localStorage `north-star:onboarding:<uid>`**: the same object, read first so nothing flashes, written at once.
  If Firestore refuses (rules not deployed yet, offline), the app runs on localStorage alone and says nothing.
- Rules + tests are written in the run (`npm run test:rules`), **deployed only by the user** (morning).
- Export/import never carry it (it's a person's, not the workspace's).

### 5.4 The queue (queue.ts)
- Inputs: events (`learn('piece-made', {kind, id})`), the progress store, the busy state.
- **Busy** = any of: a drag (`useCanvasView` `heldAt`/landing, kanban drag), focus spreading or leaving, typing
  (`document.activeElement` editable), a menu/prompt/wizard/setup/hazard/Settings/finder/thread panel open, following,
  the camera gliding, the curtain not revealed. Read from the existing stores (inventory §0), polled on change.
- A lesson triggered by an action waits ≤ 10 s for "not busy" (+ 400 ms calm), else it stays armed for the next
  time the trigger fires. Only one queued at a time per area; a newer trigger of the same lesson replaces it.
- **Retire on done**: when a lesson's `doneWhen` event fires before it shows (or while showing), it's marked seen
  (shown or not, except the welcome, the kind guide and what's new).
- **Cooldown**: after a lesson closes, the next *automatic* one waits 20 s (an action-triggered one waits only for calm).
- `tipsOff`: nothing opens by itself; `?` still works; what's new still marks a dot on `?` instead of opening.

### 5.5 Events (events.ts), mostly without touching views
| Source | Events |
|---|---|
| Workspace open + curtain revealed | `canvas-open` (→ welcome / what's new) |
| `useCanvasView` subscribe | `focus-in {kind}`, `focus-out`, `edit-on {kind}`, `card-selected`, `cards-multi`, `link-selected`, `linking`, `drawing-section`, `packing`, `bringing`, `to-canvas`, `confirming`, `beside-open` |
| `onTracked(fn)` in history.ts (**the agent run adds it in its S3**, with structured op names and `actor: 'agent'` for the agent's writes, which never trigger lessons; until S3 is committed, derive these from the workspace store: a new piece/card/label/edge id appearing that this tab wrote) | `piece-made {kind}`, `card-made {type}`, `text-made {kind}`, `link-made`, `task-made`, `package-made`, `stuck`, `unstuck`, `unframed`, `framed`, `brought`, `canvas-made`, `moved-canvas`, `evidence-added`, `doc-uploaded`, `undo` |
| Other stores | `wizard {kind}`, `setup-open {kind}`, `finder-open`, `threads-open`, `thread-open`, `side-view`, `following`, `filter-open`, `doc-reader`, `settings-open {page}` |
| URL | `canvas` switch, `?beside=` |
| One-line hooks (only where no store has it) | `plus-open` (+ the hovered row for the kind guide), `context-menu {on}`, `menu-open` (any prompt) |

### 5.6 Mounting
`<Coach />` once inside `WorkspaceContext.Provider` in WorkspaceLayout.tsx (one line) and once on the workspaces
page. It portals to `body`: modals at z 40 with `role="dialog"` (the canvas wheel scrolls them, plane keys skip
them), lessons at z 20 (above the HUD and panel, under the finder/toast), stops `pointerdown` from reaching the
canvas (as SidePanel does).

---

## 6. The demos (scenes from the real components)

### 6.1 Why a sealed frame (an iframe)
The piece components read the workspace from `useWs()` (a store we can fill with made-up data), **but also from
module-level stores** shared by the whole page: the camera and selection (`useCanvasView`), `useKanbanUi`,
`useMatrixUi`, guides, filters, presence. A demo drawn in the same page would move the person's camera and selection.
An `<iframe src="demo.html#scene=…">` from the same app gets **its own copy of every module**, so the real
components (PlaneCards, Kanban, Matrix, Table, Timeline, TextItems, CardPanel, Marks, FocusedPlane…) run untouched,
on their own stores, with nothing leaking either way. It's same-origin, so theme and motion come along and fonts are cached.

Rejected: (a) the same page with every store made per-instance (a rewrite of hot files, months of risk); (b) videos/GIFs
(out of date at the first design change, heavy, no theme; the user prefers components); (c) hand-made look-alikes (drift).

### 6.2 The demo realm
- **Its own entry** `demo.html` → `src/demo/main.tsx` (Vite multi-page; GitHub Pages serves it as a file). It imports
  the workspace views directly (`loadWorkspace()` chunk), not the router or App.
- **No Firebase at all**: `firebase.ts` gets one guard (`isConfigured && !isDemo`), so `firebase === null`; every hook
  already handles `!firebase`. Auth: a fake user (`demo`, "You"). Presence: `usePeersOn` etc. return the scene's
  scripted peers (a small seam in `src/data/presence.ts`: a demo source). Writes: `setReadOnly('demo')` with the toast
  muted, so any handler that slips through writes nothing.
- **Stage**: a `WorkspaceContext` store over a fixture (`WorkspaceData` typed, so the compiler checks it), the
  real `CanvasView` or just one piece's view (a scene picks), the backdrop off, the page black/paper, `pointer-events:
  none` on everything (the frame is `inert`), a fake cursor (the app's pointer drawn as an SVG) and key chips
  (`⌘F` shown bottom-left like a keycap) drawn by the stage.
- **Director**: a scene is `{ id, fixture, view, size: [w, h], length ≤ 6000 ms, poster, steps }`; a step is
  `{ at, do }` with a small API: `set(ws => …)` (change the made-up data, e.g. move a task), `cursor.to(selector, ms)`,
  `cursor.press()`, `cursor.drag(selector, to, ms)`, `key('⌘F')`, `ui.focus(id)`, `ui.select(id)`, `ui.edit(id)`,
  `ui.open('setup')`, `peer(name).to(selector)`, `wait(ms)`. Targets by `data-*` selectors, never coordinates (they
  survive layout changes). At the end it holds 1 s, then breaks the stage cell by cell and rebuilds the first frame.
- **Clock**: the director drives `requestAnimationFrame` time; `seek(t)` for headless shots and the poster; the app's
  own `__advance` for the cell reveals; reduced motion → `seek(poster)` and stop.
- **Talking to the app**: `postMessage` (`play`, `pause`, `seek`, `scene`, `theme`, `motion`) and back (`ready`,
  `loop`, `error`). One iframe reused for every demo; created on the first lesson that needs it, kept while the coach
  is open, preloaded after the workspace is idle.
- **Size**: scenes are authored at a fixed stage (e.g. 960 × 600 CSS px) and scaled into the card with a CSS
  transform; text stays sharp at device scale.

### 6.3 Needs from the store swap (for the agent's preview, D-312 §4.5; north-star-b2 builds one seam for both)
The agent's preview swaps the workspace store to a projected `ws'` while a preview is open. Onboarding's demo realm
needs the same seam, from a different side. So that it's built once:
1. **A provider that takes any `WorkspaceData` (+ `wid`, `workspace`, `canvas`) without Firestore listeners**: the
   store in `context.ts` already does this; keep `useWorkspaceData` (Firestore) *outside* it, so the demo can pass a
   plain object. Please don't make the store reach for Firestore itself.
2. **`getWs()` outside React** (agent S2) should read the *current provider's* store, not a module singleton, or the
   demo's iframe can't be the only one (fine either way inside an iframe, but don't assume a single workspace per page
   in new code).
3. **Writes refused or kept in memory**: when the ops layer lands (`src/ops/`, agent S3), a **memory backend** for
   `apply()` (writes go to the in-memory `WorkspaceData`, not Firestore) would let demo scenes call the real ops
   (`ops.moveCard`) instead of `set()`. Not needed for v1 (scenes mutate data directly); please keep the door open.
4. **No presence / Auth calls from the projected store or ops**: the demo has no Auth user in Firebase; ops that read
   `auth.currentUser` should take the user from a parameter/context.
5. **The diff marks** (agent preview) and onboarding's **highlight** (a scene pointing at a changed thing) could share
   a "mark this id" overlay later. Not now.

### 6.4 Scenes needed (≈ 35; each listed with its lesson in onboarding-lessons.md)
Grouped: canvas (pan/zoom/fit, plus-adds, edit-move-resize, console, focus-ink, unframe, stick, beside, canvases,
finder), planes (card-make-name, card-panel, link-draw, multi-select, package, shared-card, parts, competitor features,
filter), text (heading, paragraph, sticky, section), lenses (matrix-wizard→cells, matrix-keys, table-rules, table-keys,
deck-drag, task-panel, side-view, timeline-draw, card-deck priorities), documents (list→beside, place), together
(cursors+comment, follow, thread), what's new items. Fixtures: one rich workspace ("Pazar": a marketplace startup;
6 customers, 8 problems, 5 competitors with features, 6 ideas, 8 features, links, a matrix, a table, a deck with 12
tasks, a timeline, two documents) and small ones derived from it per scene.

---

## 7. What's new (releases.ts)

- `releases.ts` lists releases newest first: `{ id: '2026-11', date, title, items: [{ title, line, scene?, lessons:
  [...], go? }] }`. A release is a group of user-facing decisions (D-numbers), not a version number: the app has none
  (package.json `0.0.0`). The first list is written from `state-history.md` (§11 Q-026 decides how far back).
- On `canvas-open`: releases newer than `lastRelease` → what's new (§4.4), then `lastRelease` = newest.
- New people: `lastRelease` = newest at once (they get the welcome instead).
- Each lesson has `since: '<release id>'`; a returning person's baseline marks older lessons known.

---

## 8. Checks (what the run proves before each commit)

1. `npm run build` (typecheck + build; the demo entry builds too).
2. **`npm run check:lessons`** (new, `scripts/check-lessons.mjs`): ids unique and kebab; versions ≥ 1; every
   `trigger`/`doneWhen` is an event `events.ts` emits; every `after` exists and there are no cycles; every `scene`
   exists in `src/demo/scenes/`; every `anchor` appears as `data-learn="…"` in `src/`; titles ≤ 6 words, bodies ≤ 25
   words, ≤ 4 pages (welcome 4); roles valid; every release item points at lessons or scenes that exist; every
   piece kind and card type in `pieces.ts`/`cards.ts` has a kind-guide entry; the words avoid "board"/"kanban" on screen
   (D-180, D-301: "plane", "deck").
3. **vitest** (shared with the agent run; if it's not there yet, wait for it or coordinate): audience (new, invited,
   returning, viewer), the queue (busy, one at a time, cooldown, retire-on-done, tipsOff), progress merge (local vs
   Firestore, older wins nothing), releases (what's new for a given lastRelease).
4. **Rules tests** for `users/{uid}/private/onboarding` (own only, shape, size) in `tests/rules.test.mjs`
   (`npm run test:rules`; **not deployed**).
5. **Scenes check** (headless, `scripts` in the scratchpad or `tests/demo.mjs`): every scene loads with **zero
   requests** to googleapis/firebaseio/firebasestorage, no console errors, reaches `ready`; seek to 0, poster and end
   renders; after one loop the first frame equals the first frame before (pixel diff under a threshold); dark and light;
   reduced motion shows the poster still.
6. **Flows** (headless on the emulators, puppeteer-core, state.md's notes): a **new** person (fresh auth user) →
   workspaces empty state → create → welcome 4 pages → empty-canvas hint → `+` with the kind guide → a plane → its
   lesson → focus → its lesson → a card → … ; an **invited** person (Bob into Alice's filled workspace); a **returning**
   person (account older than `ONBOARDING_START`) → what's new only; a **viewer** (Carol) → viewer welcome, no editing
   lessons; `tipsOff`; `?` replays. Asserts: never two coach surfaces at once; nothing opens during a drag or focus
   transition; each lesson's card doesn't cover its anchor (rects); `esc` closes; focus returns.
7. **Shots** (like agent-run §1.6): every lesson, the welcome, the kind guide, what's new and `?` in dark and light, at
   1568 × 980 (2×), in `docs/specs/onboarding-shots/` with an `index.html` gallery (captions; never published).

---

## 9. Phases (the run's steps are in onboarding-run.md §1.5)

0. **Spike: the demo realm** (decides §6): one scene (a plane with cards, a card dragged) in an iframe, no Firebase
   traffic, real components. If it can't be made to work in the step, the fallback is logged and taken (§10).
1. Data + audience + progress + rules (+ tests, not deployed).
2. Events, queue, `?` skeleton, `check:lessons`.
3. The coach surfaces (welcome, lesson card, kind guide, what's new, nudge, `?`) on placeholder demos; a design pass
   with a preview of options first (the user decides the look later; the run builds the recommended one).
4. The director + fixtures + scene tooling (seek, poster, loop, headless check).
5. Lessons by area, each with its scenes: canvas & pieces → planes & cards → links → text → matrix & table →
   documents → decks & days → together → canvases & settings → workspaces page & empty states.
6. What's new + releases + returning flow.
7. Full flows + shots gallery + polish.

---

## 10. Risks and fallbacks

| Risk | Sign | Fallback |
|---|---|---|
| A view imports something that touches Firebase at import time in the demo realm | network requests or a crash in the spike | guard that import (`!firebase`), or stub the module via a Vite alias in the demo entry only |
| A view needs the router (`useSearchParams`) | crash in the stage | wrap the stage in a `MemoryRouter` with the scene's `?focus=` |
| Heavy iframe (a second copy of React + the workspace chunk) | > 400 ms to `ready`, jank | one iframe reused; preload on idle; poster PNGs (taken headless at build of the shots) shown until `ready` |
| Scenes break when a component changes | scenes check fails | that's the point: the check names the scene; selectors by `data-*`, not classes |
| The queue opens something at a bad moment | flows test catches it | add the moment to "busy"; a lesson that failed to find calm stays armed |
| Firestore rules not deployed in the morning | permission-denied | localStorage only, silent; the morning list says "deploy rules" |
| Hot files busy with other sessions' uncommitted work | `git status` | do other steps first; ask the peer; never take their hunks (run §1.2) |

---

## 11. Questions for the user (each has a default the run uses until answered)

- **Q-025 · soon · where is "seen" kept?** Default: per person in Firestore (`users/{uid}/private/onboarding`) with a
  browser cache; needs `npm run deploy:rules` by you once. Alternative: this browser only (no deploy, but a new
  laptop shows everything again).
- **Q-026 · soon · what counts as "new" for people who used it before?** Default: accounts made before
  `ONBOARDING_START` are "returning"; their baseline is **D-291 (2026-10-27, 1.5 merged to main)**, so what's new
  covers what came after (decks and days, timeline as a strip, several canvases, filters that pass, D-293–D-314).
  Alternatives: everything in 1.5 is new to them (show the full welcome too), or nothing (only lessons as they go).
- **Q-027 · later · a rule for the future**: "every new user-facing feature ships with its lesson and a release
  line". Default: added to CLAUDE.md's hard rules by you (the run doesn't edit CLAUDE.md).
- **Q-028 · later · the look**: the run builds the recommended look (wizard-like modal, prompt-like lesson card);
  a preview with 2–3 options goes in `docs/specs/onboarding-preview/` for you to pick in the morning.

---

## 12. Session kickoff prompt (paste into a fresh session)

> You are the lead building North Star's onboarding. Read `docs/specs/onboarding.md` (the plan, D-315),
> `docs/specs/onboarding-lessons.md` (every lesson) and `docs/specs/onboarding-run.md` (the protocol and the progress
> log) in full, and follow the protocol exactly. Another lead is building the agent at the same time
> (`docs/specs/agent-run.md`): coordinate with it as the protocol says. Start from the log's "Now".
