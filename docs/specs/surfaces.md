# Surfaces: round with a line, marks that take the corner, panels under the screen (D-387)

Status: **look agreed 2026-11-16 (D-387); steps 1–2 built 2026-11-16, steps 3–8 not.** This is the build plan for what sits on top of D-384's controls
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
  shadow of its own. One movement, ~550 ms, eased out. The panel's contents build cell by cell as today while the sheet
  uncovers them.
- **It closes:** the sheet comes back over the panel; the panel's contents leave with it, not before it (the demo drops
  them at once, the build must not).
- **Reduced motion:** no travel; the sheet is at once where it ends.
- **What rides the sheet:** the canvas, the HUD, the foot dock (centred on the sheet, not on the window), the threads
  dock. **What's on the ground:** the panel.
- The panel's width is still dragged (D-378): the sheet's edge follows it.

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
4. **Menus.** PromptFrame round with a line, cyan with the keyboard, its L's gone; PromptRow a pill, picked filled, no
   band; Menu, Select, ContextMenu, InPlaceMenu, the finder, the kind guide, Popover, PeopleHere's list checked. A menu
   in a console or dock (`plain`) too.
5. **The foot dock and the threads dock.** Console `foot` and its drawer as tabs with a line; the whole-edge case
   (`data-full`) keeps its top line; Corners.module.css's `top` pair goes with the threads dock's L's.
6. **The side panel under the screen.** The sheet (WorkspaceLayout/CanvasView's root), the ground, EdgeColumn bare on it;
   the travel in and out, reduced motion; the dock and the HUD on the sheet; the agent's column, a document beside it
   (D-382), a left column; the split with a pane beside (D-211) and the decks side view (D-300) checked, since they
   share the screen another way; the panel's drag; touch. Corners.module.css's `left`/`right` pairs go.
7. **Settings' inside, toast, tip.** Sections and Frame's boxes round; the side list's pill; the toast a pill, its action
   without brackets (the callers' `'[go there]'` strings too); the tip round.
8. **Sweep and docs.** What still draws a square surface or an L by hand; DESIGN.md §6; the release line in
   `src/onboarding/releases.ts`; D-359's and D-347's lines in the memory bank brought in step.

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
