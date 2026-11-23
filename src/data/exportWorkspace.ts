// Export (D-080, D-246): every content collection read once, whole, when asked, and the documents you may see with their
// content.
import { collection, getDoc, getDocs, query, where } from 'firebase/firestore'
import { BUNDLE_COLLECTIONS, makeBundle, type Bundle, type BundleCollection, type BundleDocument, type Raw } from '../io/bundle'
import { bodyRef, filesAvailable, readFile, type DocBody } from './documents'
import { db } from './firebase'

// `leftOut`: documents that are files (images, PDFs) that stayed behind: before Storage is live (D-083), or one that
// couldn't be read. With it, a file travels in the .zip under files/<id>/ with its thumbnail (D-425).
export async function exportWorkspace(wid: string, uid: string, workspace: { name: string; description?: string }): Promise<{ bundle: Bundle; leftOut: number }> {
  const col = (name: string) => collection(db(), 'workspaces', wid, name)
  const snaps = await Promise.all(BUNDLE_COLLECTIONS.map((c) => getDocs(col(c))))
  const data = Object.fromEntries(
    BUNDLE_COLLECTIONS.map((c, i) => [c, snaps[i].docs.map((d) => ({ ...d.data(), id: d.id }) as Raw)]),
  ) as Record<BundleCollection, Raw[]>

  // The shared ones and your own: the two queries the rules can prove (documents.ts).
  const [shared, mine] = await Promise.all([getDocs(query(col('documents'), where('shared', '==', true))), getDocs(query(col('documents'), where('uid', '==', uid)))])
  const summaries = new Map([...shared.docs, ...mine.docs].map((d) => [d.id, { ...d.data(), id: d.id } as Raw]))
  const textual = [...summaries.values()].filter((d) => d.kind === 'markdown' || d.kind === 'report')
  const documents: BundleDocument[] = await Promise.all(
    textual.map(async (d) => {
      // Who added it stays here; the name they had is kept to show.
      const { uid: _uid, path: _path, thumbPath: _thumb, ...rest } = d
      const body = (await getDoc(bodyRef(wid, d.id))).data() as DocBody | undefined
      return { ...rest, body: body ?? {} }
    }),
  )
  const files: Record<string, Uint8Array> = {}
  const fileDocs = filesAvailable ? [...summaries.values()].filter((d) => (d.kind === 'image' || d.kind === 'pdf') && typeof d.path === 'string') : []
  const bytes = async (path: string) => new Uint8Array(await (await readFile(path)).arrayBuffer())
  const carried = await Promise.all(
    fileDocs.map(async (d): Promise<BundleDocument | null> => {
      const { uid: _uid, path, thumbPath, ...rest } = d
      try {
        const file = `files/${d.id}/${String(path).split('/').pop()}`
        files[file] = await bytes(String(path))
        const thumb = typeof thumbPath === 'string' ? `files/${d.id}/thumb.webp` : undefined
        if (thumb) files[thumb] = await bytes(String(thumbPath)).catch(() => new Uint8Array())
        return { ...rest, file, ...(thumb && files[thumb].length && { thumb }) }
      } catch {
        return null
      }
    }),
  )
  const sent = carried.filter((d): d is BundleDocument => !!d)
  return { bundle: { ...makeBundle(workspace, data, [...documents, ...sent]), files }, leftOut: summaries.size - textual.length - sent.length }
}
