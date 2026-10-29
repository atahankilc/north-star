// Documents (D-232): every file the workspace keeps, one collection for all of them: a .md, an image, a PDF, and the
// old research reports (D-090), moved over once. A document is its small summary (`documents/{id}`, listed) and its
// content (`documents/{id}/content/body`, read when it's opened or shown): a .md's text, a report's sections. An image
// or a PDF is a file in Storage (`path`, with a thumbnail beside it), which needs the Blaze plan: until then only the
// emulators take files (`filesAvailable`, the pattern of D-079 and D-083).
//
// Private until shared (D-232): a new document is seen only by whoever added it, until they share it. Putting one on the
// canvas on its own shows it to everyone, so it's shared in the same step, after asking (DocumentShare in the views).
//
// The pieces (pieces.ts): a `documents` piece lists them (a table or a shelf of sheets, `DocumentsSetup`); a `document`
// piece shows one (`docId`).
import { collection, doc, getDoc, getDocs, query, updateDoc, where, writeBatch, type DocumentReference } from 'firebase/firestore'
import { useMemo } from 'react'
import { db, useEmulators } from './firebase'
import { absent, tracked } from './history'
import { useDoc, useQuery, type WithId } from './hooks'

export { DOC_KINDS, DOC_COLS, DOC_LIMITS } from '../model/shapes'
export type { DocKind, DocCol } from '../model/shapes'
import { DOC_LIMITS, type DocCol, type DocKind } from '../model/shapes'

// Where it came from: uploaded by someone, written by the assistant, or an old report moved over.
export type DocOrigin = 'upload' | 'assistant' | 'moved'

// The file types a document may be; the same list is in firestore.rules (and storage.rules for files).
export const DOC_TYPES = ['text/markdown', 'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'application/pdf'] as const
export type DocType = (typeof DOC_TYPES)[number]

// A research report's own kind (D-090, D-091), kept on a moved one.
export type ReportKind = 'research' | 'chat' | 'upload'

export type Doc = {
  kind: DocKind
  title: string
  // The first words of a .md, a report's answer: the list's second line and a sheet's lines.
  excerpt?: string
  origin: DocOrigin
  // Who added it, and their name then.
  uid: string
  name: string
  shared: boolean
  contentType?: DocType
  // Bytes of the file or the text.
  size: number
  words?: number
  pages?: number
  // A report's counts.
  sections?: number
  sources?: number
  // An image's size.
  width?: number
  height?: number
  // A file in Storage, and an image's thumbnail beside it.
  path?: string
  thumbPath?: string
  // A report's: what it was asked, the model that wrote it, its own kind.
  topic?: string
  model?: string
  reportKind?: ReportKind
  createdAt: number
  updatedAt: number
}

export type ReportPoint = { text: string; sources: number[] }
export type ReportBody = {
  sections: { question: string; points: ReportPoint[] }[]
  // `items`: ids of our cards it concerns.
  implications: { text: string; items: string[] }[]
  openQuestions: string[]
  // Numbered from 1: a point's `sources` index into this.
  sources: { title: string; url: string }[]
}
// A .md's text; a report's answer and sections.
export type DocBody = { text?: string; answer?: string } & Partial<ReportBody>

// The documents piece (D-232): how it lists them, shared by everyone; which page you're on is yours.
export type DocumentsView = 'table' | 'shelf'
export type DocumentsSetup = {
  view: DocumentsView
  // Only these kinds; none = all.
  kinds?: DocKind[]
  // Sorted by a column, newest first when unset.
  sort?: { col: DocCol; desc?: boolean }
  pageSize?: number
}
export const emptyDocuments = (): DocumentsSetup => ({ view: 'table', pageSize: 10 })

export const FILE_MAX_BYTES = 10 * 1024 * 1024

// Storage needs the Blaze plan (D-083): images and PDFs are taken only on the emulators until it's live.
const FILES_LIVE = false
export const filesAvailable = useEmulators || FILES_LIVE

const docsOf = (wid: string) => collection(db(), 'workspaces', wid, 'documents')
export const docRef = (wid: string, id: string) => doc(docsOf(wid), id)
export const bodyRef = (wid: string, id: string) => doc(docsOf(wid), id, 'content', 'body')

// Every document you may see, live: the shared ones and your own (the two queries the rules can prove), newest first.
// Small docs, so the workspace keeps them all, as it does its cards; a body loads only where it's shown.
export function useDocuments(wid: string, uid: string | undefined) {
  const shared = useQuery<Doc>(query(docsOf(wid), where('shared', '==', true)), `${wid}/documents/shared`)
  const mine = useQuery<Doc>(uid ? query(docsOf(wid), where('uid', '==', uid)) : null, `${wid}/documents/${uid ?? ''}`)
  const data = useMemo(() => {
    const byId = new Map<string, WithId<Doc>>()
    for (const d of [...shared.data, ...mine.data]) byId.set(d.id, d)
    return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt)
  }, [shared.data, mine.data])
  return { data, isLoading: shared.isLoading || mine.isLoading, error: shared.error ?? mine.error }
}

// A document's content, read live while it's shown; nothing when `enabled` is false (too far away to read).
export function useDocBody(wid: string, d: WithId<Doc> | null | undefined, enabled = true) {
  const textual = d && (d.kind === 'markdown' || d.kind === 'report')
  return useDoc<DocBody>(enabled && textual ? `workspaces/${wid}/documents/${d.id}/content/body` : null)
}

// ---- Upload

export class DocumentError extends Error {}

const BY_EXTENSION: Record<string, DocType> = {
  md: 'text/markdown',
  markdown: 'text/markdown',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
}

// What a file would be as a document, by its extension first (browsers give .md no type, or text/plain), then its type.
export function typeOfFile(file: { name: string; type: string }): DocType | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (BY_EXTENSION[ext]) return BY_EXTENSION[ext]
  return (DOC_TYPES as readonly string[]).includes(file.type) ? (file.type as DocType) : null
}

export const kindOfType = (t: DocType): DocKind => (t === 'text/markdown' ? 'markdown' : t === 'application/pdf' ? 'pdf' : 'image')

// What an upload of these files would refuse, in plain words, before anything is sent; null = fine.
export function refusal(file: File): string | null {
  const t = typeOfFile(file)
  if (!t) return 'not a type we keep'
  if (t !== 'text/markdown' && !filesAvailable) return 'files come with Storage'
  if (t === 'text/markdown' ? file.size > DOC_LIMITS.text : file.size >= FILE_MAX_BYTES) return t === 'text/markdown' ? 'over 900 KB of text' : 'over 10 MB'
  return null
}

const words = (text: string) => (text.match(/\S+/g) ?? []).length

// A .md's title: its first heading, else the file's name without the extension.
export function mdTitle(text: string, fileName: string) {
  const h = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/m.exec(text)
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim()
  return (h?.[1] ?? base ?? 'untitled').slice(0, DOC_LIMITS.title) || 'untitled'
}

// Its first words, Markdown marks taken out: headings, list marks, emphasis, links to their text.
export function mdExcerpt(text: string) {
  const plain = text
    .replace(/```[\s\S]*?```/g, ' ')
    .split('\n')
    .filter((l) => !/^\s{0,3}#{1,6}\s/.test(l))
    .join(' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s*([-*+>]|\d+[.)])\s+/gm, '')
    .replace(/[*_`~#>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.slice(0, DOC_LIMITS.excerpt)
}

// Text in UTF-8 bytes: what Firestore counts.
const bytes = (s: string) => new TextEncoder().encode(s).length

// A .md file as a document of yours (private until shared): its summary and its text in one batch, one undo step.
export async function uploadMarkdown(wid: string, who: { uid: string; name: string }, file: File): Promise<string> {
  const text = await file.text()
  if (bytes(text) > DOC_LIMITS.text) throw new DocumentError('over 900 KB of text')
  const ref = doc(docsOf(wid))
  const body = bodyRef(wid, ref.id)
  const now = Date.now()
  const excerpt = mdExcerpt(text)
  const summary: Doc = {
    kind: 'markdown',
    title: mdTitle(text, file.name),
    ...(excerpt ? { excerpt } : {}),
    origin: 'upload',
    uid: who.uid,
    name: who.name.slice(0, 200),
    shared: false,
    contentType: 'text/markdown',
    size: bytes(text),
    words: words(text),
    createdAt: now,
    updatedAt: now,
  }
  await tracked('upload a document', [ref, body], () => {
    const batch = writeBatch(db())
    batch.set(ref, summary)
    batch.set(body, { text })
    return batch.commit()
  }, { before: absent([ref, body]) })
  return ref.id
}

// ---- Changes (the author's own: sharing, renaming; firestore.rules lets no one else)

export function shareDocument(wid: string, id: string, shared: boolean) {
  const ref = docRef(wid, id)
  return tracked(shared ? 'share a document' : 'unshare a document', [ref], () => updateDoc(ref, { shared, updatedAt: Date.now() }))
}

// Unshared while it's on the canvas on its own (D-232): its pieces go with it, since no one else could see them any more.
// One undo step: undoing shares it again and puts the pieces back.
export function unshareDocument(wid: string, id: string, pieces: DocumentReference[]) {
  const ref = docRef(wid, id)
  return tracked('unshare a document', [ref, ...pieces], () => {
    const batch = writeBatch(db())
    pieces.forEach((p) => batch.delete(p))
    batch.update(ref, { shared: false, updatedAt: Date.now() })
    return batch.commit()
  })
}

export function renameDocument(wid: string, id: string, title: string) {
  const ref = docRef(wid, id)
  const value = title.trim().slice(0, DOC_LIMITS.title)
  if (!value) return Promise.resolve()
  return tracked('rename a document', [ref], () => updateDoc(ref, { title: value, updatedAt: Date.now() }), { key: `doc-title:${id}` })
}

// The document, its content and every piece showing it, as one undo step. The body first: its rule reads the summary.
export function deleteDocument(wid: string, id: string, pieces: DocumentReference[]) {
  const ref = docRef(wid, id)
  const body = bodyRef(wid, id)
  return tracked('delete a document', [ref, body, ...pieces], () => {
    const batch = writeBatch(db())
    batch.delete(body)
    pieces.forEach((p) => batch.delete(p))
    batch.delete(ref)
    return batch.commit()
  })
}

// A document as a .md file to save: a .md's own text, a report written out. Files (images, PDFs) come with Storage.
export async function downloadDocument(wid: string, d: WithId<Doc>) {
  const snap = await getDoc(bodyRef(wid, d.id))
  const b = (snap.data() as DocBody | undefined) ?? {}
  const text = d.kind === 'report' ? reportAsMarkdown(d.title, b) : (b.text ?? '')
  const blob = new Blob([text], { type: 'text/markdown' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${d.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'document'}.md`
  a.click()
  URL.revokeObjectURL(a.href)
}

function reportAsMarkdown(title: string, b: DocBody) {
  const out = [`# ${title}`, '', b.answer ?? '', '']
  ;(b.sections ?? []).forEach((s, i) => {
    out.push(`## ${String(i + 1).padStart(2, '0')} ${s.question}`, '')
    for (const p of s.points) out.push(`- ${p.text}${p.sources.length ? ` ${p.sources.map((n) => `[${n}]`).join('')}` : ''}`)
    out.push('')
  })
  if (b.implications?.length) out.push('## What it means for us', '', ...b.implications.map((x) => `- ${x.text}`), '')
  if (b.openQuestions?.length) out.push('## Open questions', '', ...b.openQuestions.map((q) => `- ${q}`), '')
  if (b.sources?.length) out.push('## Sources', '', ...b.sources.map((s, i) => `${i + 1}. [${s.title}](${s.url})`), '')
  return out.join('\n')
}

// ---- Moving the old reports over (D-232), once

type OldReport = {
  kind?: ReportKind
  title: string
  answer: string
  topic: string
  uid: string
  name: string
  model: string
  shared: boolean
  createdAt: number
} & Partial<ReportBody>

const moved = new Set<string>()

// Each old report becomes a document of kind `report` with the same id, who wrote it, when and whether it was shared,
// then the old one goes. Run when a workspace opens: a member's browser moves their own reports, an owner's the shared
// ones too (the only ones the rules let each of them read and write). One report a batch: a body's rules read its summary.
// Not an undo step: nothing anyone did. Safe to run twice: a report already moved is only deleted.
export async function moveReports(wid: string, uid: string, owner: boolean) {
  if (moved.has(wid)) return
  moved.add(wid)
  const reports = collection(db(), 'workspaces', wid, 'reports')
  const [mine, shared] = await Promise.all([
    getDocs(query(reports, where('uid', '==', uid))),
    owner ? getDocs(query(reports, where('shared', '==', true))) : Promise.resolve(null),
  ])
  const all = new Map([...mine.docs, ...(shared?.docs ?? [])].map((d) => [d.id, d]))
  for (const [id, snap] of all) {
    const r = snap.data() as OldReport
    const oldBody = doc(reports, id, 'content', 'body')
    const inline = r.sections !== undefined
    const b: Partial<ReportBody> = inline ? r : ((await getDoc(oldBody).catch(() => null))?.data() as Partial<ReportBody> | undefined) ?? {}
    const body: DocBody = {
      answer: (r.answer ?? '').slice(0, 4000),
      sections: b.sections ?? [],
      implications: b.implications ?? [],
      openQuestions: b.openQuestions ?? [],
      sources: b.sources ?? [],
    }
    const excerpt = (r.answer ?? '').replace(/\s+/g, ' ').trim().slice(0, DOC_LIMITS.excerpt)
    const summary: Doc = {
      kind: 'report',
      title: (r.title || 'untitled report').slice(0, DOC_LIMITS.title),
      ...(excerpt ? { excerpt } : {}),
      origin: 'moved',
      uid: r.uid,
      name: (r.name || 'someone').slice(0, 200),
      shared: r.shared === true,
      size: bytes(JSON.stringify(body)),
      sections: body.sections!.length,
      sources: body.sources!.length,
      ...(r.topic ? { topic: r.topic.slice(0, 500) } : {}),
      ...(r.model ? { model: r.model.slice(0, 100) } : {}),
      reportKind: r.kind ?? 'research',
      createdAt: r.createdAt || Date.now(),
      updatedAt: Date.now(),
    }
    const there = await getDoc(docRef(wid, id)).then((s) => s.exists(), () => false)
    const batch = writeBatch(db())
    if (!there) {
      batch.set(docRef(wid, id), summary)
      batch.set(bodyRef(wid, id), body)
    }
    if (!inline) batch.delete(oldBody)
    batch.delete(snap.ref)
    await batch.commit().catch((e) => console.warn(`[documents] couldn't move report ${id}`, e))
  }
}
