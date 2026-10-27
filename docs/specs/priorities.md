# Spec: priorities on the kanban, step by step

Status: **planned** (D-253, 2026-10-27); P1 done (D-268, 2026-10-27), P2 is next. Same way of working as [kanban.md](kanban.md): one session at a time,
the user checks it, the next session starts from this file alone. Follow kanban.md's "How to run a session" (git status
and `ListAgents` first, verify headless, rules tests, `D-xxx`, mark the session **done** here, commit only your hunks).

## Why

1.0 had a priorities tab (D-138): features on impact × effort, a 3 × 3 grid with its corners named (quick wins, big bets,
fill-ins, money pits), confidence from what each feature rests on, and a suggested order beside it. The fields are still
on every feature and package (`impact`, `effort`, `priority`); only the view is gone.

A grid like that and a kanban are the same thing: **things in boxes, where the box a thing sits in is one of its values,
and dragging it to another box changes that value**. A kanban is one row of boxes (columns); priorities is two (columns
× rows). So priorities is not a new piece: it's the kanban holding **cards** instead of tasks, its columns and rows
taken from two of the cards' fields. A template sets it up.

| | columns | rows | holds |
|---|---|---|---|
| the kanban today (D-251) | its own (todo · doing · done) | none | tasks |
| features by status | status: idea · planned · building · shipped | none | feature cards |
| **priorities** | effort: S · M · L | impact: high · medium · low | features + packages |
| kanban with swimlanes (kanban.md session 5) | its own | given to / the card | tasks |

The difference from a matrix (D-204): a matrix has cards on its edges and a value in each cell (Notion × Offline sync →
`partial`, the pair's value). Here the edges are values and the cards sit inside the cells (the card's own value).

## What changes, what doesn't

- **One piece, two kinds of contents.** A kanban holds tasks (as now) *or* cards, never both. Made from `+ → kanban…`
  with templates: tasks (today's), features by status, priorities.
- **Columns** are the kanban's own list (tasks, as now) or a field's values (cards). **Rows** are none or a field
  (kanban.md session 5's swimlanes, generalised). A cards kanban gets a `no value` lane: cards with the field unset,
  dragged out of it to rate them.
- **Which cards:** the table's rule list (D-209 `source.ts`: plane, type, status, tag, title; cards by hand), not a new
  filter. Stuck to a plane (kanban.md session 3), it shows that plane's cards, as a stuck table does.
- **Fields a cards kanban can sort by:** status (a feature's own, a customer/problem/idea's validation), impact, effort,
  priority. Never type (a card's type isn't changed by dragging).
- **Order inside a box:** tasks keep their hand order (`order`); cards have none to keep (sorted by score, then title).
- **Task-only features stay task-only:** given to, due, checklist, WIP limits, "given to me", the timeline (kanban.md
  sessions 4, 7, 8). The filter strip (session 4) and the look (session 1) apply to both.

## Not doing

- No new piece kind, no grid piece separate from the kanban, no priorities page or tab.
- No tasks and cards mixed on one kanban.
- No hand order for cards.
- Never writing a card's `priority` from the suggested order (it suggests only, as D-138).

## Settled (D-253, the user took both recommendations)

- **Dragging a card changes its field:** dropping on quick wins sets impact `high`, effort `S`; one undo step; the
  fastest way to rate. (Not: a board that only shows, values set in the card's panel.)
- **One confidence rule:** D-138's share, for features and packages alike: of the customers, problems and ideas it rests
  on (a package: holds), validated 2, testing 1, else 0; share ≥ 0.75 high, ≥ 0.34 medium, else low; any invalidated:
  `!` (score 0). Today the feature panel uses the weakest of what it rests on (`RestsOn`, D-221) while a package uses a
  share (`confidenceOf`, D-239, thresholds 0.67/0.34, validated only): P3 makes them one, in `cardFacts.ts`.

## Order with the kanban's sessions

Kanban session 1 (the new look, D-252) is done, so P1 can start: a cards kanban is drawn in that look. Kanban session 5 (swimlanes) and P2 both add rows: whichever comes first builds "rows by a field" for tasks
and cards alike, the other only adds its fields.

`kanban S1 → P1 → (kanban S2–S4) → kanban S5 ⇄ P2 → P3`

---

## Session P1: cards on a kanban, columns from a field · **done (D-268, 2026-10-27)**

- A kanban's setup gets what it holds (`tasks` | `cards`), and for cards: which (a `source`, D-209) and the field its
  columns come from. The cards are drawn small, in the type colour, with their confidence and priority (the look from
  kanban session 1).
- Dragging a card to another column sets the field (D-253); the `no value` lane at the start.
- A click on a card opens its panel (D-221, as D-247 does from a matrix head).
- `+ → kanban…` with templates: tasks, features by status. The setup in a tabbed panel like the matrix's (D-212).
- Rules: `validKanban` takes `holds`, `source`, `colField` (today it allows only `cols`); export/import carry them.

Built (D-268): code in `kanbanCards.ts` (fields, columns, which cards), `CardKanban.tsx` (the view), `KanbanSetup.tsx`,
`KanbanWizard.tsx`. `no value` is a column (there are no rows yet), first; dropping a card there takes the value away.
A field shows only the cards it applies to (status: customers, problems, ideas, features; impact and effort: features
and packages; priority: features, as the rules allow); a status kanban of both kinds shows both lists of columns, and a
held card's other-kind columns go faint and don't take it. Cards sorted by type, then title (P3: by score). The kanban's
own `cols` stay on the piece, unused, so switching back to tasks keeps them. Stuck to a plane it uses the kanban's
`[this plane only]` switch (`everyPlane`), not a table's auto rule. The sheet's confidence uses the package share for
features too (what it rests on: its ideas and the problems they solve), so it can differ from the feature panel's
weakest-of rule until P3. The dock's task filter and lanes are hidden on a kanban holding cards.

## Session P2: rows from a field

- The kanban's rows: none or a field; for tasks given to / the card (kanban.md session 5), for cards impact, effort,
  priority, status. Each row folds. Dragging into a row sets its field too.
- A box (column × row) can carry a name, shown small in its corner and set in the setup (`quick wins`…), a wash for the
  first and a magenta name for the last if the template says so.
- Rules: `rowField`, `names`.

## Session P3: the priorities template and the suggested order

- Template **priorities**: features and packages, columns effort S · M · L, rows impact high → low, the four corners
  named (quick wins washed green, big bets, fill-ins, money pits in magenta).
- Beside it, switched from its dock: the suggested order (D-138): score impact × confidence ÷ effort (1–3 each), 0 when
  it rests on something invalidated (`!`); rated cards in thirds as P1–P3; `P2 → P1` in yellow where the card's priority
  differs; a row opens the card's panel. Shown whenever the columns and rows are effort and impact.
- One confidence rule (D-253), in `cardFacts.ts`, used by the panel, packages and the order.

---

## Found along the way

- A kanban holding cards has no filter yet (the task filter's fields don't fit cards); the plan says the strip applies to
  both: needs card fields (type, tag, plane) (P1).
- No several-at-once on a card kanban (shift+click, box) and no presence for a held card yet (P1).
- The wizard's preview cuts column names at five letters or so (`no va…`) (P1).
