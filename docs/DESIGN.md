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

Collaborator cursors cycle through the accents. The matrix coverage scale runs:
`none` = dim grey glyphs, `partial` = yellow, `full` = white, `better` = green.
Values will be tuned against contrast checks (WCAG AA for text).

## 4. Typography

- **Display / UI:** **Geist** (D-013)
- **Data / labels / ASCII:** **Geist Mono**
- Big size contrast: huge display titles, small mono labels.

## 5. ASCII rendering

- A post-processing **ASCII shader**: sample luminance per cell, map it to a glyph ramp
  (` .:-=+*#%@` or a custom ramp), and tint selected regions with accents.
- Used for: ambient background forms (slowly flowing noise fields), view transitions
  (scene dissolves into glyphs and re-forms), loaders, empty states, and hover halos on cards.
- **Never** applied over editable or readable text.
- Respect `prefers-reduced-motion`: static ASCII, no flowing fields, crossfades only.
- Performance budget: 60 fps on a mid-range laptop. The ASCII pass can be lowered in resolution or
  turned off in Settings.

## 6. Components (ASCII-styled DOM)

- Boxes drawn with box characters (`┌─┐│└┘`) or 1px lines that echo them
- Buttons: `[ CREATE ]` style labels, with an accent fill on hover
- Inputs: underscore or caret cursor `▌`, mono text
- Tags: `#tag` in an accent colour
- Cards: flat, one shape for every type (D-055). A left border and a small uppercase label in the type's colour say what it is
  (customer green, problem magenta, competitor yellow, idea white, feature cyan); a hairline edge brightens on hover/selection.
  Type colours are reserved for type: tags are white `#chips` (D-056). Lift on hover and drag.
- Text labels: large display-face text straight on the board (D-050); editing swaps in a DOM input at the same spot
- Connections (D-059): straight, edge to edge, with an arrowhead and the kind written at the midpoint; line pattern by kind
  (solid / dashed / dotted / faint), neutral grey, cyan when attached to the selection. No animation

### HUD (D-027, D-053, D-054)
- Fixed top bar, same on every page: breadcrumb left (`# north-star / workspaces / <name>`), actions right.
- Screen-edge margins come only from `--hud-x` / `--hud-y` (toolbar, panels and status line too).

- In a workspace, the views sit beside the breadcrumb as a framed menu bar (current view filled), and the right side holds one
  settings button (avatar initial, name, ⚙) that opens the settings modal. Signed out, the right side is just the motion switch.
- Dropdowns (`src/ui/Menu.tsx`): a framed trigger `SHOW all ▾`, a framed list below (or above, for the bottom toolbar), `[x]`/`[ ]` checks.
  The create button is the one solid-magenta control on the board.

### Surfaces (D-024)
Every framed element (panels, cards, forms, chips, empty states) composes `src/ui/Frame.module.css`:
- `frame`: translucent near-black (`--surface`) + 10px backdrop blur + 1px `--line` border
- `interactive`: frame + hover border lift + accent bar wiping in along the top edge (`--accent` sets the colour)
- `dashed`: empty or placeholder states
- `label`: `┌ UPPERCASE MONO` section label

## 7. Motion

- **Loading** (D-025, D-031): only the flowing background plus a `▖ STATUS` line in the bottom-right; then the page
  rebuilds cell by cell in random order (no coloured edge).
- **Background** (D-026, D-028): flows by itself like a fluid; forms are born, drift, grow denser (heavier glyphs) and fade
  in overlapping generations. ASCII only; never reacts to the mouse.
- **Component enter/exit** (D-034, D-035): everything builds up cell by cell on the ASCII grid, in random order, no colour
  (`<Appear>` for DOM, `CardReveal` for 3D cards), and breaks apart the same way on exit. No tile waves, no blur rises (user-rejected).
- Everything starts at the same moment (`revealed`), with no staggers. Durations: components 320 ms, headline and page reveal 400 ms, decode 260 ms.
- **Motion setting** (D-030): `system | full | reduced` in the HUD; reduced = frozen background, no waves or sweeps.

- Camera flies between views (Canvas → Features → Competitor map) with eased paths
- Cards spring in on create and dissolve into glyphs on delete
- Collaborator cursors are interpolated and leave a short glyph trail
- Hover: subtle parallax and glyph shimmer
- Durations of roughly 200–600 ms, spring-based where possible
