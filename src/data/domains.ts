// Domains inside a workspace (D-039). Deleting one leaves its items unsorted rather than deleting them. Undoable (history.ts).
import { arrayRemove, collection, deleteDoc, deleteField, doc, getDocs, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from './firebase'
import { absent, tracked } from './history'
import type { Domain } from './model'

const col = (wid: string, name: string) => collection(db(), 'workspaces', wid, name)

export async function createDomain(wid: string, name: string) {
  const domain: Domain = { name, createdAt: Date.now() }
  const ref = doc(col(wid, 'domains'))
  await tracked('new domain', [ref], () => setDoc(ref, domain), { before: absent([ref]) })
  return ref.id
}

export function renameDomain(wid: string, id: string, name: string) {
  const ref = doc(col(wid, 'domains'), id)
  return tracked('rename domain', [ref], () => updateDoc(ref, { name }))
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
  const self = doc(col(wid, 'domains'), id)
  await tracked('delete domain', [...updates.map(([ref]) => ref), self], async () => {
    for (let i = 0; i < updates.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db())
      for (const [ref, data] of updates.slice(i, i + BATCH_LIMIT)) batch.update(ref, data)
      await batch.commit()
    }
    // The domain goes last, so a failure part-way leaves it visible to retry.
    await deleteDoc(self)
  }, { settle: true })
}
