// What the `?` guide lists (D-315, onboarding.md §4.6), as plain data so vitest checks it: every note (a lesson, or the
// kind guide) by area with what this person has seen and what's armed (`NEW`), the keys, and the rows the list shows
// for an open area and what's typed. No React here; Guide.tsx draws it.
import { fitsRole } from './audience'
import { KEYS, type KeyRow } from './keys'
import { AREAS, LESSONS, type Area, type Lesson, type Role } from './lessons'
import { RELEASES } from './releases'
import { isArmed } from './seenMerge'

export const AREA_NAME: Record<Area, string> = {
  start: 'start',
  canvas: 'canvas',
  planes: 'planes and cards',
  links: 'links',
  text: 'text',
  lenses: 'matrix and table',
  documents: 'documents',
  decks: 'decks and days',
  together: 'together',
  canvases: 'canvases',
  settings: 'settings',
}

// The kind guide has no pages: its row in `?` says what it is.
const KIND_GUIDE = { title: 'What each kind is', body: 'Beside the `+` menu: the row under the pointer or the keys shows what it is and when to use it.' }

export type Note = {
  id: string
  area: Area
  title: string
  // The first page's body, and its first sentence (the row's faint line).
  body: string
  line: string
  scene?: string
  pages: number
  seen: boolean
  isNew: boolean
}

export type AreaInfo = { area: Area; name: string; notes: Note[]; seen: number; isNew: boolean }

export type StartRow = { id: 'welcome' | 'whats-new'; title: string; line: string; seen: boolean; isNew: boolean; off?: boolean }

export type GuideModel = { start: StartRow[]; areas: AreaInfo[]; keys: readonly KeyRow[]; total: number; seen: number }

export type ProgressLike = { seen: Record<string, number>; armed: string[]; welcome?: string | null; lastRelease?: string }

// The first sentence (up to its full stop or colon), for a row's faint line.
export const firstLine = (s: string) => {
  const m = /^(.*?[.:;])(\s|$)/.exec(s)
  return (m ? m[1] : s).replace(/[.:;]$/, '')
}

// Shown in `?`: the lessons (and the kind guide) this role gets, outside `start` (that one's the welcome's own row).
const listed = (l: Lesson, role: Role | null) =>
  (l.format === 'lesson' || l.format === 'guide') && l.area !== 'start' && (role === null || fitsRole(l.roles, role))

// `{peer}`, `{owner}`, `{piece}` are filled in when a lesson shows; here, out of context, a plain word.
const PLAIN: Record<string, string> = { peer: 'someone', owner: 'an owner', piece: 'a piece' }
const plain = (s: string) => s.replace(/\{(\w+)\}/g, (_, k: string) => PLAIN[k] ?? k)

function noteOf(l: Lesson, role: Role | null, p: ProgressLike): Note | null {
  const seen = (p.seen[l.id] ?? 0) >= l.v
  const isNew = isArmed({ seen: p.seen, armed: p.armed }, l.id)
  if (l.format === 'guide') {
    return { id: l.id, area: l.area, title: KIND_GUIDE.title, body: KIND_GUIDE.body, line: firstLine(KIND_GUIDE.body), scene: l.rows[0]?.scene, pages: 1, seen, isNew }
  }
  if (l.format !== 'lesson') return null
  const pages = l.pages.filter((pg) => role === null || fitsRole(pg.roles ?? l.roles, role))
  const first = pages[0]
  if (!first) return null
  const title = plain(first.title)
  const body = plain(first.body)
  return { id: l.id, area: l.area, title: title.charAt(0).toUpperCase() + title.slice(1), body, line: firstLine(body), scene: first.scene, pages: pages.length, seen, isNew }
}

export function guideModel(p: ProgressLike, role: Role | null, lessons: readonly Lesson[] = LESSONS): GuideModel {
  const notes = lessons.filter((l) => listed(l, role)).map((l) => noteOf(l, role, p)).filter((n): n is Note => !!n)
  const areas = AREAS.filter((a) => a !== 'start')
    .map((area): AreaInfo => {
      const mine = notes.filter((n) => n.area === area)
      return { area, name: AREA_NAME[area], notes: mine, seen: mine.filter((n) => n.seen).length, isNew: mine.some((n) => n.isNew) }
    })
    .filter((a) => a.notes.length)
  const news = RELEASES.flatMap((r) => r.items).length
  const start: StartRow[] = [
    { id: 'welcome', title: 'welcome', line: 'the pages you saw first', seen: !!p.welcome || (p.seen.welcome ?? 0) >= 1, isNew: false },
    news
      ? { id: 'whats-new', title: "what's new", line: `${news} ${news === 1 ? 'change' : 'changes'} in the latest release`, seen: true, isNew: false }
      : { id: 'whats-new', title: "what's new", line: 'nothing yet: changes show here after a release', seen: true, isNew: false, off: true },
  ]
  return { start, areas, keys: KEYS, total: notes.length, seen: notes.filter((n) => n.seen).length }
}

// Every word typed is in it.
export function matches(text: string, q: string): boolean {
  const t = text.toLowerCase()
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => t.includes(w))
}

const noteText = (n: Note, a: AreaInfo) => `${n.title} ${n.body} ${a.name}`.replace(/`/g, '')
const keyText = (k: KeyRow) => `${k.keys} ${k.what} ${k.where ?? ''} keys`

export type Row =
  | { kind: 'head'; key: string; title: string; count?: string }
  | { kind: 'start'; key: string; start: StartRow }
  | { kind: 'area'; key: string; area: AreaInfo; open: boolean; shown: number }
  | { kind: 'note'; key: string; note: Note; area: Area }
  | { kind: 'keys'; key: string; open: boolean; shown: number }
  | { kind: 'key'; key: string; row: KeyRow }

export const KEYS_ID = 'keys'

// The rows shown: `open` is the one area (or `keys`) unfolded. Typed, every area with a match is open with only its
// matches, the rest left out.
export function guideRows(m: GuideModel, open: string | null, q: string): Row[] {
  const typed = q.trim()
  const rows: Row[] = []
  const start = typed ? m.start.filter((s) => matches(`${s.title} ${s.line}`, typed)) : m.start
  if (start.length) {
    rows.push({ kind: 'head', key: 'h:start', title: 'start' })
    for (const s of start) rows.push({ kind: 'start', key: `s:${s.id}`, start: s })
  }
  const areas = m.areas
    .map((a) => ({ a, notes: typed ? a.notes.filter((n) => matches(noteText(n, a), typed)) : a.notes }))
    .filter((x) => !typed || x.notes.length)
  if (areas.length) {
    rows.push({ kind: 'head', key: 'h:areas', title: 'areas', count: `${m.seen} / ${m.total} seen` })
    for (const { a, notes } of areas) {
      const isOpen = typed ? true : open === a.area
      rows.push({ kind: 'area', key: `a:${a.area}`, area: a, open: isOpen, shown: notes.length })
      if (isOpen) for (const n of notes) rows.push({ kind: 'note', key: `n:${n.id}`, note: n, area: a.area })
    }
  }
  const keys = typed ? m.keys.filter((k) => matches(keyText(k), typed)) : m.keys
  if (keys.length) {
    const isOpen = typed ? true : open === KEYS_ID
    rows.push({ kind: 'head', key: 'h:keys', title: 'keys' })
    rows.push({ kind: 'keys', key: 'k:all', open: isOpen, shown: keys.length })
    if (isOpen) keys.forEach((k, i) => rows.push({ kind: 'key', key: `k:${i}:${k.keys}`, row: k }))
  }
  return rows
}

export const pickable = (r: Row) => r.kind !== 'head'

// The fold a row belongs to (an area or the keys): ← on a note folds it and goes back to its area.
export function parentOf(rows: Row[], i: number): number {
  for (let j = i; j >= 0; j--) {
    const r = rows[j]
    if (r.kind === 'area' || r.kind === 'keys') return j
    if (r.kind === 'head') break
  }
  return -1
}

// The next pickable row from `i` going `by` (wrapping), or -1.
export function step(rows: Row[], i: number, by: 1 | -1): number {
  const n = rows.length
  if (!n) return -1
  for (let k = 1; k <= n; k++) {
    const j = (((i + by * k) % n) + n) % n
    if (pickable(rows[j])) return j
  }
  return -1
}

// A key row's lesson, if it has one this person gets.
export const keyLesson = (m: GuideModel, k: KeyRow) => (k.lesson && m.areas.some((a) => a.notes.some((n) => n.id === k.lesson)) ? k.lesson : undefined)

// Something armed is still unseen: the magenta dot on the side nav's `?`.
export function hasNew(p: ProgressLike, lessons: readonly Lesson[] = LESSONS): boolean {
  return lessons.some((l) => isArmed({ seen: p.seen, armed: p.armed }, l.id))
}
