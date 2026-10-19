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
| **Competitor** | name, URL, pricing, audience, regions (D-145), description, notes, tags; its features by category | yellow |
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
  The kind is written on a chip at the midpoint; the link's own label follows it only while the link is hovered,
  selected or the selected card's (D-135). Colour by meaning (D-108): violet
  solves / part of, salmon competes / contradicts, sand inspired by / depends on, grey relates and customer tags (`for`, its own group); both hidden by default, still shown for the selected card (D-128). `competes` is its own LINKS group,
  hidden by default too: a competitor's lines show while it (or a card it competes with) is hovered or selected, and its
  card says how many it competes with (`vs 8`) (D-135); the pattern tells
  kinds apart within a colour. Hovering a card (or selecting cards) dims every link that doesn't touch it.
  Click a link to select it: a bar under it changes its kind, gives it a label, turns it around, removes it (Delete too).
  The `LINKS` filter hides groups of links and doubles as the colour key; `solves` / `part of` and `inspired by` /
  `depends on` are separate groups there, each pair in one colour (D-146).
- **Linking:** drag from the `○` handle on a hovered card's right edge, or shift+drag the card, onto another card.
- **Selecting several** (D-108): shift+click adds or removes a card or text; alt+drag on empty board draws a box (shift
  keeps what was selected). Drag any of them to move all, one undo step. The panel shows what's selected, tags shared by all
  (add or remove on all), duplicate and delete. ⌘C / ⌘V copy and paste (paste lands at the view's centre, keeping the
  layout, the links among them and customer tags), ⌘D duplicates just below.
- **Lining up** (D-124): the panel's `line up` rows align the selection's left edges, centres, right edges (top, middle,
  bottom; text by its centre, like the guides) or space three or more out evenly between the outermost two (equal gaps).
  The arrow keys nudge whatever is selected, one or many, by the snap step (0.25), shift by a whole unit; a run of
  nudges is one undo step. Each line-up is one undo step. Collaborators see the whole selection ringed, not just the last pick.
- **Text sizes** (D-108, D-130): a selected text label gets a bar with H1 (heading, the default), H2, H3 and note (small
  mono), then B / I / AA (bold, italic, capitals: the real Geist faces, each switch drawn in its own style), a
  colour, edit and remove.

- **Customers are the segments** (D-044): tagging an item with a customer is a `for` link, drawn as a label chip on the card
  and as a grey dashed line (D-119). The line is its own LINKS group, `for (customer tags)`, hidden by default; the chips stay (D-128). Selecting a customer highlights everything tagged for it.
- Anything can link to anything. Typical links: idea → solves → problem; competitor → competes with → problem or idea;
  feature → inspired by → idea or a competitor's feature. Shift+drag picks a sensible link kind.
- **Text labels** name areas of the board ("COMPETITORS", "PRICING IDEAS"). Headings and subheadings are places in the
  jump list (`go to`, with a search field at the top); notes are not (D-116).
- **Sections** (D-130): a named frame round part of the board. Drawn, never placed: `+` → section (or "section" in the
  empty board's right-click) turns the pointer into a crosshair, and a press, drag and release on the board draws the
  frame (corners on the grid while snapping, alt freely; a drag under 1 unit draws nothing; Esc cancels; the footer
  says so). A selection's right-click also has "put in a section" (round it, taking in text it would cover). What it holds is decided by position, nothing stored: cards and text whose
  centre is inside it, and smaller sections wholly inside it, so sections nest. Its name sits in a band across the top
  (set like text: H1, H2 or H3, bold, italic, capitals, from its bar; the frame's size never changes it); a faint wash marks the area. Grab the band or an edge
  to drag it with everything it holds (one undo step); the bottom-right corner resizes it (top-left stays, contents don't
  move); double-click the name or `rename` in its bar (colour, rename, remove) to rename it. Deleting it leaves its
  contents. The middle belongs to the board: clicks there reach the cards or pan. An alt+drag box selects a section
  only when it goes all round it. Sections are never copied or duplicated (a copy over the original would hold all
  of it); arrow keys and line-up move their contents with them. Named
  sections are in `go to` (framed whole, by their top edge).
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
[ SHOW all ▾ ] [ FOR any ▾ ] [ TAG any ▾ ] [ REGION any ▾ ] [ GO TO ▾ ]                       (go to: board only)

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

### Focus (D-127)
`/workspaces/<id>/focus?on=<card>`, the tab right of Board: the board showing one card's chain only, every card where it
is on the board. From the card the chain customer → problem → idea → feature is followed both ways without turning back
(an idea: its problems, their customers, the customers it is for, its features, theirs; not other ideas for the same
problem), plus competitors linked to any of its problems, ideas or features (a link to a competitor's feature counts).
No text or project block, but every section holding a card in the chain stays, drawn round those cards only (with its
nested parents), so you still see what each card is part of; they can't be moved or edited there (D-130). No creating (a new card would vanish). The card in focus has a magenta ring. Pick it in
`FOCUS │ card ▾` (search, by type), `[◎ focus]` in a card's or competitor's panel (any view; closes the panel), or a
card's right-click `◎ focus`; the tab opens on the selected card, or the last one focused. Each change frames the chain;
browser back goes to the previous card. SHOW/FOR/TAG/LINKS still apply, except the card in focus always shows.
Presence reports it as the board (same positions, so cursors and follow line up).

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
