import { describe, expect, it } from 'vitest'
import { firstLine, guideModel, guideRows, hasNew, keyLesson, parentOf, step, type Row } from './guideModel'
import { KEYS } from './keys'
import { LESSONS, lessonById } from './lessons'

const none = { seen: {}, armed: [] }
const kinds = (rows: Row[]) => rows.map((r) => r.kind)

describe('the ? guide model', () => {
  it('lists every lesson and the kind guide by area, never start, nudges or empty states', () => {
    const m = guideModel(none, null)
    const ids = m.areas.flatMap((a) => a.notes.map((n) => n.id))
    expect(ids).toContain('kind-guide')
    expect(ids).toContain('focus-plane')
    expect(ids).not.toContain('welcome')
    expect(ids).not.toContain('join-pending')
    expect(ids.some((id) => id.startsWith('nudge-'))).toBe(false)
    expect(ids).not.toContain('empty-canvas')
    expect(m.areas.map((a) => a.area)).not.toContain('start')
    expect(m.total).toBe(ids.length)
    expect(m.seen).toBe(0)
  })

  it('by role: a viewer gets no editor-only lessons', () => {
    const viewer = guideModel(none, 'viewer').areas.flatMap((a) => a.notes.map((n) => n.id))
    const owner = guideModel(none, 'owner').areas.flatMap((a) => a.notes.map((n) => n.id))
    expect(viewer).not.toContain('kind-guide')
    expect(viewer).not.toContain('piece-made')
    expect(owner).toContain('people-settings')
    expect(guideModel(none, 'editor').areas.flatMap((a) => a.notes.map((n) => n.id))).not.toContain('people-settings')
  })

  it('counts seen at the lesson version and marks armed ones NEW', () => {
    const focus = lessonById('focus-plane')!
    const m = guideModel({ seen: { 'focus-plane': focus.v, 'piece-made': 0 }, armed: ['beside@1'] }, 'owner')
    const canvas = m.areas.find((a) => a.area === 'canvas')!
    const planes = m.areas.find((a) => a.area === 'planes')!
    expect(planes.notes.find((n) => n.id === 'focus-plane')!.seen).toBe(true)
    expect(planes.seen).toBe(1)
    expect(canvas.notes.find((n) => n.id === 'beside')!.isNew).toBe(true)
    expect(canvas.isNew).toBe(true)
    expect(m.seen).toBe(1)
    // An armed version already seen isn't new.
    expect(guideModel({ seen: { beside: 1 }, armed: ['beside@1'] }, 'owner').areas.some((a) => a.isNew)).toBe(false)
  })

  it('folded areas show only their row; one open shows its notes under it', () => {
    const m = guideModel(none, 'owner')
    const shut = guideRows(m, null, '')
    expect(shut.filter((r) => r.kind === 'note')).toHaveLength(0)
    expect(shut.filter((r) => r.kind === 'area')).toHaveLength(m.areas.length)
    expect(shut.filter((r) => r.kind === 'key')).toHaveLength(0)
    const open = guideRows(m, 'canvas', '')
    const canvas = m.areas.find((a) => a.area === 'canvas')!
    expect(open.filter((r) => r.kind === 'note')).toHaveLength(canvas.notes.length)
    const keys = guideRows(m, 'keys', '')
    expect(keys.filter((r) => r.kind === 'key')).toHaveLength(KEYS.length)
  })

  it('typing narrows across notes and keys and opens what matches', () => {
    const m = guideModel(none, 'owner')
    const rows = guideRows(m, null, 'focus')
    const notes = rows.filter((r): r is Extract<Row, { kind: 'note' }> => r.kind === 'note')
    expect(notes.length).toBeGreaterThan(0)
    expect(notes.every((n) => `${n.note.title} ${n.note.body}`.toLowerCase().includes('focus') || n.area)).toBe(true)
    expect(rows.filter((r) => r.kind === 'area').every((r) => r.kind === 'area' && r.open)).toBe(true)
    const keyRows = guideRows(m, null, 'undo').filter((r) => r.kind === 'key')
    expect(keyRows.length).toBeGreaterThan(0)
    expect(guideRows(m, null, 'zzqx')).toEqual([])
    // Every word must be in it.
    expect(guideRows(m, null, 'snapping grid').some((r) => r.kind === 'key')).toBe(true)
  })

  it('arrows skip headings and wrap; ← finds the fold a row is in', () => {
    const m = guideModel(none, 'owner')
    const rows = guideRows(m, 'canvas', '')
    const first = step(rows, -1, 1)
    expect(rows[first].kind).toBe('start')
    expect(rows[step(rows, first, -1)].kind).not.toBe('head')
    const note = rows.findIndex((r) => r.kind === 'note')
    expect(rows[parentOf(rows, note)]).toMatchObject({ kind: 'area', open: true })
    expect(parentOf(rows, first)).toBe(-1)
  })

  it('keys name lessons that exist; first lines are a sentence', () => {
    for (const k of KEYS) if (k.lesson) expect(lessonById(k.lesson), k.lesson).toBeTruthy()
    const m = guideModel(none, 'owner')
    expect(keyLesson(m, KEYS.find((k) => k.lesson === 'finder')!)).toBe('finder')
    expect(firstLine('Press `focus` or double-click. Inside it is yours.')).toBe('Press `focus` or double-click')
    expect(firstLine('No stop at all')).toBe('No stop at all')
  })

  it('placeholders read as plain words out of context', () => {
    const titles = guideModel(none, 'owner').areas.flatMap((a) => a.notes.map((n) => `${n.title} ${n.body}`))
    expect(titles.some((t) => /\{\w+\}/.test(t))).toBe(false)
  })

  it('the dot: something armed and unseen', () => {
    expect(hasNew(none)).toBe(false)
    expect(hasNew({ seen: {}, armed: ['focus-plane@1'] })).toBe(true)
    expect(hasNew({ seen: { 'focus-plane': 1 }, armed: ['focus-plane@1'] })).toBe(false)
    expect(hasNew({ seen: {}, armed: ['gone-lesson@1'] }, LESSONS)).toBe(false)
  })

  it('start: the welcome, and what\'s new (off while no release has items)', () => {
    const m = guideModel({ seen: {}, armed: [], welcome: 'done' }, 'owner')
    expect(m.start.map((s) => s.id)).toEqual(['welcome', 'whats-new'])
    expect(m.start[0].seen).toBe(true)
    expect(kinds(guideRows(m, null, '')).slice(0, 3)).toEqual(['head', 'start', 'start'])
  })
})
