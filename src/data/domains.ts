// Domains inside a workspace (D-039). Deleting one leaves its items unsorted rather than deleting them.
import { addDoc, arrayRemove, collection, deleteDoc, deleteField, doc, getDocs, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from './firebase'
import type { Domain } from './model'

const col = (wid: string, name: string) => collection(db(), 'workspaces', wid, name)

export async function createDomain(wid: string, name: string) {
  const domain: Domain = { name, createdAt: Date.now() }
  const ref = await addDoc(col(wid, 'domains'), domain)
  return ref.id
}

export function renameDomain(wid: string, id: string, name: string) {
  return updateDoc(doc(col(wid, 'domains'), id), { name })
}

const SINGLE = ['problems', 'ideas']
const MULTI = ['customers', 'competitors', 'features']
const BATCH_LIMIT = 450

export async function deleteDomain(wid: string, id: string) {
  const updates: [ReturnType<typeof doc>, Record<string, unknown>][] = []
  for (const name of SINGLE) {
    const snap = await getDocs(col(wid, name))
    for (const d of snap.docs) if (d.data().domainId === id) updates.push([d.ref, { domainId: deleteField() }])
  }
  for (const name of MULTI) {
    const snap = await getDocs(col(wid, name))
    for (const d of snap.docs) {
      if ((d.data().domainIds as string[] | undefined)?.includes(id)) updates.push([d.ref, { domainIds: arrayRemove(id) }])
    }
  }
  for (let i = 0; i < updates.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db())
    for (const [ref, data] of updates.slice(i, i + BATCH_LIMIT)) batch.update(ref, data)
    await batch.commit()
  }
  // The domain goes last, so a failure part-way leaves it visible to retry.
  await deleteDoc(doc(col(wid, 'domains'), id))
}
