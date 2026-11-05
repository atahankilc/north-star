import { describe, expect, it } from 'vitest'
import { ANCHORS, EVENTS, LESSONS, lessonById, type Role } from './lessons'
import { NEWEST, RELEASES } from './releases'
import { SAMPLE_RELEASES } from './releases.sample'

const pagesFor = (id: string, role: Role, audience: 'new' | 'invited') => {
  const l = lessonById(id)
  if (!l || (l.format !== 'welcome' && l.format !== 'lesson')) return []
  return l.pages.filter((p) => (!p.roles || p.roles.includes(role)) && (!p.audience || p.audience === audience))
}

// The lessons as data (D-315); scripts/check-lessons.mjs checks the rest (words, scenes, anchors, the `+` menu).
describe('lessons', () => {
  it('have unique ids and known events and anchors', () => {
    const ids = LESSONS.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const l of LESSONS) {
      for (const t of [...l.trigger, ...(l.doneWhen ?? [])]) expect(EVENTS).toContain(t.event)
      if (l.anchor) expect(ANCHORS).toContain(l.anchor)
      for (const a of [...(l.after ?? []), ...(l.unless ?? [])]) expect(ids).toContain(a)
    }
  })
  it('give the welcome one thing a page, in the order things are met: canvas, pieces, console, inside, tools, canvases, together (D-351, D-357)', () => {
    for (const a of ['new', 'invited'] as const) {
      for (const role of ['owner', 'editor'] as const) expect(pagesFor('welcome', role, a).map((p) => p.tab)).toEqual(['canvas', 'pieces', 'bar', 'inside', 'tools', 'canvases', 'people'])
      expect(pagesFor('welcome', 'viewer', a).map((p) => p.tab)).toEqual(['canvas', 'pieces', 'reading', 'bar', 'inside', 'tools', 'canvases', 'people'])
    }
    // What a piece is comes before its console; only editors are told to add one.
    expect(pagesFor('welcome', 'editor', 'new')[1].body).toMatch(/`\+`/)
    expect(pagesFor('welcome', 'viewer', 'new')[1].body).not.toMatch(/`\+`/)
    expect(pagesFor('welcome', 'owner', 'invited')[0].title).toContain('{owner}')
    // What's inside a plane is the plane's own lesson, never the canvas's welcome.
    for (const p of pagesFor('welcome', 'editor', 'new')) expect(p.body).not.toMatch(/customers?, problems/i)
  })
  it('keep editing pages from viewers', () => {
    for (const id of ['focus-plane', 'matrix', 'table', 'deck', 'card-panel']) {
      expect(pagesFor(id, 'viewer', 'new').length).toBeGreaterThan(0)
      for (const p of pagesFor(id, 'viewer', 'new')) expect(p.body).not.toMatch(/`\+|type `|Drag tasks|add them/)
    }
    expect(LESSONS.filter((l) => l.roles.length === 1 && l.roles[0] === 'viewer').map((l) => l.id)).toEqual(['viewer'])
  })
  it('are all paged modals or the few small helpers: no lesson inside a menu, the finder, a wizard or typing (D-349)', () => {
    for (const l of LESSONS) if (l.format !== 'guide') expect(['menu', 'finder', 'wizard', 'typing']).not.toContain(l.within)
  })
})

describe('releases', () => {
  it('start at launch, newest first', () => {
    expect(RELEASES.at(-1)?.id).toBe('launch')
    expect(NEWEST).toBe(RELEASES[0].id)
    expect(RELEASES.map((r) => r.date)).toEqual(RELEASES.map((r) => r.date).sort().reverse())
  })
  it('arm only lessons that exist (the sample too)', () => {
    for (const r of [...RELEASES, ...SAMPLE_RELEASES]) for (const it of r.items) for (const id of it.lessons) expect(lessonById(id)).toBeDefined()
  })
})
