# The workspaces page (D-338, D-390)

The page after sign-in (`/workspaces`). Its job is to take you back to work: the workspace you left, what happened
there, what needs you. Making, joining and importing are rarer and live in the same prompt. Chosen from
[workspaces-preview/](workspaces-preview/) (option E: D's page, B's prompt, the old big title), centred.

## 1. Layout (top to bottom, `--page-w`, centred; the look is D-390's)

```
Workspaces 05                                        ← hero title, count magenta mono
> find, start a new one, or paste an invite code…                    import .zip   ← PromptField, as wide as the page
╭──────────────────────────────────────────────────╮
│ [picture of its first canvas] │ CONTINUE · OWNER  │
│                               │ Pazar             │
│                               │ its description   │
│                               │ SINCE YOU LEFT·2H │  ← only when something changed; names in their colours
│                               │ Ayşe 8 cards…     │
│                               │ (2 new tasks) (2 ask to join)   ← what waits for you in it, in words
│                               │ 3 people ● Ⓐ here now       ⋯ │  ← the card itself opens it
╰──────────────────────────────────────────────────╯
NEEDS YOU ───────────────────────────────── 04       ← one list, a row each, only the ones that apply
│ (3 new tasks) given to you…  2 in Pazar · 1 in …            open → │
│ ● 2 people ask to join Pazar                                open → │
│ ● Kitchen robots  invited you · 4 people             [join] decline │
│ ● QRST-UVWX  you asked to join                             withdraw │
OTHERS ─────────────────────────────────── 04
╭ picture │ name      role ╮ ╭ picture ╮ ╭ picture ╮   ← one that changed since you left is two columns wide:
│         │ SINCE YOU LEFT │ │ name    │ │ name    │     its picture, then who changed what; the rest small
╰─────────┴────────────────╯ ╰─────────╯ ╰─────────╯
START ANOTHER ───────                                      ← only while you have one (D-345)
╭ NEW ╮ ╭ JOIN ╮ ╭ IMPORT [choose file] ╮
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

## 2. Cards (D-390; they were drawn as the canvas's pieces until then)

Round with a line (`PieceCard`: `--radius-menu`, `--bg-raised`, no shadow, no band), Marks on hover (far, dim) and on
the keyboard's pick (close, cyan) following the round corner. A card's name, when it has one, is a mono caps label on
top inside it, in its tone (new magenta, join cyan, import blue); no number, no role cut into an edge: a workspace's
role stands beside its name. Everything enters cell by cell (`Appear`).

- **People in colour.** A name in since-you-left is in that person's colour (their own, from their id). Who's in it now:
  a cyan lamp that beats (still under reduced motion), up to three circles in their colours (`Avatar`), `here now`.
- **What waits for you, in words** (`Chip` `soft`): `2 new tasks` yellow, `2 ask to join` magenta, in the list's row
  and on the workspace's own card. Never a glyph and a number.
- **A row's buttons in ink** (inside D-384): `open →` strong, `join` the one filled, `decline` and `withdraw` magenta.
- **Nothing pictured**: faint dots. The made-up canvas is only the first visit's START.

## 3. Data

| What | Where | Reads per page open |
|---|---|---|
| Your workspaces | `workspaces` where `memberIds` has you (as before) | N |
| Your last visit, tasks seen | `workspaces/{wid}/threadReads/{you}` (`visited`, `tasks`) | N |
| The picture | `workspaces/{wid}/summary/main` | N |
| Since you left | `changes` where `at > visited`, newest first: 20 on every card (`SINCE_MAX`, D-390); others' only; a list cut at 20 ends `and more` | ≤ 20N |
| New for you | `tasks` where `assignee == you`, counted with `givenAt > tasks`, `givenBy != you` | your tasks |
| Asking to join | `joinRequests` where `workspaceId` (owners only, as before) | requests |
| Here now | RTDB `presence/{wid}`: members only (D-317), not away (D-331); each with the colour they have in it | — |
| Names in since-you-left | `members/{uid}` for the people in it, on every card that changed | ≤ a few each |

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

## 7. The round look (D-390, 2026-11-17)
What the user picked on a port preview, and what they turned down, is in D-390. Kept from §6: no `continue` button, no
key hints, a `⋯` on every card, the backdrop shaded only under what's read. Changed from §6: the import card is gone
(`import .zip` at the prompt's end; the three ways in still hold `choose file` while you have one); needs-you is a list,
not info cards; an empty workspace's picture is dots.
