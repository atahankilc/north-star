// A whole workspace as one file (D-080, D-246): a .zip holding `workspace.json`. Only the content travels: the canvas's
// pieces (planes, matrices, tables, documents lists and documents, kanbans) and what's in them, a kanban's tasks (D-251), the cards and everything on them
// (links, evidence, competitor features, matched features, packages), the other planes cards are on (D-281), the canvases and the other canvases pieces
// are on (D-302), text, matrix and table cells, and the documents
// you can see with their content. Members, roles, invite codes, comment threads (D-159) and anything AI never do.
// Version 2 (D-246); files from before it (version 1, North Star 1.0) are refused (D-248).
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { str } from '../model/clean'
import type { BundleDocument, Raw } from '../model/clean'
export type { BundleDocument, Raw } from '../model/clean'

export const BUNDLE_FORMAT = 'north-star.workspace'
export const BUNDLE_VERSION = 2

// Every content collection, as stored.
export const BUNDLE_COLLECTIONS = [
  'pieces',
  'customers',
  'problems',
  'competitors',
  'ideas',
  'features',
  'packages',
  'competitorFeatures',
  'comparisons',
  'edges',
  'evidence',
  'labels',
  'cells',
  'tasks',
  'places',
  // The canvases (D-302) and the pieces on more than their own (its session 3); a file without them is all on the first.
  'canvases',
  'pieceSpots',
] as const
export type BundleCollection = (typeof BUNDLE_COLLECTIONS)[number]

export type Bundle = {
  format: typeof BUNDLE_FORMAT
  version: number
  exportedAt: string
  workspace: { name: string; description?: string }
  documents: BundleDocument[]
} & Record<BundleCollection, Raw[]>

export class BundleError extends Error {}

export function makeBundle(workspace: { name: string; description?: string }, data: Record<BundleCollection, Raw[]>, documents: BundleDocument[]): Bundle {
  const bundle = {
    format: BUNDLE_FORMAT,
    version: BUNDLE_VERSION,
    exportedAt: new Date().toISOString(),
    workspace: { name: workspace.name, ...(workspace.description && { description: workspace.description }) },
    documents,
  } as Bundle
  for (const c of BUNDLE_COLLECTIONS) bundle[c] = data[c]
  return bundle
}

export function zipBundle(bundle: Bundle): Blob {
  const zip = zipSync({ 'workspace.json': strToU8(JSON.stringify(bundle, null, 2)) }, { level: 6 })
  return new Blob([zip as Uint8Array<ArrayBuffer>], { type: 'application/zip' })
}

const docs = (v: unknown): Raw[] => (Array.isArray(v) ? v.filter((d): d is Raw => !!d && typeof d === 'object' && typeof (d as Raw).id === 'string') : [])

// Reads a .zip from an export, or its workspace.json on its own.
export async function readBundle(file: File): Promise<Bundle> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let text: string
  // "PK": a zip.
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    let entries: Record<string, Uint8Array>
    try {
      entries = unzipSync(bytes, { filter: (f) => f.name.endsWith('workspace.json') })
    } catch {
      throw new BundleError('That zip file could not be opened.')
    }
    const entry = Object.keys(entries).find((n) => n.endsWith('workspace.json'))
    if (!entry) throw new BundleError('No workspace.json in that zip: is it a North Star export?')
    text = strFromU8(entries[entry])
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
  if (b.version < BUNDLE_VERSION) throw new BundleError('That export comes from North Star 1.0, which this version no longer reads.')
  const description = str(b.workspace?.description, 1000)
  const bundle = {
    format: BUNDLE_FORMAT,
    version: b.version,
    exportedAt: typeof b.exportedAt === 'string' ? b.exportedAt : '',
    workspace: { name: str(b.workspace?.name, 200)?.trim() || 'Imported workspace', ...(description && { description }) },
    documents: docs(b.documents),
  } as Bundle
  for (const c of BUNDLE_COLLECTIONS) bundle[c] = docs(b[c])
  return bundle
}

// ---- Cleaning (every clean* below) lives in src/model/clean.ts, without Firebase (S3); re-exported here.
export { cleanCard, cleanCompetitorFeature, cleanComparison, cleanEvidence, cleanEdge, cleanLabel, cleanPiece, cleanTimeline, cleanKanban, cleanPlace, cleanTask, cleanCell, cleanDocument } from '../model/clean'
export type { Ids } from '../model/clean'

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
