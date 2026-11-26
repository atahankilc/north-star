// A workspace as one person sees it, live on the server (D-434): the same collections the app listens to
// (src/data/workspaceData.ts), turned into the same snapshot by the same converter (src/model/fromDocs.ts), read through
// the rules as that person (person.ts). What the app's agent reads beside the store comes too: the notes' text, the change
// log, the members (src/agent/ui/agentStore.ts' liveWs). Read only: nothing here writes.
//
// A listener that is open when its person is removed isn't told (P0's spike), so this snapshot never decides who may:
// the run checks membership apart, before each step (membership.ts).
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query, where, type DocumentData, type Query, type Unsubscribe } from 'firebase/firestore'
import type { AgentWs } from '../../../src/agent/contract'
import type { DocBody } from '../../../src/data/documents'
import { fromDocs, WS_COLLECTIONS, type Docs, type RawDoc } from '../../../src/model/fromDocs'
import { fromChangeDoc, type ChangeEntry } from '../../../src/model/changeLog'
import { MAIN } from '../../../src/model/canvases'
import { CHANGES_READ, MEMBERS_READ } from '../../../src/model/limits'
import { NOTES_ID } from '../../../src/model/notes'
import type { Person } from './person'

export type ServerWorkspace = {
  // The workspace now; throws what a listener said when one was refused.
  get: () => AgentWs
  // A document's text, read once into the snapshot (agent-bugs 1, 25); nothing when the rules refuse it.
  loadBody: (id: string) => Promise<DocBody | null>
  close: () => void
}

// `canvas`: the one the person has open; `now`: the run's clock, when it isn't this machine's (the evals). Resolves once every listener has answered.
export async function openWorkspace(person: Person, wid: string, o: { canvas?: string; now?: () => number } = {}): Promise<ServerWorkspace> {
  const ws = (...path: string[]) => ['workspaces', wid, ...path] as [string, ...string[]]
  const raw = Object.fromEntries(WS_COLLECTIONS.map((c) => [c, [] as RawDoc[]])) as unknown as Docs
  const documents: { shared: RawDoc[]; mine: RawDoc[] } = { shared: [], mine: [] }
  const bodies: Record<string, DocBody> = {}
  let workspace: (DocumentData & { id: string }) | null = null
  let notes: string | null = null
  let changeLog: ChangeEntry[] = []
  let members: { uid: string; name: string; email?: string }[] = []
  let failed: Error | null = null
  let made: AgentWs | null = null
  const offs: Unsubscribe[] = []
  const dirty = () => void (made = null)
  const close = () => offs.splice(0).forEach((off) => off())

  // One listener: kept while the workspace is open; `first` resolves with its first answer. An optional one that is
  // refused reads as empty (the app's own choice for the notes, the log and the members).
  const listen = (q: Query, set: (docs: RawDoc[]) => void, optional = false) =>
    new Promise<void>((resolve, reject) => {
      offs.push(
        onSnapshot(
          q,
          (snap) => {
            set(snap.docs.map((d) => ({ ...d.data(), id: d.id })))
            dirty()
            resolve()
          },
          (e) => {
            if (optional) return resolve()
            failed = e
            reject(e)
          },
        ),
      )
    })
  const col = (name: string) => collection(person.db, ...ws(name))
  const listenDoc = (path: [string, ...string[]], set: (d: RawDoc | null) => void, optional = false) =>
    new Promise<void>((resolve, reject) => {
      offs.push(
        onSnapshot(
          doc(person.db, ...path),
          (d) => {
            set(d.exists() ? { ...d.data(), id: d.id } : null)
            dirty()
            resolve()
          },
          (e) => {
            if (optional) return resolve()
            failed = e
            reject(e)
          },
        ),
      )
    })

  try {
    await Promise.all([
      listenDoc(ws() as [string, ...string[]], (d) => void (workspace = d)),
      ...WS_COLLECTIONS.map((c) => listen(col(c), (docs) => void (raw[c] = docs))),
      listen(query(col('documents'), where('shared', '==', true)), (docs) => void (documents.shared = docs)),
      listen(query(col('documents'), where('uid', '==', person.uid)), (docs) => void (documents.mine = docs)),
      listen(query(col('changes'), orderBy('at', 'desc'), limit(CHANGES_READ)), (docs) => void (changeLog = docs.flatMap(({ id, ...d }) => fromChangeDoc(id, d) ?? [])), true),
      listen(query(col('members'), orderBy('name'), limit(MEMBERS_READ)), (docs) => void (members = docs.map((d) => ({ uid: d.id, name: String(d.name ?? ''), ...(d.email ? { email: String(d.email) } : {}) }))), true),
    ])
    // The notes' body is listened to only when its summary is there (its rule reads the summary).
    if (documents.shared.some((d) => d.id === NOTES_ID)) await listenDoc(ws('documents', NOTES_ID, 'content', 'body'), (d) => void (notes = d ? String(d.text ?? '') : null), true)
  } catch (e) {
    close()
    throw e
  }

  const get = (): AgentWs => {
    if (failed) throw failed
    if (!workspace) throw new Error('the workspace is gone')
    if (made) return made
    const seen = new Map<string, RawDoc>()
    for (const d of [...documents.shared, ...documents.mine]) seen.set(d.id, d)
    const docs = [...seen.values()].sort((a, b) => Number(b.createdAt) - Number(a.createdAt)) as unknown as AgentWs['documents']
    const held = { ...bodies, ...(notes !== null ? { [NOTES_ID]: { text: notes } } : {}) }
    made = {
      ...fromDocs(raw, docs),
      wid,
      workspace: workspace as unknown as AgentWs['workspace'],
      canvas: o.canvas ?? MAIN,
      me: person.uid,
      ...(o.now ? { now: o.now() } : {}),
      ...(Object.keys(held).length ? { bodies: held } : {}),
      ...(changeLog.length ? { changeLog } : {}),
      ...(members.length ? { members } : {}),
    }
    return made
  }

  return {
    get,
    close,
    loadBody: async (id) => {
      const body = await getDoc(doc(person.db, ...ws('documents', id, 'content', 'body'))).then(
        (d) => (d.exists() ? (d.data() as DocBody) : null),
        () => null,
      )
      if (body) {
        bodies[id] = body
        dirty()
      }
      return body
    },
  }
}
