// What came in each release (D-315, onboarding.md §7): someone whose seen-state is older than a release gets its
// "what's new" once, one page per item, and the items' lessons are armed (shown on first use as `NEW`). Newest first.
// A release is a group of user-facing decisions, not a version number (the app has none). At launch the list holds
// only `launch` (onboarding itself, nothing to show as new: everyone starts as new, Q-026); every later release adds an
// entry here with the features it brought, and bumps those lessons' `v` in lessons.ts (CLAUDE.md, D-315).
// Plain data, no value imports (scripts/check-lessons.mjs loads it in Node).

export type ReleaseItem = {
  title: string
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
  { id: 'launch', date: '2026-10-29', title: 'Onboarding', items: [] },
]

// The newest release's id: what a new person's `lastRelease` starts at.
export const NEWEST = RELEASES[0].id
