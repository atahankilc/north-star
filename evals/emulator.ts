// The eval's emulator mode (S13, D-312; agent.md §6 Phase 5's gates "one undo returns the workspace exactly" and "what
// was applied equals what was previewed"): `npm run eval -- --emulator`. The same runner and graders, but every accept
// goes through the REAL apply (src/ops/firestore.ts: validate, one tracked() step in src/data/history.ts, batched
// writes) into the running Firestore emulator, as a signed-in member, under the real firestore.rules; the end state is
// read back from Firestore, and `undoRestores` runs the real history undo and reads the workspace back again.
//
// Loaded only by evals/cli.mjs with --emulator, after it sets VITE_USE_EMULATORS=true, so src/data/firebase.ts (not
// changed) connects its app to the emulators (demo-north-star; auth 9099, Firestore 8080) instead of the real project.
// Nothing else in src/ is shimmed: firebase/auth and firebase/firestore run in node (Firestore over gRPC).
//
// Each attempt: a new workspace id; the fixture's docs written with the emulator's admin access (REST `Bearer owner`,
// which only the emulator accepts) with the workspace doc's roles giving the acting person their role; the auth
// emulator signs in as the fixture's person (an unsigned custom token, accepted only by the emulator); listeners on every
// collection (as the app has: history reads the cache); the start read back from Firestore (what graders compare with).
import { signInWithCustomToken } from 'firebase/auth'
import { collection, doc, getDocFromServer, getDocsFromServer, onSnapshot, waitForPendingWrites, type Unsubscribe } from 'firebase/firestore'
import { db, firebase, useEmulators } from '../src/data/firebase'
import { apply } from '../src/ops/firestore'
import { undo, useHistory } from '../src/data/history'
import { OpsRefused, type OpError } from '../src/ops/types'
import { toDocs } from '../src/ops/docs'
import { fromDocs, WS_COLLECTIONS, type Docs, type RawDoc } from '../src/model/fromDocs'
import type { Role } from '../src/data/model'
import type { AgentWs } from '../src/agent/contract'
import type { Writer } from './env'

const PROJECT = 'demo-north-star'
const FIRESTORE = 'http://127.0.0.1:8080'
const BASE = `projects/${PROJECT}/databases/(default)/documents`

export type Emulated = { start: AgentWs; write: Writer; undo: () => Promise<AgentWs>; close: () => void; wid: string }

// A JS value as Firestore's REST API writes it.
function toValue(v: unknown): Record<string, unknown> {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (typeof v === 'string') return { stringValue: v }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } }
  return { mapValue: { fields: fieldsOf(v as Record<string, unknown>) } }
}
const fieldsOf = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, x]) => x !== undefined).map(([k, x]) => [k, toValue(x)]))

// Every doc written with the emulator's admin access (rules don't apply to seeding).
async function seed(wid: string, start: AgentWs, uid: string, role: Role) {
  const store = toDocs(start)
  const writes: unknown[] = []
  const { id: _w, ...workspace } = start.workspace as unknown as Record<string, unknown>
  const roles = { ...(start.workspace.roles ?? {}), [uid]: role }
  writes.push({ update: { name: `${BASE}/workspaces/${wid}`, fields: fieldsOf({ ...workspace, roles, memberIds: [...new Set([...(start.workspace.memberIds ?? []), uid])] }) } })
  for (const c of WS_COLLECTIONS)
    for (const [id, d] of store.get(c) ?? []) {
      const { id: _i, ...fields } = d as Record<string, unknown>
      writes.push({ update: { name: `${BASE}/workspaces/${wid}/${c}/${id}`, fields: fieldsOf(fields) } })
    }
  for (let i = 0; i < writes.length; i += 400) {
    const r = await fetch(`${FIRESTORE}/v1/${BASE}:commit`, { method: 'POST', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ writes: writes.slice(i, i + 400) }) })
    if (!r.ok) throw new Error(`seeding the emulator failed (${r.status}): ${(await r.text()).slice(0, 300)}`)
  }
}

// The auth emulator accepts an unsigned custom token for any uid.
async function signIn(uid: string) {
  const auth = firebase!.auth
  if (auth.currentUser?.uid === uid) return
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const claims = { iss: 'evals@demo-north-star.iam', sub: 'evals@demo-north-star.iam', aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit', iat: now, exp: now + 3600, uid }
  await signInWithCustomToken(auth, `${b64({ alg: 'none', typ: 'JWT' })}.${b64(claims)}.`)
}

// The workspace read back from the server, as the listeners' converters make it (the fixture's extras kept: members,
// messages, document text, me, now; documents aren't a workspace collection here).
async function readBack(wid: string, base: AgentWs): Promise<AgentWs> {
  const docs = Object.fromEntries(
    await Promise.all(WS_COLLECTIONS.map(async (c) => [c, (await getDocsFromServer(collection(db(), 'workspaces', wid, c))).docs.map((d) => ({ ...d.data(), id: d.id }) as RawDoc)])),
  ) as Docs
  const w = await getDocFromServer(doc(db(), 'workspaces', wid))
  const data = fromDocs(docs, base.documents)
  return { ...base, ...data, wid, workspace: { ...(w.data() as AgentWs['workspace']), id: wid } } as AgentWs
}

let n = 0

// A fresh workspace in the emulator holding the fixture, the person signed in, the env's writer and undo.
export async function emulate(start: AgentWs, o: { role: Role; uid?: string; tag?: string }): Promise<Emulated> {
  if (!useEmulators || !firebase) throw new Error('the emulator mode needs VITE_USE_EMULATORS=true (evals/cli.mjs sets it with --emulator)')
  const uid = o.uid ?? start.me ?? start.workspace.ownerId
  const wid = `eval-${(o.tag ?? 'run').replace(/[^a-z0-9-]/gi, '').slice(0, 30)}-${Date.now().toString(36)}-${++n}`
  await seed(wid, start, uid, o.role)
  await signIn(uid)
  useHistory.getState().reset(wid)
  useHistory.setState({ past: [], future: [] })
  // Listeners on every collection, as the app keeps them (history.ts reads the cache), waited for once.
  const offs: Unsubscribe[] = []
  await Promise.all(
    [...WS_COLLECTIONS.map((c) => collection(db(), 'workspaces', wid, c)), doc(db(), 'workspaces', wid)].map(
      (ref) =>
        new Promise<void>((res, rej) => {
          let first = true
          const done = () => (first ? ((first = false), res()) : undefined)
          offs.push('type' in ref && ref.type === 'document' ? onSnapshot(ref, done, rej) : onSnapshot(ref as ReturnType<typeof collection>, done, rej))
        }),
    ),
  )
  const back = await readBack(wid, { ...start, wid })
  const write: Writer = async (plans, as, ws) => {
    try {
      const a = await apply(wid, plans, { actor: 'agent', ...(as.label ? { label: as.label } : {}), ws: { ...ws, wid } as never, by: { uid, role: o.role, agent: true }, ...(as.key ? { key: as.key } : {}), ...(as.mergeAlways ? { mergeAlways: true } : {}) })
      await a.written
      return { ok: true, ws: await readBack(wid, ws), step: a.step }
    } catch (e) {
      const errors: OpError[] = e instanceof OpsRefused ? e.errors : [{ op: 'apply', message: `Firestore refused it: ${(e as Error).message}`, fix: 'check firestore.rules against the plan' }]
      return { ok: false, errors }
    }
  }
  return {
    start: back,
    wid,
    write,
    undo: async () => {
      await undo()
      await waitForPendingWrites(db())
      return readBack(wid, back)
    },
    close: () => offs.forEach((f) => f()),
  }
}



