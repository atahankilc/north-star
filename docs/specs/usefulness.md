# Spec: from research to decisions (Phase 6)

Status: **slices 1–6 and 8 built (D-133–D-138, D-144)**; slice 7 became planes and packages (D-139–D-143). Each slice gets its own D-number when it's built.

## 1. Why

Findings from examining a real workspace, BUBBLES, on 2026-10-19: 8 customers, 15 problems, 11 ideas, 19 features,
22 competitors (95 competitor features), 252 links, 145 matrix cells, 22 text labels and sections.

The workspace holds a lot of research but doesn't help anyone decide. Nearly every card's notes say "Hypothesis, not
validated demand". All 19 features are status `idea`, 11 are P1 and 17 are effort L. Nothing in it says what is true,
what matters most, or what to do next, and the app has nowhere to record that.

The chain stops at features. Real ideation goes on: **validate → prioritise → decide**.

## 2. Findings

### Board: too complicated
- 67 of the 252 links are competitor `competes with` lines (42 to features, 25 to ideas). They cross the whole board and
  make most of the tangle. They also repeat the matrix, which already says which competitor overlaps which feature.
- In focus on "Permission-Aware Context API", 16 of the 21 cards shown are competitors.
- 127 links carry a full-sentence label. Zoomed in, their chips overlap into unreadable text.
- At fit-all every card is a dot. No zoom level in between still reads.

### Matrix: "partial" says nothing
- 116 of 145 cells (80%) are `partial`. The footer says "fully covered 0/19" for every competitor.
- The notes are good (median ~290 characters), and nearly all follow one pattern: "they cover X, but Y is not
  established". The single coverage value flattens that, and the note is a click away in the side panel.
- Only 145 of 418 cells are filled: the matrix can't tell "we didn't look" from "doesn't apply".
- Many notes say "the reviewed docs do not establish": confidence in a cell isn't recorded either.

### Missing steps
- **Evidence:** no place to record what was learned (an interview, a quote, data), so nothing ever stops being a
  hypothesis. Each card says so in its notes instead of in a field.
- **Prioritisation:** priority / effort are single letters with no reason behind them, so they carry no information.
- **Decisions:** no MVP slice or "now / next / later". The "Core Retrieval Loop" section is really one, but the app
  doesn't know it.

### Smaller
- Card notes all open with boilerplate ("Report basis: … sections 2–4. Hypothesis, not validated demand"). It should be
  fields (source, status) with a badge, so notes stay short.
- "Enterprise AI Platform Organizations" is tagged on 31 items and "AI-Native Scale-Ups" on 34, so `FOR` barely narrows.

## 3. Slices

Each slice ships on its own, with its decision, docs and tests. Order is the recommended one; ask before reordering.

### Slice 1: matrix criteria and white space (built, D-133)
- Each of our features gets 3–5 **criteria**: the must-haves that define it (e.g. Retrieval Trace and Failure Workbench:
  request trace · source-to-stage diagnosis · permission checks · observed vs suspected cause · reviewable repair).
- A cell scores each criterion: `met | part | no | unknown`. The cell shows `2/5` with a small bar instead of a half
  circle. "Partial" then says *which* part.
- **White space** row per feature: the criteria no competitor meets, which is our differentiation. Shown in the matrix
  and the feature's panel.
- The note shows on hover, not only in the side panel.
- Cells without criteria keep today's coverage, so old workspaces still read.

### Slice 2: the assistant fills criteria (built, D-134)
- The assistant drafts each feature's criteria and scores the cells from the notes already written, as a proposal
  (checklist, one undo step).

### Slice 3: competitor lines off the board by default (built, D-135)
- `competes with` lines hidden by default; a competitor's card shows `vs N` (the cards it competes with; the board font has
  no ⚔), and its lines
  show only for the hovered or selected card. The `LINKS` filter still turns them all on.
- Link chips show only the kind; the label moves to hover and the link bar.

### Slice 4: matrix completeness and confidence (built, D-136)
- A cell can be `not relevant` (different from not assessed).
- Confidence per cell: `documented | inferred | guess` (`~` / `?` in the cell's corner).

### Slice 5: evidence and status (built, D-137)
- Status on customers, problems and ideas: `hypothesis → testing → validated | invalidated`, shown as a badge.
- **Evidence** (interview, quote, data, observation, link) in the card's panel, counted on the card; you set the status,
  the evidence informs it and a status it doesn't back is flagged (the user's choice, 2026-10-19).
- Possibly an **assumption** card with experiments ("Regulated mid-market will pay for traceability").

### Slice 6: real prioritisation (built, D-138)
- Impact, confidence and effort on features (confidence fed by evidence), and a 2 × 2 view.

### Slice 7: bets (replaced by planes and packages, [planes.md](planes.md))
- Group features into now / next / later or a named MVP slice, each with the riskiest assumption it depends on.

### Slice 8: overview page (built, D-144)
- A one-screen "so what" when a workspace opens: strongest and weakest-evidenced problems, the matrix's white space, the
  riskiest untested assumptions, next experiments, warnings ("11 features are P1", "a competitor linked to 6+ features").

### Later, board readability (planes cover most of it, [planes.md](planes.md))
- Past a zoom threshold, a section shows as a summary tile (name, counts per type, top titles) instead of dots.
- A "story" layout: one lane per problem (customer → problem → idea → feature).
