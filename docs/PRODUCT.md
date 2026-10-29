# North Star: Product Spec

> A visual, real-time collaborative workspace for the startup ideation phase.
> Capture ideas as cards on planes, connect and structure them, break competitors down into features,
> and compare everything in one linked model.

## 1. Problem

Early-stage founders keep ideas, competitor research and feature planning in separate tools
(notes, Miro, spreadsheets, browser tabs). Nothing connects "my idea" to "who already does this,
and how well". North Star keeps all of it in one connected graph.

## 2. Core principle

**Everything is one graph.** Customers, problems, competitors, ideas and our features are cards linked to each other;
a competitor's features live inside it and are matched to ours (`≈ our`), not linked (D-296). Each view is a different
lens on that same graph.

## 3. Entities

| Entity | Description | Key fields |
|---|---|---|
| **Workspace** | One startup idea space; the unit of sharing | name, description, members, roles (owners, editors, viewers; D-098) |
| **Customer** | Who it's for, at any breadth; doubles as the segment (D-044) | title, notes, position, status (D-137) |
| **Problem** | A pain worth solving; ideas link to it (D-041) | title, notes, position, status (D-137) |
| **Piece** | Something placed on a workspace's canvas: a plane, matrix, table, documents list, document, deck (the kanban; called so on screen, D-301) or timeline (D-176) | kind, position, size, name, its setup, the plane it's stuck to, framed or open |
| **Text label** | Text written on the canvas or a plane: a heading that names an area and is a place to jump to (D-050, D-188), a paragraph of light Markdown (D-156), a section (a named frame, D-130) or the project title (D-118); any can turn a quarter | text, size, small line, turn, width, position, its space |
| **Sticky note** | A note anyone who edits drops on the canvas or a plane, signed with who wrote it and when (D-158, D-257) | text, colour, author, width, folded, position |
| **Comment thread** | A conversation on a component: a plane, card, text, link or kanban task (D-193, D-260); anyone in the workspace starts one or answers, viewers too; `@` mentions people; new ones light up, and all of them are in the threads panel (D-159, D-166, D-199) | what it's on, its space, messages (who, text, mentions, when), resolved, what each person has read |
| **Idea** | A thought, insight or answer to a problem | title, body, tags, position on its plane, status |
| **Connection** | Typed link between any two cards | from, to, kind (`solves`, `part-of`, `competes-with`, `contradicts`, `inspired-by`, `depends-on`, `relates`, `for`, or custom; D-147), label; always straight (bend points dropped, D-292) |
| **Feature** (ours) | Something we plan to build; its own view, linked to the ideas it came from | name, detailed description, priority, status, effort, impact (D-138), linked ideas |
| **Competitor** | A company or product in the space | name, URL, description, pricing, audience, regions it operates in (D-145), notes |
| **Competitor Feature** | One piece of a competitor's functionality | name, description, category, competitor, availability, source link (D-164) |
| **Package** | A piece of the chain as one card on a plane: unfolded a frame round its members, folded a card holding them as rows; rated like a feature (D-141, D-239) | name, notes, tags, members, impact, effort |
| **Evidence** | What was learned about a customer, problem or idea: listed in its panel, counted on its card (D-137) | card, kind (`interview`/`quote`/`data`/`observation`/`link`), text, supports or contradicts, source, link, date |
| **Comparison** | Which competitor feature matches one of our features (D-164), and old criteria scores (D-133); how well is scored in a matrix's cells now (D-204, D-249) | feature, competitor, matched competitor feature, criteria scores (`met`/`part`/`no`) |
| **Matrix cell** | One cell of a matrix piece, or of a table's own column (D-204, D-209) | matrix, row, column, value (a step, a number or text), note, not relevant, confidence (`documented`/`inferred`/`guess`, D-136) |
| **Document** | A file the workspace keeps: a `.md`, an image, a PDF or an old report (D-232); private to its author until shared | kind, title, excerpt, author, shared, its content |
| **Task** | A to-do on a deck, the kanban piece (D-251, D-301): in a column, given to someone, due on a day, for a card | title, notes, column, assignee, due, card, checklist, labels, priority |

## 4. Views

A workspace is one infinite canvas (D-174), or several once someone adds more (D-302, not built yet:
[specs/canvases.md](specs/canvases.md)): the moving backdrop, drag to pan, wheel to zoom. Everything else is a
**piece** placed on it from the side nav's `+` (D-176), several of each; each piece sits on its own graphite surface
with a band in its kind's colour (D-274), opens into **focus** (it becomes the view, D-184), and in edit mode is moved,
resized, renamed or deleted. A matrix, table or documents piece can be **unframed** onto the canvas (D-228, D-234).

1. **Plane** (D-180). Where the cards live: customers, problems, competitors (their features inside them), ideas,
   features and packages, linked to each other (D-187, D-207, D-225, D-239). Text, sections and sticky notes go on it
   or straight on the canvas (D-188). In focus: multi-select, alignment guides, filters, right-click (D-227–D-237).
   A card's panel opens on the right (D-219, D-221). One card can be on several planes, at its own spot on each, the same
   card everywhere (D-281): Delete on a plane takes it off that one while it's on another; delete everywhere asks first.
2. **Matrix** (D-204). Rows and columns are every card of a type (one plane or all), typed names or single cards;
   cells a scale of your own steps, a number or a text, with notes, `not relevant` and how sure; a reading for each
   row and column. Features × competitors is one of its templates; problems × customers, ideas × criteria and a blank
   one are the others. An axis can unfold its features into what they're judged on (their criteria, D-249): each a row
   under the feature, scored like any cell; a criterion nobody meets is `◇ open` (the white space). Made in a short
   wizard (start from, rows, columns, cells, with a preview); its heads look like the cards they are (D-212).
3. **Table** (D-209). The first *lens*: rows are the cards that meet its rules (plane, type, status, tag, words in the
   title; is or is not) plus cards and names added by hand; columns are the cards' own fields and columns of its own
   (a scale, a number, a text, a check), sorted by any, widths dragged (D-224), paged (D-213).
   A matrix or a table moved to a plane's edge **sticks** there: it moves with the plane and shows that plane's cards
   (D-210, D-215); in the plane's focus it opens **beside** the plane, the screen split (D-211).
4. **Documents** (D-232, [specs/documents.md](specs/documents.md)). A list of the workspace's documents (a table or a
   shelf of sheets) and a piece showing one document; old research reports were moved here.
5. **Kanban** (D-251) and **timeline** (D-262): see §6.
6. **Finder** (D-236). ⌘F or the side nav's compass: the places (planes, headings, sections, the project title) and
   anything typed, with a preview of where you'll land.
7. **Settings.** You (account, display) and the workspace (general, people, export) (D-064, D-097, D-246).

**1.0's pages** (D-177, D-248; code deleted, in git at `493bf87`): one board (Board, Flow, Table, Matrix tabs, D-040,
[specs/board.md](specs/board.md)), Focus (one card's chain, D-127), Priorities (D-138; back as a kanban, D-271),
Overview (D-144), Reports (D-090, D-103; now documents), the assistant (D-074–D-134) and a built-in example workspace
(D-052). They come back one by one as pieces, or not.

## 5. Key flows

1. Brain-dump: put cards on a plane quickly (Enter makes one, Tab the next, D-250)
2. Structure: link, tag, name areas with headings and sections, group cards into packages
3. Research: add competitors and break their products into features
4. Link: ideas ↔ problems and competitors
5. Plan: add features, link them to the ideas they come from, match them to competitors' features
6. Compare: fill in a matrix; prioritise on a kanban holding cards (D-271)
7. Decide: use gaps and differences to pick what to build
8. Collaborate: invite people, see live cursors, follow someone, comment, give tasks

## 6. Feature scope

### In scope (confirmed by user)
- **Real-time collaboration**: live cursors, presence (who is here), live edits
- **Authentication**
- **AI assist with BYOK** (bring your own OpenAI key, or a workspace key, D-079): 1.0's assistant (chat, proposals,
  deep research) is deleted with 1.0 (D-248); it comes back as a piece. Its server side waits for Blaze.
- **Settings** in a modal: account, display, the workspace's name, people and export
- **Export / Import** of a workspace (`.zip` bundle, D-246)
- **Files**: `.md` documents now; images and PDFs as documents once Storage is live (D-232). Drawings are uploaded as
  files, no built-in sketch pad
- **Comments and mentions** on any component (D-193)
- **Web only**

- **Kanban** (D-251, [specs/kanban.md](specs/kanban.md)): the team's tasks in columns (`todo · doing · done` to start);
  a task has a title, who it's given to, a due day, the card it's for, a checklist and notes. A card's panel lists its
  tasks, and a finished test logs evidence (D-254); stuck to a plane it shows that plane's tasks (D-255); filters,
  labels, priorities, limits, lanes (D-256, D-258); others' picks and drags shown, tasks given to you counted by your
  square (D-260, D-261).
- **Cards on a kanban** (D-268, D-269, [specs/priorities.md](specs/priorities.md)): a kanban can hold cards instead,
  its columns (and rows) a field's values (status, impact, effort, priority), so a drag sets the field. The
  `priorities` template (D-271): features and packages on effort × impact, the corners named, and beside it the
  suggested order impact × confidence ÷ effort; confidence is the share of what a card rests on that's validated or
  being tested, broken by anything invalidated.
- **Timeline** (D-262, D-289, D-304): the linked kanban's tasks (else every kanban's) on a strip of days that moves on sideways without end, at a scale you pick (day, week, month, quarter); a task runs from its first day to its due day, dragged to move it or (picked) by its edges; a drawn `+` makes one; stuck to a kanban, beside it; unframes like the others.

### Later / nice to have
- Templates (Lean Canvas, SWOT, positioning map)
- Version history / snapshots
- Export to PDF, PNG or CSV (matrix)

See [ROADMAP.md](ROADMAP.md) for phasing and [../memory-bank/open-questions.md](../memory-bank/open-questions.md)
for unresolved items.
