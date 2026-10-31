// Seeds for the flows, written through the Firebase client SDK against the emulators (auth 9099, Firestore FS_PORT),
// as the test users the app's "sign in as" makes (`test-<name>`). Each call signs in on an app instance of its own.
import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, GoogleAuthProvider, signInWithCredential } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore, doc, collection, writeBatch, setDoc, updateDoc } from 'firebase/firestore'

const FS_PORT = Number(process.env.FS_PORT ?? 8080)
let n = 0
// Signed in as `name` (the app's test-user id: test-<lowercased name>): its uid and a Firestore handle.
export async function as(name) {
  const app = initializeApp({ apiKey: 'demo-key', projectId: 'demo-north-star' }, `seed-${++n}-${Date.now()}`)
  const auth = getAuth(app)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  const fs = getFirestore(app)
  connectFirestoreEmulator(fs, '127.0.0.1', FS_PORT)
  const slug = name.toLowerCase()
  const u = (await signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub: `test-${slug}`, email: `${slug}@example.com`, email_verified: true, name })))).user
  return { uid: u.uid, fs, name }
}

// A seen-state doc (users/{uid}/private/onboarding, D-315 §5.3) for someone who's been here: welcome done.
export const seenDoc = ({ seen = {}, tipsOff = false, lastRelease = 'launch', days = 20 } = {}) => {
  const t0 = Date.now()
  return { v: 1, audience: 'new', startedAt: t0 - 864e5 * days, seen: { welcome: 1, ...seen }, armed: [], tipsOff, lastRelease, welcome: 'done', ...(tipsOff ? { at: { tipsOff: t0 - 864e5 } } : {}), updatedAt: t0 - 864e5 }
}
export async function writeSeen(user, d) {
  await setDoc(doc(user.fs, 'users', user.uid, 'private', 'onboarding'), d)
}

// "Pazar" (the fixtures' made-up startup: home cooks selling lunch to office workers), filled: two planes of cards with
// links, and a deck with tasks. Owner `owner`; `members`: [{ user, role }] added straight to the workspace (as if they
// had accepted). Returns { wid, planes, deck }.
export async function seedPazar(owner, members = [], { name = 'Pazar', made } = {}) {
  const fs = owner.fs
  const w = doc(collection(fs, 'workspaces'))
  const now = Date.now()
  await setDoc(w, { name, ownerId: owner.uid, memberIds: [owner.uid], roles: { [owner.uid]: 'owner' }, inviteCode: 'ZZ' + now.toString(36).toUpperCase().slice(-6), createdAt: made ?? now })
  if (members.length) {
    const roles = { [owner.uid]: 'owner' }
    for (const m of members) roles[m.user.uid] = m.role
    await updateDoc(w, { memberIds: [owner.uid, ...members.map((m) => m.user.uid)], roles })
  }
  await setDoc(doc(fs, 'workspaces', w.id, 'members', owner.uid), { name: owner.name, email: `${owner.name.toLowerCase()}@example.com`, joinedAt: now })
  const sub = (c) => doc(collection(fs, 'workspaces', w.id, c))
  const b = writeBatch(fs)
  const p1 = sub('pieces'), p2 = sub('pieces'), deck = sub('pieces')
  b.set(p1, { kind: 'plane', x: 0, y: 0, w: 1200, h: 600, name: '01 Who and why', createdAt: now, updatedAt: now })
  b.set(p2, { kind: 'plane', x: 1300, y: 0, w: 1000, h: 600, name: '02 Rivals', createdAt: now + 1, updatedAt: now + 1 })
  const c = (col, piece, f, x, y, i) => { const r = sub(col); b.set(r, { ...f, pieceId: piece.id, x, y, createdAt: now + 10 + i, updatedAt: now + 10 + i }); return r }
  const cu = ['Office workers near Kadıköy', 'Home cooks with spare portions', 'Students on a budget'].map((title, i) => c('customers', p1, { title }, 25 + i * 250, 50, i))
  const pr = ['Lunch is slow and costs €14', 'Leftovers go to waste'].map((title, i) => c('problems', p1, { title, status: i ? 'hypothesis' : 'testing' }, 25 + i * 250, 250, 10 + i))
  const id = ['Cooks sell tomorrow’s lunch the night before', 'A pickup shelf in each lobby'].map((title, i) => c('ideas', p1, { title }, 25 + i * 250, 425, 20 + i))
  const co = ['Wolt', 'Yemeksepeti', 'Shef'].map((nm, i) => c('competitors', p2, { name: nm }, 25 + i * 250, 50, 30 + i))
  const fe = ['Pre-order by 9 pm', 'Allergen labels on every dish'].map((title, i) => c('features', p2, { title }, 25 + i * 250, 300, 40 + i))
  const e = (from, fromType, to, toType, kind) => b.set(sub('edges'), { fromId: from.id, fromType, toId: to.id, toType, kind, createdAt: now, updatedAt: now })
  e(id[0], 'idea', pr[0], 'problem', 'solves')
  e(id[1], 'idea', pr[0], 'problem', 'solves')
  e(pr[0], 'problem', cu[0], 'customer', 'for')
  e(pr[1], 'problem', cu[1], 'customer', 'for')
  e(fe[0], 'feature', id[0], 'idea', 'relates')
  b.set(deck, { kind: 'kanban', x: 0, y: 700, w: 900, h: 450, name: '03 This week', kanban: { cols: [{ id: 'todo', name: 'todo' }, { id: 'doing', name: 'doing' }, { id: 'done', name: 'done', done: true }] }, createdAt: now + 2, updatedAt: now + 2 })
  const day = (d) => new Date(now + d * 864e5).toISOString().slice(0, 10)
  ;[['Ask two lobbies about a shelf', 'todo', 2], ['Cook a test batch for 10', 'doing', 1], ['Price check: Wolt lunch menu', 'done', -1], ['Write the night-before order form', 'todo', 5]].forEach(([title, col, due], i) =>
    b.set(sub('tasks'), { pieceId: deck.id, col, order: i, title, due: day(due), uid: owner.uid, createdAt: now + 50 + i, updatedAt: now + 50 + i }))
  await b.commit()
  return { wid: w.id, planes: [p1.id, p2.id], deck: deck.id }
}
