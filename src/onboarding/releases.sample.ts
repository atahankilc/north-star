// A sample later release, for tests and the dev-only `?release=sample` switch (onboarding-lessons.md §11): never in a production build. It is what a release
// after `launch` would look like, written from state-history.md (D-293 → D-314), to build and check what's new.
import type { Release } from './releases'

export const SAMPLE_RELEASES: readonly Release[] = [
  {
    id: '2026-11',
    date: '2026-11-15',
    title: 'Decks and days, several canvases',
    items: [
      { title: 'Decks and days', tab: 'decks', line: '`t` opens plane → deck → days beside you, from anywhere.', scene: 'side-view', lessons: ['side-view', 'tasks-given'], go: { label: 'open the side view', action: 'side-view' } },
      { title: 'Timeline as a strip', tab: 'timeline', line: 'Days without end: drag through time, pinch to change the scale, draw tasks.', scene: 'timeline-scroll', lessons: ['timeline'] },
      { title: 'Several canvases', tab: 'canvases', line: 'Split the work into canvases; a piece can be on more than one.', scene: 'canvases', lessons: ['canvases', 'move-canvas'], go: { label: "open the crumb's prompt", action: 'crumb-prompt' } },
      { title: 'Filters that pass', tab: 'filters', line: 'A filter lasts while its view is open, and new things always show.', scene: 'plane-filter', lessons: ['plane-filter', 'deck-filter'] },
      { title: 'Card faces', tab: 'faces', line: 'Cards tinted by type everywhere: on decks and in tables too.', scene: 'card-deck', lessons: [] },
    ],
  },
  { id: 'launch', date: '2026-10-29', title: 'Onboarding', items: [] },
]
