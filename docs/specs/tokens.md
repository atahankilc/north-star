# Tokens: one set of rules for every value (D-325)

Status: **agreed 2026-10-31 (D-325, superseding D-319's "nothing may look different").** Written from a count of
every declaration in the 62 CSS files (tokens.css left out). The user wants **consistency first**: off-scale values snap
to the scale; what visibly changes is listed below (all agreed) and checked in before/after shots. Tokens are in
`src/styles/tokens.css`; progress is `npm run check:tokens` (1,760 raw values on 2026-10-31).

## Where we are

| What | Uses | Already tokens | Raw values (distinct) |
|---|---|---|---|
| Colour | ~1,600 | almost all | 12 hex (Hud's night copies, 2 masks, 1 glue) |
| Spacing (padding, gap, margin) | ~900 | most | ~25 raw px values: 2, 3, 5, 6, 7, 10, 14, 18, 20, 36 |
| Font size | 362 | 290 | 64 raw, 22 distinct (5.2 → 26 px) |
| Tracking | 145 | 80 | 21 raw, 9 distinct |
| Line height | 120 | 9 | 31 distinct |
| Sizes (width, height, min, max) | ~590 | few | ~120 distinct |
| Lines (border, outline) | ~470 | colours yes | widths raw: 1, 2, 3.5, 6, 7 px |
| Shadows | 51 | some | 31 distinct |
| Layers (z-index) | 113 | none | 26 distinct, −1 → 2147483647 |
| Opacity | 69 | none | 10 distinct |
| `color-mix` amounts | ~60 | `--card-tint` | 23 distinct (3 % → 96 %) |
| Durations and eases | ~110 | `--dur-*`, `--ease-out` | 14 raw durations, 2 raw eases |
| Radius | 0 | | nothing rounded anywhere (keep it so) |

Colour and spacing are in good shape. Sizes, type inside the world, line heights, layers, opacity and shadows are where
the 940 raw px and the inconsistency really are.

## The ground rules

1. **No number with a unit in a module CSS file**, except: `0`, `%`, `ch`, `em` (sizes relative to the text), `vw`/`vh`,
   and the multipliers in a `calc()` (`calc(2 * var(--space-3))`). Every px, ms, hex, z-index and opacity is a token.
2. **Two families.** Screen tokens (`--text-*`, `--space-*`, …) for what is drawn at screen size: HUD, panels, menus,
   prompts, the agent, settings, onboarding. **World tokens (`--w-*`)** for what lives inside the zoomed world in canvas
   px: card faces, plane text, kanban sheets, the timeline, matrix and table cells, documents' sheets, stickies. A world
   element never uses a screen type token, and the other way round (spacing is shared, see below).
3. **A component's own geometry is a named token too** (a panel's width, a row's height): `--panel-w`, `--row-h`. If it
   is used by one component only it is still declared in tokens.css under that component's heading, so every size the
   app has is in one file.
4. **Snap, don't add.** An off-scale value moves to the nearest step; a new step is added only when a value is used in
   many places for one clear purpose. Ties round up, unless the before/after shot looks wrong.
5. **Checked by a script:** `npm run check:tokens` fails on any raw value left (rule 1), like `check:memory`.

## 1. Type

### Screen
The scale stays, with one step added for panel titles:

| Token | px | For |
|---|---|---|
| `--text-xs` | 11 | labels, meta, small buttons; **nothing smaller on screen** |
| `--text-sm` | 13 | body, controls, notes |
| `--text-md` | 15 | reading text |
| `--text-lg` | 18 | card and list titles |
| `--text-title` *(new)* | 22 | right panel titles (SidePanel; 22 today, DESIGN.md said 26) |
| `--text-heading` | 26 / 20 on phones | page and report titles |
| `--text-xl`, `--text-hero`, `--text-display` | clamp | as today |
| `--text-code` *(new)* | 0.88em | code and markers inside Markdown (0.86em ×3, 0.92em ×1) |

**Changes you will see:** the 31 labels at **10 px become 11 px** (CardPanel's small labels, Menu headings and foot,
SidePanel and Agent rules, CardTasks' due and where, PreviewMarks' badge). Matrix and Documents' 10 px are in the world,
see below.

### World (canvas px, scaled with the zoom)
Today 14 sizes: 5.2, 7, 7.5, 8, 9, 9.5, 10, 10.5, 12.5, 13, 14, 22, 24, 26. Proposed 7 steps:

| Token | px | Was | For |
|---|---|---|---|
| `--w-text-3xs` | 7 | 5.2, 7, 7.5 | the tiniest caps: a card's chip and inner category, mini avatars, the sticky's glue band and fold |
| `--w-text-2xs` | 8 | 8 | a link's chip, a package band's caps |
| `--w-text-xs` | 9 | 9, 9.5 | who, meta rows, members, month names |
| `--w-text-sm` | 10 | 10, 10.5 | hints in cells, sheet text, readouts |
| `--w-text-md` | 13 | 12.5, 13 | pills, row labels, order titles |
| `--w-text-lg` | 14 | 14 | card, task and package titles |
| `--w-text-xl` | 22 | 22, 24 | a card's compact title and handle |
| `--w-text-2xl` | 26 | 26 | the project title's description |

Headings, paragraphs and stickies keep their sizes in TS (`PARA_PX`, `STICKY_PX`, H1–H3 48/29/22), since the layout
measures with them; they move to `tokens.ts` under `world`, so TS and CSS read one list.

**Changes you will see:** the sticky's glue band (`ATAHAN · 2m`) goes 5.2 → 7 (it's the one to check in shots: it may
be better at 7, or it may need to stay its own size relative to the note), a card's compact title 24 → 22, small
half-pixel steps (7.5, 9.5, 10.5, 12.5) round to their neighbour.

### Tracking
Three on screen and in the world, plus one for glyph cells:

| Token | Value | Was |
|---|---|---|
| `--track-label` | 0.12em | 0.14, 0.12, 0.1, 0.08, 0.06, 0.04em (every uppercase label) |
| `--track-title` | -0.02em | -0.01, -0.015, -0.02em, and `tracking()`'s -0.02 / -0.03em in TextItems.tsx |
| `--track-display` | -0.045em | as today (the project title, the landing) |
| `--track-cells` *(new)* | -1px | kanban's `▮▮▯` cells: glyphs that must touch |

**Changes you will see:** world caps labels at 0.14em (a card's kind, a piece's name in edit, the package kind) tighten
a little to 0.12em; headings' caps (0.04em) open up to 0.12em: this one is visible, and is the one to look at.

### Line height
31 values → four ratios, no px:

| Token | Value | Was |
|---|---|---|
| `--lh-none` | 1 | 1, 0.82, 0.9 |
| `--lh-tight` | 1.15 | 1.05, 1.12, 1.15 |
| `--lh-snug` | 1.3 | 1.2, 1.25, 1.3 |
| `--lh-body` | 1.5 | 1.4, 1.45, 1.5, 1.55, 1.6, 1.65 |

The 30 line heights in px (9, 10, 11, 12, 14, 15, 16, 18, 20, 30) are row heights in disguise: they become `--row-*`
(see Sizes) or a ratio. **Visible:** small, a line or two in long text moves by a pixel or so.

### Weight
`--weight-regular` 400, `--weight-medium` 500, `--weight-bold` 600 (only these three are used today).

## 2. Spacing
The scale stays and gets one step below 4, for hairline gaps (2 px is used ~70 times):

`--space-half` 2 · `--space-1` 4 · `--space-2` 8 · `--space-3` 12 · `--space-4` 16 · `--space-6` 24 · `--space-8` 32 ·
`--space-12` 48

Snaps: 3 → 2 or 4 by look · 5 → 4 · 6 → 8 · 7 → 8 · 10 → 12 · 14 → 16 · 18 → 16 · 20 → 24 · 36 → 32.

Shared by screen and world: inside the world it is a 4 px rhythm in canvas px, which is what it is today. (The 25 px
`GRID` stays: it places things, it doesn't space them.)

**Changes you will see:** chips and pills (`2px 10px`, `5px 12px`, `7px 12px`) get a little wider or taller; gaps of 6
and 10 between icons and text open slightly. This is the biggest visible change by count, and the one where "ties round
up" may need to give way to "round down" in dense lists (kanban sheets, the table).

## 3. Sizes
~120 distinct widths and heights. They fall into five kinds, each with its tokens:

- **Lines:** `--line-w` 1 px (every border, rule, divider; ~320 uses), `--line-w-bold` 2 px (bands, drop lines,
  inset bars; `--piece-band` already is). Offsets that overlap a border (`-1px`) become `calc(-1 * var(--line-w))`.
- **Dots and glyph marks:** `--dot` 6 (6, 7), `--dot-lg` 10 (8, 9, 10, 12) for status dots, swatches, scale squares,
  handles.
  The Marks' sizes (`--mark-*`) stay as they are.
- **Controls** (screen), one ladder of squares and rows: `--control-xs` 16 (badges), `--control-sm` 24 (avatars,
  small buttons, chips; 22–26), `--control` 30 (buttons, triggers, rows; 28–30), `--control-lg` 36 (the side nav's
  tools, the create button), `--control-xl` 48 (the big avatar). `--head-h` 40 and `--hud-h` 56 as today.
- **Panels and columns** (screen), named once each: `--panel-w` 400 (the right panel, D-219), `--menu-w` 260 (menus,
  popovers, a settings label), `--menu-max-w` 360, `--menu-h` 460 (the prompt), `--list-h` 320 (Select, people),
  `--confirm-w` 420, `--modal-w` 960 / `--modal-h` 720 / `--modal-nav-w` 216 (settings), `--name-max-w` 160,
  `--hud-shade-w` 120, `--measure` 760. Small labels' widths are in `ch` (10ch, 12ch).
- **Marks on edges:** `--corner-mark` 7 (the magenta L's on panel, console and dock corners), `--lead` 12 (a numbered
  rule's magenta lead), `--underline-offset` 3 (2–4).
- **Breakpoints** can't be variables: `@media` lines are left to themselves, and they are 760 and 640 px only.
- **World geometry** (`--w-*`): a card's 200 × 100 and its parts, kanban sheet and column widths, timeline row height,
  documents' sheet (140 × 186). These are read by TS for layout too, so they live in `tokens.ts` (`world`) and are
  written into CSS from there once, at load (one place, read by both).

Arrowheads drawn as CSS triangles (border widths 3.5, 6, 7 px) become `--arrow` 7 px (one size for every arrow).

## 4. Colour
- Hud's night colours (8 hex, copies of tokens.css's night block) → `--night-fg`, `--night-fg-strong`, `--night-fg-dim`,
  `--night-fg-faint`, defined once in tokens.css, read by both.
- Masks (`linear-gradient(#000 …)`) use the keyword `black`: a mask is opacity, not a colour, and themes don't touch it.
- The sticky's glue (`color-mix(…, #000)`) → `--sticky-glue-mix` with `--shade` (black in both themes).
- **`color-mix` amounts** (23 values) → five: `--mix-wash` 8 % (3–12), `--card-tint` 16 / 9 % (as today), `--mix-soft`
  40 % (32–55), `--mix-strong` 72 % (60–78), `--mix-near` 86 % (80–96). The feathered shade behind ink is one token,
  see Shadows.
- **Opacity** (10 values) → three: `--o-faint` 0.35 (0.32–0.45), `--o-dim` 0.6 (0.5, 0.6), `--o-soft` 0.85 (0.7, 0.85).
  0 and 1 stay as they are.

**Visible:** faint things (packages' non-members, ghosts) get a little more alike; nothing changes colour.

## 5. Shadows
31 → five:

| Token | What |
|---|---|
| `--piece-shadow` | as today (a framed piece) |
| `--feather` | the hugging shade behind ink on the page: `0 0 16px 10px` of the page at 72 % (today 12 px 8, 16 px 10, 18 px 12) |
| `--ink-feather` | the same on the onboarding's ink (`--ink-shade`) |
| `--bar` | an inset bar on one side (2 px, its colour from `--tone` / `--type`) |
| `--ring` | an inset 1 px ring (`--line-hover`, `--tone`, `--fg-faint`) |

## 6. Layers (z-index)
26 values with no system. Two kinds:

**Inside a component** (stacking under or over its own parts): `--z-under` -1, `--z-1` 1, `--z-2` 2, `--z-3` 3. Today's
4–7 and 9 inside pieces (CanvasView, PlaneCards, Timeline, DocumentPiece) become `--z-3` or a named layer below.

**The app's layers**, lowest first, each with a name:

| Token | Value | What (today) |
|---|---|---|
| `--z-world-ui` | 5 | marks and drop lines over the world (CanvasView, PlaneLinks, Timeline: 5–7, 9) |
| `--z-hud` | 10 | HUD, context menu, piece consoles |
| `--z-panel` | 12 | right panel, threads, agent, pack picker (11–13) |
| `--z-coach` | 20 | onboarding lessons and coach, a title being typed (20, 25) |
| `--z-float` | 30 | finder, toasts, others' Marks tags (30, 31) |
| `--z-menu` | 40 | prompts and menus, the guide, the kind guide (39–41) |
| `--z-popover` | 60 | Select, people here, canvas switch, preview marks (60, 61) |
| `--z-curtain` | 100 | the loading curtain (100, 101) |
| `--z-demo` | max | the demo stage only |

A `+ 1` stays as `calc(var(--z-menu) + 1)`. **Nothing should look different**: the order is kept; each merge is
checked against what stacks with it.

## 7. Motion
Durations today: 40, 70, 80, 120, 140, 160, 180, 200, 260, 280, 320, 400, 420, 600 ms, plus `--dur-*` 200/400/600.

| Token | ms | For | Was |
|---|---|---|---|
| `--dur-press` | 70 | a press (Marks, buttons) | 40, 70, 80 |
| `--dur-snap` | 120 | resize, landing, the console's way out | 120 |
| `--dur-quick` | 160 | small things in and out, steps(3) entrances | 140, 160, 180 |
| `--dur-fast` | 200 | hovers, colour changes | 200 |
| `--dur-decode` | 260 | text decode (D-034) | 260 |
| `--dur-cells` | 320 | a component's cell-by-cell build-up (D-035) | 280, 320 |
| `--dur-med` | 400 | headline, page, large moves | 400, 420 |
| `--dur-slow` | 600 | | 600 |
| `--dur-spring` | 300 | Marks' spring | 300 |

Eases: `--ease-out` (as today), `--ease-in-out` `cubic-bezier(0.65, 0, 0.35, 1)` (fold and resize; today raw twice),
`--mark-spring` (as today). `--fold-ease` points to `--ease-in-out`. The reduced-motion `0.01ms` stays (it's a switch,
not a duration).

Durations written in TS (cellReveal, the focus ink, the curtain) are not CSS: they move into `tokens.ts` under
`motion` in the same pass, so a duration exists once.

## Progress
- 2026-10-31: tokens in tokens.css, `check:tokens` in CI (baseline 1,760), **src/ui done** (0 left; 148 gallery shots
  before/after, dark and light: 55 changed as listed above, mostly 10 → 11 px labels, menu/settings rows a step taller,
  Markdown's line height 1.65 → 1.5). 1,475 left in 44 files. Next: panels (CardPanel, Agent, onboarding), then the
  world.

## How it gets done
1. tokens.css and tokens.ts: every token above, DESIGN.md §3, 4, 6, 7 rewritten from this file.
2. `scripts/check-tokens.mjs` (`npm run check:tokens`) with today's count as the starting number, so it can run in CI
   from the first day and only ever go down.
3. File by file, small to big: ui/ first (shared, screen only), then panels (CardPanel, Agent, Menu), then the world
   (PlaneCards, TextItems, Kanban, Timeline, Matrix, Table, Documents). Each file: headless shots before and after, dark
   and light, at two zooms for world files; a change in the list above is expected, anything else is a mistake.
4. When the count reaches 0, `check:tokens` fails on any new raw value.

Several sessions edit these files: each file is converted in one short commit, after checking `git status`, so the
others can pull it in without fighting it.

## To decide
- The visible changes above, mainly: 10 → 11 px labels on screen; headings' caps tracking 0.04 → 0.12em; spacing snaps
  (6 → 8, 10 → 12); the sticky's glue band 5.2 → 7.
- World geometry in `tokens.ts` written into CSS at load (one source) vs. listed twice (tokens.css and tokens.ts, kept
  equal by `check:tokens`). Recommendation: one source, from TS.
