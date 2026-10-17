// Attachments (D-083): images, SVGs and PDFs on an item. The file goes to Storage at
// workspaces/{wid}/attachments/{id}/{safe name}, its metadata to Firestore at workspaces/{wid}/attachments/{id}.
// Undo only covers Firestore (history.ts), so deleting an attachment (or its item) removes only the doc and the file
// stays; undo brings the doc back with its file intact. Files without a doc are swept after a day (sweepOrphans).
// Loading: a workspace loads only the records (small docs, live, like every collection). No file is fetched until it's
// looked at: a panel shows each image's small thumbnail, the full image loads in the lightbox, a PDF only when opened,
// and the board shows just a count.
// Rules: firestore.rules (attachments) and storage.rules.
import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore'
import {
  deleteObject,
  getBytes,
  getDownloadURL,
  getMetadata,
  listAll,
  ref,
  uploadBytes,
  uploadBytesResumable,
  type FirebaseStorage,
  type StorageReference,
} from 'firebase/storage'
import { useEffect, useState } from 'react'
import { db, firebase, useEmulators } from './firebase'
import { absent, tracked } from './history'
import { ATTACHMENT_MAX_BYTES, ATTACHMENT_TYPES, type Attachment, type AttachmentType, type NodeType } from './model'

// Storage needs the Blaze plan (D-015, D-083). Until storage.rules are deployed on the live project, attachments are
// shown only on the emulators. Set to true in the same change that deploys them (and sets the bucket's CORS, cors.json).
const ATTACHMENTS_LIVE = false
export const attachmentsAvailable = useEmulators || ATTACHMENTS_LIVE

// Images bigger than this on a side, or heavier than SHRINK_OVER_BYTES, are shrunk to fit before upload (Q-009).
const MAX_SIDE = 2560
const SHRINK_OVER_BYTES = 2 * 1024 * 1024
const WEBP_QUALITY = 0.85
const SHRINKABLE: AttachmentType[] = ['image/png', 'image/jpeg', 'image/webp']
// Panels show this instead of the file, so opening one costs a few tens of KB per image, not megabytes.
const THUMB_SIDE = 320
const THUMB_QUALITY = 0.8
// Never a real file's name: safeFileName keeps only letters, digits, `.`, `-` and `_`.
const THUMB_NAME = '~thumb.webp'

const DAY_MS = 24 * 60 * 60 * 1000

function storage(): FirebaseStorage {
  if (!firebase) throw new Error('Firebase is not configured')
  return firebase.storage
}

const attachmentsCol = (wid: string) => collection(db(), 'workspaces', wid, 'attachments')
const prefix = (wid: string) => `workspaces/${wid}/attachments`

export class AttachmentError extends Error {}

const BY_EXTENSION: Record<string, AttachmentType> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
}

// The browser's type, or the extension's when it gives none.
export function attachmentType(file: { name: string; type: string }): AttachmentType | null {
  if ((ATTACHMENT_TYPES as readonly string[]).includes(file.type)) return file.type as AttachmentType
  if (file.type) return null
  return BY_EXTENSION[file.name.split('.').pop()?.toLowerCase() ?? ''] ?? null
}

export const isImage = (a: Pick<Attachment, 'contentType'>) => a.contentType !== 'application/pdf' && a.contentType !== 'image/svg+xml'

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// "My photo (1).PNG" → "My-photo-1-.PNG": safe in a Storage path and a zip.
export function safeFileName(name: string): string {
  const clean = name
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^[.-]+/, '')
    .slice(-100)
  return clean || 'file'
}

type Prepared = { blob: Blob; name: string; contentType: AttachmentType; width?: number; height?: number; thumb?: Blob }

function drawTo(bitmap: ImageBitmap, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas
}

const webpOf = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality)).then((b) => (b?.type === 'image/webp' ? b : null))

// A small WebP of an image (a GIF's first frame), or null if the browser can't make one.
const thumbnailOf = (bitmap: ImageBitmap) => webpOf(drawTo(bitmap, THUMB_SIDE), THUMB_QUALITY)

// For import: the thumbnail of a file from a bundle.
async function thumbnailOfBytes(bytes: Uint8Array, contentType: AttachmentType): Promise<Blob | null> {
  if (!isImage({ contentType })) return null
  try {
    const bitmap = await createImageBitmap(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: contentType }))
    const thumb = await thumbnailOf(bitmap)
    bitmap.close()
    return thumb
  } catch {
    return null
  }
}

// Checks the file and shrinks big photos (Q-009): over 2560 px on a side or over 2 MB, a PNG, JPEG or WebP is resized to
// fit 2560 px and saved as WebP (quality 0.85), unless that comes out bigger. GIFs (maybe animated), SVGs and PDFs stay as they are.
export async function prepareFile(file: File): Promise<Prepared> {
  const type = attachmentType(file)
  if (!type) throw new AttachmentError(`${file.name} can't be attached: only images (PNG, JPEG, WebP, GIF, SVG) and PDFs can.`)
  let out: Prepared = { blob: file, name: file.name, contentType: type }

  if (type !== 'image/svg+xml' && type !== 'application/pdf') {
    let bitmap: ImageBitmap
    try {
      bitmap = await createImageBitmap(file)
    } catch {
      throw new AttachmentError(`${file.name} couldn't be read as an image.`)
    }
    out = { ...out, width: bitmap.width, height: bitmap.height }
    if (SHRINKABLE.includes(type) && (Math.max(bitmap.width, bitmap.height) > MAX_SIDE || file.size > SHRINK_OVER_BYTES)) {
      const canvas = drawTo(bitmap, MAX_SIDE)
      // Some browsers can't write WebP (null): keep the original then, and also when the WebP comes out bigger.
      const webp = await webpOf(canvas, WEBP_QUALITY)
      if (webp && webp.size < file.size) {
        out = { blob: webp, name: file.name.replace(/\.[^.]*$/, '') + '.webp', contentType: 'image/webp', width: canvas.width, height: canvas.height }
      }
    }
    out.thumb = (await thumbnailOf(bitmap)) ?? undefined
    bitmap.close()
  }

  if (out.blob.size >= ATTACHMENT_MAX_BYTES) {
    throw new AttachmentError(`${file.name} is ${formatSize(out.blob.size)}; files can be up to 10 MB.`)
  }
  return out
}

// Uploads the file, then records it (one undo step). `onProgress` gets 0..1 while the bytes go up.
export async function attachFile(
  wid: string,
  node: { id: string; type: NodeType },
  file: File,
  uid: string,
  onProgress: (fraction: number) => void,
): Promise<void> {
  const prepared = await prepareFile(file)
  const docRef = doc(attachmentsCol(wid))
  const path = `${prefix(wid)}/${docRef.id}/${safeFileName(prepared.name)}`
  const thumbPath = `${prefix(wid)}/${docRef.id}/${THUMB_NAME}`
  // The thumbnail is tiny: it goes up alongside, and a failed one only means the panel shows the full image.
  const thumb = prepared.thumb
    ? uploadBytes(ref(storage(), thumbPath), prepared.thumb, { contentType: 'image/webp' }).then(() => true, () => false)
    : Promise.resolve(false)
  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(ref(storage(), path), prepared.blob, { contentType: prepared.contentType })
    task.on('state_changed', (s) => onProgress(s.totalBytes ? s.bytesTransferred / s.totalBytes : 0), reject, () => resolve())
  })
  const hasThumb = await thumb
  const data: Attachment = {
    nodeId: node.id,
    nodeType: node.type,
    name: prepared.name.slice(0, 200),
    contentType: prepared.contentType,
    size: prepared.blob.size,
    path,
    ...(prepared.width && prepared.height && { width: prepared.width, height: prepared.height }),
    ...(hasThumb && { thumbPath }),
    uid,
    createdAt: Date.now(),
  }
  await tracked(`attach "${data.name}"`, [docRef], () => setDoc(docRef, data), { before: absent([docRef]) })
}

// Removes only the record; the file stays so undo can bring it back (swept a day later if nothing does).
export function removeAttachment(wid: string, id: string, name: string) {
  const docRef = doc(attachmentsCol(wid), id)
  return tracked(`remove "${name}"`, [docRef], () => deleteDoc(docRef))
}

// ---- Showing files

const urls = new Map<string, Promise<string>>()

function attachmentUrl(path: string): Promise<string> {
  let url = urls.get(path)
  if (!url) {
    url = getDownloadURL(ref(storage(), path))
    urls.set(path, url)
    // A failure isn't cached: the file may come back (an undo, a slow upload).
    url.catch(() => urls.delete(path))
  }
  return url
}

export type FileUrl = { url: string | null; state: 'loading' | 'ready' | 'missing' | 'failed' }

// The file's download URL, or why there is none (e.g. "file missing" after an undo past a sweep).
export function useAttachmentUrl(path: string | null): FileUrl {
  const [state, setState] = useState<FileUrl>({ url: null, state: 'loading' })
  useEffect(() => {
    let live = true
    setState({ url: null, state: 'loading' })
    if (!path) return
    attachmentUrl(path).then(
      (url) => live && setState({ url, state: 'ready' }),
      (err: { code?: string }) => live && setState({ url: null, state: err.code === 'storage/object-not-found' ? 'missing' : 'failed' }),
    )
    return () => {
      live = false
    }
  }, [path])
  return state
}

// ---- Export, import, clean-up

// The file's bytes, for the export (needs the bucket's CORS on the live site, cors.json). Null if it's gone.
export async function attachmentBytes(path: string): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(await getBytes(ref(storage(), path)))
  } catch {
    return null
  }
}

// Import: puts a file from a bundle under a new attachment id. Returns the record to write once its item exists.
export async function uploadImported(
  wid: string,
  bytes: Uint8Array,
  meta: Omit<Attachment, 'path' | 'size' | 'thumbPath'>,
): Promise<{ id: string; data: Attachment }> {
  const docRef = doc(attachmentsCol(wid))
  const path = `${prefix(wid)}/${docRef.id}/${safeFileName(meta.name)}`
  const thumbPath = `${prefix(wid)}/${docRef.id}/${THUMB_NAME}`
  await uploadBytes(ref(storage(), path), bytes, { contentType: meta.contentType })
  const thumb = await thumbnailOfBytes(bytes, meta.contentType)
  const hasThumb = Boolean(thumb) && (await uploadBytes(ref(storage(), thumbPath), thumb!, { contentType: 'image/webp' }).then(() => true, () => false))
  return { id: docRef.id, data: { ...meta, size: bytes.byteLength, path, ...(hasThumb && { thumbPath }) } }
}

async function listFiles(dir: StorageReference): Promise<StorageReference[]> {
  const res = await listAll(dir)
  const nested = await Promise.all(res.prefixes.map(listFiles))
  return [...res.items, ...nested.flat()]
}

// Workspace delete: every file goes first, while you're still a member (the rules check the workspace doc).
export async function deleteAttachmentFiles(wid: string): Promise<void> {
  if (!attachmentsAvailable) return
  const files = await listFiles(ref(storage(), prefix(wid)))
  await Promise.all(files.map((f) => deleteObject(f)))
}

const sweptKey = (wid: string) => `north-star.attachments-swept.${wid}`

// Files with no record that are over a day old: removed attachments nobody brought back, or uploads whose record was
// never written. At most once a day per browser and workspace.
export async function sweepOrphans(wid: string): Promise<number> {
  if (!attachmentsAvailable) return 0
  try {
    const last = Number(localStorage.getItem(sweptKey(wid)) ?? 0)
    if (Date.now() - last < DAY_MS) return 0
    localStorage.setItem(sweptKey(wid), String(Date.now()))
  } catch {
    return 0
  }
  const known = new Set((await getDocs(attachmentsCol(wid))).docs.map((d) => d.id))
  const root = await listAll(ref(storage(), prefix(wid)))
  let removed = 0
  for (const folder of root.prefixes) {
    if (known.has(folder.name)) continue
    for (const file of await listFiles(folder)) {
      const meta = await getMetadata(file)
      if (Date.now() - Date.parse(meta.timeCreated) <= DAY_MS) continue
      await deleteObject(file)
      removed++
    }
  }
  return removed
}

export function useOrphanSweep(wid: string) {
  useEffect(() => {
    if (!attachmentsAvailable) return
    sweepOrphans(wid).catch(() => {})
  }, [wid])
}
