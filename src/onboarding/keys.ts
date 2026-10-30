// Every shortcut, for the `?` guide's `# keys` (D-315, onboarding.md §4.6), from onboarding-inventory.md §C and the
// handlers it points at. Written as the app writes keys (`⌘F`, `esc`, `0`). `lesson`: the note that teaches it, played
// by Enter on the row. Plain data: change a key in the app, change it here.

export type KeyRow = {
  keys: string
  what: string
  // Where it works, said after the line when it isn't everywhere.
  where?: string
  lesson?: string
}

export const KEYS: readonly KeyRow[] = [
  // Anywhere in a workspace
  { keys: '⌘F', what: 'find anything, and go there', lesson: 'finder' },
  { keys: '?', what: 'this guide' },
  { keys: '⌘J', what: 'the agent: open it or fold it away' },
  { keys: '/', what: 'the agent, when nothing has the keyboard' },
  { keys: '⌘Z', what: 'undo', lesson: 'hazard-undo' },
  { keys: '⇧⌘Z  ⌃Y', what: 'redo', lesson: 'hazard-undo' },
  { keys: '0', what: 'fit: show everything (in a focus, all of the piece)', lesson: 'side-nav' },
  { keys: 'wheel', what: 'zoom round the pointer (pinch or ⌃: faster)' },
  { keys: 't', what: 'decks and days beside you', lesson: 'side-view' },
  { keys: 'c', what: 'comments on the canvas, shown or hidden', lesson: 'comment' },
  { keys: '⌥1–⌥9', what: 'go to canvas 1 to 9', lesson: 'canvases' },
  { keys: 'esc', what: 'back out: close, let go, leave a focus' },
  { keys: 'delete  ⌫', what: 'delete what is selected (a piece: in edit mode, and it asks first)' },
  // The `+` and every menu
  { keys: '+ p ↵', what: 'a plane (any letter in [ ] puts its row first)', where: 'the + menu', lesson: 'kind-guide' },
  { keys: 'type', what: 'narrow a menu; ↵ picks the first', where: 'menus' },
  { keys: '↑ ↓', what: 'move through the rows', where: 'menus, finder, this guide' },
  { keys: 'home end', what: 'the first or the last row', where: 'menus' },
  { keys: '→ ←', what: 'open or fold what a row holds', where: 'menus, finder, this guide' },
  { keys: 'esc  ⇥', what: 'close the menu', where: 'menus' },
  { keys: '⇧↵', what: 'bring a card and keep the list open', where: 'existing card…', lesson: 'brought' },
  { keys: '⌥↵', what: 'move the card here instead', where: 'existing card…', lesson: 'brought' },
  { keys: '↵', what: 'go there', where: 'finder', lesson: 'finder' },
  { keys: '⇥', what: 'here, this canvas, everywhere', where: 'finder', lesson: 'finder' },
  { keys: '⌥C ⌥W ⌥X', what: 'match case, whole words, regular expression', where: 'finder' },
  // Pieces and focus
  { keys: 'double-click', what: 'go inside a plane (focus)', where: 'the canvas', lesson: 'focus-plane' },
  { keys: '⌥ drag', what: 'move or resize off the grid', where: 'pieces, cards, text, sections', lesson: 'piece-made' },
  { keys: 'double-click', what: "rename a deck column, or a matrix's typed head", where: 'deck, matrix' },
  // In a plane
  { keys: '↵', what: 'keep a new card', where: 'a new card', lesson: 'card-made' },
  { keys: '⇥', what: 'keep it and make the next of its type', where: 'a new card', lesson: 'card-made' },
  { keys: '↓', what: 'to the cards like it (use that one)', where: 'a new card' },
  { keys: '⌘↵', what: 'done typing a paragraph or sticky note (a heading: ↵)', where: 'text', lesson: 'text-made' },
  { keys: '⇧ click', what: 'add to the selection', where: 'a plane', lesson: 'multi-select' },
  { keys: '⌥ drag', what: 'draw a box round things to select them', where: 'a plane', lesson: 'multi-select' },
  { keys: '↑ ↓ ← →', what: 'nudge what is selected a grid step (⇧: four)', where: 'a plane' },
  { keys: '⌘C ⌘V', what: 'copy and paste cards and text', where: 'a plane', lesson: 'multi-select' },
  { keys: '⇧⌘V', what: 'paste as the same cards, not copies', where: 'a plane', lesson: 'brought' },
  { keys: '⌘D', what: 'duplicate', where: 'a plane', lesson: 'multi-select' },
  { keys: 'g', what: 'snapping to the grid on or off', where: 'a plane', lesson: 'guides-snap' },
  { keys: 'a', what: 'alignment guides on or off', where: 'a plane', lesson: 'guides-snap' },
  // Matrix and table, live
  { keys: '1–9', what: 'set a scale cell to that step', where: 'matrix, table', lesson: 'matrix-keys' },
  { keys: '↑ ↓ ← →', what: 'move between cells', where: 'matrix, table', lesson: 'table-keys' },
  { keys: '↵', what: 'type into a cell that takes typing (not a scale or a check)', where: 'matrix, table', lesson: 'table-keys' },
  { keys: '⌫  delete', what: 'clear a cell', where: 'matrix, table', lesson: 'matrix-keys' },
  { keys: '-', what: "doesn't apply here (—)", where: 'matrix', lesson: 'matrix-keys' },
  { keys: 'space', what: 'tick a check cell', where: 'table', lesson: 'table-keys' },
  // Decks
  { keys: '⇧ click', what: 'pick several tasks', where: 'a deck', lesson: 'deck' },
  { keys: '⌥ drag', what: 'draw a box round tasks to pick them', where: 'a deck', lesson: 'deck' },
  { keys: 'delete', what: 'delete the picked tasks', where: 'a deck', lesson: 'deck' },
  // Wizards
  { keys: '↵', what: 'next; on the last step, make it', where: 'wizards', lesson: 'matrix-wizard' },
  { keys: '⌘↵', what: 'make it now, from any step', where: 'wizards', lesson: 'matrix-wizard' },
  { keys: 'esc', what: 'close without making anything', where: 'wizards' },
  // Pages and this guide
  { keys: '→ ↵  ←', what: 'next page, back a page; esc skips', where: "welcome, what's new" },
  { keys: '⇥', what: 'tips on or off', where: 'this guide' },
  // The agent
  { keys: '↵  ⇧↵', what: 'send; a new line', where: 'the agent' },
  { keys: '/', what: 'its skills, narrowed as you type', where: "the agent's box" },
  { keys: '↵', what: 'on an empty box: keep the changes shown', where: 'the agent, a preview' },
  { keys: '→ ←  j k', what: 'step through the changes', where: 'the agent, a preview' },
  { keys: 'esc', what: 'back to the chat, then drop the preview, then close', where: 'the agent' },
]
