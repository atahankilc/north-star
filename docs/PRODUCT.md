# North Star: Product Spec

> A visual, real-time collaborative workspace for the startup ideation phase.
> Capture ideas as post-its, connect and structure them, break competitors down into features,
> and compare everything in one linked model.

## 1. Problem

Early-stage founders keep ideas, competitor research and feature planning in separate tools
(notes, Miro, spreadsheets, browser tabs). Nothing connects "my idea" to "who already does this,
and how well". North Star keeps all of it in one connected graph.

## 2. Core principle

**Everything can link to everything.** Ideas, our features, competitors and competitor features
are nodes in a single graph. Each view is a different lens on that same graph.

## 3. Entities

| Entity | Description | Key fields |
|---|---|---|
| **Workspace** | One startup idea space; the unit of sharing | name, description, members, roles (owners, editors, viewers; D-098) |
| **Customer** | Who it's for, at any breadth; doubles as the segment (D-044) | title, notes, position, status (D-137) |
| **Problem** | A pain worth solving; ideas link to it (D-041) | title, notes, position, status (D-137) |
| **Text label** | Text written on the board: a heading that names an area and is a place to jump to (D-050), or a paragraph of light Markdown (D-156); either can turn a quarter | text, size, small line, turn, width, position |
| **Sticky note** | A note anyone who edits drops on the board, signed with who wrote it and when (D-158); the assistant reads them | text, colour, author, width, position |
| **Comment thread** | A conversation pinned to anything you can select on the board (card, text, section, sticky note, link) or a spot; anyone in the workspace starts one or answers, viewers too; `@` mentions people; new ones light up, and all of them are in the threads panel; resolved threads leave the board (D-159, D-166) | what it's on, messages (who, text, mentions, when), resolved, what each person has read |
| **Idea** (post-it) | A thought, problem, insight or feature idea | title, body, color, tags, position (x,y,z), status, attachments |
| **Connection** | Typed link between any two nodes | from, to, type (`relates`, `depends-on`, `contradicts`, `part-of`, `inspired-by`, custom), label, bend points the user put on it (D-155) |
| **Feature** (ours) | Something we plan to build; its own view, linked to the ideas it came from | name, detailed description, priority, status, effort, impact (D-138), linked ideas |
| **Competitor** | A company or product in the space | name, URL, logo, description, pricing, audience, regions it operates in (D-145), notes |
| **Competitor Feature** | One piece of a competitor's functionality | name, description, category, competitor, availability, source link (D-164) |
| **Package** | A piece of the chain as one card: on its home plane its members sit in its frame; elsewhere it links and is rated like a feature (D-141) | name, notes, tags, members, home plane, impact, effort |
| **Evidence** | What was learned about a customer, problem or idea: listed in its panel, counted on its card (D-137) | card, kind (`interview`/`quote`/`data`/`observation`/`link`), text, supports or contradicts, source, link, date |
| **Comparison** | How a competitor covers one of our features | feature, competitor, coverage (`none`/`partial`/`full`/`better`), notes, linked competitor feature, a score per feature criterion (`met`/`part`/`no`, D-133), not relevant, confidence (`documented`/`inferred`/`guess`, D-136) |
| **Attachment** | Image, SVG or PDF on any card (D-083; upload only, no sketch pad) | file, type, name, size, owner item |

## 4. Views

> **D-177, D-248:** the views below were 1.0's; their code is deleted (in git at `493bf87`) and they come back one by one
> as canvas pieces.
>
> **Next (D-174, D-176):** no more pages. A workspace opens on an infinite canvas (the moving backdrop, no grid marks, no
> view tabs; drag to pan, wheel to zoom). What used to be pages become pieces placed on it, several of each: the side
> nav's `+` puts a **plane** (D-180; first called a board) at the middle of the screen (beside any it would cover). Every
> piece has its own background: a plane's is solid page colour with only its `+` marks, no animation. Under its
> bottom-right corner a console stays open (zoom, full screen, edit); only in edit mode is a plane moved, resized,
> renamed or deleted, since a press inside it belongs to what's in it. Today a plane is still empty; its cards, tables and
> the rest come next. Until then the views
> below open by their paths (`/board`, `/table`, …).
>
> Now one board with every item type, text labels to jump between, and Board / Flow / Table / Matrix views (D-040, D-050):
> see [specs/board.md](specs/board.md). Items 1–3 below describe the earlier per-type pages. A built-in example workspace shows it all (D-052).

1. **Idea Canvas.** A 3D/2.5D infinite board of post-its with connections, groups, zoom/pan,
   mini-map, and live collaborator cursors.
2. **Features View.** A 3D board like the idea canvas, for our features (priority, status, effort).
   Each feature links back to its source ideas ("promote to feature") and forward to comparisons (D-037).
3. **Competitors.** A list of competitors; each has a profile (URL, pricing, audience, regions, notes) and its
   features grouped by category. Those features can be linked to our ideas and features (D-038).
4. **Comparison Matrix.** A spreadsheet-style view: rows are our features, columns are competitors,
   and each cell holds coverage plus notes. Extra columns hold description, priority and status. A feature can list
   criteria (its must-haves); a cell then scores each one and shows which are met, and the row counts the criteria no
   competitor meets: the white space (D-133).
   Shows gaps (opportunities) and table stakes.
   **Now (D-204):** a generic matrix, a piece on the canvas: rows and columns are every card of a type, typed names or
   single cards; cells a scale of your own steps, a number or a text, with notes, `not relevant` and how sure; a reading
   for each row and column. Features × competitors is one of its templates; problems × customers, ideas × criteria and a
   blank one are the others.
   An axis can unfold its features into what they're judged on (their criteria, D-249): each a row under the feature,
   scored like any cell; the feature's cells read from them, and a criterion nobody meets is `◇ open`.
   On the canvas it's a window you move and resize, its table inside, no `+` marks (D-208); focus brings the table to
   the middle of the whole screen (D-206).
   Made in a short wizard (start from, rows, columns, cells, with a preview); its heads look like the cards they are,
   a scale's cells are squares filled to the step, each axis ends in a dashed card to add to, and the totals can sit
   in the heads, at the ends or both, as squares, a number or a line (D-212).
   **Table (D-209):** the first *lens*, a window like the matrix's: rows are the cards that meet its rules (plane,
   type, status, tag, words in the title; is or is not; none required) plus cards and names added by hand; columns
   are the cards' own fields and columns of its own (a scale, a number, a text, a check), sorted by any; each column's
   width is dragged from its head's edge, and a row or column just added is glided to (D-224). Made, like the
   matrix, in a short wizard from `+ → table…`, and set up in the same tabbed panel (D-218). A matrix or a
   table moved to a plane's edge sticks there: it moves with the plane and shows that plane's cards (D-210). In the
   plane's focus the dock opens what's stuck to it beside the plane, the screen split, each part its own area (D-211).
   A link shows quietly: faint `· ›` in the gap, or a thin line under everything when apart; the piece's console names
   its plane, and its dropdown links or unlinks it; a plane carries what's linked to it (D-215).
   **Open on the canvas (D-228):** in edit mode a matrix's or table's console has `[unframe]`: the window goes and the
   whole table lies on the canvas at its own size, live there (cells, heads, adds, pages and `[setup]` from its
   console), for everyone. It only moves then (its size is its contents'); `[frame]` puts it back in its window.
   Focus still works the same.
5. **Overview** (D-144). The workspace read on one screen: next steps, what's on solid ground and what's still a
   guess, the riskiest bets, the white space, what looks off. Reached by its path; opening a workspace now lands on
   the canvas (D-174).
6. **Priorities** (D-138). Our features on impact × effort, each with a confidence read from the status of the ideas,
   problems and customers it rests on, and the order impact × confidence ÷ effort suggests beside the priority we set.
7. **Detail Panel.** A side panel for any node: edit fields, see all links, attachments,
   and AI actions.
6. **Reports.** Research reports, write-ups of assistant chats and uploaded `.md` files (D-091), saved per person and shared with the workspace by
   choice (D-090). One tab beside board, flow, table and matrix.
8. **Focus.** The board showing one card's chain only (customers → problems → ideas → features both ways from it, and the
   competitors around them), cards in place; the tab right of Board (D-127, [specs/board.md](specs/board.md)).
7. **Settings.** Profile, workspace members, AI config (OpenAI key, model), export/import.

## 5. Key flows

1. Brain-dump: create post-its quickly on the canvas
2. Structure: connect, tag, name areas with text labels
3. Research: add competitors and break their products into features
4. Link: ideas ↔ competitor features
5. Plan: add features and link them to the ideas and competitor features they come from
6. Compare: fill in the matrix
7. Decide: use gaps and differences to pick what to build
8. Collaborate: invite people, see live cursors, edit together

## 6. Feature scope

### In scope (confirmed by user)
- **Real-time collaboration**: live cursors, presence (who is here), live edits
- **Authentication**
- **AI assist with BYOK** (bring your own OpenAI key), using a cheap model for:
  - summarize an area (the cards under a text label)
  - suggest connections between ideas
  - draft a competitor breakdown from a description or URL text
  - fill or suggest matrix notes
- **Settings page** where users enter their own API key and choose a model
- **Export / Import** of a workspace (JSON bundle)
- **Attachments**: images, SVGs and PDFs on any card, up to 10 MB each, big photos shrunk before upload (D-083); drawings are uploaded as files, no built-in sketch pad
- **Web only**

- **Kanban** (D-251): a canvas piece holding the team's tasks in columns (`todo · doing · done` to start, renamed,
  added, moved, one marked finished); a task has a title, who it's given to, a due day, the card it's for, a checklist
  and notes; dragged between columns, typed in at a column's foot, opened in a right panel. Grown in eight sessions
  (docs/specs/kanban.md): the ledger look (D-252); a card's panel lists and makes its tasks, a finished test logs
  evidence (D-254); stuck to a plane it shows that plane's tasks and opens beside it (D-255); filters, `#labels`, `P1–P3`,
  column limits (D-256); lanes by person or card, several selected at once (D-258); others' picks and drags shown,
  comments on tasks (D-260); tasks given to you counted by your square, found by ⌘F (D-261); a `SOON` band of what's due.
- **Cards on a kanban** (D-268, docs/specs/priorities.md): a kanban holds tasks or cards, never both; made from
  `+ → kanban…` (tasks, features by status, my own) and set up in a tabbed panel (holds · cards · columns). Holding
  cards, which come from the table's rules (plane, type, status, tag, title; cards by hand), its columns are one field's
  values (status, impact, effort, priority), `no value` first; dragging a card to another column sets that field (one
  undo step), a click opens its panel. Stuck to a plane it shows that plane's cards. Rows and the priorities template come
  next (P2, P3).
- **Timeline** (D-262): a canvas piece showing kanbans' tasks on two weeks of days, rows by kanban, person or card;
  dragging a task onto a day sets its due day; late ones on today in magenta; a tray of tasks with no day. Sticks to a
  kanban and opens beside it in the kanban's focus.

### Later / nice to have
- Templates (Lean Canvas, SWOT, positioning map)
- Version history / snapshots
- Export to PDF, PNG or CSV (matrix)
- Comments and mentions

See [ROADMAP.md](ROADMAP.md) for phasing and [../memory-bank/open-questions.md](../memory-bank/open-questions.md)
for unresolved items.
