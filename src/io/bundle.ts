// A whole workspace as one file (D-080): a .zip holding `workspace.json` and, since D-083, each attachment's file at
// `attachments/<id>/<name>` (its record is in workspace.json's optional `attachments`, so the version stays 1).
// Only the content travels: items, links, matrix cells, labels, files, research reports (D-090). Members, invite codes, roles and anything AI
// (keys, usage) never do.
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate'
import type { WorkspaceData } from '../data/workspaceData'
import { ATTACHMENT_MAX_BYTES, ATTACHMENT_TYPES, CONFIDENCES, COVERAGES, CRITERION_SCORES, FEATURE_EFFORTS, FEATURE_IMPACTS, FEATURE_PRIORITIES, FEATURE_STATUSES, EVIDENCE_KINDS, LABEL_SIZES, MAX_BENDS, MAX_CRITERIA, REPORT_LIMITS, STANCES, VALIDATIONS, type Bend, type SavedReport } from '../data/model'

export const BUNDLE_FORMAT = 'north-star.workspace'
export const BUNDLE_VERSION = 1

export const BUNDLE_COLLECTIONS = [
  'labels',
  'customers',
  'problems',
  'ideas',
  'features',
  'competitors',
  'competitorFeatures',
  'comparisons',
  'edges',
  // Missing in older exports (D-137, D-139): read as none.
  'evidence',
  'planes',
  'placements',
  'packages',
] as const satisfies readonly (keyof WorkspaceData)[]
export type BundleCollection = (typeof BUNDLE_COLLECTIONS)[number]

type Doc = Record<string, unknown> & { id: string }

export type Bundle = {
  format: typeof BUNDLE_FORMAT
  version: number
  exportedAt: string
  workspace: { name: string; description?: string }
  // Records only; each `file` names its entry in the zip (D-083). Missing in older exports.
  attachments?: Doc[]
  // Research reports you could see (D-090), without who ran them; missing in older exports.
  reports?: Doc[]
} & Record<BundleCollection, Doc[]>

// A bundle as read back, with the attachment files from its zip by entry name.
export type LoadedBundle = Bundle & { files: Record<string, Uint8Array> }

export class BundleError extends Error {}

// `reports`: the ones you may see, whole; fetched only when exporting (D-098).
export function makeBundle(name: string, description: string | undefined, data: WorkspaceData, reports: (SavedReport & { id: string })[] = []): Bundle {
  const bundle = {
    format: BUNDLE_FORMAT,
    version: BUNDLE_VERSION,
    exportedAt: new Date().toISOString(),
    workspace: { name, ...(description && { description }) },
  } as Bundle
  for (const c of BUNDLE_COLLECTIONS) bundle[c] = data[c].map((d) => ({ ...d }) as Doc)
  if (data.attachments.length) {
    // Where it was stored, who attached it and its thumbnail stay behind; the importer makes new ones.
    bundle.attachments = data.attachments.map(({ path, uid: _uid, thumbPath: _thumb, ...rest }) => ({
      ...rest,
      file: attachmentEntry(rest.id, path),
    }))
  }
  if (reports.length) bundle.reports = reports.map(({ uid: _uid, ...rest }) => ({ ...rest }) as Doc)
  return bundle
}

// attachments/<id>/<stored name>: the stored name is already safe for a zip.
export const attachmentEntry = (id: string, path: string) => `attachments/${id}/${path.split('/').pop()}`

// `files`: the attachments' bytes by entry name; already compressed (images, PDFs), so stored as they are.
export function zipBundle(bundle: Bundle, files: Record<string, Uint8Array> = {}): Blob {
  const entries: Zippable = { 'workspace.json': strToU8(JSON.stringify(bundle, null, 2)) }
  for (const [name, bytes] of Object.entries(files)) entries[name] = [bytes, { level: 0 }]
  const zip = zipSync(entries, { level: 6 })
  return new Blob([zip as Uint8Array<ArrayBuffer>], { type: 'application/zip' })
}

// Reads a .zip from an export, or its workspace.json on its own.
export async function readBundle(file: File): Promise<LoadedBundle> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let text: string
  let files: Record<string, Uint8Array> = {}
  // "PK": a zip.
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    let entries: Record<string, Uint8Array>
    try {
      entries = unzipSync(bytes, {
        filter: (f) => f.name.endsWith('workspace.json') || (f.name.startsWith('attachments/') && f.originalSize < ATTACHMENT_MAX_BYTES),
      })
    } catch {
      throw new BundleError('That zip file could not be opened.')
    }
    const entry = Object.keys(entries).find((n) => n.endsWith('workspace.json'))
    if (!entry) throw new BundleError('No workspace.json in that zip: is it a North Star export?')
    text = strFromU8(entries[entry])
    files = Object.fromEntries(Object.entries(entries).filter(([n]) => n.startsWith('attachments/')))
  } else {
    text = strFromU8(bytes)
  }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new BundleError('That file is not a North Star export.')
  }
  const b = raw as Partial<Bundle>
  if (!b || b.format !== BUNDLE_FORMAT) throw new BundleError('That file is not a North Star export.')
  if (typeof b.version !== 'number' || b.version > BUNDLE_VERSION) {
    throw new BundleError('That export comes from a newer version of North Star. Reload the page and try again.')
  }
  const description = str(b.workspace?.description, 1000)
  const bundle = { ...b, workspace: { name: str(b.workspace?.name, 200) || 'Imported workspace', ...(description && { description }) }, files } as LoadedBundle
  for (const c of BUNDLE_COLLECTIONS) bundle[c] = Array.isArray(b[c]) ? (b[c] as Doc[]).filter((d) => d && typeof d.id === 'string') : []
  bundle.attachments = Array.isArray(b.attachments) ? b.attachments.filter((d) => d && typeof d.id === 'string') : []
  bundle.reports = Array.isArray(b.reports) ? b.reports.filter((d) => d && typeof d.id === 'string') : []
  return bundle
}

// ---- Cleaning: a bundle is a file anyone could have edited, so every doc is rebuilt from known fields only,
// in the shapes firestore.rules accepts (change both together). Ids are remapped by the importer.

function str(v: unknown, max: number): string | undefined {
  return typeof v === 'string' ? v.slice(0, max) : undefined
}
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const oneOf = <T extends string>(v: unknown, values: readonly T[]) => (values.includes(v as T) ? (v as T) : undefined)
const tags = (v: unknown) =>
  Array.isArray(v) ? v.filter((t): t is string => typeof t === 'string').slice(0, 30).map((t) => t.slice(0, 60)) : undefined

// Drops undefined fields (Firestore refuses them).
function compact(o: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ''))
}

const times = (d: Doc, now: number) => ({ createdAt: num(d.createdAt) ?? now, updatedAt: num(d.updatedAt) ?? now })

export function cleanCard(d: Doc, now: number) {
  const x = num(d.x)
  const y = num(d.y)
  if (x === undefined || y === undefined) return null
  return {
    title: str(d.title, 200) ?? '',
    ...compact({ body: str(d.body, 20000), tags: tags(d.tags), validation: oneOf(d.validation, VALIDATIONS) }),
    x,
    y,
    ...times(d, now),
  }
}

// A package (D-141), without its members and home plane: the importer maps those to the new ids.
export function cleanPackage(d: Doc, now: number) {
  const card = cleanCard(d, now)
  if (!card) return null
  return { ...card, ...compact({ impact: oneOf(d.impact, FEATURE_IMPACTS), effort: oneOf(d.effort, FEATURE_EFFORTS) }) }
}

// A plane (D-139); its placements follow it with new ids.
export function cleanPlane(d: Doc, now: number) {
  const name = str(d.name, 80)?.trim()
  if (!name) return null
  return { name, order: num(d.order) ?? 0, ...times(d, now) }
}

export function cleanPlacement(d: Doc) {
  const x = num(d.x)
  const y = num(d.y)
  return x === undefined || y === undefined ? null : { x, y }
}

// One piece of evidence (D-137), without its card: the importer adds where it now points.
export function cleanEvidence(d: Doc, now: number) {
  const text = str(d.text, 2000)?.trim()
  const kind = oneOf(d.kind, EVIDENCE_KINDS)
  const stance = oneOf(d.stance, STANCES)
  if (!text || !kind || !stance) return null
  const date = typeof d.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : undefined
  return { text, kind, stance, ...compact({ source: str(d.source, 200), url: str(d.url, 2000), date }), ...times(d, now) }
}

export function cleanFeature(d: Doc, now: number) {
  const card = cleanCard(d, now)
  if (!card) return null
  return {
    ...card,
    ...compact({
      priority: oneOf(d.priority, FEATURE_PRIORITIES),
      status: oneOf(d.status, FEATURE_STATUSES),
      effort: oneOf(d.effort, FEATURE_EFFORTS),
      impact: oneOf(d.impact, FEATURE_IMPACTS),
      criteria: criteria(d.criteria),
    }),
  }
}

// A feature's criteria (D-133): ids kept as they are (the cells' scores refer to them), only safe ones.
const CRITERION_ID = /^[a-z0-9]{1,16}$/
function criteria(v: unknown) {
  if (!Array.isArray(v)) return undefined
  const list = v
    .filter((c): c is Doc => !!c && typeof c === 'object' && typeof c.id === 'string' && CRITERION_ID.test(c.id))
    .map((c) => ({ id: c.id as string, text: str(c.text, 200) ?? '' }))
    .slice(0, MAX_CRITERIA)
  return list.length ? list : undefined
}

function scores(v: unknown) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined
  const kept = Object.entries(v).filter(([id, s]) => CRITERION_ID.test(id) && oneOf(s, CRITERION_SCORES)).slice(0, MAX_CRITERIA)
  return kept.length ? Object.fromEntries(kept) : undefined
}

export function cleanCompetitor(d: Doc, now: number) {
  return {
    name: str(d.name, 200) ?? '',
    ...compact({
      tags: tags(d.tags),
      regions: tags(d.regions)?.slice(0, 20),
      url: str(d.url, 2000),
      description: str(d.description, 20000),
      pricing: str(d.pricing, 2000),
      audience: str(d.audience, 2000),
      notes: str(d.notes, 20000),
      x: num(d.x),
      y: num(d.y),
    }),
    ...times(d, now),
  }
}

export function cleanLabel(d: Doc, now: number) {
  const text = str(d.text, 200)
  const x = num(d.x)
  const y = num(d.y)
  // The title block (D-118) has no text of its own: it shows the workspace's name and description.
  const title = d.kind === 'title'
  // A section (D-130) keeps its size; one without a usable size isn't one.
  const w = num(d.w)
  const h = num(d.h)
  const section = d.kind === 'section' && !!w && !!h && w > 0 && h > 0 && w <= 2000 && h <= 2000
  if ((!text && !title && !section) || x === undefined || y === undefined) return null
  return {
    text: title ? '' : (text ?? ''),
    x,
    y,
    ...compact({ color: str(d.color, 20), size: oneOf(d.size, LABEL_SIZES), kind: title ? 'title' : section ? 'section' : undefined }),
    ...(d.bold === true && { bold: true }),
    ...(d.italic === true && { italic: true }),
    ...(d.caps === true && { caps: true }),
    ...(section && { w, h }),
    // The title block's width (D-132), when it was resized.
    ...(title && w && w > 0 && w <= 2000 && { w }),
    ...times(d, now),
  }
}

export function cleanCompetitorFeature(d: Doc, now: number) {
  return { name: str(d.name, 200) ?? '', ...compact({ description: str(d.description, 20000), category: str(d.category, 100) }), ...times(d, now) }
}

export function cleanComparison(d: Doc, now: number) {
  return { ...compact({
      coverage: oneOf(d.coverage, COVERAGES),
      notes: str(d.notes, 20000),
      criteria: scores(d.criteria),
      notRelevant: d.notRelevant === true ? true : undefined,
      confidence: oneOf(d.confidence, CONFIDENCES),
    }), updatedAt: num(d.updatedAt) ?? now }
}

// The record's own fields; the importer adds where the file now lives, its item and who imported it.
export function cleanAttachment(d: Doc, now: number) {
  const name = str(d.name, 200)
  const contentType = oneOf(d.contentType, ATTACHMENT_TYPES)
  if (!name || !contentType || typeof d.nodeId !== 'string' || typeof d.file !== 'string') return null
  const width = num(d.width)
  const height = num(d.height)
  return { name, contentType, ...(width && height && { width, height }), createdAt: num(d.createdAt) ?? now }
}

// A report's own fields (D-090), within the limits the rules check; `items` are still the file's ids (the importer maps
// them). The importer adds who it belongs to.
export function cleanReport(d: Doc, now: number) {
  const L = REPORT_LIMITS
  const list = (v: unknown, max: number) => (Array.isArray(v) ? v.slice(0, max) : [])
  const text = (v: unknown, max: number) => str(v, max) ?? ''
  const title = str(d.title, 300)
  if (!title) return null
  const sources = list(d.sources, L.sources)
    .map((c: { title?: unknown; url?: unknown }) => ({ title: text(c?.title, 500), url: text(c?.url, 2000) }))
    .filter((c) => /^https?:\/\//.test(c.url))
  const nums = (v: unknown) => list(v, 20).filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= sources.length)
  return {
    kind: d.kind === 'chat' || d.kind === 'upload' ? d.kind : ('research' as const),
    title,
    answer: text(d.answer, 4000),
    sections: list(d.sections, L.sections).map((x: { question?: unknown; points?: unknown }) => ({
      question: text(x?.question, 1000),
      points: list(x?.points, L.points).map((p: { text?: unknown; sources?: unknown }) => ({ text: text(p?.text, L.text), sources: nums(p?.sources) })),
    })),
    implications: list(d.implications, L.implications).map((x: { text?: unknown; items?: unknown }) => ({
      text: text(x?.text, L.text),
      items: list(x?.items, 20).filter((i): i is string => typeof i === 'string'),
    })),
    openQuestions: list(d.openQuestions, L.openQuestions).map((q) => text(q, L.text)),
    sources,
    topic: text(d.topic, 500),
    model: text(d.model, 100),
    name: text(d.name, 200) || 'someone',
    shared: d.shared === true,
    createdAt: num(d.createdAt) ?? now,
  }
}

export function cleanEdge(d: Doc) {
  const kind = str(d.kind, 40)
  if (!kind) return null
  return { kind, ...compact({ label: str(d.label, 200), bends: cleanBends(d.bends) }) }
}

// A link's bend points (D-155), or nothing: straight.
function cleanBends(v: unknown): Bend[] | undefined {
  if (!Array.isArray(v) || v.length === 0) return undefined
  const bends = v.slice(0, MAX_BENDS).map((b) => ({ x: num((b as Doc)?.x), y: num((b as Doc)?.y) }))
  return bends.every((b) => b.x !== undefined && b.y !== undefined) ? (bends as Bend[]) : undefined
}

// A file name safe on every system: "Example: Tablebook" → "example-tablebook".
export function fileSlug(name: string) {
  return (
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/[\s_-]+/g, '-')
      .slice(0, 60) || 'workspace'
  )
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  // Give the browser a moment to start the download before the URL goes.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
