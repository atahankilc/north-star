# The app's shell (D-412, answers Q-036)

Picked 2026-11-19 on the talk preview's port (scratch, 5193) after many rounds: "tamam güzel implemente et".
North Star is the canvas first, and also a place to talk (threads, channels), to run tasks (decks and their days) and
to keep documents; the agent beside all of it. This is where each opens.

## The rule

- **The canvas is home.** With nothing docked it fills the window, square (D-387's sheet closed). It lifts and floats
  as a sheet only while something is docked beside it.
- **Places:** Talk, Tasks, Docs. Each opens first **beside the canvas**, as a column on the left, on the ground under
  the sheet (EdgeColumn, D-387, D-395), exactly as a right panel lies on the right. `full` turns it into **the page**:
  it takes the canvas's place in the main sheet; `beside the canvas` puts it back; `×` closes it and the canvas is
  back. One place open at a time.
- **The right is the thing selected** (a card's, a task's panel, D-219) and, at the far right, **the agent** (D-312,
  its orb in the corner while closed, D-407, D-408). Unchanged.
- **The HUD on the left edge, bare buttons on the ground, nothing round them:**
  - the **open page's actions** at the middle of the left edge: the canvas's side nav (`+`, fit, the compass, `?`);
    a page's own while it's the page (Docs: write, upload, the compass; Talk and Tasks: the compass);
  - the **places** at the foot, over who's here, you and the gear: Talk (its count of mentions or a dot for new),
    Tasks (its count of tasks given to you), Docs. Lit while open beside the canvas or as the page. There is no
    canvas button: closing a place goes back to it.

## What each place shows

- **Talk** (the threads, D-405): beside the canvas the list; a conversation opens **in the list's place** (`‹
  threads` back). As the page: the list on the left and the conversation on the rest, the messages as lines (who,
  when, what) rather than bubbles.
- **Tasks:** tabs for the canvas's decks, `mine`, `all · days`. Beside the canvas: the deck's board (KanbanView),
  mine as rows, all · days as the timeline. As the page: the board and its days side by side, the line between them
  dragged. The decks side view (D-300) stays for a plane's linked deck (`⇆ deck` in a plane's dock); the side nav's
  decks button and `t` open the Tasks place instead.
- **Docs:** every document the workspace keeps (D-232), the ones you may see. Beside the canvas a list; a document
  opens in the list's place. As the page: the list on the left, the document read on the rest.

## Steps

1. **The places and the HUD** (built 2026-11-19): `places/placeStore.ts`, the pages at the HUD's foot (`PlacesTools`),
   the side nav's decks button gone, Talk's conversation in the list's place, Tasks and Docs as columns, `full` as the
   page in the main sheet, the page's actions in the middle.
2. Talk's page in lines; its look on touch and narrow windows.
3. **Folders and files** for Docs (a data change: `folders/`, a document's `folderId`, rules, export/import): not
   started, needs the user's yes for the rules deploy.
4. **Channels** for Talk (a thread `on: 'channel'`, its name and what it's for; rules, a channel's messages paged): not
   started, needs the user's yes for the rules deploy.
5. The side view (D-300) folded into Tasks for a plane's linked deck too, once Tasks has its own `linked` strip.

## Not yet

- Folders and channels (steps 3, 4). The preview's folder tree and channels were made up.
- A page's address (`?page=talk`): today a page is this tab's state, not shared or kept.
