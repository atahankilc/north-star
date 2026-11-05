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
| `--fg-faint` | `#666666` | quiet marks: separators, empty states, idle actions (≥ 3:1; not for words to read) |
| `--fg-dim` | `#8a8a8a` | secondary text, meta lines, labels (≥ 4.5:1 on the page and on a piece, D-337) |
| `--fg-muted` | `#b0b0b0` | help text, hints |
| `--fg` | `#ededed` | primary text |
| `--fg-strong` | `#ffffff` | headlines, focus |
| `--accent-magenta` | `#ff3d9a` | ideas / selection |
| `--accent-cyan` | `#2de2e6` | features / links |
| `--accent-yellow` | `#ffd23f` | competitors / warnings |
| `--accent-blue` | `#3d7bff` | AI output |
| `--accent-green` | `#3dff8a` | success / "we're better" |

**Light theme (D-069):** dark is the default; Settings → display → theme switches to light (or `system`). Light swaps the
tokens above for neutral light grey (`--bg #f3f3f3`, D-342), white surfaces, near-black text (`--fg #111`, `--fg-muted #444`,
`--fg-dim #595959`, `--fg-faint #767676`, D-337) and darker accents, each the strongest of its hue that reads no worse on
white (magenta `#e00070`, cyan `#0095ad`, yellow `#b47500`, blue `#1955ff`, green `#009a43`, D-368). Cards have their own
colours in light (`--type-*`: customer `#00936a`, problem `#e11d48`, competitor `#e8590c`, idea `#7c3aed`, feature `#0891b2`,
package `#2563eb`), which also tint a card's panel head and rows (`--panel-tint`, none in dark). The ASCII field prints as ink on the paper. Values in `src/styles/tokens.css`
(`[data-theme='light']`); what WebGL draws (bg, accents, the night sky) also in `palettes.light` in `tokens.ts`, read through
`usePalette()` (D-321). Text on an accent fill uses `--on-accent`; tints use `--wash-*`.

**Diff colours (D-096, 1.0's assistant):** the assistant's preview marks what a proposal does with the checklist's signs in their own colours,
apart from the type colours: `--diff-new` `+` (`#a6ff3d`), `--diff-edited` `~` (`#ff9f1c`), `--diff-moved` `→` (`#3d7bff`),
`--diff-deleted` `−` (`#ff4545`); darker in light. Only the sign badge, the ring and the moved
ghost carry them; a deleted item turns grey and struck through, an edit shows `was` and the old value under the new.

Collaborator cursors cycle through the accents. The matrix coverage scale runs:
`none` = dim grey glyphs, `partial` = yellow, `full` = white, `better` = green.
Values will be tuned against contrast checks (WCAG AA for text).

## 4. Typography

- **Reading and UI:** **Inter** (`--font-display`, D-337; was Geist, D-013), with its optical sizes, so small text opens up
- **System bits / ASCII:** **JetBrains Mono** (`--font-mono`, D-337; was Geist Mono)
- Big size contrast: huge display titles, small mono labels.
- *Which face (D-337, replacing D-093's split):* Inter is the page's default: titles, reading text, rows, hints, meta
  lines, fields, settings, menus' items, tasks, table cells. JetBrains Mono only where the system speaks: caps labels
  (Label, Rule, kinds, piece names, column heads), numbers and counts, buttons, the
  prompt's `>` and `›`, glyphs, cells, consoles and docks, readouts, tags, sticky notes, and the landing's name (D-340). A rule that sets mono on a
  whole container is wrong now: set it on the bit.
- *Scale (tokens.css; no raw px sizes):* `--text-xs` 12 (labels, meta, small buttons; nothing smaller), `--text-sm` 14 (body
  and controls), `--text-md` 15 (report body), `--text-lg` 18 (card and list titles), `--text-heading` 26, 20 on phones (page,
  panel and report titles), `--text-xl`, `--text-hero` (the workspaces page title), `--text-display` (the landing's name, in JetBrains Mono, D-340).
- *Case:* uppercase means a label (`NOTES`, `┌ DISPLAY`, column heads, type names); everything you click is lowercase
  (buttons, the Settings menu, choices).
- *Tracking:* `--track-label` 0.05em on every small uppercase label (D-337; 0.12em pulled small caps apart), `--track-title` -0.02em on sans titles,
  `--track-display` -0.045em on the display headline, `--track-cells` -1px where glyph cells must touch. The same in the
  world (D-325). Lowercase actions are untracked.
- *Inside the zoomed world (D-325):* the screen's `--text-xs`…`--text-lg` hold in canvas px too; `--w-text-*` adds only
  what the screen lacks: `-2xs` 8 (the smallest, D-366), `-xs` 9, `-sm` 10 (read when zoomed in), `-lg` 14 (card titles), `-xl` 22,
  `-2xl` 26 (don't shrink on phones). Screen UI never uses `--w-*`. Sizes TS also measures come from one source,
  `src/model/world.ts`, which writes them as `--w-grid`, `--w-card-*`, `--w-row-*`, `--w-sticky-h`, `--w-doc-pad`; the
  deck's and timeline's rows are exact in tokens. They never snap alone. `--text-title` 22 is the right panel's title, `--text-code` 0.88em code inside Markdown.
- *Line height and weight (D-325):* ratios only: `--lh-none` 1, `--lh-tight` 1.15, `--lh-snug` 1.3, `--lh-body` 1.5 (a
  fixed row height is a size token); `--weight-regular` 400, `--weight-medium` 500, `--weight-bold` 600.
- *Every value a token (D-325, docs/specs/tokens.md):* no number with a unit in a module CSS file (`0`, `%`, `ch`,
  `em`, `vw`/`vh` and calc() multipliers aside); spacing `--space-half` 2 to `--space-12` 48, lines `--line-w` 1 /
  `--line-w-bold` 2, `--dot`, `--arrow`, `--control*`, `--row-h`, shadows `--feather`, mixes `--mix-*`, opacity
  `--o-*`, layers `--z-*`, durations `--dur-*`. Off-scale values snap. `npm run check:tokens` keeps count.
- *Reading width:* `--measure` (760 px) for long text (a document open in its reader).
- *1.0 (D-096, D-101, D-102, D-106):* the reports tab read on solid `--bg` with an "on this page" outline (documents keep
  that); the assistant's stage was one cyan box (`StageBox`) with a `‹ n/N ›` stepper.

### Names and lines on the canvas (D-266)
- *Two voices.* The system's: JetBrains Mono, caps, tracked (piece names, type labels, column heads, panel sections, the
  small line over a heading, consoles). The user's: Inter (card titles, headings, paragraphs, section names, the
  project title).
- *Numbers.* A number, wherever there is one, is magenta, mono, before the name: a piece's name (`▦ PLANE 01 PAZAR`, a
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
  (its kind's tab, `04 ── RIVALS`, mono at the name's size on the screen, caps, tracked `--track-label`, the number magenta); its console the same rail, on
  the same hover rule, hanging 10 px under the contents' right end (D-347). A dropdown in a console or dock is plain text, like
  the link `Select` (`label value ▾`, no frame or fill).
  Going between: the window breaks (or builds) cell by cell while the contents grow from fitted to their own size (or
  shrink back), 320 ms, eased both ends; nothing else moves.
- *Ink (D-277).* Text on the canvas (headings and their small lines, paragraphs, the project title, section names) sits
  on a shade line by line, as long as each line (`src/ui/primitives/Ink.tsx`), never a box. *Lines:* straight, edge grey, holds
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
- Buttons are cells (D-344, `src/ui/primitives/Button.tsx`, lowercase, D-093): every button is the same cell, a faint
  shade (`--wash-2`) that says "you can press this", a step brighter on hover (`--wash-3`), a little smaller while pressed
  (`--press-scale`); its kind shows only in its fill and ink, never in its shape. No brackets, no key after it (keys live
  in its `title`; onboarding teaches them). `sm` is 24 px (`--control-sm`; a glyph's cell 24 × 24, `icon`), mono 12;
  `tone="main"` a row's strong one (`--wash-3`, `--fg`), `"primary"` the one that goes, a solid cyan cell (save, add,
  make, apply, done: **at most one on a surface**), `"danger"` magenta on hover (`--wash-magenta`), `"hazard"` the solid
  magenta one where deleting is the point (the hazard confirm); `pressed` (a switch on, a Choice picked) cyan on
  `--wash-cyan` with a line under it, `--button-on` another colour. `md` the page's: a white 36 px cell, its accent wiping
  in on hover. `link` (a name that goes somewhere) has no cell. The HUD's ToolButton is the same cell at 30 px
  (`--control`), cyan while what it opens is open. A caller's class only places a button (margin, flex, shown on hover),
  never repaints, repads or resizes it.
- **ButtonGroup** (D-344, `src/ui/primitives/ButtonGroup.tsx`): buttons that belong together join into one strip, a
  hairline between their cells instead of a gap: a dock's or console's actions, a panel's or a wizard's foot, a zoom's
  `− 100% +`, a Choice's options. Menu's triggers (`SHOW all ▾`, the side nav's `+`) are the same cell.
- **Controls are toggle cells** (D-344), one kit component each: Checkbox (the label is the cell, `✓` before it while
  on; no label, a square box cell; `CheckMark` inside a row), Tabs (cells joined by the seam, filling their row, one row that scrolls sideways when they don't fit; Choice
  is its segments, Steps its tabs with a lead `01`, the passed ones brighter, all one width), one dropdown trigger (`Trigger.module.css`, Menu's and Select's). A menu's ticked
  rows show `✓` on a wash. A person's square is `Avatar` (30 px in the HUD, 24 in rows).
- Inputs: underscore or caret cursor `▌`, mono text
- Tags: `#tag` in an accent colour
- **Marks** (D-265, `src/ui/primitives/Marks.tsx`, tokens `--mark-*`): hover and selection on everything selectable (cards, text,
  tasks, sheets, cells, rows, heads, chips, pieces, sections) are four L's in screen px, in three tiers (S 6 px for
  cells, rows, heads, chips; M 12 for cards, text, tasks; L 18 for pieces and sections; a tier down when small on
  screen). Grey a little out on hover (160 ms); on the corners, longer, in the item's tone while pressed (70 ms); just
  outside in the tone once selected (a 300 ms overshooting spring). Cyan is what you can do (a link's target, the box
  select). Others' selections: the same L's in their colour with their name on a tag. Reduced motion: states switch at once.
- **Screen size while zooming** (D-278, D-280, D-293): during a wheel, pinch or glide only the canvas's (or a focus's
  view's) transform changes. Piece names grow and shrink with it; everything else held at screen size (marks and their
  L's, resize handles, consoles, comment chips, text's and links' bars, a matrix cell's bar, a stuck piece's line, guides)
  is hidden until it stops, then shows at once at its screen size 120 ms later (at once on a press); not what the
  keyboard is in. The same in a focused plane, table, matrix, kanban, timeline and documents list, and while focus fits.
- **Drag and resize** (D-265, D-272, D-273): a press becomes a drag after 5 px; what's dragged (each of several) shrinks
  to 0.8 round the point held and follows the pointer, its L's at full size where it will land (`<Landing>`, 80 ms per
  grid step; on a kanban the gap that opens); let go, it grows into them (180 ms). What holds others (a section, an
  unfolded package dragged by its band) shrinks with them as one, round the same point, in the same 160 ms, and only
  its L's show where it lands (D-291). Text's L's are on its edges (the project title's 7 px out); where a heading or
  paragraph lands is rounded up to the grid, so its L's sit on the grid's dots (D-294). Resizing: cyan handles on the ring
  only while selected (a corner's L, an edge's bar), the moving edges lit cyan, no size shown (D-347).
- **Cards** (D-055, D-152, D-205): flat, one shape for every type; a left border and a small uppercase label in the type's
  colour (customer green, problem magenta, competitor yellow, idea white, feature cyan, package blue), the face a dark
  tone of it (`--card-tint` of the colour over `--bg-raised`: 16 %, light too, D-368; a matrix's card heads and a package's
  band too, D-291; a kanban's card sheets and a table's card names, D-294; inside it the greys and the type's label lean to the ink so every line reads ≥ 4.5, D-295), no edge of their own (D-148); never lift or tilt (D-061). Type colours are only for type: tags are white `#chips` (D-056). Inside: a
  squircle corners (16, 8 on a face a line tall; flat ones square) and the colour as a 3 px bar inside the left edge (D-380);
  header (type label; the status, regions, priority or rating, then evidence cells: filled supports, outlined against,
  magenta when they disagree with the status), the title (≤ 3 lines), a dim mono facts line, tag chips. Smaller on
  screen (D-111, D-153): the title alone, whole words, `…`; then each line a `--fg-dim` bar. A hovered card shows a dim
  `›` to drag a link from (cyan while linking).
- Plane grid (D-182, D-187): faint dots every 25 px (`--grid-mark`, the shape `--grid-mark-shape`, D-332); pieces, cards and text snap to it (alt free).
  A card is 200 × 100, 8 × 4 steps, a mark on each corner. (1.0's board: 0.625 units, marks thinning as they crowded,
  D-110, D-148, D-149, D-151.)
- Text (D-050, D-156, D-188, D-194): Inter straight on the canvas or a plane; typing keeps its face, size and layout
  (D-190); under it the ink shade, line by line (D-277). Headings H1–H3 (48 / 29 / 22 px on the canvas), left-aligned,
  with an optional small line (`02 ── WHO WE BEAT`: mono caps, `--fg-dim`, the number magenta); an H1's hairline rule
  fades right. Paragraphs (`¶`, S/M/L, L the default and still under an H3, D-161, D-162) wrap at their width, light
  Markdown (bold in `fgStrong`, italic, bullets, `code`, cyan links), a hairline down the left. Any text turns a quarter
  (↺ reads up, ↻ down). Headings and paragraphs never turn into each other; headings and section names show at any zoom
  (D-160). A paragraph's and the title's width drag by the cyan bars at both ends of the text (D-273, D-378); a section and a sticky note resize from every side and corner (D-376): a note's height is the least it is, its text can make it taller.
- Sticky notes (D-158, D-162, D-257, D-259): paper in its colour (92 % with black in dark, a 34 % pastel in light; yellow
  the bright one), dark ink (`--sticky-ink`), a darker 13 px glue band with `ATAHAN · 2h` and three checks, a soft shade
  under its foot, never tilted. 150 × 125 to start (6 × 5 steps), growing down as you type; a long one folds back from
  `▾` / `▸`, its text fading at the foot. Text mono (JetBrains Mono) S/M/L, light Markdown.
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
  dock's `view` drawer (D-347); alt drags freely.
- Right-click (D-117, D-237): the prompt (D-222) at the pointer. In a focused plane: a card's open / fold / copy /
  duplicate / delete; text's edit / copy / duplicate / delete; a link's label / turn round / kind / remove; several's
  copy / duplicate / delete; the plane's paste and add here; `comment` on any component (D-193). A right drag still pans.

### Words explained on hover (D-355)
- `Tip` (src/ui/patterns/Tip.tsx): a word in `--accent-cyan` with a dotted underline; on hover or keyboard focus its
  meaning in a small box under it (above near the foot), the page's black with a `--line-hover` hairline, Inter
  `--text-xs`, never pressed. Used for the app's own words in the onboarding (glossary.ts), the first use in a text.
- Keys are written the Mac way in code and shown as the computer writes them (`Ctrl+F` off a Mac, keyGlyphs.ts).

### Pieces (D-176, D-263–D-276)
- Surface (D-263, D-274): every piece (plane, matrix, table, kanban, timeline, documents, document) is graphite
  `--piece` (white in light), `--piece-edge`, a deep shadow, a 1 px light on top and a 2 px band along the top in its
  kind's colour (plane fg, matrix violet, table sky, kanban gold, documents moss, timeline orange); what it holds sits a
  step lighter (`--piece-card`); in focus and beside, the screen is the page's black (D-289), what's held still
  `--piece-card`.
- Name (D-223, D-276, D-365, D-372): in the top edge, mostly over it (see *Names and lines*; zoomed out it grows down onto the piece, a section's name out of its section), 18 px close to 24 px far on the
  screen, `--fg` caps weight 500, after the kind's tab, a solid cell in the kind's colour with its drawn icon and word
  (`▦ PLANE 01 PAZAR`; under 50 % zoom only the icon, D-370; unnamed, the tab alone); tight, the name takes a `…`, then the tab's word goes; hovered, all of it.
  Edit mode: a cyan-framed field, a cyan `>` and `17/80`.
- Console (D-264, D-275, D-347; docs/specs/console-preview/, option D+E): one `Console` everywhere. A rail: who (name,
  mode, readouts, a page) · nouns (`filter 2`, `view`, `linked 2`), each opening its drawer as the rail's upper floor,
  one at a time · tools · go last; groups by role, each a ButtonGroup. On the canvas cut into the piece's bottom edge,
  half in, half out, near the right corner (never over what the piece holds); shown only while the piece is pointed
  at (cell by cell), in edit mode, with its setup or the keyboard in it; 11 px, growing to 1.4 × as the canvas zooms
  out; new comments keep a small magenta tab. Past 70 % of its edge's width it takes the whole edge and wraps upward,
  go at the right end. No edge line: faint L's on its visible corners (only the top two when it stands on the
  screen's foot), cyan while pointed at or in edit mode. Edit mode: marks in the kind's colour, a cyan handle on every
  corner and edge, the rail cyan with `delete` and `done`, no size.
- Focus (D-185, D-189, D-297): a plane spreads over the screen like ink, cell by cell, while its own view glides to fit
  what it holds (going out it glides home while the ink draws back); its page eases from the piece's graphite to the
  black on the way in and back on the way out, everything on `--bg` inside with it. The focus dock is the same Console standing on the screen's foot in the middle (D-347), `unfocus` last. The right of the screen stays free,
  except what's beside the plane (D-211) and the right panel (D-219).

### HUD (D-027, D-175)
- Top left on every page but the landing (which has none, D-340): the breadcrumb (`# north-star / workspaces / <name>`, then the focused plane's name, D-189).
  Everything else moves to a left side nav piece by piece. Screen-edge margins come only from `--hud-x` / `--hud-y`.
- The side nav's tools at the middle of the left edge (D-178): ToolButton cells like the gear (D-344); the `+` a drawn 20 px
  magenta `+` in its cell, its menu opening right.
- Bottom-left corner, `--space-3` from the edges, top to bottom (D-175, D-193): people here (D-169: squares, no names,
  overlapping, name on hover, `+N` past four; a click follows), the threads button, a short rule, your square (initial,
  name on hover), the ⚙ (a cyan count when people wait to join). Anything else bottom left stays `--corner-h` above.
- Its size (D-348): Settings → display → `hud size` small / normal / large: the tools', squares' and `+N`'s cell 24 / 30
  / 36 px (`--hud-tool`), icons 14 / 18 / 22 (`--tool-icon`), the drawn `+` 16 / 20 / 24 (`--hud-plus`), the breadcrumb
  12 / 14 / 15 (`--hud-text`); `data-hud` on `<html>`, set before the first paint; normal by default. Panels, menus and
  pieces keep their size.
- Settings (D-064, D-097): your square opens it on the account page, the gear on the last page used. A modal with a side
  menu in groups, `YOU` (account, display) and `WORKSPACE <name>` (general, people, export; only inside a workspace),
  the current page with a cyan left bar; on the right a title, a one-line description and framed sections (label in the
  top edge, rows split by hairlines, a note at the foot). Below 640 px the menu becomes tabs. 1.0's `ASSISTANT` (keys,
  usage) comes back with the assistant. Signed out there are no controls (D-069).
- Dropdowns (`src/ui/patterns/Menu.tsx`) are a **prompt** (D-222, D-350): a trigger cell `SHOW all ▾` (D-344) (or a side
  nav icon) opening `PromptPanel` (`src/ui/patterns/`), built cell by cell. Its look is a console's (D-347): no box, the
  page's black on a hugging shade, faint L's on its four corners, cyan while the keyboard is in it. On top a `>` line
  with focus (a placeholder saying what it does: `add…`, `find a place…`); the keys never leave it. Typing narrows the
  list, the typed part lit magenta. `# SECTION ──── 4` heads as the kit's Rule (an empty one a plain rule). A row
  (`PromptRow`): a magenta `›` and a 2 px band in its tone on the picked row (the first until the keys or the pointer
  move it; Enter picks it), its glyph, the label, a faint hint (data, never a key); dangerous ones red; tick rows a small
  box, lit in their tone with `✓` while on; the value now cyan with `✓` at its end. An item's letter still puts it
  first when typed alone (`+` `p` Enter makes a plane), but isn't shown: no keys anywhere in the app (D-344).
  Nothing under the list. The right-click menu (`ContextMenu.tsx`) is the same panel at the pointer, its `>` line
  saying what it's on (`do with this customer…`); `InPlaceMenu` lays it in a panel.
- One-of pickers (`src/ui/patterns/Select.tsx`, D-093, D-350), never the browser's `<select>`: an inline `value ▾` opens
  the prompt (PromptPanel) in a `Popover`: the value now cyan with `✓`, lit first; past 7 options the `>` line,
  otherwise a first letter jumps; no build-up; opens upward only when it must, stays inside its panel, follows its
  trigger on scroll; Escape closes only the list. Placement in `src/ui/foundation/floating.ts`.
- Adding a link from a card's panel: each links section's add (at its rule's right end, D-221) opens the same kind of
  list, narrowed to the cards that fit (a problem for `solves`, a customer for `for`).

### Surfaces (D-024)
Every framed element (panels, cards, forms, chips, empty states) composes `src/ui/foundation/Frame.module.css`:
- `frame`: translucent near-black (`--surface`) + 10px backdrop blur + 1px `--line` border
- `interactive`: frame + hover border lift + accent bar wiping in along the top edge (`--accent` sets the colour)
- `dashed`: empty or placeholder states
- `label`: `┌ UPPERCASE MONO` section label, starts a group (report blocks, panel kicker)
- `fieldLabel`: the same without the glyph, names one field or list (`NOTES`, `LINKS`, Choice), and the label set into a
  Settings section's top edge (the box draws its own corner)

### Windows and docked panels (D-359)
Two families, each on its own shell; they share only foundation parts (`src/ui/foundation`): one Escape stack
(`useEscapeLayer`: what opened last closes first; a field keeps its Escape in a panel), focus in and back
(`focus.ts`), the canvas guard, `dragPointer`, and the docked marks (`Corners.module.css`: faint L's, cyan when pointed at).
- **Docked to an edge:** `EdgeColumn` (full height, a line on its inner edge, the marks, cell by cell) with `PanelHead`
  (kind in its tone, tools and one `×` joined): the right panel (`SidePanel`, 400 px to start, its left edge dragged 320–800 and kept in the browser, D-378) and the agent's column. The
  threads dock stays bottom left in its own shape with the same parts. A dragged edge is `ResizeEdge` (a cyan line on
  the edge while pointed at); a line that shares the screen between two parts is `SplitLine` (9 px to grab, 1 px drawn,
  cyan when pointed at): beside a plane, between stacked panes, the tasks side view and its days, the documents.
- **Over the page:** the one `Window` (scrim, focus kept inside, Escape, `[×] esc`): `Dialog` (a small window asking
  one thing: title, fields, answers joined at the foot, the go last), WizardShell, Settings, HazardConfirm (an
  `alertdialog`, its veil and tape drawn on the scrim), `PromptOverlay` (a `>` prompt in the middle: the finder, the
  `?` guide). No native `<dialog>`.

### Pages (D-093, 1.0's views; `Page.module.css` is still used by Settings)
Every 1.0 workspace view except the board composed `src/ui/foundation/Page.module.css`:
- `page`: content from `--hud-x`, starting below the filter row, so switching views never moves it. Frames fill the width
  (Flow, Table, Reports); the Matrix keeps its fit-content width (D-060). Every frame is as tall as its content and stops at
  the page's bottom edge, scrolling inside past that; none stretches to the full height when it has less to show.
- `toolbar`: a view without filters puts its controls exactly where the filter row sits, 30 px tall. Reports puts its
  filters and upload there (D-106).
- Column headers (D-107): every table-like view composes `head` from `src/ui/TableHead.module.css` (40 px, `--bg-raised`,
  mono `--text-xs` uppercase, `--fg-dim`) and sets only its side padding; a column may add its own mark or colour.
- `title`: Inter at `--text-heading`, for Settings pages, side panels, the competitor profile, the matrix panel and the report screen.
Settings rows (D-097) are two columns: on the left the setting's name (mono, `--fg-strong`) with what it does under it (Inter,
`--fg-muted`), on the right the control (`--label-w`, 260 px; stacked on phones). Help text is never `--fg-faint` there:
`--fg-muted` is the readable grey for explanations. On phones a side panel covers the filter row.

### Scroll bars (D-105)
One look for every scrolling area: an 8 px track with no background, a square thumb 4 px wide in `--fg-dim`, 6 px and
`--accent-cyan` on hover, the track's whole 8 px while held (D-377; Firefox only the resting colour). The look is set in one place, the `--scroll-*` tokens
in `src/styles/tokens.css` (light follows by itself); `src/styles/global.css` draws it (D-377). No per-component scroll bar
styles, `npm run check:kit` refuses them, in the kit too: `scrollbar-width` on an element makes Chrome draw the system's bar
there. A new scrolling area gets the look by itself; one that scrolls with no bar sets `data-scrollbar='none'`.

## 7. Motion

- **Loading** (D-025, D-031): only the flowing background plus a `▖ STATUS` line in the bottom-right; then the page
  rebuilds cell by cell in random order (no coloured edge).
- **Background** (D-026, D-028): flows by itself like a fluid; forms are born, drift, grow denser (heavier glyphs) and fade
  in overlapping generations. ASCII only; never reacts to the mouse.
- **Welcome** (D-072): the first 10 s after the app starts, before the flow: the sky slowly fills with stars (few, then
  faster) while a sunrise glow spreads low along the bottom edge from the lower left (pale gold at the edge, then orange, then red;
  it never climbs far), and last one star blazes far brighter than the rest (cross and diagonal rays, upper right). Then the stars
  go out one by one and the sky melts slowly into the flow, which has been running underneath. The landing has no scrim:
  the glow and then the flow reach every edge, behind the title too (D-340). No galaxy, nebula, Milky Way,
  shooting stars, constellation lines or aurora (all tried and rejected). Skipped when the app starts under reduced motion.
  In the light theme, signed out only, the landing's sky turns dark blue for the intro (white stars, a brighter sunrise, light text):
  it sweeps in with the page's other entrances as eight tones (paper → light blue → night) crossing diagonally from the bottom left
  to the top right with room between them, ragged edges of small squares, 0.8 s; from 8.4 s the tones go out the same direction. Signed-in
  pages play the intro on paper. Light theme prints its ASCII ink in sRGB space, so it reads as strongly as the dark theme's glyphs.
- **Component enter/exit** (D-034, D-035): everything builds up cell by cell on the ASCII grid, in random order, no colour
  (`<Appear>`, `src/ui/foundation/cellReveal.ts`), and breaks apart the same way on exit. No tile waves, no blur rises (user-rejected).
- Everything starts at the same moment (`revealed`), with no staggers. Durations: components 320 ms, headline and page reveal 400 ms, decode 260 ms.
- *Durations and eases are tokens (D-325):* `--dur-press` 70, `--dur-snap` 120, `--dur-quick` 160, `--dur-fast` 200,
  `--dur-decode` 260, `--dur-spring` 300, `--dur-cells` 320, `--dur-med` 400, `--dur-slow` 600 ms; `--ease-out`,
  `--ease-in-out` (folding, resizing), `--mark-spring`. Nothing else in CSS.
- **1.0's assistant** (D-094, D-095, D-114, D-121): the chat a small box sliding up with the orb perched on it (pushed off
  by a wide panel: it falls, bounces, peeks, hops back); the first message grows it into a column (650 ms); a preview or
  report glides it left (700 ms) while the stage builds in its wake; steps a live log folding into `▸ N steps · 4.7s`.
- **Motion setting** (D-030, D-063): `full | reduced | system`, default `full`; reduced = frozen background, no waves or sweeps.
  **Background** `on | off` beside it (signed-in pages only).
- **Focus** (D-185, D-297): ink spreading cell by cell on the 9 px grid, nearest first, 820 ms in, 700 ms out, the
  view gliding to its fit (420 ms) and the page's colour easing with it; matrices and tables glide to the middle instead
  (D-206). Framing and unframing turn cell by cell in 320 ms (D-276).
- Cards build cell by cell when they arrive and break apart when they go (D-203); nothing lifts, tilts or shimmers (D-061).
- Collaborator cursors are drawn 200 ms behind on a curve through what was sent, so they glide like the sender's
  (D-169, D-193; no trail: tried and removed, D-067); their name shows only while you point at the arrow, so it never
  hides what's under it (D-352)
- In a document written together (D-374), someone's caret is a 1 px line in their colour with their name on a tag
  over it (the Marks' peer tag), what they've selected shaded in it (`--mix-soft`); never yours, never someone away
- Marks and drags: see §6 (D-265).
