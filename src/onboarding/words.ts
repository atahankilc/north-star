// The coach's words (D-315, onboarding.md §3.1.3): placeholders filled, backticks split into key chips, and the page
// models the welcome and what's new draw. Pure: no React, so vitest checks it.
import type { Page } from './lessons'
import type { Release, ReleaseItem } from './releases'

export type Fill = { owner?: string; peer?: string; piece?: string }

// `{owner}`, `{peer}`, `{piece}` → the names; a name not known reads as a plain word rather than braces.
const FALLBACK: Required<Fill> = { owner: 'A teammate', peer: 'Someone', piece: 'it' }
export function fill(s: string, f: Fill = {}): string {
  return s.replace(/\{(owner|peer|piece)\}/g, (_, k: keyof Fill) => f[k] || FALLBACK[k])
}

// A line as text and chips: `…` in backticks is a key or an on-screen word as the app writes it.
export type Bit = { text: string; key: boolean }
export function bits(s: string): Bit[] {
  const out: Bit[] = []
  const parts = s.split('`')
  // An odd count of backticks (an even count of parts) leaves the last one as text.
  const unmatched = parts.length % 2 === 0 ? parts.length - 1 : -1
  parts.forEach((t, i) => {
    const key = i % 2 === 1 && i !== unmatched
    if (t) out.push({ text: key || i !== unmatched ? t : '`' + t, key })
  })
  return out
}
export const plain = (s: string) => s.replace(/`/g, '')

// A lesson's name in its label (`LESSON · FOCUS PLANE`): its id in words.
export const lessonName = (id: string) => id.replace(/[-_]+/g, ' ')

// One page of the welcome or what's new, as the window draws it.
export type PageModel = {
  // The short name in the tabs / the log (`canvas`, `decks and days`, `+ 2 more`).
  tab: string
  title: string
  body: string
  extra?: string
  scene?: string
  go?: ReleaseItem['go']
  // The `+ N more` page: the smaller changes as rows, no demo.
  list?: { title: string; line: string }[]
}

// The welcome's tabs by scene (the mock's `01 CANVAS 02 PIECES 03 ADD 04 TOGETHER`); else the title's last word.
const TABS: Record<string, string> = {
  'canvas-fit': 'canvas',
  'pieces-tour': 'pieces',
  'plus-adds-plane': 'add',
  'finder-go': 'find',
  'peers-comment': 'together',
}
export const tabFor = (p: Pick<Page, 'scene' | 'title'>) => (p.scene && TABS[p.scene]) || plain(p.title).split(/\s+/).pop()!.toLowerCase()

export function welcomePages(pages: readonly Page[], role: string | null, f: Fill): PageModel[] {
  return pages.map((p) => ({
    tab: tabFor(p),
    title: fill(p.title, f),
    body: fill(p.body, f),
    extra: p.extra && role && p.extra.roles.includes(role as never) ? fill(p.extra.line, f) : undefined,
    scene: p.scene,
  }))
}

// A tab's label in `max` characters, cut at a word: the words that fit (a trailing `and`, `as`, `of`… dropped), else the
// first word cut with `…` straight after it (never `DECKS AND …` or `DECKS AND DA…`).
const LOOSE = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'that', 'the', 'to', 'with'])
export function fitTab(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, ' ')
  if (t.length <= max) return t
  const words = t.split(' ')
  const kept: string[] = []
  for (const w of words) {
    if ([...kept, w].join(' ').length > max) break
    kept.push(w)
  }
  while (kept.length > 1 && LOOSE.has(kept[kept.length - 1].toLowerCase())) kept.pop()
  if (kept.length && !(kept.length === 1 && LOOSE.has(kept[0].toLowerCase()))) return kept.join(' ')
  return words[0].slice(0, Math.max(1, max - 1)) + '…'
}

// What's new (§4.4): one page per change, the biggest first; past four, three pages and a `+ N more` list page.
// `can(action)`: whether a `[show me]` has somewhere to go here (the side view with no deck or timeline on the canvas
// would open empty); an item it can't go to keeps its page, without the button.
export function newsPages(releases: readonly Release[], can: (action: NonNullable<ReleaseItem['go']>['action']) => boolean = () => true): PageModel[] {
  const items = releases.flatMap((r) => r.items)
  const page = (it: ReleaseItem): PageModel => ({
    tab: (it.tab ?? it.title).toLowerCase(),
    title: it.title,
    body: it.line,
    scene: it.scene,
    go: it.go && can(it.go.action) ? it.go : undefined,
  })
  if (items.length <= 4) return items.map(page)
  const rest = items.slice(3)
  return [
    ...items.slice(0, 3).map(page),
    {
      tab: `+ ${rest.length} more`,
      title: `And ${rest.length} more`,
      body: rest.length === 1 ? 'A smaller change, in a line.' : 'Smaller changes, a line each.',
      list: rest.map((it) => ({ title: it.title, line: it.line })),
    },
  ]
}

// The lessons a release arms (§4.4), once each.
export const newsLessons = (releases: readonly Release[]) => [...new Set(releases.flatMap((r) => r.items.flatMap((i) => i.lessons)))]

// `01`, `02`…
export const two = (n: number) => String(n).padStart(2, '0')
