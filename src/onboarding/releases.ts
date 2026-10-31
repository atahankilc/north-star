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
