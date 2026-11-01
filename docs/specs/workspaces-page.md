# The workspaces page (D-338)

The page after sign-in (`/workspaces`). Its job is to take you back to work: the workspace you left, what happened
there, what needs you. Making, joining and importing are rarer and live in the same prompt. Chosen from
[workspaces-preview/](workspaces-preview/) (option E: D's page, B's prompt, the old big title), centred.

## 1. Layout (top to bottom, `--page-w`, centred)

```
Workspaces 05                                        ← hero title, count magenta mono
> find, start a new one, or paste an invite code…    ← PromptField, the page's first line
┌ 01 CONTINUE · OWNER ─────────────────────────────┐
│ [picture of its first canvas] │ Pazar             │
│                               │ its description   │
│                               │ SINCE YOU LEFT·2H │  ← only when something changed
│                               │ Ayşe · 4 cards…   │
│                               │ 3 people · 1 here now     ⋯ │  ← the piece itself opens it
└──────────────────────────────────────────────────┘
┌ FOR YOU ──┐ ┌ ASKING ───┐ ┌ INVITED ──┐ ┌ WAITING ─┐   ← only the ones that apply
OTHERS ─────────────────────────────────── 04
┌02 EDITOR┐ ┌03 OWNER┐ … ┌IMPORT┐                         ← picture, name, people, here, new, last visit, ⋯;
                                                             the import piece last once the start row is gone
START ANOTHER ───────                                      ← only while you have one (D-345)
┌ NEW ┐ ┌ JOIN ┐ ┌ IMPORT [choose file] ┐
```

- **Typed**: the body gives way (cell by cell) to ledger rows: `01 Name` (the match lit cyan), new-for-you, people,
  role, last visit, under it the since-you-left line; then always `+ new workspace "…"` (also when you have one by that
  name: two ideas may share a name; the match stays first, so ↵ opens it), and `ask to join ABCD-EFGH` beside it when
  it could be a code (four and four of the codes' letters, no 0 O 1 I L): first when typed with its dash, else after
  `+ new` (an 8-letter name stays a name). ↑↓ pick, ↵ goes, ⌘↵ opens in a new tab,
  Tab on `+ new` asks what you're building first, Escape empties it; none of it written on the page. Cleared, the body comes back.
- **Typing anywhere** on the page (not in a field, no window open) types into the prompt.
- **A `.zip` dropped anywhere** imports it (a cyan dashed frame says so while dragging).
- **First visit** (no workspaces): `Workspaces 00`, the placeholder `name your first workspace, or paste an invite
  code…`; a `01 START` piece: a sample canvas of shapes only (a heading and its fading rule, a plane with its grid and
  card shapes, a deck's columns, a table's rows; bands in kind colours, no words), `Your first workspace`, one line on
  what a workspace is, `HOW IT STARTS` 1–3; then the three ways in. No buttons that only move the focus to the prompt;
  `choose file` stays (it opens the picker).
- **A workspace's menu** (`⋯` on the continue piece, right-click on any piece or row): the prompt menu (D-222) with
  open, open in a new tab, rename (owners, editors), copy invite code (owners), leave (anyone but the last owner),
  delete (owners, through the hazard confirm). Rename and new workspace open a Window: name (≤ 80) and, for new, "what
  are you building" (the description, D-082).

## 2. Pieces

As on the canvas (D-263, D-266, D-265): graphite, a 2 px band (cyan on the continue piece, the kind's colour on the
needs-you pieces: tasks yellow, asking magenta, invited cyan, waiting the line; new magenta, join cyan, import blue),
the name cut into the top edge in mono caps with a magenta number, Marks on hover (far, dim) and on the keyboard's pick
(close, cyan). No lift, no `┌`, no dashed boxes. Everything enters cell by cell (`Appear`).

## 3. Data

| What | Where | Reads per page open |
|---|---|---|
| Your workspaces | `workspaces` where `memberIds` has you (as before) | N |
| Your last visit, tasks seen | `workspaces/{wid}/threadReads/{you}` (`visited`, `tasks`) | N |
| The picture | `workspaces/{wid}/summary/main` | N |
| Since you left | `changes` where `at > visited`, newest first: 20 on the continue piece, 5 on others; others' only | ≤ 20 + 5N |
| New for you | `tasks` where `assignee == you`, counted with `givenAt > tasks`, `givenBy != you` | your tasks |
| Asking to join | `joinRequests` where `workspaceId` (owners only, as before) | requests |
| Here now | RTDB `presence/{wid}`: members only (D-317), not away (D-331) | — |
| Names in since-you-left | `members/{uid}` for the people in it (the continue piece only) | ≤ a few |

**`threadReads/{uid}.visited`** (number, ms): written when the workspace opens and again when you leave it (unmount,
hidden tab), at most once a minute. The page orders by it, newest first; never visited → `createdAt`.

**`summary/main`** (one doc per workspace, only that id):

```
{ by: uid, at: ms, n: cards on the first canvas's planes,
  pieces: "k x y w h;…"   ≤ 60 pieces of the first canvas; k one letter (p plane, m matrix, t table, d documents,
                           o document, k kanban, l timeline); x y w h integers 0–1000 in the pieces' bounding box
  cards:  "i t x y;…"     ≤ 300 cards on those planes; i the piece's index in `pieces`, t one letter (c customer,
                           p problem, r competitor, i idea, f feature, k package), x y integers 0–100 in the plane }
```

Numbers and letters only (`[a-z0-9 ;]`), never a title. Written by an editor's or owner's browser from what it has
loaded (src/model/summary.ts makes it, src/data/summary.ts writes it): when the string differs from the last written,
at most every 5 minutes, and once on leaving. Viewers don't write it. Rules: members read; owners and editors write
`main` with exactly these keys, `by` themselves, `at` near now, the strings capped and matching; owners delete (the
workspace's cascade). Not exported (it is made again on the next visit).

## 4. Onboarding

`workspaces-empty` v2: its three choices are the page's three ways in, drawn by the coach in the start row's box
(`data-learn="workspaces-empty"`), their words the page's: `new` (type its name in the line above), `join` (paste the
code above), `import` (a .zip someone exported; the picker). `join-pending` anchors the waiting piece
(`data-learn="pending-row"`). No release entry yet: the first `what's new` would open for everyone (the user's call,
as for D-330).

## 5. Not yet

- The summary of a canvas other than the first; a picture made of a big canvas's text.
- Since-you-left lines that name what changed (the log has no text, D-312).

## 6. After the first look (the user, 2026-11-01)
- No `continue` button: the piece opens it. Since-you-left only when something changed. No key hints on the page at
  all (the placeholder says what the prompt does; keys are onboarding's to teach). Every piece has its `⋯` (right-click is not known to everyone), no frame
  round it. The import piece ends the others. The backdrop shaded only under what's read (title, prompt, rules), not
  under the whole column. A picture's drawing clipped to each piece, its margin clear of the cut-in name.
- Two kinds of card, one system: a **workspace card** (a picture over a strip: name, facts, `⋯`; the import card at the
  end of the others is one too, its picture `DROP A .ZIP`, its strip `choose file`), and an **info card** (name cut in,
  a title, one line, its actions in the bottom-right corner: needs-you, the three ways in). An empty or not yet
  pictured workspace's picture is the made-up canvas, faint. The import card's words the same everywhere.
