# Spec: one board (Phase 2b)

Status: **built**. Decisions D-040 to D-052. Domains (D-039) and groups (D-047) were tried and removed (D-048, D-049).
North Star is for any kind of startup, B2B or B2C (D-043). The built-in example workspace (D-052) shows every part of this spec filled in.

## 1. Why

Founders think in a chain: **who it's for → what hurts → how they cope today → our answer → what we'll build**.
Everything lives on one board; the other views are different ways of drawing the same items and links.

## 2. Items

| Item | Key fields | Card on the board (D-051) |
|---|---|---|
| **Customer** | title (any breadth: "SMEs", "solo game devs"), notes | green **pill**, `@` |
| **Problem** | title, notes | magenta, **folded top-right corner**, `!` |
| **Competitor** | name, URL, pricing, audience, description, notes; its features by category | yellow, **wide with a double rim** |
| **Idea** | title, notes, tags | neutral **post-it** with a strip along the top |
| **Feature** (ours) | title, notes, priority, status, effort | cyan **tag** (pointed ends), `◆` |
| **Competitor feature** | name, description, category | no card: listed in its competitor's panel |
| **Text label** (D-050) | text | large text on the board, no card |

- **Customers are the segments** (D-044): tagging an item with a customer is a `for` link, drawn as a label chip on the card,
  not a line. Selecting a customer highlights everything tagged for it and shows those lines.
- Anything can link to anything. Typical links: idea → solves → problem; competitor → competes with → problem or idea;
  feature → inspired by → idea or a competitor's feature. Shift+drag picks a sensible link kind.
- **Text labels** name areas of the board ("COMPETITORS", "PRICING IDEAS"). Every label is a place in the jump list.

## 3. Layout

```
# north-star / workspaces / Tablebook                                              invite ABCD-1234
 show: [customers] [problems] [competitors] [ideas] [features]     for: any  SMEs  solo game devs
 go to: CUSTOMERS  PROBLEMS  COMPETITION  OUR IDEAS  ROADMAP                (board only, 1–9 keys)

                       ( the current view: board, flow, table or matrix )

[ + CUSTOMER ] [ + PROBLEM ] [ + COMPETITOR ] [ + IDEA ] [ + FEATURE ] [ + TEXT ]   view: [board] flow table matrix
```

- **Filters** toggle item types, and `for:` narrows to items tagged with the chosen customers. Remembered per workspace.
- **Go to** lists every text label in reading order (top to bottom, then left to right). Clicking one, or pressing 1–9,
  glides the camera there (instant under reduced motion). Any pan or zoom of your own takes over.
- Zoom reaches from a single card to the whole workspace.

## 4. Views

### Board (main)
The free 3D canvas. Drag to move, shift+drag to link, double-click for a new item of the last `+` type (text included),
side panel to edit. Text: `+ Text` or double-click (after `+ Text`) opens an input right on the board; Enter saves, Escape
cancels, empty text removes it; double-click a label to edit it, drag to move, Delete to remove.

### Flow
Columns in chain order (D-045): Customers → Problems → Competitors → Ideas → Features. One row per problem (its customers,
the competitors of it or its ideas, its ideas, and the features for any of those), then ideas without a problem, customers with
neither, and a "not linked yet" row. A link to a competitor's feature counts as a link to that competitor. Gaps read
`(none researched)`, `(no idea yet)`, etc.

### Table
Everything the filters let through, one section per type in chain order. Sortable columns: name, for, linked to, priority, status.
Name, customers, priority and status edit inline; the type opens the side panel.

### Matrix
Our features × competitors, coverage per cell, with a verdict per feature (gap / mixed / table stakes).

## 5. Data and rules

- Collections: `customers`, `problems`, `ideas`, `features`, `competitors` (+ `x, y`), `competitorFeatures`, `comparisons`,
  `edges`, `labels` (text, color, x, y).
- Customer tags are `edges` with `kind: 'for'`.
- `domains` and `groups` are retired: no new writes; still readable and deletable so old workspaces clean up.
  Old `domainId` / `domainIds` fields on items are tolerated and ignored.
