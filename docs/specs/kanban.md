# Spec: the kanban, step by step

Status: **v1 built (D-251)**. This file is the plan for what comes next, split into sessions. The user checks each
session's work, then starts a new one with a fresh context ("reset"). So every session must be able to start from this
file alone.

## How to run a session

1. Read this file, then `memory-bank/state.md`. The first session below that is not marked **done** is yours.
2. Check `git status` and `ListAgents` first: other sessions work on this repo too. Tell them which files you'll touch.
3. Do only that session's scope. If you find something else, add it to "Found along the way" at the bottom.
4. Before you finish: verify it in headless Chrome on the emulators (see state.md's notes), run `npm run test:rules`
   (or `node tests/rules.test.mjs` if the emulators are already running) after any rules change, then `npm run build`.
5. Write the decision (`D-xxx`, next free number) in `memory-bank/decisions-log.md` and `decisions.md`, mark the session
   **done** here with its D-number and date, and update state.md. Then `npm run check:memory`.
6. Commit only your own files and hunks. Deploy rules only if the session changed them (Storage is not set up yet:
   `npx firebase deploy --only firestore:rules,firestore:indexes,database --project north-star-db`).
7. Tell the user, in plain words, what to look at to check the session.

What v1 has (D-251): a canvas piece, columns on the piece (`todo · doing · done`), tasks in `tasks/{id}` (title, given
to, due day, the card it's for, checklist, notes), drag between columns, `+ task` at a column's foot, a right panel.
Code: `src/data/tasks.ts`, `src/views/workspace/Kanban.tsx`, `TaskPanel.tsx`.

The user picked these ideas (2026-10-26): 1, 2, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16. Not picked: the assistant
writing tasks (3) and full keyboard use (7). Don't build those unless asked.

---

## Session 1: a new look (the user: "kanbanın UI'ı iğrenç gözüküyor") · **done (D-252, 2026-10-26)**

Picked: A, the ledger (decisions-log D-252 has the details).

**Why:** v1 is boxes in boxes: a frame round every column, tall grey cards with empty space, dashed `+ task` boxes
everywhere, small heads. It doesn't look like the rest of North Star.

**Scope:**
- Show 2–3 options on a local preview page (never an artifact), each with its list of detail choices: column heads,
  how a column is marked (or not), the task card, its meta line, `+ task`, the finished column, overdue, empty column,
  the drop slot, hover and selection, long titles, many tasks. At least one bold option from North Star's own language
  (the `+` grid, terminal lines, corner marks, ASCII).
- The user picks; build that one. Cards may grow with their content (no fixed 84 px); keep drag right.
- Light theme and reduced motion checked.

**Done when:** the user likes it.

## Session 2: tasks and cards, both ways (ideas 1, 2) · **done (D-254, 2026-10-27)**

- A card's right panel gets a `tasks` section: the tasks for this card (which kanban, which column, done or not), `+ task`
  (pick the kanban, it goes in its first column), a row opens the task's panel.
- A card shows how many tasks it has, small, on its facts line (`☐ 2/5`).
- Validation tasks (2): on a customer, problem or idea still `hypothesis` or `testing`, the panel offers `+ test it`
  (a task named "Test: <title>"). When a task for such a card goes into the finished column, offer to log evidence on
  the card (the D-137 form, prefilled with the task's title and notes).
- Deleting a card leaves its tasks; they say "its card is gone" (v1 already does).

Built (D-254): "still being tested" counts an unset status too; the offer is a cyan `+ log what it taught` on the
finished sheet and a `learned` section in its panel (`[not now]` stops it; tasks keep `learned`); the task panel now
opens in a plane's focus too.

## Session 3: a kanban stuck to a plane (idea 4)

- A kanban moved near a plane's edge sticks like a table (D-210, D-215): `stuckTo`, the link dropdown in its console.
- Stuck, it shows only tasks whose card is on that plane, plus tasks with no card (a switch in its dock: `this plane only`).
- It opens beside the plane in the plane's focus (D-211), and a task picked there glides the plane to its card.
- Rules: `stuckTo` allowed on kanbans.

## Session 4: filters, labels and priority, WIP limits (ideas 5, 10, 9)

- A filter strip in the dock, the plane filter's look (D-233): `GIVEN TO ▾  DUE ▾  FOR ▾  LABEL ▾`. Given to: me,
  someone, nobody. Due: past, today, this week, none. For: a card type or a card. Kept per kanban, per browser.
- Labels on tasks (`#tags` as on cards, D-056) and a priority (`P1`–`P3`), shown on the card; set in the panel.
- A WIP limit per column (set from the head's tools): `DOING 4/3` in magenta when over.
- Rules: `labels`, `priority` on tasks; `limit` on columns.

## Session 5: swimlanes and multi-select (ideas 6, 8)

- Swimlanes: rows by who it's given to, or by the card it's for, or none (a choice in the dock). Each lane folds.
  Dragging into a lane changes the task's person or card.
- Multi-select: shift+click, alt+drag a box; drag them together; the panel turns into `N selected` (move to column,
  give to, set due, delete).

## Session 6: working together (ideas 11, 12)

- Others see the task you've selected (corner marks in your colour, D-191) and a task being dragged (its ghost in their
  colour, sent like cursors, D-169). A follower takes your selection.
- Comments on tasks: right-click → `comment`, a chip on the card, the threads panel lists them (D-192/D-193).
  `THREAD_TARGETS` gets `task`; rules follow.

## Session 7: "given to me" and the finder (ideas 13, 16)

- Tasks given to you show as a count by your square bottom left (like `@` mentions, D-166): new since you last looked.
  A click lists them (kanban, column, due); a row goes there. Read marks per person.
- The finder (⌘F, D-236) finds tasks by title, notes and checklist text; Enter goes into the kanban's focus with the task
  picked.

## Session 8: time (ideas 14, 15)

- A "soon" band over the columns: tasks past due, due today, this week, in that order (click goes to the task). Folds.
- A timeline lens: a new piece (`+ → timeline`) or a view switch on the kanban (ask the user which): the same tasks
  on a day axis, by due day; drag to change the day.

---

## Found along the way

- Open on the canvas (unframed), a kanban's size is its window's, not measured from what it holds.
- The assistant's brief doesn't list tasks (not picked: idea 3).
- Priorities will be this kanban holding cards, columns and rows from their fields ([priorities.md](priorities.md)).
  Session 5's swimlanes: build them as "rows by a field" so cards can use them too.
