// A whole workspace as one file (D-080): a .zip holding `workspace.json`, with room for `attachments/` once files exist (D-015).
// Only the content travels: items, links, matrix cells, labels. Members, invite codes, roles and anything AI (keys, usage) never do.
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import type { WorkspaceData } from '../data/workspaceData'
import { COVERAGES, FEATURE_EFFORTS, FEATURE_PRIORITIES, FEATURE_STATUSES } from '../data/model'

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
] as const satisfies readonly (keyof WorkspaceData)[]
export type BundleCollection = (typeof BUNDLE_COLLECTIONS)[number]

type Doc = Record<string, unknown> & { id: string }

export type Bundle = {
  format: typeof BUNDLE_FORMAT
  version: number
  exportedAt: string
  workspace: { name: string; description?: string }
} & Record<BundleCollection, Doc[]>

export class BundleError extends Error {}

export function makeBundle(name: string, description: string | undefined, data: WorkspaceData): Bundle {
  const bundle = {
    format: BUNDLE_FORMAT,
    version: BUNDLE_VERSION,
    exportedAt: new Date().toISOString(),
    workspace: { name, ...(description && { description }) },
  } as Bundle
  for (const c of BUNDLE_COLLECTIONS) bundle[c] = data[c].map((d) => ({ ...d }) as Doc)
  return bundle
}

export function zipBundle(bundle: Bundle): Blob {
  const zip = zipSync({ 'workspace.json': strToU8(JSON.stringify(bundle, null, 2)) }, { level: 6 })
  return new Blob([zip as Uint8Array<ArrayBuffer>], { type: 'application/zip' })
}

// Reads a .zip from an export, or its workspace.json on its own.
export async function readBundle(file: File): Promise<Bundle> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let text: string
  // "PK": a zip.
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    let files: Record<string, Uint8Array>
    try {
      files = unzipSync(bytes, { filter: (f) => f.name.endsWith('workspace.json') })
    } catch {
      throw new BundleError('That zip file could not be opened.')
    }
    const entry = Object.keys(files)[0]
    if (!entry) throw new BundleError('No workspace.json in that zip: is it a North Star export?')
    text = strFromU8(files[entry])
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
  const bundle = { ...b, workspace: { name: str(b.workspace?.name, 200) || 'Imported workspace' } } as Bundle
  for (const c of BUNDLE_COLLECTIONS) bundle[c] = Array.isArray(b[c]) ? (b[c] as Doc[]).filter((d) => d && typeof d.id === 'string') : []
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
  return { title: str(d.title, 200) ?? '', ...compact({ body: str(d.body, 20000), tags: tags(d.tags) }), x, y, ...times(d, now) }
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
    }),
  }
}

export function cleanCompetitor(d: Doc, now: number) {
  return {
    name: str(d.name, 200) ?? '',
    ...compact({
      tags: tags(d.tags),
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
  if (!text || x === undefined || y === undefined) return null
  return { text, x, y, ...times(d, now) }
}

export function cleanCompetitorFeature(d: Doc, now: number) {
  return { name: str(d.name, 200) ?? '', ...compact({ description: str(d.description, 20000), category: str(d.category, 100) }), ...times(d, now) }
}

export function cleanComparison(d: Doc, now: number) {
  return { ...compact({ coverage: oneOf(d.coverage, COVERAGES), notes: str(d.notes, 20000) }), updatedAt: num(d.updatedAt) ?? now }
}

export function cleanEdge(d: Doc) {
  const kind = str(d.kind, 40)
  if (!kind) return null
  return { kind, ...compact({ label: str(d.label, 200) }) }
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
