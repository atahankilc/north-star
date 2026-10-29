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
  { keys: '⇧⌘Z', what: 'redo', lesson: 'hazard-undo' },
  { keys: '0', what: 'fit: show everything', lesson: 'side-nav' },
  { keys: 't', what: 'decks and days beside you', lesson: 'side-view' },
  { keys: 'c', what: 'comments on the canvas, shown or hidden', lesson: 'comment' },
  { keys: '⌥1–⌥9', what: 'go to canvas 1 to 9', lesson: 'canvases' },
  { keys: 'esc', what: 'back out: close, let go, leave a focus' },
  { keys: 'delete', what: 'delete what is selected' },
  // The `+` and every menu
  { keys: '+ p ↵', what: 'a plane (any letter in [ ] puts its row first)', where: 'the + menu', lesson: 'kind-guide' },
  { keys: 'type', what: 'narrow a menu; ↵ picks the first', where: 'menus' },
  { keys: '→ ←', what: 'open or fold what a row holds', where: 'menus, finder, this guide' },
  { keys: '⇥', what: 'here, this canvas, everywhere', where: 'finder', lesson: 'finder' },
  { keys: '⌥C ⌥W ⌥X', what: 'match case, whole words, regular expression', where: 'finder' },
  // Pieces and focus
  { keys: 'double-click', what: 'go inside a piece (focus)', where: 'the canvas', lesson: 'focus-plane' },
  { keys: '⌥ drag', what: 'move or resize off the grid', where: 'edit mode, a plane', lesson: 'piece-made' },
  // In a plane
  { keys: '↵', what: 'keep a new card', where: 'a new card', lesson: 'card-made' },
  { keys: '⇥', what: 'keep it and make the next of its type', where: 'a new card', lesson: 'card-made' },
  { keys: '⌘↵', what: 'done typing a paragraph or sticky note', where: 'text', lesson: 'text-made' },
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
  { keys: '↵', what: 'type into a number or text cell', where: 'matrix, table', lesson: 'table-keys' },
  { keys: 'backspace', what: 'clear a cell', where: 'matrix, table', lesson: 'matrix-keys' },
  { keys: '-', what: "doesn't apply here (—)", where: 'matrix', lesson: 'matrix-keys' },
  { keys: 'space', what: 'tick a check cell', where: 'table', lesson: 'table-keys' },
  // Decks
  { keys: '⇧ click', what: 'pick several tasks', where: 'a deck', lesson: 'deck' },
  { keys: 'delete', what: 'delete the picked tasks', where: 'a deck', lesson: 'deck' },
  // Wizards
  { keys: '↵', what: 'next; on the last step, make it', where: 'wizards', lesson: 'matrix-wizard' },
  { keys: 'esc', what: 'close without making anything', where: 'wizards' },
]
