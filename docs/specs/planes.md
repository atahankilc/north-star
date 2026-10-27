# Spec: planes and packages (Phase 6)

Status: **built in 1.0 (D-140–D-143), code deleted (D-248)**. 1.5's planes are a different thing: canvas pieces holding
their own cards (D-180, D-187); packages came back on them (D-239). Kept as reference. The user's idea (2026-10-19); the three open choices went with the
recommendations (D-139). Replaces slice 7 (bets) and "later, board readability"
in [usefulness.md](usefulness.md).

## 1. Why

One board holds every card at one position, so it has to be the library, the map and the plan at once. In BUBBLES that
meant 75 cards, 22 competitors in a pile and links across the whole board (usefulness.md §2). The user, 2026-10-19:

> having different planes … one plane can used to store cards like maybe customers or competitors … maybe user chooses
> to use one plane to show a mvp or a feature, from problem to idea to feature and maybe package it … use different
> planes to store individual cards and then use them across different panels instead of creating a new one all the time.

Earlier attempts split the **cards** apart: per-type boards (D-036, superseded by D-040) and domains as separate idea
spaces (D-048, removed). Planes keep **one set of cards** and split only **where you look at them**: a card exists once
(its notes, evidence, criteria, matrix cells, links) and each plane places it somewhere, or doesn't.

## 2. Concepts

- **Plane:** a named board in the workspace. Each has its own camera, sections and text. A card can sit on any number of
  planes, at a different spot on each.
- **All** (the recommended answer to Q-016): the plane every workspace has, which shows every card, like the board today.
  It can't be deleted or emptied. A card made on another plane also lands on All, at a free spot. So no card is ever lost,
  and today's boards need no migration: All *is* today's board, and positions stay where they are.
- **Library and story planes:** not different kinds, just uses. "Competitors" holds the competitors with their features;
  "MVP: retrieval loop" holds one problem → idea → features chain.
- **Placing:** a plane shows the cards placed on it. **Remove from this plane** takes a card off one plane, and is always
  safe. **Delete** removes the card from every plane, as today, with one undo step.
- **Package** (Q-017): a named set of cards (e.g. a problem, the idea that solves it, its features) that acts as one card
  elsewhere: "package + another feature → solves this other problem".

## 3. On the board

- **Switcher:** `PLANE │ All ▾` first in the filter bar. It lists the planes with their card counts, `+ new plane`, rename
  and delete. Keys `[` and `]` step through the planes. The URL is `/workspaces/<id>?plane=<pid>`, with All bare.
- **Bringing cards in:** the `+` menu gains `existing card…`, a search of every card not on this plane, by type, title or
  tag. Picking one places it in the middle of the view. A selection can also be sent from its panel or the right-click
  menu: `place on ▸ <plane>`.
- **On another plane:** a card shows a small count, `on 3 planes`, and its panel lists the planes (click to go there).
- **Links** are the workspace's, not a plane's. A plane draws a link only when both ends are on it; a card with links to
  cards not on this plane shows `+4 off-plane` on its edge, and hovering it lists them. Linking two cards on any plane
  makes the link everywhere both are.
- **Sections and text belong to their plane** (the recommended answer to Q-018). The project title block too: All has
  the workspace's; another plane may get its own from `+`, showing the plane's name.
- **New cards** made on a plane are placed on it and on All.
- **Empty plane:** "Bring cards in from `+ → existing card`, or make new ones here."

## 4. Packages (step 2)

The recommended answer to Q-017 is a new kind of card, `package`:
- It has a name, notes and members: card ids, in chain order (customers → problems → ideas → features), any number.
- Its **home plane** shows the members laid out inside a package frame (like a section, D-130, but holding cards by
  membership, not by position, so the same card can be in two packages).
- **On other planes** it is one card: `PACKAGE` label, its name, then `1 problem · 1 idea · 3 features`, plus the status
  and confidence of what it holds (D-137, D-138). It links like any card (`solves`, `depends on`, `part of`).
- **Open it** from its panel: it lists the members, and `open its plane` goes to its home plane.
- **Priorities and matrix:** a package can be rated like a feature (impact, effort; confidence from its members); this
  is where slice 7's "bets" go. The matrix keeps features only.
- **Made from a selection:** `package these` in the N-selected panel. It makes the package and a home plane holding them.

## 5. Data

Every change goes through `src/data/`, with rules in `firestore.rules` and a test each.

- `planes/{pid}`: `name`, `order`, `createdAt`, `updatedAt`. All has no doc: it is the plane id `all`.
- `placements/{pid}_{itemId}`: `planeId`, `itemId`, `itemType` (a board type or `package`), `x`, `y`. The id is fixed by
  its two ends, like matrix cells, so a card can't be placed twice on a plane. On All a card's position stays its own
  `x`/`y`: no placements, no migration.
- `labels` get `planeId?` (missing = All).
- `packages/{id}`: `name`, `body?`, `memberIds: string[]` (≤ 60), `homePlaneId`, `impact?`, `effort?`, `tags?`, `x`, `y`
  (its spot on All), timestamps. Edges accept `package` as a type.
- **Cascades:** deleting a card deletes its placements and takes it out of packages. Deleting a plane deletes its
  placements, labels and sections; its cards stay (on All). Deleting a package leaves its members.
- **Loading:** planes and placements load with the workspace (they are needed to draw the board), like edges.
- **Export / import:** `planes`, `placements`, `packages` in the bundle (missing in older ones = only All), ids remapped.
- **Presence:** `plane` beside `view` in `presence/{wid}/{uid}`. Cursors and selection rings show only for people on the
  same plane; following someone switches plane. The RTDB rule needs the field.

## 6. Other views

- **Focus** (D-127) shows the chain on All, or on the current plane when the whole chain is there.
- **Flow, Table, Matrix, Priorities, Reports** work on cards, not positions: unchanged. Later, a `PLANE` filter there
  ("only cards on MVP").
- **PNG export** draws the current plane.

## 7. The assistant

- The brief lists the planes, which cards each holds, and the packages with their members.
- `arrange_area`, `add_section` and the other layout ops take a `plane` (default: the one open).
- New ops: `add_plane`, `place` / `unplace` (cards on a plane), `add_package` / `edit_package`.
- `/organize` may propose planes for a crowded All: e.g. "Competitors", one plane per segment, one per MVP slice.

## 8. Steps

Each step ships on its own, with its D-number, docs and tests.

1. **Planes:** switcher, All, placements, `existing card…`, remove vs delete, `on N planes`, off-plane link counts,
   sections and text per plane, URL, presence per plane, export/import, rules.
2. **Packages:** the card, its home plane and frame, `package these`, links, rating in priorities.
3. **The assistant on planes:** brief, `plane` on layout ops, plane and package ops, `/organize` proposing planes.
4. **Plane filter** in Flow, Table, Matrix, Priorities.

## 9. Decided (D-139)

- **All plane:** yes (§2).
- **Packages:** a card (§4).
- **Sections and text:** per plane (§3).
