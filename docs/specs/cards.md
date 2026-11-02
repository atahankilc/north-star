# Cards: one face for every card (D-358)

Status: **agreed 2026-11-02 (D-358); steps 1–4 done 2026-11-02.** Written from a read of every place that draws a card or
a task. Same way as the kit (D-326) and the gallery (D-324): one thing built once at the bottom, everything else built
on it, each part with its own `X.gallery.tsx`. Same rule as D-325: **consistency first**. Where the copies drifted
apart they snap to one look, and every visible change is listed below and shown in the gallery before and after.

## What counts as a card

Anything that stands for **one card or one task** and shows its type's colour: a sheet, a bar, a head, a row.

| # | What | Where today | Its own component? |
|---|---|---|---|
| 1 | Plane card: full, compact (the title), far (bars) | `plane/PlaneCards.tsx` `CardBody`, `FullCard`, `CompactTitle` | inside a 958-line file |
| 2 | Package band (unfolded), member rows (folded) | `PlaneCards.tsx` `PackageFrame`, `.memberRow` | inside it |
| 3 | A competitor's feature, small inside its card | `PlaneCards.tsx` `.mini` | inside it |
| 4 | Task sheet on a deck | `deck/Kanban.tsx` `TaskCard` | inside a 1061-line file |
| 5 | Card sheet on a deck | `deck/CardKanban.tsx` `CardSheet` (borrows Kanban's `.task` CSS) | inside it |
| 6 | Suggested order row | `CardKanban.tsx` `OrderList` | inside it |
| 7 | Timeline bar, the no-day tray's pill | `deck/Timeline.tsx` `sheet()` (a function, not a component) | no |
| 8 | Matrix head drawn as a card | `matrix/Matrix.tsx` `Head` | inside it |
| 9 | Table name cell drawn as a card | `table/Table.tsx` `NameCell` | inside it |
| 10 | A card's tasks in its panel | `panels/CardTasks.tsx` | inside it |
| 11 | "The card it's for" in a task's panel | `panels/TaskPanel.tsx` `own.card` | inside it |

**Not cards, left as they are:** the sticky note (paper, not a card: `text/TextItems.tsx` `StickyBody`), `PieceCard`
(a piece off the canvas, already in the kit), prompt rows with a tone band (`PromptRow`, already in the kit).

## What repeats (counted 2026-11-02)

1. **The face is written 6 times in CSS:** a tint of the type (`--card-tint`), a coloured left edge, a thin outer line
   (`--piece-card-edge`). PlaneCards `.card` and `.memberRow`, Matrix `.rowHead/.colHead`, Table `.name`, Kanban
   `.task[data-ccard]`, Timeline `.task`. The copies drifted:
   - edge `--w-card-edge` (plane, matrix) vs `--line-w-bold` (deck, timeline, table);
   - the colour named `--type` (plane, matrix, table) vs `--tone` (deck, timeline);
   - base `--bg-raised` everywhere but the table (`transparent`); the table has no outer line.
2. **D-295 is only on two of them.** On a tinted face the greys lean to the ink and the type's colour leans a quarter to
   the ink, so small text stays ≥ 4.5:1. PlaneCards and the deck's card sheet have it; the matrix heads, table names
   and timeline bars are tinted but don't. A bug from the drift.
3. **`TYPE_ACCENT`** is `CARD_TONE` given a second name in `PlaneCards.tsx`; 10 files import it from there, so the
   table, the finder, the side nav and the task panel all pull in the big plane file.
4. **The empty card's name** in three forms: `PLACEHOLDER[type]` (PlaneCards, cardEntry), `` `untitled ${type}` `` in
   about 15 files, plain `'untitled'` in others.
5. **Task helpers live in `Kanban.tsx`** (`dueText`, `overdue`, `initials`, `cells`): the timeline, the task panel and
   CardTasks import a 1061-line view to format a date. `initials` is copied in `table/rows.ts` (`initialsOf`).
6. **The sheet shell** (`data-selected/finished/lifted`, `role="button"`, `tabIndex`, `--tone`, `usePeersOn`,
   `<Marks tone>`) is written in TaskCard, CardSheet and the timeline bar.
7. **P1 in three looks:** a task's `Chip pill` + `PRIORITY_TONE`; the card sheet's same chip with its own `P1_ON_TINT`;
   the timeline's own `.p` span.
8. **A name typed in place** is the same `<input>` with the same Enter / Escape / blur code in Matrix `Head` and Table
   `NameCell` (the kit's `InlineEdit` is screen-sized; these are world-sized).
9. **Checklist progress in four forms:** `▮▮▯ 2/3` (task sheet), a filling bar (timeline), `2/3` (CardTasks), `☐ 2/3`
   (plane card). Sizes differ, so some difference is right; it was never chosen.
10. **The small card row** (a tone bar, a title, a hint at the end) is hand-made in 5 places: #3, #2's rows, #6, #10, #11.

## The plan: layers

A new area, `src/views/workspace/cards/` (a covered gallery folder by its parent), plus pure helpers in `src/model/`.

### 1. Bottom: helpers, no look change
- `CARD_TONE` imported from `ui/foundation/cardTone.ts` everywhere; `TYPE_ACCENT` deleted.
- `model/cardName.ts`: `cardName(card)` → its title or `untitled <type>`; `cardPlaceholder(type)` for the faint text on
  an empty card (PlaneCards' `PLACEHOLDER` moves here). Every `untitled ${…}` in views reads it.
- `model/tasks.ts` (already the home of `today` and `overdue`): `dueText`, `initials`, `checkCells` and
  `CHECK_CELLS_MAX` moved out of Kanban.tsx; `table/rows.ts`' copy deleted. (Avatar's one-letter `initialOf` stays: a
  square of one letter is the HUD's look.) Tested in `tests/unit/cardWords.test.ts`.
- The one word that changes: lists that said a bare `untitled` for a card (the FOR filter, the deck's lanes, a task
  sheet's card line, a card sheet's label) now say `untitled idea` like everywhere else.

### 2. `CardFace`: the one face
`cards/CardFace.tsx` + `CardFace.module.css`. A shell `div` with:
- `tone` (a type's colour or none), `tint` (on for a card, off for a task's plain sheet), `scale` (`world` | `screen`:
  the edge `--w-card-edge` or `--line-w-bold`, chosen by size, not by who wrote it);
- states as data attributes: `selected`, `pressed`, `lifted`, `finished`, `dim`;
- D-295's ink built in whenever it's tinted (`--fg-dim`, `--fg-faint`, `--placeholder`, `--type-ink`, `--clash-ink`);
- its `Marks` (tone, peers by id) and an `extra` slot (thread chip, `›`);
- `as` and pass-through handlers; it never holds drag or data code.

### 3. Small parts (each a file + gallery, in `cards/parts/`)
`PriorityChip` (knows it sits on a tint: one P1), `DueMark` (`◷ 28 oct`, magenta late), `Checklist` (`cells` | `bar` |
`count`), `ProofCells`, `TagChips`, `Sure` (`◆ high`, `! broken`), `Assignee` (the two-letter square).

### 4. Built on top
- `TaskSheet` (was TaskCard) and `CardSheet`, both on `CardFace` (step 2, done); Kanban and CardKanban keep their boards, drag and
  lanes.
- `PlaneCard`: `FullCard`, `CompactTitle` and the package band's face out of PlaneCards. The drag, link and landing code
  stays in PlaneCards, so its memo work (D-287) and `sameProps` don't change.
- `TimelineBar`: the face, label, checks bar and grips; the day maths stays in Timeline.
- `CardRow`: the small row (#3, #2, #6, #10, #11).
- `NameInPlace`: the world-sized typed name for Matrix and Table (built as the kit's `InlineField`, step 4).

### 5. Kept from coming back
`check:kit` refuses `--card-tint` and the card edge (`inset … 0 0 var(--type|--tone)` with `--piece-card-edge`)
outside `cards/`, and `TYPE_ACCENT` anywhere.

## What will look different (to be shown before/after)
- Edge widths stay two: `card` (`--w-card-edge`, plane cards and matrix heads) and `sheet` (`--line-w-bold`, deck,
  timeline, table). The table's names stay as they were (`flat`, step 4): a full face hid the row lines.
- Matrix heads, table names and timeline bars get D-295's ink: their dim and faint text a little brighter (seen in the
  matrix heads' unset step squares, dark theme; light below the eye).
- A typed head or row name in a matrix gets the table's cyan line under it while typed (the kit's `InlineField`).
- The timeline's `P1` becomes the same pill as a task's.
- Checklist: the plane card's `☐ 2/5` and the sheet's `▮▮▯ 2/5` stay (size), CardTasks' plain count stays; only the
  part is shared.

## Steps (one commit each, gallery and `check:kit` green)
1. Bottom moves (section 1). No visible change but the `untitled` word. Typecheck, unit tests. **Done 2026-11-02.**
2. `CardFace` + its gallery; TaskSheet and CardSheet on it, galleries for every state (plain, tinted per type, selected,
   lifted, finished, late, long title, peers).
   **Done 2026-11-02:** `cards/CardFace` (`edge`: `sheet` 2 px or `card`, the plane card's world edge, kept as two widths
   rather than one: a 4 px edge on a deck's narrow sheet is too heavy), `cards/Sheet.module.css` (the sheet's layout,
   moved out of Kanban.module.css, which keeps only how a sheet sits on the deck: `styles.task`), `cards/TaskSheet`
   (was TaskCard), `cards/CardSheet`, `cards/PriorityChip` (one P1: `var(--clash-ink, magenta)`, so on a tinted face it
   is the old `P1_ON_TINT` and elsewhere magenta; the suggested order uses it too). A lane's person square is still its
   own copy in Kanban.module.css until `Assignee` (step 5).
3. `PlaneCard` out of PlaneCards: every type, full / compact / far, empty, with tasks, tags, proof, open competitor,
   folded feature, folded package.
   **Done 2026-11-02:** `cards/PlaneCard.tsx` holds the face and all inside it (FullCard, CompactTitle, ProofCells,
   TagChips, the competitor's small features, member rows) and `PackageBand`; its insides' CSS in PlaneCard.module.css,
   on `--tone` (set by the face) instead of the box's `--type`, so it also draws alone in the gallery. The plane's own
   code stays in PlaneCards.tsx (place, drag, link handle, Marks, landing, memo); what the insides do comes in as
   callbacks (`onFeature`, `onMember`, `onFold`). PlaneCards.module.css keeps only where a face sits (`.box > .card`,
   `.pkg > .band`) and the drag, dim and packing states. CardFace gained `ref` and pointer enter/leave; it sets
   `tabIndex` only when told to be a button or not, so a plane card stays out of the tab order as before.
4. TimelineBar, matrix and table heads on the face, `NameInPlace`.
   **Done 2026-11-02:** `cards/TimelineBar` (the bar on the face, tinted; no card: its grey tint and edge kept so it
   shows on the strip; a ◆ has no face, its tone only for the ◆ and its marks; P1 the `PriorityChip`), the matrix's card
   heads and the table's card names on `CardFace` (matrix `card` edge; table `sheet` edge and `flat`: no paper, the
   tint over its row and the edge only, because a full face hid the table's dashed row lines, D-266, and read much
   brighter), typed names stay without paper. `NameInPlace` became the kit's `InlineField` (src/ui/primitives/InlineEdit.tsx: the field alone, Enter or blur
   ends, Escape puts the name back, `''` clears), used by both. CardFace's paper is in `:where()` (D-334's way) so a
   caller's `position: absolute` (the table's and matrix's `> *`, the timeline) always wins.
5. `CardRow` and the small parts in the 5 rows; the `check:kit` rule.

## Not yet
- The plane card's drag and link code as a hook shared with text and packages (worth it, but a separate change: it
  touches D-229/D-265/D-291's behaviour, not the look).
