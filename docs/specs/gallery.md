# The component gallery (D-324)

A page for developers that shows every UI component of the app, each in its states, on made-up data, in dark and
light, full and reduced motion. Dev only: `gallery.html`, served by the dev server, never built or deployed.

Status: G0 (this spec), G1 (the page, every `src/ui` example, the check) G2 (the pieces, `[grid]`) and G3 (panels,
docks, wizards, screens, onboarding) built 2026-10-31; G4 not started. Scope: `src/ui` first (the user, 2026-10-31), then the
pieces (G2), then panels, screens and onboarding (G3).

---

## 1. Why

- The app has ~90 components; most are seen only after clicking through a workspace into the right state (a deck's
  column over its limit, a matrix cell `~ ?`, a plane in edit mode, the hazard confirm). Checking a change in light
  theme or reduced motion means doing that twice more.
- A place where each one is one click away, in every state, makes design checks fast, shows drift between components
  (the consistency work, D-263–D-277) and gives headless shots a fixed address for each state.

## 2. What it's built on: the demo realm

The onboarding's demo realm (D-315, `demo.html`, `src/demo/`) already mounts real components on made-up data with
nothing reaching Firebase. The gallery reuses its parts, not its director:

| Part | From the demo realm | In the gallery |
|---|---|---|
| No Firebase | `window.__northStarDemo = true` before any module (src/data/firebase.ts reads it) | the same, in `gallery.html` |
| Storage | localStorage / sessionStorage in memory, theme + motion copied in | the same (so the gallery never changes the app's own choices on this origin) |
| Writes | `setReadOnly(...)`, refused writes counted, not errors | the same; the count shown in the bar (`refused 2`): it says what a click would have written |
| Workspace data | `makeStore(fixture)` + `WorkspaceContext` + `registerStore` | the same, one store per mounted example |
| Fixtures | `src/demo/fixtures/` (tiny, pazar, kit…) | shared; new ones go in the same folder |
| Store reset | `fresh()` in boot.tsx: every outside-React store back to its start | moved to a shared module (`src/demo/realm.ts`) used by both |
| Hover / focus | `demoCss.ts`: `:hover` also matches `[data-demo-hover]` | the same rewrite, so a state can show hover or focus held still |
| Clock | a virtual clock stepped by the director | **not used**: the gallery runs on real time, so hover, drags and entrances behave as in the app |

So: no Storybook (it would need the same store set-up per story anyway, a build of its own beside Vite/rolldown, and
it brings its own look).

## 3. The page

`npm run dev` (or another port, e.g. `npm run dev -- --port 5179`), then `/gallery.html`. Rebuilt by D-336 (the user:
"hiçbir şey anlamıyorum… ne nerde nasıl kullanılmış"): a page per component.

```
┌─ > find a component… ─┬──────────────────────────────────────────────────┐
│ # PRIMITIVES          │ Button                                           │
│   Button            7 │ [PRIMITIVES]  src/ui/primitives/Button.tsx        │
│   Label             3 │ the one button: sm the [verb] of rows and bars…  │
│ # PATTERNS            │ STATES · 7 ─────────── THEME  MOTION  ON  (ZOOM) │
│   Window            4 │ ┌sm tones──┐┌sm with key┐┌link─────┐ …            │
│ # PANELS              │ BUILT FROM · 0 ─────────────────────────────────  │
│   Card panel        8 │ USED IN · 37 ───────────────────────────────────  │
│ # AGENT               │   PANELS   Card panel · Task panel · …           │
│   Agent             — │   DECKS    Deck · Timeline · …                   │
└───────────────────────┴──────────────────────────────────────────────────┘
```

- **Left column**: every component file, grouped by layer and area (`src/gallery/pages.ts`'s AREAS, from where the file
  lives: foundation, primitives, patterns, canvas, planes, panels, decks and days, table, matrix, documents, text,
  threads, finder, settings, screens, onboarding, agent, backdrop), with its number of states, or `—` without an
  example. In the prompt look (D-222). `tree`: the same files by what they're made of (uses.ts); every row opens. The
  title goes to the overview. `window.__gallery` lists every example and its states, for scripts.
- **Overview** (nothing picked): every component, area by area: name, what it is, its states, how many use it.
- **A component's page**: its name, area and file (a click copies it), what it is. `STATES`: every state side by
  side, each the address with `&alone` in a frame of its own (a small part at its own size, a `size: 'full'` one at a
  third); a click opens it large and live, with the state tabs, `ZOOM`, `[‹ all states]` (Esc), `[ ]` / `]` step,
  `\` mounts again. `BUILT FROM` and `USED IN`: the component files it draws and that draw it (uses.ts), a line per
  area, each a link (faint: no example yet, its page still says where it's used). A file with no example has a page
  too: no states, only those two.
- **Live**: a state open large is mounted fresh each time it's picked (new store, every outside-React store reset). An
  error while drawing is caught for that example only: a magenta line with the message. `THEME` / `MOTION` are the
  gallery's own stores (never the app's storage); `ON` the page's black or a piece's graphite surface (D-263); `ZOOM`
  `1` or `2`. A state's box is as big as it draws, or its `size` (`[w, h]`, or `full` for what places itself on the
  screen); the box is a transform, so `position: fixed` lands in it. Under it: writes refused, `[again]`, `[alone ↗]`.
- **Address**: `gallery.html#c=select&s=open&theme=light&motion=reduced&on=piece&zoom=2` (no `s`: every state side by side; `&alone` for the bare example). Every state
  of every component has one; back/forward work.
- Text in the gallery's own chrome follows the rules of the app: tokens only, Geist Mono, labels uppercase, actions
  lowercase. It is a dev page, but it's the same design language.

## 4. Example files

One file per component, next to it: `Select.gallery.tsx` beside `Select.tsx`. The gallery finds them itself
(`import.meta.glob('/src/**/*.gallery.tsx')`), so there is no list to keep.

```tsx
// src/ui/primitives/Select.gallery.tsx
import { example } from '../gallery/example'
import { Select } from './Select'

export default example({
  name: 'Select',
  place: 'forms/pickers',      // category/group on the map (D-326); `also: ['…']` lists it elsewhere too
  file: 'src/ui/primitives/Select.tsx',
  states: {
    default: () => <Select value="b" options={OPTS} onChange={() => {}} ariaLabel="pick" />,
    open: {
      render: () => <Select value="b" options={OPTS} onChange={() => {}} ariaLabel="pick" />,
      // After the first frame: open it as a person would (a real click on the real element).
      setup: (c) => c.click('[aria-haspopup]'),
    },
    'many options': () => <Select value="o3" options={MANY} onChange={() => {}} ariaLabel="pick" />,
  },
})
```

- A state is a render function, or `{ render, setup?, hover?, fixture?, route?, size? }`:
  - `setup(c)`: runs after the first frame; `c` has the store (`c.store.set(...)`, `c.store.tell()`), real clicks and
    keys on the real elements (`c.click(sel)`, `c.key('Escape')`), and the outside stores (canvas camera, kanban UI…).
  - `hover`: a selector held hovered (`[data-demo-hover]`, §2).
  - `fixture`: the made-up workspace (default `tiny`); `route`: the router's address (`?focus=<id>` for a piece in
    focus); `size`: the example's box (`[w, h]`, default the middle's size).
- Examples hold state locally when it helps (a `Select` that really changes its value): a small wrapper component in
  the example file. Handlers never write: anything that reaches `src/data/` is refused and counted.
- Pieces and panels are mounted the way the demo's `CanvasScreen` does (`src/demo/views.tsx`): the real `CanvasView`
  over a fixture, with the route picking focus; a piece alone uses the `bare` trick (no HUD).
- `*.gallery.tsx` files are dev-only: imported only by the gallery, never by the app (a check in G3).

## 5. What it is not

- Not shipped: `gallery.html` is not in `vite.config.ts`'s inputs or `vite.demo.config.ts`'s, so `npm run build`
  leaves it out; nothing in `dist/` links to it.
- Not a test runner: no assertions. Headless shots of each address come in G4.
- No Firebase, no emulators, no sign-in needed.
- Not a user-facing feature: no onboarding lesson (D-315 covers what users see).

## 6. Steps

- **G1 — the page and `src/ui`.** `gallery.html`, `src/gallery/` (main, shell, the mount with its boundary, the
  registry, `example()`), `src/demo/realm.ts` (the shared reset), the left column, the bottom bar, the address; an
  example file for every component exported from `src/ui`; `npm run check:gallery` (§7) for `src/ui`.
- **G2 — the pieces (built).** `src/gallery/canvas.tsx`: `onCanvas({ only, open, focus, edit, selected, card, cards,
  link, label, change, then })` mounts the real CanvasView over Pazar (no HUD) and leaves the stores as a person's
  clicks would; `docTexts()` draws a document's text (no Firestore). Examples beside CanvasView, PlaneCards,
  PlaneLinks, TextItems, Matrix, Table, Kanban, CardKanban, Timeline, Documents, DocumentPiece: on the canvas, in
  focus, unframed, edit mode, picked. `[grid]`: every state at once, each in a frame of its own (`&alone`), so their
  stores never meet. gallery.html gives the fixtures' clock (`window.__demoClock`): real time, dates from Pazar's day
  (20 Oct 2026). The check covers `src/views/workspace` too, with a `PENDING` list (G3's components) that only shrinks.
- **G3 — panels, screens, onboarding (built).** Every component in `src/views/workspace` and `src/onboarding` has
  its example (the check's `PENDING` is empty; `src/onboarding` covered). Helpers beside canvas.tsx: `panels.tsx`
  (Pazar's threads with messages, a package, a match, parts), `docks.tsx` (find, right-click, press, drag with
  pointer capture made harmless), `screens.tsx` (`screen()`: the whole screen as the demo's CanvasScreen, HUD and
  all; several canvases; a peer's cursor placed), `onboarding.tsx` (`Fresh` resets the coach's progress and guide
  role, lessons built as devMount does, a lesson drawn once its anchor is there). The shell has no z-index, so a
  portal centred on the window (a wizard, a list) reads whole; the list says `role="list"`, so a lesson doesn't
  take it for an open menu. Not shown fully: people's names (Firestore paging), peers' cursors after a pan (their
  tracks are presence.ts's own).
- **The tree (D-326, built).** The list's other half, `[tree]` (`&side=tree`): every component file by level, level 0
  the primitives (they draw no other component file), each opening (`▸ N`) into what uses it, and on up to the
  screens; files with no example (the agent, the landing, three.js) listed faint. The bar's `USES` and `USED IN` rows
  for the component shown. Read from the sources (src/gallery/uses.ts: a file uses another when it imports a
  capitalised name from it and draws `<Name`), never kept by hand.
- **The map (D-326, built).** `place` and `also` replace `section`; `MAP` in registry.ts; a Tokens page under
  foundations (src/gallery/Tokens.gallery.tsx, every token read from the page's style sheets).
- **G4 — shots (later).** A script that opens each address `&alone` in dark/light × full/reduced and saves PNGs, with
  puppeteer-core from a scratchpad (never a dependency of the repo, as state.md's notes say); a side-by-side page for
  comparing two runs. Decided when G3 is done.

## 7. The rule and its check

- **Every new UI component in a covered folder, or a real change to one, ships in the same change with its example
  file** (`X.gallery.tsx` beside `X.tsx`), its states covering what changed. Covered today: `src/ui`; a folder joins
  when its step (G2, G3) is built. In CLAUDE.md's hard rules.
- `npm run check:gallery` (`scripts/check-gallery.mjs`) fails when:
  - a `.tsx` in a covered folder exports a component (a capitalised `export function` / `export const … = memo(`) and
    has no `.gallery.tsx` beside it, unless it's in the check's `EXEMPT` list with why (e.g. `Curtain`: the page's
    own entrance, seen on every load);
  - a `.gallery.tsx` has no component file beside it any more;
  - anything outside `src/gallery/` and the `*.gallery.tsx` files imports a `*.gallery.tsx` or `src/gallery/`;
  - `gallery.html` appears in a build input (`vite.config.ts`, `vite.demo.config.ts`).
- Dev only, for good: the deployed site never has the gallery (the user: "Deploy ettiğim şeyde neden göstereyim").
