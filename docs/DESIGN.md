# North Star: Design Language

> Since 1.5 a workspace is one canvas of pieces (D-174). Where a rule below was written for 1.0's board, views or
> assistant (code deleted, D-248), it says so; those stand as reference for when the feature comes back.

## 1. Direction: "3D ASCII"

The interface is a dark, monochrome world rendered through **ASCII glyphs**, with depth and motion
from three.js. It is mostly black and white. **Colour is rare and meaningful**, so it pops.

References in [design/references/](design/references/):
- `ascii-hero-enosta.webp`: black canvas, flowing 3D forms rendered as fine character dithering,
  a large clean grotesk headline, small nav text. **Takeaways:** restraint, big type contrast, and
  ASCII used as *texture and atmosphere*.
- `ascii-portrait-color-accents.jpeg`: a 3D form rendered entirely in glyphs, mostly white/grey
  with streaks of **magenta, cyan, yellow, blue**. **Takeaways:** colour lives *inside* the ASCII
  as accents, not as flat fills.

## 2. Principles

1. **Black first.** True black background, with white/grey content.
2. **Colour = meaning.** An accent appears only for state, category, selection, collaborators,
   or AI output.
3. **ASCII is the material.** Backgrounds, transitions, edges, loaders and empty states are made of
   glyphs. Readable content stays crisp.
4. **Depth with purpose.** 3D gives spatial memory (where ideas live) and smooth travel between views.
   It is not decoration for its own sake.
5. **Everything moves softly.** Spring-based motion, no hard cuts.

## 3. Colour tokens (initial)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#000000` | canvas / page |
| `--bg-raised` | `#0b0b0b` | panels, cards |
| `--line` | `#2a2a2a` | borders, grid glyphs |
| `--fg-dim` | `#6b6b6b` | secondary text, ambient ASCII |
| `--fg` | `#e8e8e8` | primary text |
| `--fg-strong` | `#ffffff` | headlines, focus |
| `--accent-magenta` | `#ff3d9a` | ideas / selection |
| `--accent-cyan` | `#2de2e6` | features / links |
| `--accent-yellow` | `#ffd23f` | competitors / warnings |
| `--accent-blue` | `#3d7bff` | AI output |
| `--accent-green` | `#3dff8a` | success / "we're better" |

**Light theme (D-069):** dark is the default; Settings → display → theme switches to light (or `system`). Light swaps the
tokens above for neutral light grey (`--bg #f5f5f5`), white surfaces, near-black text and darker accents (magenta `#db1a7a`, cyan `#0a979c`,
yellow `#a87d00`, blue `#2a5fe0`, green `#0f9a4b`); the ASCII field prints as ink on the paper. Values in `src/styles/tokens.css`
(`[data-theme='light']`) and `palettes.light` in `tokens.ts`. Text on an accent fill uses `--on-accent`; tints use `--wash-*`.

**Diff colours (D-096, 1.0's assistant):** the assistant's preview marks what a proposal does with the checklist's signs in their own colours,
apart from the type colours: `--diff-new` `+` (`#a6ff3d`), `--diff-edited` `~` (`#ff9f1c`), `--diff-moved` `→` (`#3d7bff`),
`--diff-deleted` `−` (`#ff4545`); darker in light (`palettes.*.diff` for WebGL). Only the sign badge, the ring and the moved
ghost carry them; a deleted item turns grey and struck through, an edit shows `was` and the old value under the new.

Collaborator cursors cycle through the accents. The matrix coverage scale runs:
`none` = dim grey glyphs, `partial` = yellow, `full` = white, `better` = green.
Values will be tuned against contrast checks (WCAG AA for text).

## 4. Typography

- **Display / UI:** **Geist** (D-013)
- **Data / labels / ASCII:** **Geist Mono**
- Big size contrast: huge display titles, small mono labels.
- *Which face (D-093):* Geist for titles and long reading text (report answers and points); Geist Mono for everything else:
  data, labels, controls, inputs, meta lines.
- *Scale (tokens.css; no raw px sizes):* `--text-xs` 11 (labels, meta, small buttons; nothing smaller), `--text-sm` 13 (body
  and controls), `--text-md` 15 (report body), `--text-lg` 18 (card and list titles), `--text-heading` 26, 20 on phones (page,
  panel and report titles), `--text-xl`, `--text-hero` (the workspaces page title), `--text-display` (landing headline).
- *Case:* uppercase means a label (`NOTES`, `┌ DISPLAY`, column heads, type names); everything you click is lowercase
  (buttons, the Settings menu, choices).
- *Tracking:* `--track-label` 0.12em on every small uppercase label, `--track-title` -0.02em on Geist titles,
  `--track-display` -0.045em on the display headline. Lowercase actions are untracked.
- *Reading width:* `--measure` (760 px) for long text (a document open in its reader).
- *1.0 (D-096, D-101, D-102, D-106):* the reports tab read on solid `--bg` with an "on this page" outline (documents keep
  that); the assistant's stage was one cyan box (`StageBox`) with a `‹ n/N ›` stepper.

### Names and lines on the canvas (D-266)
- *Two voices.* The system's: Geist Mono, caps, tracked (piece names, type labels, column heads, panel sections, the
  small line over a heading, consoles). The user's: Geist (card titles, headings, paragraphs, section names, the
  project title).
- *Numbers.* A number, wherever there is one, is magenta, mono, before the name: a piece's name (`01 PAZAR · PLANE`, a
  leading number in the name is taken apart), kanban columns (`01 TODO`), sections, a heading's small line, the right
  panel's sections (`01 STATUS`), the suggested order.
- *Two edges.* Containers have one (pieces, sections), their name cut into it the same way: a 16 px lead of edge, 8 px
  clear each side of the name (a piece's in screen px, a section's in its space's). What's held has none (cards, tasks,
  rows, cells): it's a surface whose colour comes from a band.
- *Two bands.* Held things carry theirs on the left (a card's, a task's, a row's type colour); containers on top (a
  piece's kind, D-263).
- *Framed and unframed (D-267).* Framed is a window (the surface, its band, shadow, the name in its edge, the console).
  Unframed is ink on the canvas: no edge, band or shadow, on the page's black (D-289; `--bg`, feathered `0 0 14px 8px`,
  what it holds on `--piece-card`) and exactly as big as its contents; under each row (a matrix's heads and cells, a table's
  rows, a kanban's heads and tasks, a list's rows and sheets) a shade that hugs it (page colour at 80 %, feathered
  `0 0 16px 10px` at 72 %), as under text; its name a heading's small line 8 px over its contents
  (`04 ── RIVALS · TABLE`, mono 11 px on the screen, caps, tracked .14em, the number magenta); its console the same, on
  the same hover rule, hanging 10 px under the contents' right end. A dropdown in a console or dock is plain text, like
  the link `Select` (`label value ▾`, no frame or fill).
  Going between: the window breaks (or builds) cell by cell while the contents grow from fitted to their own size (or
  shrink back), 320 ms, eased both ends; nothing else moves.
- *Ink (D-277).* Text on the canvas (headings and their small lines, paragraphs, the project title, section names) sits
  on a shade line by line, as long as each line (`src/ui/Ink.tsx`), never a box. *Lines:* straight, edge grey, holds
  (pieces, sections); fading to the right opens a region (H1, the project title); dashed separates a list's rows
  (tables, lists); a short magenta lead starts something numbered (the title's and an H1's rule, panel sections).

## 5. ASCII rendering

- A post-processing **ASCII shader**: sample luminance per cell, map it to a glyph ramp
  (` .:-=+*#%@` or a custom ramp), and tint selected regions with accents.
- Used for: ambient background forms (slowly flowing noise fields), view transitions
  (scene dissolves into glyphs and re-forms), loaders, empty states, and hover halos on cards.
- **Never** applied over editable or readable text.
- Reduced motion (Settings, or the OS when motion is `system`): static ASCII, no flowing fields, crossfades only.
- Performance (D-063): the field renders at one texel per cell, the backdrop at 30 fps on demand, the board only when
  something changes. Signed-in users can switch the background off in Settings; the landing always keeps it.

## 6. Components (ASCII-styled DOM)

- Boxes drawn with box characters (`┌─┐│└┘`) or 1px lines that echo them
- Buttons, two sizes, both lowercase (`src/ui/AsciiButton.module.css`, D-093): `<AsciiButton>` `[ create ]` (spaced coloured
  brackets, accent fill on hover) for the main action of a form or panel; `small` `[share]` (dim, faint brackets;
  `data-tone="primary"` cyan, `"danger"` magenta on hover) for row and inline actions. Compose `small`; never redraw brackets.
- Inputs: underscore or caret cursor `▌`, mono text
- Tags: `#tag` in an accent colour
- **Marks** (D-265, `src/ui/Marks.tsx`, tokens `--mark-*`): hover and selection on everything selectable (cards, text,
  tasks, sheets, cells, rows, heads, chips, pieces, sections) are four L's in screen px, in three tiers (S 6 px for
  cells, rows, heads, chips; M 12 for cards, text, tasks; L 18 for pieces and sections; a tier down when small on
  screen). Grey a little out on hover (160 ms); on the corners, longer, in the item's tone while pressed (70 ms); just
  outside in the tone once selected (a 300 ms overshooting spring). Cyan is what you can do (a link's target, the box
  select). Others' selections: the same L's in their colour with their name on a tag. Reduced motion: states switch at once.
- **Screen size while zooming** (D-278, D-280): during a wheel, pinch or glide only the canvas's (or a focus's view's)
  transform changes; marks, piece names, consoles, chips and text's bars grow and shrink with it and settle to their
  screen size 120 ms after it stops (at once on a press). The same in a focused plane, table, matrix, kanban, timeline
  and documents list.
- **Drag and resize** (D-265, D-272, D-273): a press becomes a drag after 5 px; what's dragged (each of several) shrinks
  to 0.8 round the point held and follows the pointer, its L's at full size where it will land (`<Landing>`, 80 ms per
  grid step; on a kanban the gap that opens); let go, it grows into them (180 ms). What holds others (a section, an
  unfolded package dragged by its band) shrinks with them as one, round the same point, in the same 160 ms, and only
  its L's show where it lands (D-291). Text's L's are on its edges (the project title's 7 px out); where a heading or
  paragraph lands is rounded up to the grid, so its L's sit on the `+` marks (D-294). Resizing: cyan handles on the ring
  only while selected (a corner's L, an edge's bar), the moving edges lit cyan, the size beside them.
- **Cards** (D-055, D-152, D-205): flat, one shape for every type; a left border and a small uppercase label in the type's
  colour (customer green, problem magenta, competitor yellow, idea white, feature cyan, package blue), the face a dark
  tone of it (`--card-tint` of the colour over `--bg-raised`: 16 %, light 9 %; a matrix's card heads and a package's
  band too, D-291; a kanban's card sheets and a table's card names, D-294), no edge of their own (D-148); never lift or tilt (D-061). Type colours are only for type: tags are white `#chips` (D-056). Inside: a
  header (type label; the status, regions, priority or rating, then evidence cells: filled supports, outlined against,
  magenta when they disagree with the status), the title (≤ 3 lines), a dim mono facts line, tag chips. Smaller on
  screen (D-111, D-153): the title alone, whole words, `…`; then each line a `--fg-dim` bar. A hovered card shows a dim
  `›` to drag a link from (cyan while linking).
- Plane grid (D-182, D-187): faint `+` marks every 25 px (`--grid-mark`); pieces, cards and text snap to it (alt free).
  A card is 200 × 100, 8 × 4 steps, a mark on each corner. (1.0's board: 0.625 units, marks thinning as they crowded,
  D-110, D-148, D-149, D-151.)
- Text (D-050, D-156, D-188, D-194): Geist straight on the canvas or a plane; typing keeps its face, size and layout
  (D-190); under it the ink shade, line by line (D-277). Headings H1–H3 (48 / 29 / 22 px on the canvas), left-aligned,
  with an optional small line (`02 ── WHO WE BEAT`: mono caps, `--fg-dim`, the number magenta); an H1's hairline rule
  fades right. Paragraphs (`¶`, S/M/L, L the default and still under an H3, D-161, D-162) wrap at their width, light
  Markdown (bold in `fgStrong`, italic, bullets, `code`, cyan links), a hairline down the left. Any text turns a quarter
  (↺ reads up, ↻ down). Headings and paragraphs never turn into each other; headings and section names show at any zoom
  (D-160). A paragraph's or sticky note's width drags by the cyan bar on its right edge (D-273).
- Sticky notes (D-158, D-162, D-257, D-259): paper in its colour (92 % with black in dark, a 34 % pastel in light; yellow
  the bright one), dark ink (`--sticky-ink`), a darker 13 px glue band with `ATAHAN · 2h` and three checks, a soft shade
  under its foot, never tilted. 150 × 125 to start (6 × 5 steps), growing down as you type; a long one folds back from
  `▾` / `▸`, its text fading at the foot. Text Geist Mono S/M/L, light Markdown.
- Sections (D-130, D-157): a thin frame, no fill; the name in the edge, the line breaking round it, along the top or up
  the left edge (read bottom to top), a number before it in magenta; a colour goes to the line and name only.
- Comment threads (D-159, D-166, D-167, D-193): a chip under the component's bottom-right corner, at screen size: the
  comment icon (a square speech bubble, three square dots) and a count; magenta when someone else wrote since you read
  it, `@` when it mentions you. Nothing opens on the canvas (D-199): the threads panel is one wide tab on the bottom edge
  right of the corner's buttons (D-197), the list left and the conversation right, each half building and breaking cell
  by cell. A conversation: a header with what it's on and `[on the canvas ↗]` (D-220), a terminal log (writer in
  `--fg-strong`, you in cyan, `2d`, the text indented, `@Name` cyan, `[edit]` `[delete]` on your own), a `>` prompt; no
  person colours. The panel says what it shows: `whole workspace`, or `inside "<plane>"` in cyan (D-195).
- Connections (D-059, D-147, D-154): straight, edge to edge, an arrowhead, the kind on a small framed chip at the middle
  (solid `--bg`, a thin border in the link's colour, mono at a card's small size). One colour per kind, all solid, from
  `--link-*`: violet solves, sky part of, orange competes, raspberry contradicts, gold inspired by, moss depends on, grey
  relates, near-white `for` (near-black in light). Links not touching the hovered or selected card go faint (a
  competitor's include its features', D-115). Several between two cards sit side by side, chips staggered (D-113). No
  animation. Always straight: 1.0's bend points (D-155) were dropped (D-292).
- Floating bars (D-108, D-188): a selected link or text gets a small solid bar under it (2 px top edge in its colour)
  with its tools.
- Alignment guides (D-117, D-231): while dragging on a plane, a card pulls into line with others' edges and centres
  within 6 px, 1 px magenta lines across what it lines up with. `a` guides, `g` snapping, per browser, in the focus
  dock's `[view ▾]`; alt drags freely.
- Right-click (D-117, D-237): the prompt (D-222) at the pointer. In a focused plane: a card's open / fold / copy /
  duplicate / delete; text's edit / copy / duplicate / delete; a link's label / turn round / kind / remove; several's
  copy / duplicate / delete; the plane's paste and add here; `comment` on any component (D-193). A right drag still pans.

### Pieces (D-176, D-263–D-276)
- Surface (D-263, D-274): every piece (plane, matrix, table, kanban, timeline, documents, document) is graphite
  `--piece` (white in light), `--piece-edge`, a deep shadow, a 1 px light on top and a 2 px band along the top in its
  kind's colour (plane fg, matrix violet, table sky, kanban gold, documents moss, timeline orange); what it holds sits a
  step lighter (`--piece-card`); in focus and beside, the screen is the page's black (D-289), what's held still
  `--piece-card`.
- Name (D-223, D-276): in the top edge (see *Names and lines*), 13 px × zoom on screen (11–15), `--fg` caps weight 500,
  the kind faint after it (`PAZAR · PLANE`; unnamed, the kind alone in `--fg-faint`); tight, the kind goes first, then
  the name takes a `…`; hovered, all of it. Edit mode: a cyan-framed field, a cyan `>` and `17/80`.
- Console (D-181, D-264, D-275): a tab standing on the bottom edge inside the bottom-right corner, shown only while the
  piece is pointed at (cell by cell), in edit mode, with its setup or the keyboard in it; 11 px, growing to 1.4 × as the
  canvas zooms out; new comments keep a small magenta tab. Edit mode: marks in the kind's colour, a cyan handle on every
  corner and edge, the console a cyan status line with the live size and `[done]`.
- Focus (D-185, D-189): a plane spreads over the screen like ink, cell by cell, its `+` marks never moving; nothing
  zooms. The focus dock is a tab on the bottom edge's middle, `[unfocus] esc` last. The right of the screen stays free,
  except what's beside the plane (D-211) and the right panel (D-219).

### HUD (D-027, D-175)
- Top left on every page: the breadcrumb (`# north-star / workspaces / <name>`, then the focused plane's name, D-189).
  Everything else moves to a left side nav piece by piece. Screen-edge margins come only from `--hud-x` / `--hud-y`.
- The side nav's tools at the middle of the left edge (D-178): unframed icon buttons like the gear; the `+` a drawn 20 px
  magenta `+`, its menu opening right.
- Bottom-left corner, `--space-3` from the edges, top to bottom (D-175, D-193): people here (D-169: squares, no names,
  overlapping, name on hover, `+N` past four; a click follows), the threads button, a short rule, your square (initial,
  name on hover), the ⚙ (a cyan count when people wait to join). Anything else bottom left stays `--corner-h` above.
- Settings (D-064, D-097): your square opens it on the account page, the gear on the last page used. A modal with a side
  menu in groups, `YOU` (account, display) and `WORKSPACE <name>` (general, people, export; only inside a workspace),
  the current page with a cyan left bar; on the right a title, a one-line description and framed sections (label in the
  top edge, rows split by hairlines, a note at the foot). Below 640 px the menu becomes tabs. 1.0's `ASSISTANT` (keys,
  usage) comes back with the assistant. Signed out there are no controls (D-069).
- Dropdowns (`src/ui/Menu.tsx`) are a **prompt** (D-222): a framed trigger `SHOW all ▾` (or a side nav icon), a list on
  page black with a `--line-hover` edge, built cell by cell. On top a `>` line with focus (a placeholder saying what it
  does: `add…`, `find a place…`): typing narrows the list, the typed part lit magenta, Enter picks the first. `# text`
  section lines. A row: a magenta `›` where Enter goes, the item's letter `[p]` (typed alone it goes first: `+` `p` Enter
  makes a plane), its glyph, the label, a faint hint; dangerous ones red; `[x]`/`[ ]` checks. A foot counts what's shown
  (`8 things · type to find · a letter goes first`). The right-click menu (`ContextMenu.tsx`) is the same panel at the
  pointer, its `>` line saying what it's on (`do with this customer…`).
- One-of pickers (`src/ui/Select.tsx`, D-093), never the browser's `<select>`: an inline `value ▾` opens a compact list in
  the prompt's look, a cyan `•` on the current value, the magenta `›` + wash under the pointer or keys; past 7 options the
  `>` line, otherwise a first letter jumps; no build-up; opens upward only when it must, stays inside its panel, follows
  its trigger on scroll; Escape closes only the list. Placement in `src/ui/floating.ts`.
- Adding a link from a card's panel: each links section's add (at its rule's right end, D-221) opens the same kind of
  list, narrowed to the cards that fit (a problem for `solves`, a customer for `for`).

### Surfaces (D-024)
Every framed element (panels, cards, forms, chips, empty states) composes `src/ui/Frame.module.css`:
- `frame`: translucent near-black (`--surface`) + 10px backdrop blur + 1px `--line` border
- `interactive`: frame + hover border lift + accent bar wiping in along the top edge (`--accent` sets the colour)
- `dashed`: empty or placeholder states
- `label`: `┌ UPPERCASE MONO` section label, starts a group (report blocks, panel kicker)
- `fieldLabel`: the same without the glyph, names one field or list (`NOTES`, `LINKS`, Choice), and the label set into a
  Settings section's top edge (the box draws its own corner)

### Pages (D-093, 1.0's views; `Page.module.css` is still used by Settings)
Every 1.0 workspace view except the board composed `src/ui/Page.module.css`:
- `page`: content from `--hud-x`, starting below the filter row, so switching views never moves it. Frames fill the width
  (Flow, Table, Reports); the Matrix keeps its fit-content width (D-060). Every frame is as tall as its content and stops at
  the page's bottom edge, scrolling inside past that; none stretches to the full height when it has less to show.
- `toolbar`: a view without filters puts its controls exactly where the filter row sits, 30 px tall. Reports puts its
  filters and upload there (D-106).
- Column headers (D-107): every table-like view composes `head` from `src/ui/TableHead.module.css` (40 px, `--bg-raised`,
  mono `--text-xs` uppercase, `--fg-dim`) and sets only its side padding; a column may add its own mark or colour.
- `title`: Geist at `--text-heading`, for Settings pages, side panels, the competitor profile, the matrix panel and the report screen.
Settings rows (D-097) are two columns: on the left the setting's name (mono, `--fg-strong`) with what it does under it (Geist,
`--fg-muted`), on the right the control (`--label-w`, 260 px; stacked on phones). Help text is never `--fg-faint` there:
`--fg-muted` is the readable grey for explanations. On phones a side panel covers the filter row.

### Scroll bars (D-105)
One rule for every scrolling area, in `src/styles/global.css`: an 8 px track with no background, a square thumb 4 px wide in
`--line-hover`, 6 px and `--fg-faint` on hover, `--accent-cyan` while held (the focus colour). Colours are tokens, so light
works too. No per-component scroll bar styles; a new scrolling area gets the look by itself.

## 7. Motion

- **Loading** (D-025, D-031): only the flowing background plus a `▖ STATUS` line in the bottom-right; then the page
  rebuilds cell by cell in random order (no coloured edge).
- **Background** (D-026, D-028): flows by itself like a fluid; forms are born, drift, grow denser (heavier glyphs) and fade
  in overlapping generations. ASCII only; never reacts to the mouse.
- **Welcome** (D-072): the first 10 s after the app starts, before the flow: the sky slowly fills with stars (few, then
  faster) while a sunrise glow spreads low along the bottom edge from the lower left (pale gold at the edge, then orange, then red;
  it never climbs far), and last one star blazes far brighter than the rest (cross and diagonal rays, upper right). Then the stars
  go out one by one and the sky melts slowly into the flow, which has been running underneath. The landing's headline scrim stays
  out during the intro so the glow can reach the bottom edge, and fades in as the flow takes over. No galaxy, nebula, Milky Way,
  shooting stars, constellation lines or aurora (all tried and rejected). Skipped when the app starts under reduced motion.
  In the light theme, signed out only, the landing's sky turns dark blue for the intro (white stars, a brighter sunrise, light text):
  it sweeps in with the page's other entrances as eight tones (paper → light blue → night) crossing diagonally from the bottom left
  to the top right with room between them, ragged edges of small squares, 0.8 s; from 8.4 s the tones go out the same direction. Signed-in
  pages play the intro on paper. Light theme prints its ASCII ink in sRGB space, so it reads as strongly as the dark theme's glyphs.
- **Component enter/exit** (D-034, D-035): everything builds up cell by cell on the ASCII grid, in random order, no colour
  (`<Appear>`, `src/ui/cellReveal.ts`), and breaks apart the same way on exit. No tile waves, no blur rises (user-rejected).
- Everything starts at the same moment (`revealed`), with no staggers. Durations: components 320 ms, headline and page reveal 400 ms, decode 260 ms.
- **1.0's assistant** (D-094, D-095, D-114, D-121): the chat a small box sliding up with the orb perched on it (pushed off
  by a wide panel: it falls, bounces, peeks, hops back); the first message grows it into a column (650 ms); a preview or
  report glides it left (700 ms) while the stage builds in its wake; steps a live log folding into `▸ N steps · 4.7s`.
- **Motion setting** (D-030, D-063): `full | reduced | system`, default `full`; reduced = frozen background, no waves or sweeps.
  **Background** `on | off` beside it (signed-in pages only).
- **Focus** (D-185): ink spreading cell by cell on the 9 px grid, nearest first, 820 ms in, 700 ms out; matrices and
  tables glide to the middle instead (D-206). Framing and unframing turn cell by cell in 320 ms (D-276).
- Cards build cell by cell when they arrive and break apart when they go (D-203); nothing lifts, tilts or shimmers (D-061).
- Collaborator cursors are drawn 200 ms behind on a curve through what was sent, so they glide like the sender's
  (D-169, D-193; no trail: tried and removed, D-067)
- Marks and drags: see §6 (D-265).
