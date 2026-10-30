// What's new end to end, without the browser (D-315, onboarding.md §4.4, §5.2, §7): the plan a canvas-open makes, the
// arming it leaves in the seen-state, `?`'s NEW and dot, the `+ N more` paging, and the shipped list holding only launch.
import { afterEach, describe, expect, it } from 'vitest'
import { planNews, releasesSince } from './audience'
import { guideModel, hasNew } from './guideModel'
import { lessonById, LESSONS, type Lesson } from './lessons'
import { RELEASES, newest, releases, setReleases, type Release } from './releases'
import { SAMPLE_RELEASES } from './releases.sample'
import { cleanArmed, isArmed } from './seenMerge'
import { newsPages } from './words'

const v = (id: string) => lessonById(id)?.v
const known = (lastRelease: string, tipsOff = false) => ({ hasDoc: true, lastRelease, tipsOff })

// A later release on top of the sample, to see several releases at once.
const LATER: Release = {
  id: '2026-12',
  date: '2026-12-10',
  title: 'Later',
  items: [{ title: 'Finder', line: 'Find anything.', lessons: ['finder'] }],
}
const THREE = [LATER, ...SAMPLE_RELEASES]

afterEach(() => setReleases(null))

describe('the shipped list', () => {
  it('holds only launch, with nothing in it', () => {
    expect(RELEASES.map((r) => r.id)).toEqual(['launch'])
    expect(RELEASES[0].items).toEqual([])
    expect(releases()).toBe(RELEASES)
    expect(newest()).toBe('launch')
  })

  it('setReleases swaps the list in use (the dev switch) and back', () => {
    setReleases(SAMPLE_RELEASES)
    expect(newest()).toBe('2026-11')
    setReleases(null)
    expect(newest()).toBe('launch')
  })
})

describe('releasesSince, several lastRelease values', () => {
  it('launch → both later ones, newest first; 2026-11 → one; newest → none; unknown or empty → none', () => {
    expect(releasesSince('launch', THREE).map((r) => r.id)).toEqual(['2026-12', '2026-11'])
    expect(releasesSince('2026-11', THREE).map((r) => r.id)).toEqual(['2026-12'])
    expect(releasesSince('2026-12', THREE)).toEqual([])
    expect(releasesSince('2025-01', THREE)).toEqual([])
    expect(releasesSince('', THREE)).toEqual([])
  })

  it('the shipped list gives nothing to anyone', () => {
    expect(releasesSince('launch', RELEASES)).toEqual([])
  })
})

describe('who gets what', () => {
  it('a new person (or an old account with no doc, Q-026): begin at the newest, no what’s new', () => {
    expect(planNews({ hasDoc: false, lastRelease: '', tipsOff: false }, SAMPLE_RELEASES, v)).toEqual({ kind: 'begin', lastRelease: '2026-11' })
    // Even with a lastRelease somehow kept elsewhere: no doc is new.
    expect(planNews({ hasDoc: false, lastRelease: 'launch', tipsOff: false }, SAMPLE_RELEASES, v).kind).toBe('begin')
  })

  it('known, no release recorded yet: set to the newest, nothing shown', () => {
    expect(planNews(known(''), SAMPLE_RELEASES, v)).toEqual({ kind: 'set', lastRelease: '2026-11' })
  })

  it('known and up to date: nothing', () => {
    expect(planNews(known('2026-11'), SAMPLE_RELEASES, v)).toEqual({ kind: 'none' })
    expect(planNews(known('launch'), RELEASES, v)).toEqual({ kind: 'none' })
  })

  it('known with an older lastRelease: what’s new, the items’ lessons armed at their version', () => {
    const plan = planNews(known('launch'), SAMPLE_RELEASES, v)
    expect(plan.kind).toBe('news')
    if (plan.kind !== 'news') return
    expect(plan.modal).toBe(true)
    expect(plan.lastRelease).toBe('2026-11')
    expect(plan.releases.map((r) => r.id)).toEqual(['2026-11'])
    expect(plan.arm.sort()).toEqual(
      ['side-view', 'tasks-given', 'timeline', 'canvases', 'move-canvas', 'plane-filter', 'deck-filter'].map((id) => `${id}@${v(id)}`).sort(),
    )
  })

  it('several releases since: every one’s pages and lessons, once each', () => {
    const plan = planNews(known('launch'), THREE, v)
    if (plan.kind !== 'news') throw new Error(plan.kind)
    expect(plan.lastRelease).toBe('2026-12')
    expect(plan.arm).toContain(`finder@${v('finder')}`)
    expect(new Set(plan.arm).size).toBe(plan.arm.length)
    expect(newsPages(plan.releases).map((p) => p.title)).toEqual(['Finder', 'Decks and days', 'Timeline as a strip', 'And 3 more'])
  })

  it('a lesson that no longer exists is not armed', () => {
    const odd: Release[] = [{ id: 'x', date: '', title: '', items: [{ title: 't', line: 'l', lessons: ['gone-lesson'] }] }, ...RELEASES]
    const plan = planNews(known('launch'), odd, v)
    if (plan.kind !== 'news') throw new Error(plan.kind)
    expect(plan.arm).toEqual([])
  })

  it('releases since with no items: lastRelease moves on, nothing shown', () => {
    const empty: Release[] = [{ id: 'quiet', date: '', title: '', items: [] }, ...RELEASES]
    expect(planNews(known('launch'), empty, v)).toEqual({ kind: 'set', lastRelease: 'quiet' })
  })

  it('tips off: no modal (the dot instead), lessons still armed', () => {
    const plan = planNews(known('launch', true), SAMPLE_RELEASES, v)
    if (plan.kind !== 'news') throw new Error(plan.kind)
    expect(plan.modal).toBe(false)
    expect(plan.arm.length).toBeGreaterThan(0)
    const p = { seen: {}, armed: cleanArmed(plan.arm, {}) }
    expect(hasNew(p)).toBe(true)
  })
})

describe('arming', () => {
  const plan = planNews(known('launch'), SAMPLE_RELEASES, v)
  const arm = plan.kind === 'news' ? plan.arm : []

  it('armed lessons are NEW in `?` (their area too) and light the dot', () => {
    const p = { seen: {}, armed: cleanArmed(arm, {}) }
    expect(isArmed(p, 'side-view')).toBe(true)
    const m = guideModel(p, 'owner')
    const decks = m.areas.find((a) => a.area === 'decks')!
    expect(decks.isNew).toBe(true)
    expect(decks.notes.find((n) => n.id === 'side-view')!.isNew).toBe(true)
    expect(m.areas.find((a) => a.area === 'text')!.isNew).toBe(false)
    expect(hasNew(p, LESSONS, 'owner')).toBe(true)
  })

  it('already seen at that version stays seen: not armed, not NEW', () => {
    const seen = { 'side-view': v('side-view')! }
    const armed = cleanArmed(arm, seen)
    expect(armed.some((e) => e.startsWith('side-view@'))).toBe(false)
    expect(isArmed({ seen, armed }, 'side-view')).toBe(false)
    expect(guideModel({ seen, armed }, 'owner').areas.find((a) => a.area === 'decks')!.notes.find((n) => n.id === 'side-view')!.seen).toBe(true)
  })

  it('a release that bumps a lesson’s version arms it again though the older one was seen ("changed")', () => {
    const base = lessonById('timeline')!
    const bumped = { ...base, v: base.v + 1 } as Lesson
    const lessons = LESSONS.map((l) => (l.id === 'timeline' ? bumped : l))
    const plan2 = planNews(known('launch'), SAMPLE_RELEASES, (id) => lessons.find((l) => l.id === id)?.v)
    if (plan2.kind !== 'news') throw new Error(plan2.kind)
    expect(plan2.arm).toContain(`timeline@${base.v + 1}`)
    const seen = { timeline: base.v }
    const armed = cleanArmed(plan2.arm, seen)
    expect(armed).toContain(`timeline@${base.v + 1}`)
    expect(isArmed({ seen, armed }, 'timeline')).toBe(true)
    expect(hasNew({ seen, armed }, lessons)).toBe(true)
    // Seen at the new version: gone.
    expect(cleanArmed(armed, { timeline: base.v + 1 }).some((e) => e.startsWith('timeline@'))).toBe(false)
  })

  it('the dot counts only what `?` lists for this role: an editor-only lesson armed for a viewer leaves it off', () => {
    const p = { seen: {}, armed: ['move-canvas@1'] }
    expect(lessonById('move-canvas')!.roles).not.toContain('viewer')
    expect(hasNew(p, LESSONS, 'viewer')).toBe(false)
    expect(hasNew(p, LESSONS, 'editor')).toBe(true)
    // Armed nudges or empty states (never listed in `?`) don't light it either.
    expect(hasNew({ seen: {}, armed: ['empty-canvas@1'] })).toBe(false)
  })
})

describe('the `+ N more` paging', () => {
  const items = (n: number): Release[] => [
    { id: 'r', date: '', title: '', items: Array.from({ length: n }, (_, i) => ({ title: `Item ${i + 1}`, line: `line ${i + 1}`, lessons: [] })) },
  ]

  it('up to four: one page each, no list', () => {
    for (const n of [1, 2, 3, 4]) {
      const pages = newsPages(items(n))
      expect(pages).toHaveLength(n)
      expect(pages.every((p) => !p.list)).toBe(true)
    }
  })

  it('past four: the first three, then `+ N more` with the rest as rows', () => {
    const pages = newsPages(items(7))
    expect(pages).toHaveLength(4)
    expect(pages.slice(0, 3).map((p) => p.title)).toEqual(['Item 1', 'Item 2', 'Item 3'])
    expect(pages[3]).toMatchObject({ tab: '+ 4 more', title: 'And 4 more' })
    expect(pages[3].list!.map((r) => r.title)).toEqual(['Item 4', 'Item 5', 'Item 6', 'Item 7'])
    expect(pages[3].scene).toBeUndefined()
  })

  it('the sample: `[show me]` only where an item has a go', () => {
    const pages = newsPages(SAMPLE_RELEASES)
    expect(pages.map((p) => p.go?.action ?? null)).toEqual(['side-view', null, 'crumb-prompt', null])
  })
})

describe("`?`'s what's new row follows the list in use", () => {
  it('shipped: off; the sample: its count', () => {
    expect(guideModel({ seen: {}, armed: [] }, 'owner').start.find((s) => s.id === 'whats-new')!.off).toBe(true)
    setReleases(SAMPLE_RELEASES)
    const row = guideModel({ seen: {}, armed: [] }, 'owner').start.find((s) => s.id === 'whats-new')!
    expect(row.off).toBeUndefined()
    expect(row.line).toBe('5 changes in the latest release')
  })
})
