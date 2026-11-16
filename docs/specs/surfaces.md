# Surfaces: round with a line, marks that take the corner, panels under the screen (D-387)

Status: **look agreed 2026-11-16 (D-387); built 2026-11-16, all eight steps.** This is the build plan for what sits on top of D-384's controls
([controls.md](controls.md)): modals, the hazard confirm, the selection marks, menus, the foot dock, the threads dock,
the side panel, Settings' inside, the toast and the tip. Cards (squircle) and pieces (square) don't change.

The demo that was approved, piece by piece, on a port: [surfaces-preview/demo.patch](surfaces-preview/demo.patch) (how
to run it: [The demo](#the-demo)). Where this text and the demo's CSS differ, this text wins: the demo is an overlay,
written fast, and its numbers aren't tokens.

## The idea

1. **A surface is round and has a line.** No shadow, no lighter ground: the page's black, a thin line round it, round
   corners. A modal, a menu, a box in Settings, a toast: the same sentence at different sizes.
2. **What rises from an edge is a tab.** The foot dock and the threads dock keep the corners that touch the floor square
   and round the two that don't.
3. **A mark takes the corner of what it marks.** A square corner keeps the L. A round corner gets a short piece of that
   curve instead. One rule, no second kind of mark.
4. **A side panel is under the main screen, not over it.** The screen is a sheet: it lifts, gets round corners and draws
   back; the panel lies bare on the ground under it.

## Each part

| Part | Today | New |
|---|---|---|
| **Modal** (Window: Dialog, WizardShell, Settings, PromptOverlay) | square, a line | round (24), the line stays, the page's black, no shadow |
| **Hazard confirm** | square box, a square band of `╱╱╱` round it | round box (24), magenta line (its top no bolder than the rest); the `╱╱╱` follow the round corner, a small gap off the box, still on the screen's cell grid, still wrapping out and running once |
| **Marks** (selection, hover, press, peers) | four L's on everything | the host's corner: square → the L as today; round → a piece of that curve as long as the L, concentric with the corner (the corner's radius plus how far out the mark is), a squircle where the host is one. Cards get the curve; pieces, text, cells, sections, notes keep the L |
| **Menu, Select's list, right-click, finder, popover** (PromptFrame, Popover) | no box, a hugging shade, L's on four corners | round (16, squircle), a line (`--line-hover`), cyan while the keyboard is in it; no L's. The hugging shade stays under it, so it still reads over a busy canvas |
| **A prompt's row** | picked: a band on its left, a wash | a pill; picked: filled with its tone's wash (22 %), no band (D-384: never a line on one side) |
| **Foot dock** (Console `foot`) and its drawer | square, L's on its top corners | a tab: top corners round (14), a line, cyan while pointed at or the keyboard is in it; no L's. Its drawer the same tab above it; while the drawer is open the rail under it is square |
| **Console on a piece** | square, L's | unchanged: a piece is square, so its console and marks are too |
| **Threads dock** | square, L's on its top corners | the same tab: top corners round (14), a line; no L's |
| **Side panel** (EdgeColumn: SidePanel, the agent's column) | over the screen, its edge a line, L's | under the screen: see [The sheet](#the-sheet) |
| **Settings' sections, Frame's boxes** | square line | the line stays, corners round (14) |
| **Settings' side list** | the current one framed | the current one a filled pill (`--wash-3`), no frame |
| **Toast** | square | a pill with a line; its action a plain Button word, no `[ ]` round it |
| **Tip** | square | round (14), a line |

## The sheet

After the "Only Panels" project's map: the main screen is a sheet lying on a ground.

- **Closed:** the screen fills the window, square, as today. Nothing shows that it's a sheet.
- **A panel opens:** the screen lifts (a shadow under it, a lit rim on its edge), its corners go round (24), it draws in
  8 px from the window's edges and back from the panel's side by the panel's width. The panel is on the ground under it:
  the ground's colour (a step off the page's black: `#121215` in the demo, `#e2e2e5` in light), no line, no L's, no
  shadow of its own. One movement, 600 ms, eased out. The panel is there at once, whole, under the sheet: the sheet's
  edge uncovers it (D-395; no cells, they were a second movement over the first). Everything on the sheet (the bar,
  the foot's tabs) travels with its edge, from the first open on; the ground never passes over the HUD's tools; the app
  narrows for the agent's column only once the sheet has drawn back over that part.
- **It closes:** the sheet comes back over the panel; the panel's contents leave with it, not before it (the demo drops
  them at once, the build must not).
- **Reduced motion:** no travel; the sheet is at once where it ends.
- **What rides the sheet:** the canvas, the HUD, the foot dock (centred on the sheet, not on the window), the threads
  dock. **What's on the ground:** the panel.
- The panel's width is still dragged (D-378): the sheet's edge follows it.

## The HUD while a column is docked (D-389)

Agreed 2026-11-16 on a port (the first build left the HUD where it was, over the sheet's edge). The user's idea: with
no panel the canvas fills the window and the HUD is on it, as always; when a panel opens and the screen lifts, **the
HUD's tools stay down on the ground**.

- **The tools on the left edge don't move** (the side nav, who's here, the threads button, you, the gear). The sheet
  draws back off them, `--sheet-rail-w` (60 px: their strip and its margins), so they're on a rail of ground beside it.
  The HUD paints that ground itself, under its tools (`.rail`); the ground layer is cut there, and the rail
  paints what that layer would in its strip, the same way: the sheet's own box in it (its edge, its gap above and
  below, its round corners, its time and ease), the ground's colour outside. A plain block up to the sheet's left edge
  let the canvas show past the sheet's line on the way (fixed 2026-11-17). The rim casts no shadow to its left (it would dim them).
- **The breadcrumb rides the sheet** (it can't fit on the rail): the bar's box is the sheet's.
- The threads dock stands clear of the sheet's round corner while it's lifted (`--sheet-round`).
- A column docked on the left covers the tools as before: no rail then.
- Shown and not taken: the HUD riding the sheet whole; a rail kept always (the canvas always a sheet); the bar staying
  too, the sheet drawing down off it.
- *Built 2026-11-16:* `useSheetRail` (the HUD's, while it has tools on the left), `--sheet-rail`, `--sheet-round`.

**The agent, closed, is a tab** (D-389): the box in the bottom-right corner is a tab rising from the sheet's foot (top
corners round, a line that goes cyan while the keyboard is in it, no foot line), the threads dock's twin; opened small
it's the same tab grown taller; as a column it's on the ground already. It stands on the sheet's foot (`--sheet-b`)
and clear of its round corner (`--sheet-round`), left of a docked column as before (`--box-inset`).
*Built 2026-11-16* in Agent.module.css only (its cyan lead on the top edge is gone: the line says it's in use). Seen in
the real app on the emulators (the agent has no gallery): closed, opened small, as a column over the backdrop with the
HUD's tools on the rail, folded back. Not seen: beside a card's panel, over a pane's dock (`--box-lift`), light.

## Consoles and threads (D-393)

Agreed 2026-11-17 on a port, built the same day.

- **A piece's console is a pill:** under the piece's bottom edge, a small gap off it (the gap is the console's too, so
  the pointer going down to it never leaves the piece), all round, a line (faint; cyan in use, magenta with something
  new). A selection's bar (text, a link) the same. Its drawer is a round box over it. The whole-edge case keeps its top
  line. No corner L's are left anywhere: `--corner-mark` is deleted, `check:kit`'s `cornerMark` has no exception.
  Shown and not taken: a tab hanging from the piece's edge; as it was.
- **The foot has three tabs of one family:** the threads on the left (past the HUD's tools), the dock in the middle,
  the agent on the right: 32 px, the same line and top corners, all travelling with the sheet. The threads' button left
  the HUD's corner: `ThreadsTool` is the left tab (a lamp while the list is open, a magenta count of what's new, `@n`
  with a mention), still drawn from the HUD's corner, fixed to the window.
- **The threads lie on the ground:** the list is a column on the left, beside the HUD's rail (which stays: sheet.ts
  keeps the rail when a left column starts past it); a conversation is a column on the right, where a thing's panel
  is, over that panel while both are open. Two `EdgeColumn`s in `AnimatePresence`; the tab with two halves over the
  canvas and its dragged height are gone. A window too narrow for the list, the least screen (`SHEET_MIN_PX`, feel.ts)
  and a conversation: the list gives way while one is open. The list's rows are round shades, the open one stronger.
- Seen in the gallery (both themes) and in the real app on the emulators: a plane's console in edit mode and under the
  pointer; the three tabs 32 px tall on one line; the list open (the sheet from 400 px), a comment started from a
  card's right-click (the conversation at the right, the agent's tab stepping aside), Escape closing the conversation,
  then the list.
- *Not yet:* the conversation as a tab of the thing's own panel (`card · thread`); a dock's drawer as a round menu
  card; panes beside as two sheets; one column with tabs when the agent's and a card's panel don't both fit.

## The threads' list and a conversation (D-398)

Picked 2026-11-17 on a port (list: now, A people first, **B by place**, C cards that speak; conversation: now, A the
thing on top, **B bubbles**), built the same day. The columns, the foot tab and their motion stay D-393's and D-395's.

- **The list has one head:** `Threads` (Inter, `--text-lg`), what it shows beside it, `mark all read` and `×`. What it
  shows is plain words (`whole workspace`) until there's something to pick: with several canvases, or opened from a
  plane's console, it's the one dropdown trigger (`whole workspace`, `on <canvas>`, `in <plane>`). The views are tabs
  right under it, their words short enough for one row: `all`, `new`, `@you`, `done`. Three strips with a line each
  became one.
- **The list is as wide as the right panel** (`--panel-w`, 400; it was 340).
- **Threads stand under the place they're on:** the kit's `Rule` (`02 PRODUCT ── 1`: the name's number magenta, the
  count at the end), the place with the newest thread first, newest first inside it. A row no longer says `on 02
  Product ↗`.
- **A row leads with the thing:** its colour a bar inside the row's left (a card's `CARD_TONE`, a piece's
  `PIECE_TONE`, else quiet), its kind as a `Label` in that colour, its name (Inter, medium; `✓` before a resolved
  one's; `what it was on was deleted` when it's gone), when at the right end. Under it one line: who wrote last (first
  name, in their colour), how it began, and the count with the comment mark. `started by …` is gone.
- **New:** a magenta lamp after the name, the name `--fg-strong` (read: `--fg-muted`), the count magenta; `@` in
  place of the comment mark when it names you.
- **A conversation's head says what it's on as a thing's panel does:** the kind in its colour and `thread · 4`, the
  tools on that row (`resolve`, `delete`, `×`; `all threads` first while the list is shut), the name big
  (`--text-lg`, wraps, never cut), then `on 02 Product ↗`, which goes there.
- **Messages are bubbles:** someone else's on the left, their `Avatar` at its foot, their name in their colour and when
  over it; yours on the right in cyan (`--mix-pick` of `--accent-cyan`), no circle and no name: the side says it's
  you. The corner by its writer is small. `edit` and `delete` show on your own under the pointer, beside its time. A
  bubble is at most 88 % of the column.
- **A person's colour** (`usePersonColor`): the one they have here now (D-067), else their own (`presenceColor`, as
  the workspaces page names them, D-390), in the theme's shade.
- **The prompt is a round well** (`--radius-well`, a line that goes cyan with the keys), `>` and `send` inside it.
- `thingOf` (CanvasView) gives a thread's kind, name, colour and whether it's gone; `titleOf` is made from it.
- *Not yet:* messages one after another by the same person as one group; the conversation as a tab of the thing's
  own panel (D-393's); touch.

## Tokens

New, in `src/styles/tokens.css` (names to settle in step 1; values from the demo):

| Token | Value | For |
|---|---|---|
| `--radius-window` | 24px | a modal, the hazard box, the sheet |
| `--radius-menu` | 16px | a menu's frame, a popover |
| `--radius-box` | 14px | a tab's top corners, a box in Settings, a tip |
| `--sheet-gap` | 8px | the sheet's inset while a panel is open |
| `--ground` | dark `#121215`, light `#e2e2e5` | what a panel lies on |
| `--sheet-lift`, `--sheet-rim` | a shadow, a 1 px rim | the lifted sheet |
| `--dur-sheet` | 550ms | the sheet's travel (motionTokens.ts too) |

`--corner-mark` and the `--mark-*` tiers stay: a curved mark is as long as the L it replaces.

## Steps

One commit each, each with its galleries; `check:tokens`, `check:kit`, `check:gallery`, `check:lessons`, unit tests and
the build green before the next.

1. **Tokens and the modal.** The radii above; `Window` round with its line; Dialog, WizardShell, Settings,
   PromptOverlay checked in both themes (a wizard's foot, Settings' side column and its inner line at the round corners).
   *Built 2026-11-16:* `--radius-window`, `--radius-menu`, `--radius-box`; Window, Settings and the onboarding's lesson
   window (its magenta corner marks gone) round. A window doesn't clip (a menu opened in it hangs past its edge), so
   Settings' side column and page round their own corners with `--window-inner`. PromptOverlay is a prompt's frame:
   step 4. The sheet's tokens come with step 6.
2. **The hazard confirm.** Round box; the tape drawn by distance to the round box (HazardConfirm.tsx), the same grow and
   run; reduced motion: the tape just there.
   *Built 2026-11-16:* the box round, one line all round (the bolder top bent at the corners); a cell is tape when its
   middle is within the band of the round box's edge, `--space-1` clear of it. The tape is drawn again when the box
   changes size: under reduced motion it was drawn once, before the box had settled, and came out short.
3. **Marks take the corner.** `Marks` reads its host's corner (`--corner`, which CardFace already sets) and takes a
   `corner` where it's drawn beside the face (PlaneCards, a deck's and a table's cards) and on `Landing`; a flat face
   says 0. The short curve, every state (hover, selected, pressed, arrive, target, peers), all three tiers, at 25 % and
   400 %. `check:kit` refuses a hand-drawn corner mark outside Marks.
   *Built 2026-11-16:* in Marks.module.css, from `--corner`: a card's face sets it and the marks drawn in it read it (a
   flat face says 0); `Marks` and `Landing` take `corner` where they're drawn beside the round thing (a plane's cards, a
   deck's gap, a timeline's bar). The mark is as big as the round corner and `clip-path` keeps the L's length of it, so
   the curve is the corner's own at every distance. A pill (a deck's `SOON` task) keeps the L for now: its corner is
   half its height, which CSS can't read. The `check:kit` rule waits for step 8, when the docked L's are gone too.
4. **Menus.** PromptFrame round with a line, cyan with the keyboard, its L's gone; PromptRow a pill, picked filled, no
   band; Menu, Select, ContextMenu, InPlaceMenu, the finder, the kind guide, Popover, PeopleHere's list checked. A menu
   in a console or dock (`plain`) too.
   *Built 2026-11-16:* PromptFrame round (`--radius-menu`, squircle), its line `--frame-line` (cyan with the keyboard),
   the hugging shade kept, its L's gone; so every prompt at once (PromptPanel, PromptOverlay's finder and guide, the
   threads' `@` list, the agent's skill menu, a matrix's pickers). PromptList steps its rows `--space-1` in from the
   line; a row is a pill, picked filled with its tone (`--mix-pick`, cyan with no tone; was a magenta band and a grey
   wash), a two-line row a box's corners. The kind guide glued to the `+` menu carries the menu's line on: the menu
   keeps its left corners, the guide takes the right ones.
5. **The foot dock and the threads dock.** Console `foot` and its drawer as tabs with a line; the whole-edge case
   (`data-full`) keeps its top line; Corners.module.css's `top` pair goes with the threads dock's L's.
   *Built 2026-11-16:* Console `foot` (not `data-full`) and its drawer: `--radius-box` on top, a line (`--tab-line`,
   cyan while pointed at, the keyboard in it or editing), no L's; the rail square under an open drawer. The threads
   dock the same; Corners' `top` pair deleted. A matrix's, table's and deck's setup panel is the dock's upper floor,
   so it's the same tab too (its own L's gone).
6. **The side panel under the screen.** The sheet (WorkspaceLayout/CanvasView's root), the ground, EdgeColumn bare on it;
   the travel in and out, reduced motion; the dock and the HUD on the sheet; the agent's column, a document beside it
   (D-382), a left column; the split with a pane beside (D-211) and the decks side view (D-300) checked, since they
   share the screen another way; the panel's drag; touch. Corners.module.css's `left`/`right` pairs go.
   *Built 2026-11-16:* nothing in the screen is laid out again (no pointer maths moves, the canvas isn't resized):
   `foundation/sheet.ts` keeps two fixed layers (Sheet.module.css): the ground's colour painted over everything
   outside the sheet's box, and the sheet's rim and shadow over the column. EdgeColumn says it's there
   (`useSheetColumn`, off as soon as it starts leaving, so the sheet comes back while the column breaks apart); the
   reach is measured from the columns, so the agent's column with a document beside it, a left column and a dragged
   width all follow. The root gets `--sheet-x0`, `--sheet-x1`, `--sheet-b`: the foot dock stays in the sheet's middle
   and on its foot, the threads dock rises with it. EdgeColumn is the ground's colour, no line; Corners.module.css is
   deleted. The travel is `--dur-slow`; reduced motion: none. Tokens: `--sheet-gap`, `--ground`, `--lift`,
   `--lift-shade`, `--sheet-rim`. Seen in the gallery only (both themes, opening and closing): the real app over the
   full backdrop, the split with a pane beside, the decks side view and touch are still to look at.
7. **Settings' inside, toast, tip.** Sections and Frame's boxes round; the side list's pill; the toast a pill, its action
   without brackets (the callers' `'[go there]'` strings too); the tip round.
   *Built 2026-11-16:* Settings' sections `--radius-box` (their foot rounds its own corners), its side list's items
   pills, the one you're on `--wash-3` (was a cyan line on its left and a cyan wash); the toast a pill with a line (the
   callers already said `go there` without brackets: only the gallery's example had them); the tip `--radius-box`;
   the people-here list round with a line, its rows pills. Frame's `dashed` and `interactive` have no users and are
   left as they are. The agent's corner box is left square: its UI has no gallery yet and is being redesigned (D-312).
8. **Sweep and docs.** What still draws a square surface or an L by hand; DESIGN.md §6; the release line in
   `src/onboarding/releases.ts`; D-359's and D-347's lines in the memory bank brought in step.
   *Built 2026-11-16:* `check:kit` refuses `var(--corner-mark)` outside Console.module.css (`cornerMark`, the kit
   too); nothing else drew one. DESIGN.md §6, decisions.md and D-387's log entry say the built look; release
   `2026-11-16`, one item, no lesson (a look, not a feature).

## To check first

- The sheet over an empty canvas's full backdrop (WebGL under a rounded, inset screen).
- The ground's colour in light, beside a white piece.
- A menu's round line where its rows scroll: nothing square shows in the corners.
- A short curve on the smallest tier, on a card far out: it must still read as a corner, not a dot.

## What this leaves out

Cards, pieces, consoles on pieces and everything else on the canvas; the controls (D-384). A dropdown's corner that
touches its trigger staying square, a floating dock, a floating threads box, marks as a full corner, a striped band or a
glow for the hazard confirm were shown and not taken.

## The demo

`git worktree add --detach <dir> d1d01e3`, `git apply docs/specs/surfaces-preview/demo.patch` in it, link the repo's
`node_modules`, `VITE_USE_EMULATORS=true npx vite --port 5179 --strictPort`, open `/round.html`. It shows the last round
only (toast and tip) with everything picked before fixed; `src/roundDemo.ts` holds every look as CSS over the real
components, keyed by `data-*` on the root (`?round={"mark":"hug"}` in a gallery address sets one).
