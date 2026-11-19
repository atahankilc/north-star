// Folders of documents (D-415, docs/specs/shell.md step 3): `folders/{id}`, a name and the folder it's in (`parent`;
// none: at the top). A document says the folder it's in (`folderId`, documents.ts). Folders are the workspace's content
// (firestore.rules' content shapes): every member sees them, owners and editors make, rename, move and delete them. A document is moved by its author, or by an
// owner or editor once it's shared (firestore.rules). Every write through tracked(): one undo step each.
import { collection, deleteField, doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from './firebase'
import { absent, tracked } from './history'
import type { WithId } from './hooks'
import type { Doc } from './documents'
import { FOLDER_NAME_MAX } from '../model/limits'
import { cut } from '../model/words'

export type Folder = { name: string; parent?: string; uid: string; createdAt: number; updatedAt: number }

const foldersOf = (wid: string) => collection(db(), 'workspaces', wid, 'folders')
const folderRef = (wid: string, id: string) => doc(foldersOf(wid), id)
const docRef = (wid: string, id: string) => doc(db(), 'workspaces', wid, 'documents', id)

const folderName = (name: string) => cut(name.trim(), FOLDER_NAME_MAX) || 'untitled folder'

// A new folder in `parent` (null: at the top); its id.
export async function makeFolder(wid: string, parent: string | null, name: string, uid: string): Promise<string> {
  const ref = doc(foldersOf(wid))
  const now = Date.now()
  await tracked('make a folder', [ref], () => setDoc(ref, { name: folderName(name), ...(parent && { parent }), uid, createdAt: now, updatedAt: now }), { before: absent([ref]) })
  return ref.id
}

export function renameFolder(wid: string, id: string, name: string) {
  const ref = folderRef(wid, id)
  return tracked('rename a folder', [ref], () => updateDoc(ref, { name: folderName(name), updatedAt: Date.now() }), { key: `folder-name:${id}` })
}

// A document into a folder (null: to the top).
export function moveDocument(wid: string, id: string, folder: string | null) {
  const ref = docRef(wid, id)
  return tracked('move a document', [ref], () => updateDoc(ref, { folderId: folder ?? deleteField(), updatedAt: Date.now() }))
}

// A folder deleted: what was in it (its folders, the documents you may move) goes to where it was. One undo step.
export function deleteFolder(wid: string, id: string, folders: WithId<Folder>[], docs: WithId<Doc>[], mayMove: (d: WithId<Doc>) => boolean) {
  const ref = folderRef(wid, id)
  const parent = folders.find((f) => f.id === id)?.parent
  const kids = folders.filter((f) => f.parent === id)
  const inIt = docs.filter((d) => d.folderId === id && mayMove(d))
  const refs = [ref, ...kids.map((f) => folderRef(wid, f.id)), ...inIt.map((d) => docRef(wid, d.id))]
  return tracked('delete a folder', refs, () => {
    const batch = writeBatch(db())
    const now = Date.now()
    for (const f of kids) batch.update(folderRef(wid, f.id), { parent: parent ?? deleteField(), updatedAt: now })
    for (const d of inIt) batch.update(docRef(wid, d.id), { folderId: parent ?? deleteField(), updatedAt: now })
    batch.delete(ref)
    return batch.commit()
  })
}
