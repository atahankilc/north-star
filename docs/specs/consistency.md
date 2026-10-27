# Spec: one look and one behaviour across the canvas

Status: **agreed 2026-10-27 (D-263–D-267); all six sessions built (D-270, D-272–D-276)**. This file is the plan, split into sessions. The user checks each
session's work, then starts a new one with a fresh context ("reset"). So every session must be able to start from this
file alone.

Why: feedback that pieces are black holes in the backdrop and the focus button is hard to find; the user found that a
drag's landing marks exist on plane cards only ("bu tarz inconsistency'lerin olmasını istemiyorum"). The user wants every
selectable, draggable or resizable thing to look and move the same way.

The preview the user picked from: `docs/specs/consistency-preview/index.html` (open it with any static server from the
repo root, e.g. `npx serve .` → `/docs/specs/consistency-preview/`). Its "hepsi önerimde" button shows the picks; its
"şimdi" options copy today's values from the code. Values below are the source of truth; the preview is the picture.

## How to run a session

1. Read this file, then `memory-bank/state.md`. The first session below that is not marked **done** is yours.
2. Check `git status` and `ListAgents` first: other sessions work on this repo too. Tell them which files you'll touch.
3. Do only that session's scope. If you find something else, add it to "Found along the way" at the bottom.
4. Before you finish: verify it in headless Chrome on the emulators (see state.md's notes). Headless Chrome reports
   `prefers-reduced-motion: reduce`: call `page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value:
   'no-preference' }])` to see the motion, and check the reduced path too. Then `npm run build`.
5. Write the decision (`D-xxx`, next free number) in `memory-bank/decisions-log.md` and `decisions.md`, mark the session
   **done** here with its D-number and date, and update state.md. Then `npm run check:memory`.
6. Commit only your own files and hunks.
7. Tell the user, in plain words, what to look at to check the session.

---

## The rules (what every session builds toward)

### Surface (D-263)
- A piece (plane, matrix, table, kanban, timeline, documents, document) is no longer the page's colour: tokens
  `--piece` `#121315`, `--piece-head` `#17181b`, `--piece-card` `#1d1e22`, `--piece-edge` `#2f3136`,
  `--piece-shadow` `0 18px 50px -12px rgba(0,0,0,.85), 0 0 0 1px rgba(0,0,0,.6)`, a 1 px top highlight
  `rgba(255,255,255,.05)`; the `+` marks `#3b3e44`. Light: `#fff`, `#f7f7f8`, `#fff`, `#d4d5d8`, a soft shadow, marks `#c9cbd0`.
- A 2 px band in the piece kind's colour on the top edge (`--kind`): plane `--fg`, matrix `--link-solves`, table
  `--link-part`, kanban `--link-draws`, documents and document `--link-depends`, timeline `--link-competes`.
- The page colour (`--bg`) stays only for the page; the name's notch in the edge takes `--piece`. In focus the page the
  ink spreads is `--piece`.

### Console (D-264)
- Where it is today (inside the bottom-right corner, standing on the bottom edge). Shown only while the pointer is on
  the piece: built cell by cell (170 ms, 6 steps) as it comes on, broken (90 ms) as it leaves. Always shown in edit mode,
  while its setup is open, and with keyboard focus inside it. Touch: a first tap shows it, a second goes into focus.
- Something new for you (comments, a mention) stays as a small tab of its own, magenta, while the rest is hidden.
- Screen size grows as the canvas zooms out: `11 px × min(1.4, zoom^-0.5)` (100 % and over 11 px, 70 % 13.1 px, 50 %
  and under 15.4 px); padding, gaps and its magenta marks by the same factor. On a piece narrower than the console it
  stays on the bottom-right corner and runs past the left edge.

### Marks: selecting, dragging, resizing (D-265)
One component, `src/ui/Marks.tsx` (+ `Marks.module.css`, tokens `--mark-*`), four L's, for everything selectable.
- **Size:** three tiers in screen px, picked by the thing's short side on screen (< 48 px S, < 240 px M, else L):

  | tier | for | L / stroke | hover → selected | pressed L | leaving |
  |---|---|---|---|---|---|
  | S | cells, rows, heads, link chips | 6 / 1.5 | 3 → 1 out | 9 | 8 out |
  | M | cards, tasks, text, sticky notes | 12 / 2 | 7 → 3 out | 18 | 13 out |
  | L | pieces, sections, unframed pieces | 18 / 2 | 10 → 4 out | 26 | 16 out |

- **States = distance:** hover grey (`--fg-dim`) a little out; pressed on the corners, longer, in the tone; selected
  just outside, in the tone. Others' selection: the same L's in their colour, their name on a tag at the top-left
  (replaces the full frame, D-191).
- **Colour:** the tone is what the thing is (a card's type, a task's card, a piece's kind, text's own colour; cyan
  when none). **Cyan is what you can do to it:** resize handles, the box select, a link's target, sticking, edit mode.
- **Motion** (reduced motion: none of it, states switch at once):

  | change | L's | time |
  |---|---|---|
  | hover in | glide in from further out, fade in | 160 ms ease-out |
  | press | snap onto the corners, grow; colour at once | 70 ms (colour 40) |
  | release → selected | spring out to the ring, overshooting | 300 ms `cubic-bezier(0.3, 1.8, 0.5, 1)` |
  | deselect, hover out | drift out, fade | 140 ms |
  | selected without a press (keyboard, box, a peer, a follow) | from the corners, the same spring | 300 ms |
  | drag | leave the thing for where it lands; step grid to grid | 80 ms a step |
  | drop | the thing grows 0.8 → 1 into them, then the spring | 180 + 300 ms |

  The thing itself never scales or lifts on hover or selection (D-061); only its marks move.
- **Drag, one rule: the L's show where it lands.** The held thing goes 0.8 round the point held and follows the
  pointer; the L's stay at full size where it will land, snapped, in a landing box drawn in the space (plane, canvas,
  column), not inside the thing. A kanban's landing place is the gap that opens: the L's go round it (the cyan line
  goes). Pieces in edit mode do the same. Several selected: each its own landing L's.
- **Resize, one language: handles on the ring, in cyan, only when selected** (never on hover). A corner that resizes:
  that corner's L itself, cyan, grabbable. An edge that resizes: a bar at its middle, the L's stroke wide, `1.2 × L`
  long, on the ring. Hovered, a handle grows like a pressed L. Dragging: the moving edges light cyan along their whole
  length, and a readout beside them (`410` for a width, `560 × 340` for both). Which handles: paragraph, sticky note,
  project title, a table column: the right bar; section: right, bottom, bottom-right; a piece in edit mode: all four
  corners and edges.
- **Box select (alt + drag):** a cyan wash with cyan L's at its corners.
- Replaces: plane cards' (PlaneCards.module.css), text's (TextItems.module.css), pieces' (CanvasView.module.css `.mark`,
  `.bar`), kanban tasks' (Kanban.module.css `.mark`, the cyan `.slot`), matrix cells' (`.marks`), table cells' `[ ● ]`,
  documents rows' wash and left bar, link chips' fill, the section corner grip, the text width strip, the table column
  grip, `PeerMarks` frames.

### Names and lines (D-266)
- Two voices: the system's (Geist Mono, caps, tracked: piece names, type labels, column heads, panel sections, small
  lines over headings, consoles); the user's (Geist: card titles, headings, paragraphs, section names, the title).
- A number, wherever there is one, is magenta, mono, before the name: piece names (today white), kanban columns (today
  faint), sections, headings' small lines, panel sections.
- Two edges: containers have one (pieces, sections), the name cut into it with the same lead (16 px) and gap (8 px);
  what's held has none (cards, tasks, rows, cells): it is a surface whose colour comes from a band.
- Two bands: held things' on the left (cards, tasks, rows), containers' on top (pieces).
- Write these into `docs/DESIGN.md`.

### Framed and unframed (D-267, option A)
- **Framed = a window:** D-263's surface, band, shadow, name in the edge, the console. No scale readout.
- **Unframed = ink on the canvas:** no fill, edge, band, shadow. Under each row a shade that hugs it (page colour at
  80 %, feathered `0 0 16px 10px` at 72 %), as text's. Its name is a heading's small line: `04 ── RIVALS · TABLE`, mono
  11 screen px, caps, tracked `.14em`, the number magenta, 8 px over its contents. Its console is the same console on
  the same hover rule, hanging 10 px under the contents' right end.
- **Going between:** unframing, the window breaks cell by cell (D-034, 320 ms) while the contents grow from fitted to
  their own size; framing, the reverse (cells build, contents shrink to fit). No other motion.

---

## Session 1: one Marks component, plane cards and text · **done** (D-270, 2026-10-27)
Scope: `src/ui/Marks.tsx` + module + `--mark-*` tokens (D-265's tiers, states, motion, colour). Use it for plane cards
and all text (heading, paragraph, sticky note, project title, section). Drag: the landing box for text and sticky notes
(fixes the user's bug: today a dragged text's marks shrink with it, `TextItems.tsx` ~270). Box select on planes with
the cyan L's. Peer selection on these as L's + name tag.
Check: hover, press, release, deselect on a card and on each text kind, with and without reduced motion; drag a card,
a heading, a sticky note (landing L's, snapped, alt free); a multi-select drag; a peer's selection.

## Session 2: marks everywhere else · **done** (D-272, 2026-10-27)
Kanban tasks (landing L's round the opening gap instead of the cyan slot; the held task 0.8), matrix cells and heads,
table rows and cells (no `[ ● ]`), documents rows, link chips, pieces' hover and selection (tier L), timeline sheets,
`PeerMarks` in every view.

## Session 3: one resize language · **done** (D-273, 2026-10-27)
D-265's handles for paragraph, sticky note, title, section, table columns, and pieces in edit mode (which also drag
with the landing L's). The full-length cyan edge and the readout. Remove the old grips and strips.

## Session 4: surface and band · **done** (D-274, 2026-10-27)
D-263: tokens (css + `tokens.ts` for WebGL: `CellDots`, the plane's canvas picture), every piece's `var(--bg)` →
`--piece*` (CanvasView, Matrix, Table, Kanban, Documents, DocumentPiece, Timeline, Beside, FocusDock where it is the
piece), the band, focus's page. Light theme.

## Session 5: the console · **done** (D-275, 2026-10-27)
D-264: hover only (cells), the growing size, the fresh-comments tab, edit / setup / focus-within keep it, touch.

## Session 6: names, lines, unframed · **done** (D-276, 2026-10-27)
D-266 (magenta numbers, the shared edge-name geometry, DESIGN.md) and D-267 (unframed as ink, its name, its console,
the transition both ways).

---

## Asked, not decided
- Text's shade hugging each line instead of one feathered box per item (`<Ink>`), and one family of rules (straight =
  holds, fading = opens a region, dashed = separates rows, magenta lead = numbered start; H1's rule gets the magenta
  lead). In the preview under 4 → "tek dil + mürekkep zemini". The user didn't pick it or turn it down; ask before
  building. Unframed rows (D-267) use the hugging shade either way.

## Found along the way
- Session 6 (D-276): a single document unframed keeps its feathered page (it's a page of text, not rows). A name's
  leading number is taken apart only when it's 1–4 digits and then a space or a dash (`2024 plan` reads as `2024`).
- Session 4 (D-274): `--piece-head` has no user yet. In focus the HUD's shades were page-coloured strips over the
  surface: `html[data-in-focus]` turns them to `--piece`.
- Session 1 (D-270): the tier rule read literally gave a one-line paragraph S and a section M; built as the kind's tier,
  a step down when small on screen (L < 120 px, M < 24 px). Sessions 2–3: give each kind its tier the same way.
- A section's own drag now shrinks with what it holds and lands on its L's (D-273).
- Session 3 (D-273): a table column isn't selectable, so its edge bar shows under the pointer at its head; stuck
  matrices and tables carried by a plane in edit mode still move at full size (`following`), not 0.8.
- The project title keeps its edge-grey corner brackets as decoration; its marks sit just outside them, which reads
  as a double corner. Ask the user whether the brackets go once marks are everywhere.
- `PeerRing` and `PeerTaskRing` are gone (D-272).
- Session 2 (D-272): a piece in edit mode shows its old cyan grips and no selection L's; session 3 replaces the grips
  with D-265's handles. The matrix's and table's "hot" head (the hovered cell's row and column) stays a highlight.
- L's stand outside what they mark: anything with `overflow: hidden` that gets marks needs its text cut in an inner
  span instead (done for timeline sheets/pills, SOON pills; documents sheets sit in a wrapper).
