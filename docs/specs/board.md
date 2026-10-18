# Spec: one board (Phase 2b)

Status: **built**. Decisions D-040 to D-052. Domains (D-039) and groups (D-047) were tried and removed (D-048, D-049).
North Star is for any kind of startup, B2B or B2C (D-043). The built-in example workspace (D-052) shows every part of this spec filled in.

## 1. Why

Founders think in a chain: **who it's for → what hurts → how they cope today → our answer → what we'll build**.
Everything lives on one board; the other views are different ways of drawing the same items and links.

## 2. Items

Every card is the same flat rectangle (D-055). Its **left border and a small label at the top are in the type's colour**;
nothing else on the board uses those colours. Within a type, **tags** group cards (D-056): white `#chips` on the card,
a `TAG ▾` filter, and a tags column in Table.

| Item | Key fields | Type colour |
|---|---|---|
| **Customer** | title (any breadth: "SMEs", "solo game devs"), notes, tags | green |
| **Problem** | title, notes, tags | magenta |
| **Competitor** | name, URL, pricing, audience, description, notes, tags; its features by category | yellow |
| **Idea** | title, notes, tags | white |
| **Feature** (ours) | title, notes, tags, priority, status, effort | cyan |
| **Competitor feature** | name, description, category | no card: listed in its competitor's panel |
| **Text label** (D-050) | text | large text on the board, no card |
| **Project title** (D-118) | the workspace's name and description | one block per board, framed by corner brackets |

Card layout, top to bottom: `TYPE` label · title (up to two lines) · `#tags` · who it's for and type facts. Notes and
descriptions live in the side panel only (D-057).

- **Competitor features** (D-058) wait behind their competitor as a stack (up to three plates peek out). Selecting the
  competitor fans them out to the right as compressed cards; clicking one opens it unfolded in the competitor's panel, and
  shift+dragging a card onto one links to it (`inspired by`). Links to them show while they're fanned out.
- **Links** (D-059) run straight from edge to edge with an arrowhead, so they read as sentences ("idea → solves → problem").
  The kind is written on a chip at the midpoint, with the link's own label after it. Colour by meaning (D-108): violet
  solves / part of, salmon competes / contradicts, sand inspired by / depends on, grey relates / for; the pattern tells
  kinds apart within a colour. Hovering a card (or selecting cards) dims every link that doesn't touch it.
  Click a link to select it: a bar under it changes its kind, gives it a label, turns it around, removes it (Delete too).
  The `LINKS` filter hides groups of links and doubles as the colour key.
- **Linking:** drag from the `○` handle on a hovered card's right edge, or shift+drag the card, onto another card.
- **Selecting several** (D-108): shift+click adds or removes a card or text; alt+drag on empty board draws a box (shift
  keeps what was selected). Drag any of them to move all, one undo step. The panel shows what's selected, tags shared by all
  (add or remove on all), duplicate and delete. ⌘C / ⌘V copy and paste (paste lands at the view's centre, keeping the
  layout, the links among them and customer tags), ⌘D duplicates just below.
- **Lining up** (D-124): the panel's `line up` rows align the selection's left edges, centres, right edges (top, middle,
  bottom; text by its centre, like the guides) or space three or more out evenly between the outermost two (equal gaps).
  The arrow keys nudge whatever is selected, one or many, by the snap step (0.25), shift by a whole unit; a run of
  nudges is one undo step. Each line-up is one undo step. Collaborators see the whole selection ringed, not just the last pick.
- **Text sizes** (D-108): a selected text label gets a bar with H1 (heading, the default), H2 and note (small mono), a
  colour, edit and remove.

- **Customers are the segments** (D-044): tagging an item with a customer is a `for` link, drawn as a label chip on the card
  and as a grey dashed line (D-119; the LINKS filter's `relates · for` hides it). Selecting a customer highlights everything tagged for it.
- Anything can link to anything. Typical links: idea → solves → problem; competitor → competes with → problem or idea;
  feature → inspired by → idea or a competitor's feature. Shift+drag picks a sensible link kind.
- **Text labels** name areas of the board ("COMPETITORS", "PRICING IDEAS"). Headings and subheadings are places in the
  jump list (`go to`, with a search field at the top); notes are not (D-116).
- **Project title** (D-118): one block per board, added from the `+` menu ("project title", gone once there is one). A
  small magenta north star and `PROJECT`, the workspace's name big (Geist, display tracking), a magenta lead on a hairline
  rule and what the team is building (Geist, muted, wrapped); four corner brackets frame it (grey, lit on hover, cyan when selected). The name and description are the workspace's own
  fields (Settings → general shows the same): double-click the name or the description to edit it in place (Enter or
  clicking away saves, Escape cancels, shift+Enter a new line in the description); its right-click menu has "edit name"
  and "edit description". Viewers see it but can't edit; an empty
  description shows a prompt to editors only. It drags, snaps, aligns by its edges, selects and undoes its moves like text;
  it isn't copied or duplicated; deleting it takes it off the board, never the name. It's a place in `go to`, under the name.

## 3. Layout

```
# north-star / workspaces / Tablebook   ┃BOARD┃ FLOW │ TABLE │ MATRIX                    [A Alice ⚙]
[ SHOW all ▾ ] [ FOR any ▾ ] [ TAG any ▾ ] [ GO TO ▾ ]                       (go to: board only)

                       ( the current view: board, flow, table or matrix )

[+]  drag: move · shift+drag: link · …                       (+ opens: customer, problem, competitor,
                                                                    idea, feature │ text)
```

- **Views** are tabs beside the breadcrumb, after a vertical rule: no frame (frames mean filters), the current one underlined in magenta (D-053, D-066).
- **Filters** are dropdowns (D-053): `show` (item types), `for` (customers; only the chosen customers' cards stay, D-119) and `tag` (D-056). Remembered per workspace.
- **Go to** lists every text label in reading order (top to bottom, then left to right). Choosing one, or pressing 1–9,
  glides the camera there (instant under reduced motion). Any pan or zoom of your own takes over.
- **Create**: one `+` button opens a menu of everything you can create (D-053).
- **Side panel** (D-057): `for` is a multi-select dropdown; tags use a picker (chips, type to filter existing tags, Enter adds).
  The idea panel no longer has "To feature".
- **Settings** (⚙, every signed-in page, D-054): account and sign out, the workspace's name, members and invite code,
  motion, and what's coming in later phases.
- Zoom reaches from a single card to the whole workspace (camera far plane 1000, zoom-out limit 150).

## 4. Views

### Board (main)
The free canvas. Opening a workspace frames every card and label (switching views inside it keeps your place). Drag to move, shift+drag to link, double-click for a new item of the last `+` type (text included),
side panel to edit. Text: `+ Text` or double-click (after `+ Text`) opens an input right on the board; Enter saves, Escape
cancels, empty text removes it; double-click a label to edit it, drag to move, Delete to remove.

### Flow
Columns in chain order (D-045): Customers → Problems → Competitors → Ideas → Features. One row per problem (its customers,
the competitors of it or its ideas, its ideas, and the features for any of those), then ideas without a problem, customers with
neither, and a "not linked yet" row. A link to a competitor's feature counts as a link to that competitor. Gaps read
`(none researched)`, `(no idea yet)`, etc.

### Table
Everything the filters let through, one section per type in chain order. Sortable columns: name, tags, for, linked to, priority, status.
Name, tags, customers, priority and status edit inline; the type opens the side panel.

### Matrix
Our features × competitors, coverage per cell, with a verdict per feature (gap / mixed / table stakes). Fills the page height.

## 5. Data and rules

- The workspace name in the breadcrumb is plain text; rename it in settings or on the workspaces page.
- Card `color` is retired (D-055): ignored on old cards, no longer set. Competitors gain `tags` like every other card.
- Collections: `customers`, `problems`, `ideas`, `features`, `competitors` (+ `x, y`, `tags`), `competitorFeatures`, `comparisons`,
  `edges`, `labels` (text, color, x, y).
- Customer tags are `edges` with `kind: 'for'`.
- `domains` and `groups` are retired: no new writes; still readable and deletable so old workspaces clean up.
  Old `domainId` / `domainIds` fields on items are tolerated and ignored.
