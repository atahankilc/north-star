// The gallery's pages (D-336): every component file is one, with its example's states when it has an example file
// (`X.gallery.tsx`), and only what it's built from and where it's used when it hasn't. Grouped by where the file lives,
// which is what it is since the folders went by layer and area (D-326): foundation, primitives, patterns, then each
// area of the workspace, the screens, the onboarding, the agent.
import { ENTRIES, type Entry } from './registry'
import { NODES, type Node } from './uses'

export type Area = { id: string; name: string; test: RegExp; about: string }

export const AREAS: Area[] = [
  { id: 'foundation', name: 'foundation', test: /^src\/(ui\/foundation|styles|model)\//, about: 'tokens, motion, feel: what everything is drawn with' },
  { id: 'primitives', name: 'primitives', test: /^src\/ui\/primitives\//, about: 'the smallest parts: a button, a label, a field' },
  { id: 'patterns', name: 'patterns', test: /^src\/ui\/patterns\//, about: 'made from primitives: a window, a menu, a side panel' },
  { id: 'canvas', name: 'canvas', test: /^src\/views\/workspace\/canvas\//, about: 'the canvas itself: the view, the side nav, focus, docks' },
  { id: 'plane', name: 'planes', test: /^src\/views\/workspace\/plane\//, about: 'cards and links on a plane' },
  { id: 'panels', name: 'panels', test: /^src\/views\/workspace\/panels\//, about: 'a card’s and a task’s right panel' },
  { id: 'deck', name: 'decks and days', test: /^src\/views\/workspace\/deck\//, about: 'decks, the timeline, the tasks side view' },
  { id: 'table', name: 'table', test: /^src\/views\/workspace\/table\//, about: 'the table piece, its setup and wizard' },
  { id: 'matrix', name: 'matrix', test: /^src\/views\/workspace\/matrix\//, about: 'the matrix piece, its setup and wizard' },
  { id: 'documents', name: 'documents', test: /^src\/views\/workspace\/documents\//, about: 'the documents list and a document' },
  { id: 'text', name: 'text', test: /^src\/views\/workspace\/text\//, about: 'headings, paragraphs, sticky notes, sections' },
  { id: 'threads', name: 'threads', test: /^src\/views\/workspace\/threads\//, about: 'comments and the threads panel' },
  { id: 'find', name: 'finder', test: /^src\/views\/workspace\/find\//, about: 'the finder (⌘F)' },
  { id: 'settings', name: 'settings', test: /^src\/views\/workspace\/settings\//, about: 'workspace settings pages' },
  { id: 'screens', name: 'screens', test: /^src\/(views\/|app\/|main\.tsx|gallery\/)/, about: 'whole pages: landing, workspaces, the app' },
  { id: 'onboarding', name: 'onboarding', test: /^src\/onboarding\//, about: 'the welcome, lessons, hints, the guide' },
  { id: 'agent', name: 'agent', test: /^src\/agent\//, about: 'the agent’s column and its previews' },
  { id: 'backdrop', name: 'backdrop', test: /^src\/three\//, about: 'the WebGL backdrop behind everything' },
  { id: 'other', name: 'other', test: /./, about: '' },
]

export const areaOf = (file: string): Area => AREAS.find((a) => a.test.test(file))!

export type Page = { id: string; name: string; file: string; area: Area; entry?: Entry; node?: Node }

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export const PAGES: Page[] = (() => {
  const out: Page[] = []
  const byFile = new Map<string, Page>()
  for (const e of ENTRIES) {
    const p: Page = { id: e.id, name: e.name, file: e.file, area: areaOf(e.file), entry: e, node: NODES.get(`/${e.file}`) }
    out.push(p)
    byFile.set(e.file, p)
  }
  const taken = new Set(out.map((p) => p.id))
  for (const n of NODES.values()) {
    const file = n.file.slice(1)
    if (byFile.has(file)) continue
    let id = slug(n.name)
    if (taken.has(id)) id = slug(file)
    taken.add(id)
    const p: Page = { id, name: n.name, file, area: areaOf(file), node: n }
    out.push(p)
    byFile.set(file, p)
  }
  return out.sort((a, b) => AREAS.indexOf(a.area) - AREAS.indexOf(b.area) || a.name.localeCompare(b.name))
})()

const BY_ID = new Map(PAGES.map((p) => [p.id, p]))
const BY_FILE = new Map(PAGES.map((p) => [p.file, p]))
export const pageById = (id: string | null) => (id ? BY_ID.get(id) : undefined)
// `file` with or without its leading `/` (uses.ts keeps one).
export const pageOfFile = (file: string) => BY_FILE.get(file.replace(/^\//, ''))

// Files grouped by their area, in the areas' order: for "built from" and "used in".
export function byArea(files: string[]): { area: Area; pages: Page[] }[] {
  const groups = new Map<Area, Page[]>()
  for (const f of files) {
    const p = pageOfFile(f)
    if (!p) continue
    groups.set(p.area, [...(groups.get(p.area) ?? []), p])
  }
  return [...groups.entries()].sort((a, b) => AREAS.indexOf(a[0]) - AREAS.indexOf(b[0])).map(([area, pages]) => ({ area, pages: pages.sort((x, y) => x.name.localeCompare(y.name)) }))
}
