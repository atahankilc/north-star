// What came in each release (D-315, onboarding.md §7): someone whose seen-state is older than a release gets its
// "what's new" once, one page per item, and the items' lessons are armed (shown on first use as `NEW`). Newest first.
// A release is a group of user-facing decisions, not a version number (the app has none). At launch the list holds
// only `launch` (onboarding itself, nothing to show as new: everyone starts as new, Q-026); every later release adds an
// entry here with the features it brought, and bumps those lessons' `v` in lessons.ts (CLAUDE.md, D-315).
// Plain data, no value imports (scripts/check-lessons.mjs loads it in Node).

export type ReleaseItem = {
  title: string
  // Its tab in what's new, when the title is long (`decks`); else the title, cut at a word to fit.
  tab?: string
  line: string
  // A demo scene (`src/demo/scenes/<scene>.tsx`).
  scene?: string
  // The lessons it arms.
  lessons: readonly string[]
  // `[show me]`: closes what's new and does this (events.ts / the coach know each action).
  go?: { label: string; action: 'side-view' | 'crumb-prompt' | 'finder' | 'guide' }
}
export type Release = { id: string; date: string; title: string; items: readonly ReleaseItem[] }

export const RELEASES: readonly Release[] = [
  {
    id: '2026-11-25',
    date: '2026-11-25',
    title: 'Talk, made anew',
    items: [
      // D-436: a card named in a message.
      { title: 'A card in a message', tab: 'cards', line: 'In Talk, `#` and a card’s name puts the card in your message; a press on it shows it on the canvas.', scene: 'threads-panel', lessons: ['comment'] },
      // D-435: Talk's list, rail and page.
      { title: 'Talk, made anew', tab: 'talk', line: "Each row says who wrote last and what. An open conversation keeps the others on a rail; as the page, what it's about stands beside.", scene: 'threads-panel', lessons: ['comment'] },
      // D-435: one column on the right, the canvas in the middle of what's left.
      { title: 'One column on the right', tab: 'right', line: 'A card and the agent share the right by tabs. The canvas stays in the middle of what the panels leave, and fit too.', lessons: [] },
    ],
  },
  {
    id: '2026-11-23',
    date: '2026-11-23',
    title: 'Images and PDFs',
    items: [
      // D-425: documents' files in Storage.
      { title: 'Images and PDFs in Docs', tab: 'files', line: 'Upload images and PDFs to Docs: an image shows at its own shape, a PDF page by page. They travel in an export too.', lessons: ['docs'] },
    ],
  },
  {
    id: '2026-11-19',
    date: '2026-11-19',
    title: 'Bigger or smaller',
    items: [
      // D-417: one interface size for everything, replacing the hud size.
      { title: 'One size for everything', tab: 'size', line: 'Settings → display → interface size makes the text, buttons, panels and menus bigger or smaller together, 75 to 150 %.', lessons: ['settings'] },
      // D-422: the decks side view folded into Tasks.
      { title: "A plane's deck in Tasks", tab: 'tasks', line: "A plane's `⇆ deck` opens its deck in Tasks, beside the canvas, linked to the plane. Follow someone and you see their Tasks too.", lessons: ['side-view'] },
      // D-423: a place in the address.
      { title: 'Links to a place', tab: 'links', line: "Talk, Tasks and Docs are in the page's address, with the conversation or document open: a reload keeps them, a link opens them.", lessons: [] },
      // The touch pass (2026-11-20): pinch, and a phone's Fit.
      { title: 'Two fingers', tab: 'touch', line: 'On a phone or tablet, two fingers zoom the canvas and a plane in focus. Fit takes in a whole canvas on a phone too.', lessons: [] },
    ],
  },
  {
    id: '2026-11-18',
    date: '2026-11-18',
    title: 'Threads, new first',
    items: [
      // D-416: channels in Talk.
      { title: 'Channels', tab: 'channels', line: 'Talk has channels now: conversations on nothing, for the whole team, on top of the list. `+ channel` starts one.', scene: 'threads-panel', lessons: ['comment'] },
      // D-415: folders in Docs.
      { title: 'Folders', tab: 'folders', line: 'Docs keeps documents in folders: make one, rename it, move a document into it. Deleting a folder moves what was in it up.', scene: 'side-view', lessons: ['docs'] },
      // D-412: the places beside the canvas.
      { title: 'Talk, Tasks, Docs', tab: 'places', line: 'Bottom left: Talk, Tasks and Docs open beside the canvas; `full` makes one the page. The canvas fills the window until something docks.', scene: 'side-view', lessons: ['comment', 'side-view', 'docs'] },
      // D-405: the threads' list and a conversation drawn anew.
      { title: 'New first', tab: 'threads', line: 'The threads list puts what’s new on top, resolved ones at its foot. A conversation shows its card, each message in its writer’s colour.', scene: 'threads-panel', lessons: ['comment'] },
    ],
  },
  {
    id: '2026-11-16',
    date: '2026-11-16',
    title: 'Rounder, with a line',
    items: [
      // D-387: a look, not a feature, so it arms no lesson.
      { title: 'Panels under the canvas', tab: 'look', line: 'Windows and menus are round now. A side panel opens under the canvas, which lifts and draws back for it.', lessons: [] },
      // D-393: the threads on the ground. D-398: the list by place, a conversation in bubbles. D-402: their button in the HUD's corner.
      { title: 'Threads beside the canvas', tab: 'threads', line: 'The threads button is bottom left, above your square. The list opens left, grouped by place; a conversation right, your messages on your side.', scene: 'threads-panel', lessons: ['comment'] },
      // D-404: a look, not a feature, so it arms no lesson.
      { title: 'Settings, tidied', tab: 'settings', line: 'In Settings every control sits at the right edge of its row, and the close stays put while the page scrolls.', lessons: [] },
      // D-390: the workspaces page.
      { title: 'What changed, everywhere', tab: 'workspaces', line: 'Every workspace that changed while you were away says who changed what. New tasks and people asking to join are written on its card.', lessons: ['workspaces'] },
    ],
  },
  {
    id: '2026-11-15',
    date: '2026-11-15',
    title: 'A calmer look',
    items: [
      // D-384: a look, not a feature, so it arms no lesson.
      { title: 'A light for what’s on', tab: 'look', line: 'Buttons lost their grey boxes. A small light before a word shows what’s on; an icon lights up itself.', lessons: [] },
    ],
  },
  {
    id: '2026-11-05',
    date: '2026-11-05',
    title: 'Resize from any side',
    items: [
      { title: 'Every side, every corner', tab: 'resize', line: 'Sections and sticky notes resize from every side and corner; paragraphs and the title from both ends.', scene: 'section', lessons: ['section-draw', 'sticky-made'] },
      { title: 'Panels as wide as you like', tab: 'panels', line: 'Drag a right panel’s left edge to set its width; this browser keeps it.', scene: 'card-panel', lessons: ['card-panel'] },
    ],
  },
  { id: 'launch', date: '2026-10-29', title: 'Onboarding', items: [] },
]

// The newest release's id: what a new person's `lastRelease` starts at.
export const NEWEST = RELEASES[0].id

// The list the coach reads: RELEASES, except in dev with `?release=sample` (Coach.tsx swaps in releases.sample.ts for
// the flows and shots; that branch is stripped from production, so the sample never ships).
let inUse: readonly Release[] = RELEASES
export const releases = (): readonly Release[] => inUse
export const newest = (): string => inUse[0]?.id ?? NEWEST
export const setReleases = (list: readonly Release[] | null) => void (inUse = list ?? RELEASES)
