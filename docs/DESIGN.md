# North Star: Design Language

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

**Diff colours (D-096):** the assistant's preview marks what a proposal does with the checklist's signs in their own colours,
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
  (buttons, view tabs, the Settings menu, choices).
- *Tracking:* `--track-label` 0.12em on every small uppercase label, `--track-title` -0.02em on Geist titles,
  `--track-display` -0.045em on the display headline. Lowercase actions are untracked.
- *Reading width:* `--measure` (760 px) for a report's text (the tab's reader, the stage's report).
- *Reports tab (D-102, D-106):* a table on solid `--bg` (never the see-through surface: nothing animates behind reading
  text) with its filters and upload in its top row, numbered pages; an opened report builds up beside it while the table
  rebuilds as a list on the left; the reader has an "on this page" outline that follows the scroll.
- *The assistant's stage (D-096, D-101):* one cyan box (`src/ui/StageBox.tsx`) with its title and controls written into the top
  edge; the preview and the chat's report both use it, each with a `‹ n/N ›` stepper (n / p) lit both ways with the chat's box.

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
- Cards: flat, one shape for every type (D-055). A left border and a small uppercase label in the type's colour say what it is
  (customer green, problem magenta, competitor yellow, idea white, feature cyan); no edge of their own (D-148). Hover and selection are four L-shaped corner marks (D-150): grey,
  0.12 outside on hover; type colour, on the corners just inside the card while pressed; 0.06 outside once selected. A press becomes
  a drag after 5 px; the dragged card shrinks to 0.8 round the point held, and its marks show the full-size corners of
  where it lands. Type colours are reserved for type: tags are white `#chips` (D-056). Cards never lift or tilt (D-061).
  Inside (D-152): 0.06 padding; a header row (type label left; right, the status, regions, priority or rating, then
  the evidence as cells: filled supports, outlined against, magenta when they disagree with the status), the title (up
  to 3 lines), a dim mono facts line, and tags as framed chips. A hovered card shows a dim `›` just right of it to drag
  a link from (cyan while linking); not while dragged, not far out.
  Zoomed out (D-111, D-153): once the small text can't be read, the title alone in Geist 0.3, top-aligned, at most 3
  lines ending at a whole word with `…`; once no text can be read, the card keeps its shape and each title line becomes
  a `--fg-dim` bar as long as the line.
- Board grid (D-110, D-148): faint `+` marks every 0.625 units (cards are 4 × 2 steps). A dragged card's top-left corner
  snaps to a mark or to one of the four even steps between two marks (0.125, not drawn, D-149); on a mark, all four
  corners sit on marks. Drawn where the camera sees them on the
  cards' plane (no perspective shift). Zoomed in, a mark's arms reach 0.06 out; zoomed out they stop at 3 px and the stroke
  eases to 1 px, so a mark is always a thin `+`, never a dot (D-151). Under 18 px apart every other mark fades, then all but
  every fourth (a card's width); all fade out before the zoom limit.
- Text labels: display-face text straight on the board (D-050); editing swaps in a DOM field at the same spot. A heading
  (H1–H3, D-156) is set on its centre, left-aligned, with an optional small line over its left edge (`02 ── WHO WE BEAT`:
  Geist Mono capitals, `--fg-dim`, a leading number in magenta or the label's colour); an H1 also gets a hairline rule
  under it fading out to the right. A paragraph (`¶`) is Geist at 0.2 (L; D-162) wrapping at its width (6.25 until its right-edge
  grip is dragged), light Markdown (bold in `fgStrong`, italic, bullets and numbers with dim markers, `code`, links
  underlined cyan), a hairline down its left side. Any text turns a quarter either way (↺ reads up, ↻ down). Hovered or
  selected, a card's corner marks go round it (D-163), in its colour once selected; a paragraph's or sticky note's width
  drags by a thin strip down its right side. A paragraph's text is S 0.13 / M 0.165 / L 0.2, the default, clearly under an H3 (D-161, D-162);
  headings and paragraphs never switch into each other. Headings and section names are drawn at any zoom (D-160)
- Sticky notes (D-158, D-162): quieter than a card: paper in `cardBehind`, a 0.025 bar of its colour along the top
  (yellow by default), a small top line `ATAHAN · 2h` in dim mono 0.065 with three little checks in the colour on the
  right, then its text in Geist Mono S 0.085 / M 0.105 (default) / L 0.13 with light Markdown (bold in `fgStrong`).
  A card's width (2.5) until its right-edge grip drags it, padding 0.09, exactly as tall as its text; it grows as you
  type, its top-left kept. Corner marks when hovered/selected (D-163)
- Sections (D-130, D-157): a thin frame, no fill. The name sits in the frame's edge, the line breaking round it: along
  the top from near the left corner, or up the left edge ending near the top (read bottom to top). A small line before
  the name in mono (a number in magenta). A section's colour goes to its line and name, nothing else; hover and selection
  are a card's corner marks (D-150, D-160), the line keeps its colour
- Connections (D-059, D-108): straight, edge to edge, with an arrowhead and the kind on a small framed chip (solid `--bg`,
  thin border in the link's colour; mono text the size of a card's small text, D-154) at the midpoint; a bent link
  (D-155) runs through its bend points, its chip on the longest piece. One colour per kind, all solid lines (D-147), from `--link-*` tokens soft enough
  to stay apart from type, people and diff colours: violet solves, sky part of, orange competes, raspberry contradicts, gold inspired by, moss depends on, grey relates, near-white `for` (near-black in light theme). Thicker on the selected card; links not touching the hovered or selected
  card go faint (a competitor's include the links to its features, D-115). A selected link fills its chip and shows a hollow square on each piece: drag a piece to put
  a bend point there (a filled square: drag to move, double-click to take out; on the grid's fifths, alt free);
  `straighten` takes them all out. No animation. Several straight links between the same two cards sit side by side,
  0.32 apart (closer if the end is too small), their chips moved along the lines so they don't overlap (D-113)
- Floating bars (D-108, `FloatBar.module.css`): a selected link or text label gets a small solid bar under it (2px top edge
  in its colour) with its tools; the only tool UI drawn on the board itself
- Alignment guides (D-117): while dragging, a card pulls into line with other cards' edges and centres (text by its centre)
  within 6 px, and 1 px magenta lines run across everything it lines up with (a card in the same column: the centre line
  only). Gone when the drag ends. Switch beside the grid's, `a`, cyan while on, on by default; alt drags freely
- Right-click menu (D-117): the dropdown's panel and rows (`Menu.module.css`) at the pointer, flipped to stay on screen, built
  cell by cell like any panel. A right drag still pans; the menu opens only if the pointer stayed put. Card / text: copy,
  duplicate, zoom to, delete (for the whole selection if it's in it); link: its kinds (`●` the current one), reverse,
  remove; empty board: `add here` each type and text, paste here, fit all, the grid and guide switches. While it's open on a
  link or text, their floating bar waits

### HUD (D-027, D-053, D-054)
- Fixed top bar, same on every page: breadcrumb left (`# north-star / workspaces / <name>`), actions right.
- Screen-edge margins come only from `--hud-x` / `--hud-y` (toolbar, panels and status line too).

- In a workspace, the views sit beside the breadcrumb as unframed tabs after a vertical rule (current view bright with a sliding magenta underline; D-066), and the right side holds one
  account chip (avatar initial + name; just the initial below 640 px) and, beside it, a framed ⚙ icon button (cyan count in the
  corner when people wait to join). The chip opens settings on the account page, the gear on the last page used. It opens the settings
  modal (D-064, D-097): a side menu on the left in three groups, `YOU` (account, display), `WORKSPACE <name>` (general, people,
  export; only inside a workspace) and `ASSISTANT` (keys, usage); the current page gets a cyan left bar. The page on the right
  has a title, a one-line description, and framed sections (label set into the top edge, rows split by hairlines, an optional
  note at the foot). Below 640 px the menu becomes a row of tabs above the page.
  Signed out, the right side is empty (no motion switch on the landing, D-069).
- Dropdowns (`src/ui/Menu.tsx`): a framed trigger `SHOW all ▾`, a framed list below (or above, for the bottom toolbar), `[x]`/`[ ]` checks.
  The create button is the one solid-magenta control on the board.
- One-of pickers (`src/ui/Select.tsx`, D-093): never the browser's `<select>`. An inline `value ▾` trigger opens a compact list
  right under it, the same as the tag picker's suggestions (frame, tight rows, a wash on the row under the pointer, the current
  value bright), with no build-up animation; it opens upward only when it doesn't fit below, stays inside its side panel,
  follows its trigger when something scrolls, and Escape closes only the list. Used for link kinds, Table priority/status,
  the Matrix's "their version" and Settings models.
- Adding a link (`+ link`, LinkList): a dropdown hanging from the links heading, as wide as the section, never spread into the
  panel: a search box on top, matches below in the same compact rows (type dim, title); arrows move, Enter links and closes,
  Escape or a click outside closes. Placement shared with Select (`src/ui/floating.ts`).

### Surfaces (D-024)
Every framed element (panels, cards, forms, chips, empty states) composes `src/ui/Frame.module.css`:
- `frame`: translucent near-black (`--surface`) + 10px backdrop blur + 1px `--line` border
- `interactive`: frame + hover border lift + accent bar wiping in along the top edge (`--accent` sets the colour)
- `dashed`: empty or placeholder states
- `label`: `┌ UPPERCASE MONO` section label, starts a group (report blocks, panel kicker)
- `fieldLabel`: the same without the glyph, names one field or list (`NOTES`, `LINKS`, Choice), and the label set into a
  Settings section's top edge (the box draws its own corner)

### Pages (D-093)
Every workspace view except the board composes `src/ui/Page.module.css`:
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
  (`<Appear>` for DOM, `CardReveal` for 3D cards), and breaks apart the same way on exit. No tile waves, no blur rises (user-rejected).
- Everything starts at the same moment (`revealed`), with no staggers. Durations: components 320 ms, headline and page reveal 400 ms, decode 260 ms.
- **Assistant** (D-094, D-095): an empty chat is a small box that slides up from below and lifts the orb onto its top edge
  (startled); a side panel wider than the box pushes the orb off its end (D-121): it falls, bounces on the floor (squashed,
  dust, dizzy stars, then cross), peeks around the box's left side, and hops back up once there's room. The first message grows it into a tall column (by its edges, 650 ms) while the orb sinks behind the edge to peek. When a preview or a report opens, the chat glides across
  to the left (700 ms, eased in and out) while the app breaks apart and the stage builds up in its wake from the right; closing
  runs it back. Instant under reduced motion. Steps (D-114): a live log, each with its time on the right, and a last line
  `thinking` / `writing the answer`; once answered it folds into `▸ N steps · 4.7s`, which opens by its height. On phones the
  chat covers the screen; beside a stage a `chat · preview` switch shrinks it to its header along the bottom (450 ms).
- **Motion setting** (D-030, D-063): `full | reduced | system`, default `full`; reduced = frozen background, no waves or sweeps.
  **Background** `on | off` beside it (signed-in pages only).

- Camera flies between views (Canvas → Features → Competitor map) with eased paths
- Cards spring in on create and dissolve into glyphs on delete
- Collaborator cursors are interpolated (no trail: tried and removed, D-067)
- Hover: subtle parallax and glyph shimmer
- Durations of roughly 200–600 ms, spring-based where possible
