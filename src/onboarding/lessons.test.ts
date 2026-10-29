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
  it('give the welcome four pages to everyone, by role and audience', () => {
    for (const role of ['owner', 'editor', 'viewer'] as const) for (const a of ['new', 'invited'] as const) expect(pagesFor('welcome', role, a)).toHaveLength(4)
    expect(pagesFor('welcome', 'viewer', 'new')[2].title).toBe('Find your way')
    expect(pagesFor('welcome', 'editor', 'new')[2].title).toBe('Add anything with +')
    expect(pagesFor('welcome', 'owner', 'invited')[0].title).toContain('{owner}')
  })
  it('keep editing pages from viewers', () => {
    expect(pagesFor('side-nav', 'viewer', 'new').map((p) => p.title)).not.toContain('Add')
    for (const id of ['focus-plane', 'matrix-keys', 'table-keys', 'deck', 'competitor-features']) {
      expect(pagesFor(id, 'viewer', 'new').length).toBeGreaterThan(0)
      for (const p of pagesFor(id, 'viewer', 'new')) expect(p.body).not.toMatch(/`\+|type `|Drag tasks|add them/)
    }
    expect(LESSONS.filter((l) => l.roles.length === 1 && l.roles[0] === 'viewer').map((l) => l.id)).toEqual(['viewer'])
  })
})

describe('releases', () => {
  it('ship only launch, newest first', () => {
    expect(RELEASES.map((r) => r.id)).toEqual(['launch'])
    expect(NEWEST).toBe('launch')
  })
  it('arm only lessons that exist (the sample too)', () => {
    for (const r of [...RELEASES, ...SAMPLE_RELEASES]) for (const it of r.items) for (const id of it.lessons) expect(lessonById(id)).toBeDefined()
  })
})
