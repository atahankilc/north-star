# Spec: domains, customers, problems and one board (Phase 2b)

Status: **accepted** (D-039 to D-045, was Q-015). Replaces the per-type tabs from the Phase 2 checkpoint (D-036).
Examples below ("dev tools", "home fitness") are placeholders: North Star is for any kind of startup, B2B or B2C (D-043).

## 1. Why

Founders think in a chain: **who it's for → what hurts → how they cope today → our answer → what we'll build**,
inside a domain. The checkpoint split that chain across four tabs. Here, everything is in one place and the views are just
different ways of drawing it.

## 2. Items

| Item | Lives in | Key fields | New? |
|---|---|---|---|
| **Domain** | workspace | name, colour, description | new |
| **Customer** | one or more domains | title (any breadth: "SMEs", "solo game devs", "hospital buyers"), notes, position | new (D-042, D-044) |
| **Problem** | one domain | title, notes, position | new (D-041) |
| **Idea** | one domain | title, notes, tags, position | + domain |
| **Competitor** | one or more domains | name, URL, pricing, audience, notes, position | + domains, position |
| **Competitor feature** | its competitor | name, description, category | unchanged |
| **Feature** (ours) | one or more domains | title, notes, priority, status, effort, position | + domains |

- **Customers are the segments** (D-044). There is no fixed segment list: the user creates customers at whatever breadth
  they think in. A customer is a card on the board like any other item.
- **Tagging an item with a customer** creates a `for` link (item → customer). It is a real edge (Flow, Table and filters use it),
  but the board draws it as a **label on the item's card**, not a line. Selecting a customer card highlights everything
  tagged with it and shows those `for` lines while it stays selected.
- Anything can link to anything (unchanged). Typical links: idea → solves → problem; competitor → competes with → problem or idea;
  feature → inspired by → idea or competitor feature.
- New link kinds: `for` (anything → customer), `solves`, `competes-with`.
- Items with no domain yet (everything made before this change) show under **all** with an "unsorted" mark,
  until you give them a domain.

## 3. Layout

```
# north-star / workspaces / acme / [all] dev tools  home fitness  + domain          invite ABCD-1234
──────────────────────────────────────────────────────────────────────────────────────────────────
 show: [customers] [problems] [ideas] [competitors] [features]     for: any  SMEs  solo game devs

                       ( the current view: board, flow, table or matrix )

[ + CUSTOMER ] [ + PROBLEM ] [ + IDEA ] [ + COMPETITOR ] [ + FEATURE ]  view: [board] flow  table  matrix
```

- **Domain tabs** sit in the HUD breadcrumb (they replace today's view tabs). `all` shows every domain.
  Domains can be renamed and deleted from the tab; deleting a domain moves its items to unsorted (it doesn't delete them).
- **Filters** (top-left, under the HUD) toggle item types, and `for:` narrows to items tagged with the chosen customers
  (the customer cards themselves stay visible). They apply to every view and are remembered per workspace.
- **View switcher** (bottom-right). The **board** is the default.
- New items go into the current domain tab. On `all`, they start unsorted.

## 4. Views

### Board (main)
The free 3D canvas from Phase 1, now with every type on it. Each type has its own card shape, so it reads at a glance:

```
 CUSTOMER          PROBLEM             IDEA (post-it)      COMPETITOR           FEATURE
 ╭──────────╮     ┌▓▓▓▓▓▓▓▓▓▓▓┐       ┌───────────┐       ╔══════════════╗    ┌───────────┐
 │@ solo     │     │! builds    │       │cloud build │       ║ Acme CI      ║    │◆ cache    │
 │  game devs│     │  take 40min│       │cache       │       ║ acme.dev     ║    │  sharing  │
 ╰──────────╯     │[solo game…]│       │[solo game…]│       ║ 12 features  ║    │P1 planned │
                   └────────────┘       └───────────┘       ╚══════════════╝    └───────────┘
 rounded, @ mark   magenta band        accent strip         wide, double rim    diamond mark
```

`[solo game…]` is a customer label (a `for` link drawn as a chip).

- Same interactions as today: drag to move, shift+drag to link, double-click for a new item (the type follows the last
  `+` button used), side panel to edit. The panel has a "for" picker to tag customers.
- A competitor's panel is today's profile: details plus its features grouped by category. Their features don't get
  cards on the board, to keep it calm. They're listed in the panel and can still be linked.
- Each item has one position, shared by every tab. A domain tab just hides what isn't in it.

### Flow
Drawn by the app. Columns follow the chain (D-045), the links decide the rows. Nothing to drag. It shows what's missing.

```
CUSTOMERS        PROBLEMS              COMPETITORS          IDEAS               FEATURES
solo game devs ─ builds take 40 min ─┬─ Acme CI ──────────── cloud build cache ─ cache sharing
                                      └─ BuildKite ─┘
SMEs           ─ no one owns QA ────── (none researched) ── (no idea yet)       (none)
```

Competitors come before ideas, so the gap is visible before the answer. Clicking an item opens the same side panel.
An item with no links on one side ends in a faint `(none yet)`.

### Table
A spreadsheet of everything the filters let through, grouped by domain:

```
TYPE        NAME                  DOMAIN      FOR              LINKED TO                         PRI  STATUS
customer    solo game devs        dev tools   —                1 problem · 2 ideas
problem     builds take 40 min    dev tools   solo game devs   1 idea · 2 competitors
idea        cloud build cache     dev tools   solo game devs   solves: builds take 40 min
competitor  Acme CI               dev tools   SMEs             12 features · competes: 1 problem
feature     cache sharing         dev tools   —                inspired by: cloud build cache    P1   planned
```

Cells are editable inline (name, domain, for, priority, status). Click a column header to sort. Clicking the type icon opens the side panel.

### Matrix
As built at the checkpoint (features × competitors), filtered by the domain tab.

## 5. Data and rules

- New collections: `domains/{id}` (name, color, description), `problems/{id}` and `customers/{id}` (board card fields + domain).
- Single-domain items (problems, ideas): `domainId` (string or null). Multi-domain items (customers, competitors, features): `domainIds[]`.
- Competitors: + `x, y`.
- Customer tags are `edges` with `kind: 'for'` and `toType: 'customer'`. No segment fields on items.
- Rules: shape checks for the new collections and fields; tests for each.
- Deleting a domain clears `domainId` / removes the id from `domainIds` on its items (batched, like other cascades).
- Deleting a customer deletes its edges (as for any node), which removes its labels.

## 6. Build order
1. Domains, tabs and filters; customer and problem items; every type on the board (competitor cards with the profile panel); `for` labels
2. Table view
3. Flow view
4. Matrix follows the domain tab; remove the checkpoint's separate features and competitors pages
