# Spec: domains, problems and one board (Phase 2b)

Status: **draft for review** (D-039 to D-041, Q-015). Replaces the per-type tabs from the Phase 2 checkpoint (D-036).

## 1. Why

Founders think in a chain: **domain → problem → idea → who it's for → who already competes → what we'll build**.
The checkpoint split that chain across four tabs. Here, everything is in one place and the views are just
different ways of drawing it.

## 2. Items

| Item | Lives in | Key fields | New? |
|---|---|---|---|
| **Domain** | workspace | name, colour, description | new |
| **Problem** | one domain | title, notes, customer segments, position | new |
| **Idea** | one domain | title, notes, tags, customer segments, position | + domain, segments |
| **Competitor** | one or more domains | name, URL, pricing, audience, notes, customer segments, position | + domains, segments, position |
| **Competitor feature** | its competitor | name, description, category | unchanged |
| **Feature** (ours) | one or more domains | title, notes, priority, status, effort, position | + domains |

- **Customer segments** are a fixed set: `start-ups · scale-ups · SMEs · enterprises`. Pick any number.
- Anything can link to anything (unchanged). Typical links: idea → solves → problem; competitor → competes on → problem or idea;
  feature → inspired by → idea or competitor feature.
- New link kinds: `solves`, `competes-with`.
- Items with no domain yet (everything made before this change) show under **all** with an "unsorted" mark,
  until you give them a domain.

## 3. Layout

```
# north-star / workspaces / acme / [all] pet care  fintech  + domain                invite ABCD-1234
──────────────────────────────────────────────────────────────────────────────────────────────────
 show: [problems] [ideas] [competitors] [features]   for: start-ups  scale-ups  SMEs  enterprises

                       ( the current view: board, flow, table or matrix )

[ + PROBLEM ] [ + IDEA ] [ + COMPETITOR ] [ + FEATURE ]               view: [board] flow  table  matrix
```

- **Domain tabs** sit in the HUD breadcrumb (they replace today's view tabs). `all` shows every domain.
  Domains can be renamed and deleted from the tab; deleting a domain moves its items to unsorted (it doesn't delete them).
- **Filters** (top-left, under the HUD) toggle item types and customer segments. They apply to every view and are remembered per workspace.
- **View switcher** (bottom-right). The **board** is the default.
- New items go into the current domain tab. On `all`, they start unsorted.

## 4. Views

### Board (main)
The free 3D canvas from Phase 1, now with every type on it. Each type has its own card shape, so it reads at a glance:

```
 PROBLEM                IDEA (post-it)        COMPETITOR             FEATURE
┌▓▓▓▓▓▓▓▓▓▓▓▓┐        ┌────────────┐        ╔════════════════╗     ┌────────────┐
│! no-shows   │        │sitter       │        ║ Rover          ║     │◆ verified   │
│  cost money │        │matching     │        ║ rover.com      ║     │  sitters    │
│SMEs         │        │#trust       │        ║ 12 features    ║     │P1 · planned │
└─────────────┘        └────────────┘        ╚════════════════╝     └────────────┘
 magenta band           accent strip           wide, double rim       diamond mark
```

- Same interactions as today: drag to move, shift+drag to link, double-click for a new item (the type follows the last
  `+` button used), side panel to edit.
- A competitor's panel is today's profile: details plus its features grouped by category. Their features don't get
  cards on the board, to keep it calm. They're listed in the panel and can still be linked.
- Each item has one position, shared by every tab. A domain tab just hides what isn't in it.

### Flow
Drawn by the app. Columns follow the chain, and the links decide the rows. Nothing to drag. It shows what's missing.

```
PROBLEMS              IDEAS                COMPETITORS        FEATURES
no-shows cost money ─ deposit at booking ─┬─ Rover ─────────┬─ verified sitters
  SMEs                  SMEs               └─ Wag ───────────┘
vets are hard to     ─ vet chat ────────── Vetster ───────── 24/7 chat
  reach · start-ups      start-ups
lonely pets          ─ (no idea yet)       (none researched)  (none)
```

Clicking a row item opens the same side panel. An item with no links on one side ends in a faint `(none yet)`.

### Table
A spreadsheet of everything the filters let through, grouped by domain:

```
TYPE        NAME                  DOMAIN     FOR        LINKED TO                        PRI  STATUS
problem     no-shows cost money   pet care   SMEs       2 ideas · 1 competitor
idea        deposit at booking    pet care   SMEs       solves: no-shows · Rover, Wag
competitor  Rover                 pet care   SMEs, ent  12 features · competes: 2 ideas
feature     verified sitters      pet care   —          inspired by: deposit at booking  P1   planned
```

Cells are editable inline (name, domain, segments, priority, status). Click a column header to sort. Clicking the type icon opens the side panel.

### Matrix
As built at the checkpoint (features × competitors), filtered by the domain tab.

## 5. Data and rules

- New collections: `domains/{id}` (name, color, description), `problems/{id}` (card fields + `domainId`, `segments[]`).
- Ideas: + `domainId?`, `segments[]`. Features and competitors: + `domainIds[]`, `segments[]` (competitors), `x, y` (competitors).
- Rules: shape checks for the new collections and fields; tests for each.
- Deleting a domain clears `domainId` / removes the id from `domainIds` on its items (batched, like other cascades).

## 6. Build order
1. Domains, tabs and filters; problem items; every type on the board (competitor cards with the profile panel)
2. Table view
3. Flow view
4. Matrix follows the domain tab; remove the checkpoint's separate features and competitors pages

## 7. Open points (for review)
- **Segments:** is the set right? Should there be a `consumers` (B2C) segment as well?
- **Customer as an item:** should customers ever be their own items (like personas), or are segments enough for now? Recommendation: segments for now.
- **Flow columns:** Problems → Ideas → Competitors → Features. Is that the order you think in?
