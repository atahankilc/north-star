// Export (D-080, D-246): every content collection read once, whole, when asked, and the documents you may see with their
// content. Cards and text without a space (`pieceId`) aren't the app's (D-248) and stay out.
import { collection, getDoc, getDocs, query, where } from 'firebase/firestore'
import { BUNDLE_COLLECTIONS, makeBundle, type Bundle, type BundleCollection, type BundleDocument, type Raw } from '../io/bundle'
import { ALL_TYPES, CARD_COLLECTION } from './cards'
import { bodyRef, type DocBody } from './documents'
import { db } from './firebase'

// `leftOut`: documents that are files (images, PDFs), which can't travel until Storage is live (D-083).
export async function exportWorkspace(wid: string, uid: string, workspace: { name: string; description?: string }): Promise<{ bundle: Bundle; leftOut: number }> {
  const col = (name: string) => collection(db(), 'workspaces', wid, name)
  const snaps = await Promise.all(BUNDLE_COLLECTIONS.map((c) => getDocs(col(c))))
  const spaced = new Set<string>(['labels', ...ALL_TYPES.map((t) => CARD_COLLECTION[t])])
  const data = Object.fromEntries(
    BUNDLE_COLLECTIONS.map((c, i) => [c, snaps[i].docs.map((d) => ({ ...d.data(), id: d.id }) as Raw).filter((d) => !spaced.has(c) || typeof d.pieceId === 'string')]),
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
  return { bundle: makeBundle(workspace, data, documents), leftOut: summaries.size - textual.length }
}
