// Security-rule tests (Q-011) against the local emulators.
// Run: npm run test:rules
import assert from 'node:assert/strict'
import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, GoogleAuthProvider, signInWithCredential } from 'firebase/auth'
import { connectDatabaseEmulator, get as rtGet, getDatabase, ref, remove as rtRemove, serverTimestamp, set as rtSet } from 'firebase/database'
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { connectStorageEmulator, deleteObject, getBytes, getStorage, ref as fileRef, uploadBytes } from 'firebase/storage'

const PROJECT = 'demo-north-star'
const config = { apiKey: 'demo-key', projectId: PROJECT, databaseURL: `http://127.0.0.1:9010?ns=${PROJECT}-default-rtdb`, storageBucket: `${PROJECT}.appspot.com` }

async function client(name) {
  const app = initializeApp(config, name)
  const auth = getAuth(app)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  const fs = getFirestore(app)
  connectFirestoreEmulator(fs, '127.0.0.1', 8080)
  const rt = getDatabase(app)
  connectDatabaseEmulator(rt, '127.0.0.1', 9010)
  const st = getStorage(app)
  connectStorageEmulator(st, '127.0.0.1', 9199)
  let uid = null
  if (name !== 'anon') {
    const token = JSON.stringify({ sub: `test-${name}`, email: `${name}@example.com`, email_verified: true })
    uid = (await signInWithCredential(auth, GoogleAuthProvider.credential(token))).user.uid
  }
  return { fs, rt, st, uid }
}

// Writes a doc as the emulator's owner, past the rules: for what no client may write any more (old reports, D-248).
const enc = (v) =>
  typeof v === 'string' ? { stringValue: v }
    : typeof v === 'boolean' ? { booleanValue: v }
      : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
        : Array.isArray(v) ? { arrayValue: { values: v.map(enc) } }
          : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } }
async function seed(path, data) {
  const r = await fetch(`http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents/${path}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: enc(data).mapValue.fields }),
  })
  if (!r.ok) throw new Error(await r.text())
}

let passed = 0
let failed = 0
async function check(label, expectAllowed, fn) {
  let allowed = true
  let err
  try {
    await fn()
  } catch (e) {
    allowed = false
    err = e
  }
  const ok = allowed === expectAllowed
  ok ? passed++ : failed++
  console.log(`${ok ? '✔' : '✘'} ${expectAllowed ? 'allow' : 'deny '}  ${label}${ok || !err ? '' : `  (${err.code ?? err.message})`}`)
}
const allow = (l, f) => check(l, true, f)
const deny = (l, f) => check(l, false, f)

const alice = await client('alice')
const bob = await client('bob')
const carol = await client('carol')
const dave = await client('dave')
// Never a member of anything.
const erin = await client('erin')
const anon = await client('anon')

// Alice creates a workspace + invite code in one batch, like createWorkspace().
const wsRef = doc(collection(alice.fs, 'workspaces'))
const wid = wsRef.id
let CODE = 'TESTCODE'
await allow('owner creates workspace + invite code', async () => {
  const b = writeBatch(alice.fs)
  b.set(wsRef, { name: 'Acme', ownerId: alice.uid, memberIds: [alice.uid], roles: { [alice.uid]: 'owner' }, inviteCode: CODE, createdAt: Date.now() })
  b.set(doc(alice.fs, 'inviteCodes', CODE), { workspaceId: wid, createdBy: alice.uid })
  await b.commit()
})
await deny('create workspace owned by someone else', () =>
  addDoc(collection(bob.fs, 'workspaces'), { name: 'x', ownerId: alice.uid, memberIds: [alice.uid], roles: { [alice.uid]: 'owner' }, inviteCode: 'X', createdAt: 1 }),
)
await deny('create workspace granting yourself extra roles', () =>
  addDoc(collection(bob.fs, 'workspaces'), { name: 'x', ownerId: bob.uid, memberIds: [bob.uid], roles: { [bob.uid]: 'owner', [carol.uid]: 'owner' }, inviteCode: 'X', createdAt: 1 }),
)
await deny('invite code for a workspace you do not own', () =>
  writeBatch(bob.fs).set(doc(bob.fs, 'inviteCodes', 'BOBCODE1'), { workspaceId: wid, createdBy: bob.uid }).commit(),
)

const ideas = (fs) => collection(fs, 'workspaces', wid, 'ideas')
await allow('owner reads workspace', () => getDoc(doc(alice.fs, 'workspaces', wid)))
await allow('owner creates idea', () => addDoc(ideas(alice.fs), { title: 'First', pieceId: 'p1', x: 0, y: 0, createdAt: 1, updatedAt: 1 }))

await deny('non-member reads workspace', () => getDoc(doc(bob.fs, 'workspaces', wid)))
await deny('non-member lists ideas', () => getDocs(ideas(bob.fs)))
await deny('non-member creates idea', () => addDoc(ideas(bob.fs), { title: 'x', pieceId: 'p1', x: 0, y: 0 }))
await deny('signed-out user reads invite code', () => getDoc(doc(anon.fs, 'inviteCodes', CODE)))
await allow('signed-in user gets invite code by exact value', () => getDoc(doc(bob.fs, 'inviteCodes', CODE)))
await deny('anyone lists invite codes', () => getDocs(collection(bob.fs, 'inviteCodes')))

const join = (who, fields) => updateDoc(doc(who.fs, 'workspaces', wid), fields)
// D-062: a code no longer joins by itself.
await deny('join directly without a code', () => join(bob, { memberIds: arrayUnion(bob.uid), [`roles.${bob.uid}`]: 'editor' }))

// Join requests (D-062): a code sends a request; the owner approves or denies.
const reqRef = (fs, uid) => doc(fs, 'joinRequests', `${wid}_${uid}`)
const request = (who, extra = {}) => ({ workspaceId: wid, uid: who.uid, name: who.name, email: `${who.name}@example.com`, code: CODE, createdAt: 1, ...extra })
bob.name = 'bob'
carol.name = 'carol'
await deny('request with a wrong code', () => setDoc(reqRef(bob.fs, bob.uid), request(bob, { code: 'WRONG' })))
await deny('request on behalf of someone else', () => setDoc(reqRef(bob.fs, carol.uid), request(carol)))
await deny('request carrying an owner (dropped, D-248)', () => setDoc(reqRef(bob.fs, bob.uid), request(bob, { ownerId: alice.uid })))
await deny('request with someone else\'s email', () => setDoc(reqRef(bob.fs, bob.uid), request(bob, { email: 'alice@example.com' })))
await deny('request with extra fields', () => setDoc(reqRef(bob.fs, bob.uid), request(bob, { role: 'owner' })))
await deny('owner requests to join their own workspace', () => setDoc(reqRef(alice.fs, alice.uid), { ...request(bob), uid: alice.uid, email: 'alice@example.com' }))
await allow('request with the right code', () => setDoc(reqRef(bob.fs, bob.uid), request(bob)))
await deny('request again over a pending one', () => setDoc(reqRef(bob.fs, bob.uid), request(bob, { createdAt: 2 })))
await allow('requester reads their request', () => getDoc(reqRef(bob.fs, bob.uid)))
await allow('requester lists their own requests', () => getDocs(query(collection(bob.fs, 'joinRequests'), where('uid', '==', bob.uid))))
await deny('someone else reads the request', () => getDoc(reqRef(carol.fs, bob.uid)))
await deny('anyone lists all requests', () => getDocs(collection(carol.fs, 'joinRequests')))
await allow('owner lists the workspace\'s requests', () =>
  getDocs(query(collection(alice.fs, 'joinRequests'), where('workspaceId', '==', wid))),
)
await deny('pending requester still cannot read the workspace', () => getDoc(doc(bob.fs, 'workspaces', wid)))
await deny('requester approves themselves', () => join(bob, { memberIds: arrayUnion(bob.uid), [`roles.${bob.uid}`]: 'editor' }))
await allow('owner approves: adds the member and deletes the request', () => {
  const b = writeBatch(alice.fs)
  b.update(doc(alice.fs, 'workspaces', wid), { memberIds: arrayUnion(bob.uid), [`roles.${bob.uid}`]: 'editor' })
  b.delete(reqRef(alice.fs, bob.uid))
  return b.commit()
})
await deny('member requests to join again', () => setDoc(reqRef(bob.fs, bob.uid), request(bob)))
await allow('carol requests', () => setDoc(reqRef(carol.fs, carol.uid), request(carol)))
await deny('a member (not owner) deletes someone\'s request', () => writeBatch(bob.fs).delete(reqRef(bob.fs, carol.uid)).commit())
await allow('owner denies the request', () => writeBatch(alice.fs).delete(reqRef(alice.fs, carol.uid)).commit())
await allow('carol requests again', () => setDoc(reqRef(carol.fs, carol.uid), request(carol)))
await allow('requester withdraws their request', () => writeBatch(carol.fs).delete(reqRef(carol.fs, carol.uid)).commit())

// Email invites (D-062).
await deny('member (not owner) invites an email', () => join(bob, { invitedEmails: arrayUnion('dave@example.com') }))
await deny('uninvited user reads the workspace', () => getDoc(doc(dave.fs, 'workspaces', wid)))
await allow('owner invites an email', () => join(alice, { invitedEmails: arrayUnion('dave@example.com', 'carol@example.com') }))
await allow('invitee reads the workspace doc', () => getDoc(doc(dave.fs, 'workspaces', wid)))
await allow('invitee lists their invites', () =>
  getDocs(query(collection(dave.fs, 'workspaces'), where('invitedEmails', 'array-contains', 'dave@example.com'))),
)
await deny('invitee lists ideas before joining', () => getDocs(ideas(dave.fs)))
await deny('invitee joins as owner', () =>
  join(dave, { memberIds: arrayUnion(dave.uid), [`roles.${dave.uid}`]: 'owner', invitedEmails: arrayRemove('dave@example.com') }),
)
await deny('invitee joins but keeps the invite', () => join(dave, { memberIds: arrayUnion(dave.uid), [`roles.${dave.uid}`]: 'editor' }))
await deny('invitee removes someone else\'s invite', () => join(dave, { invitedEmails: arrayRemove('carol@example.com') }))
await deny('outsider joins on someone else\'s invite', async () => {
  const outsider = await client('erin')
  await join(outsider, { memberIds: arrayUnion(outsider.uid), [`roles.${outsider.uid}`]: 'editor', invitedEmails: arrayRemove('dave@example.com') })
})
await allow('invitee joins', () =>
  join(dave, { memberIds: arrayUnion(dave.uid), [`roles.${dave.uid}`]: 'editor', invitedEmails: arrayRemove('dave@example.com') }),
)
await allow('new member lists ideas', () => getDocs(ideas(dave.fs)))
await allow('invitee declines', () => join(carol, { invitedEmails: arrayRemove('carol@example.com') }))
await deny('declined invitee reads the workspace', () => getDoc(doc(carol.fs, 'workspaces', wid)))

// New code (D-062): the old one stops working.
const OLD_CODE = CODE
CODE = 'NEWCODE2'
await deny('member (not owner) changes the code', () => join(bob, { inviteCode: CODE }))
await allow('owner swaps in a new code', () => {
  const b = writeBatch(alice.fs)
  b.delete(doc(alice.fs, 'inviteCodes', OLD_CODE))
  b.set(doc(alice.fs, 'inviteCodes', CODE), { workspaceId: wid, createdBy: alice.uid })
  b.update(doc(alice.fs, 'workspaces', wid), { inviteCode: CODE })
  return b.commit()
})
await deny('request with the old code', () => setDoc(reqRef(carol.fs, carol.uid), request(carol, { code: OLD_CODE })))
await allow('request with the new code', () => setDoc(reqRef(carol.fs, carol.uid), request(carol)))

await allow('member reads workspace', () => getDoc(doc(bob.fs, 'workspaces', wid)))
await allow('member lists ideas', () => getDocs(ideas(bob.fs)))
await allow('member creates idea', () => addDoc(ideas(bob.fs), { title: 'Bob', pieceId: 'p1', x: 1, y: 1, createdAt: 1, updatedAt: 1 }))
await allow('member renames workspace', () => join(bob, { name: 'Acme 2' }))
await allow('member describes workspace', () => join(bob, { description: 'Shift scheduling for small restaurants' }))
await deny('workspace description too long', () => join(bob, { description: 'x'.repeat(1001) }))
await deny('workspace description not text', () => join(bob, { description: 5 }))

// Content shapes (D-036 to D-038).
const sub = (fs, name) => collection(fs, 'workspaces', wid, name)
const card = { title: 'Card', pieceId: 'p1', x: 0, y: 0, createdAt: 1, updatedAt: 1 }
await deny('unknown collection', () => addDoc(sub(bob.fs, 'secrets'), { title: 'x' }))
await deny('a card on no plane (1.0, D-248)', () => addDoc(ideas(bob.fs), { title: 'x', x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
await deny('idea without a position', () => addDoc(ideas(bob.fs), { title: 'x', createdAt: 1, updatedAt: 1 }))
await deny('idea with a numeric title', () => addDoc(ideas(bob.fs), { ...card, title: 5 }))
await allow('feature with priority, status, effort', () => addDoc(sub(bob.fs, 'features'), { ...card, priority: 'P1', status: 'planned', effort: 'M' }))
await allow('feature with an impact', () => addDoc(sub(bob.fs, 'features'), { ...card, impact: 'high' }))
await deny('feature with an unknown impact', () => addDoc(sub(bob.fs, 'features'), { ...card, impact: 'huge' }))
await deny('feature with an unknown status', () => addDoc(sub(bob.fs, 'features'), { ...card, status: 'someday' }))
// Parts folded into a feature (D-164): on All the feature's, on a plane the placement's.
await allow('feature with its parts folded', () => addDoc(sub(bob.fs, 'features'), { ...card, folded: true }))
await deny('feature folded with a non-bool', () => addDoc(sub(bob.fs, 'features'), { ...card, folded: 'yes' }))
// Packages (D-239).
await allow('a package', () => addDoc(sub(bob.fs, 'packages'), { ...card, memberIds: ['a', 'b'], impact: 'high', effort: 'M' }))
await deny('a package without its members', () => addDoc(sub(bob.fs, 'packages'), { ...card }))
await deny('a package with members that are not a list', () => addDoc(sub(bob.fs, 'packages'), { ...card, memberIds: 'a' }))
await deny('the old board\'s planes (D-248)', () => addDoc(sub(bob.fs, 'planes'), { name: 'Competitors', order: 1, createdAt: 1 }))
await deny('the old board\'s placements (D-248)', () => setDoc(doc(sub(bob.fs, 'placements'), 'p1_c1'), { planeId: 'p1', itemId: 'c1', itemType: 'idea', x: 1, y: 2 }))
// The canvas (D-176): planes placed on it (D-180).
const piece = { kind: 'plane', x: -480, y: -300, w: 960, h: 600, createdAt: 1, updatedAt: 1 }
await allow('a plane on the canvas', () => addDoc(sub(bob.fs, 'pieces'), piece))
await allow('a named plane on the canvas', () => addDoc(sub(bob.fs, 'pieces'), { ...piece, name: 'Pricing' }))
await deny('a piece called a board (before D-180, D-248)', () => addDoc(sub(bob.fs, 'pieces'), { ...piece, kind: 'board' }))
await deny('a canvas piece of an unknown kind', () => addDoc(sub(bob.fs, 'pieces'), { ...piece, kind: 'video' }))
await deny('a canvas piece without a size', () => addDoc(sub(bob.fs, 'pieces'), { ...piece, w: 0 }))
await deny('a canvas piece without a place', () => addDoc(sub(bob.fs, 'pieces'), { kind: 'plane', w: 1, h: 1, createdAt: 1, updatedAt: 1 }))
const axis = (type) => ({ ...(type ? { type } : {}), items: [] })
const setup = { rows: axis('feature'), cols: { items: [{ id: 'a1', name: 'price' }] }, cell: 'scale', steps: [{ id: 'no', glyph: '✕', label: 'no', tone: 'dim' }], reading: true }
await allow('a matrix on the canvas (D-204)', () => setDoc(doc(sub(bob.fs, 'pieces'), 'm1'), { ...piece, kind: 'matrix', matrix: setup }))
await deny('a plane with a matrix setup', () => addDoc(sub(bob.fs, 'pieces'), { ...piece, matrix: setup }))
await deny('a matrix with an unknown cell kind', () => addDoc(sub(bob.fs, 'pieces'), { ...piece, kind: 'matrix', matrix: { ...setup, cell: 'colour' } }))
await allow('a matrix with totals at both ends as a line, cells as marks (D-212)', () =>
  setDoc(doc(sub(bob.fs, 'pieces'), 'm2'), { ...piece, kind: 'matrix', matrix: { ...setup, totalsAt: 'both', totalsAs: 'bar', marks: true } }))
await deny('a matrix with totals somewhere unknown', () => addDoc(sub(bob.fs, 'pieces'), { ...piece, kind: 'matrix', matrix: { ...setup, totalsAt: 'side' } }))
await deny('a matrix with totals as a pie', () => addDoc(sub(bob.fs, 'pieces'), { ...piece, kind: 'matrix', matrix: { ...setup, totalsAs: 'pie' } }))
await deny('a matrix axis of an unknown type', () => addDoc(sub(bob.fs, 'pieces'), { ...piece, kind: 'matrix', matrix: { ...setup, rows: axis('video') } }))
await allow('a matrix cell', () => setDoc(doc(sub(bob.fs, 'cells'), 'm1_f1_a1'), { matrixId: 'm1', row: 'f1', col: 'a1', value: 'no', updatedAt: 1 }))
await allow('a matrix whose features unfold into what they are judged on, one shown open (D-249)', () =>
  setDoc(doc(sub(bob.fs, 'pieces'), 'm3'), { ...piece, kind: 'matrix', matrix: { ...setup, rows: { ...axis('feature'), unfold: 'criteria', open: ['f1'] } } }))
await deny('a matrix axis unfolding into something unknown', () =>
  addDoc(sub(bob.fs, 'pieces'), { ...piece, kind: 'matrix', matrix: { ...setup, rows: { ...axis('feature'), unfold: 'parts-of-parts' } } }))
await allow('a cell on what a feature unfolded into (D-249)', () => setDoc(doc(sub(bob.fs, 'cells'), 'm3_f1~c0_a1'), { matrixId: 'm3', row: 'f1~c0', col: 'a1', value: 'full', updatedAt: 1 }))
await allow('a matrix cell with a number, a note, not relevant and a confidence', () =>
  setDoc(doc(sub(bob.fs, 'cells'), 'm1_f2_a1'), { matrixId: 'm1', row: 'f2', col: 'a1', value: 4.5, notes: 'seen on their site', notRelevant: true, confidence: 'guess', updatedAt: 1 }))
await deny('a matrix cell under another id', () => setDoc(doc(sub(bob.fs, 'cells'), 'm1_f1'), { matrixId: 'm1', row: 'f1', col: 'a1', updatedAt: 1 }))
await deny('a matrix cell with a list for a value', () => setDoc(doc(sub(bob.fs, 'cells'), 'm1_f3_a1'), { matrixId: 'm1', row: 'f3', col: 'a1', value: ['x'], updatedAt: 1 }))
const table = { rows: { rules: [{ field: 'type', values: ['feature'] }], items: [] }, cols: [{ id: 'c1', field: 'status' }, { id: 'c2', name: 'cost', kind: 'number' }], sort: { col: 'c2' } }
await allow('a table on the canvas (D-209)', () => setDoc(doc(sub(bob.fs, 'pieces'), 't1'), { ...piece, kind: 'table', table }))
await deny('a plane with a table setup', () => addDoc(sub(bob.fs, 'pieces'), { ...piece, table }))
await deny('a table without its rows', () => addDoc(sub(bob.fs, 'pieces'), { ...piece, kind: 'table', table: { cols: [] } }))
await deny('a table with rules that are not a list', () => addDoc(sub(bob.fs, 'pieces'), { ...piece, kind: 'table', table: { ...table, rows: { rules: 'all', items: [] } } }))
await allow('a table stuck to a plane (D-210)', () => setDoc(doc(sub(bob.fs, 'pieces'), 't2'), { ...piece, kind: 'table', table, stuckTo: 'p1' }))
await deny('a plane stuck to a plane', () => addDoc(sub(bob.fs, 'pieces'), { ...piece, stuckTo: 'p1' }))
// Opened onto the canvas (D-228).
await allow('a table opened onto the canvas', () => setDoc(doc(sub(bob.fs, 'pieces'), 't3'), { ...piece, kind: 'table', table, open: true }))
await deny('a plane opened onto the canvas', () => addDoc(sub(bob.fs, 'pieces'), { ...piece, open: true }))
await deny('a table opened with a string', () => addDoc(sub(bob.fs, 'pieces'), { ...piece, kind: 'table', table, open: 'yes' }))
await allow('a table cell', () => setDoc(doc(sub(bob.fs, 'cells'), 't1_f1_c2'), { matrixId: 't1', row: 'f1', col: 'c2', value: 1200, updatedAt: 1 }))
// A kanban (D-251): its columns on the piece, its tasks in `tasks`.
const kanban = { cols: [{ id: 'k1', name: 'todo' }, { id: 'k2', name: 'doing' }, { id: 'k3', name: 'done', done: true }] }
await allow('a kanban on the canvas (D-251)', () => setDoc(doc(sub(bob.fs, 'pieces'), 'kb1'), { ...piece, kind: 'kanban', kanban }))
await allow('a kanban opened onto the canvas', () => setDoc(doc(sub(bob.fs, 'pieces'), 'kb2'), { ...piece, kind: 'kanban', kanban, open: true }))
await deny('a plane with kanban columns', () => addDoc(sub(bob.fs, 'pieces'), { ...piece, kanban }))
await deny('a kanban without columns', () => addDoc(sub(bob.fs, 'pieces'), { ...piece, kind: 'kanban', kanban: { cols: [] } }))
await deny('a kanban with something else in its setup', () => addDoc(sub(bob.fs, 'pieces'), { ...piece, kind: 'kanban', kanban: { ...kanban, swimlanes: [] } }))
await allow('a kanban stuck to a plane (D-255)', () => addDoc(sub(bob.fs, 'pieces'), { ...piece, kind: 'kanban', kanban, stuckTo: 'p1' }))
await allow('a stuck kanban showing every task', () => addDoc(sub(bob.fs, 'pieces'), { ...piece, kind: 'kanban', kanban: { ...kanban, everyPlane: true }, stuckTo: 'p1' }))
await allow('a kanban in lanes by who (D-258)', () => addDoc(sub(bob.fs, 'pieces'), { ...piece, kind: 'kanban', kanban: { ...kanban, rows: 'assignee' } }))
await deny('a kanban in lanes by something unknown', () => addDoc(sub(bob.fs, 'pieces'), { ...piece, kind: 'kanban', kanban: { ...kanban, rows: 'mood' } }))
await deny('a kanban whose every-plane switch is not a switch', () => addDoc(sub(bob.fs, 'pieces'), { ...piece, kind: 'kanban', kanban: { ...kanban, everyPlane: 'yes' } }))
await deny('a documents list stuck to a plane', () => addDoc(sub(bob.fs, 'pieces'), { ...piece, kind: 'documents', stuckTo: 'p1' }))
const task = { pieceId: 'kb1', col: 'k1', order: 1, title: 'Call three bakeries', uid: bob.uid, createdAt: 1, updatedAt: 1 }
await allow('a task', () => addDoc(sub(bob.fs, 'tasks'), task))
await allow('a task given to someone, due, for a card, with a checklist', () =>
  addDoc(sub(bob.fs, 'tasks'), { ...task, assignee: alice.uid, assigneeName: 'Alice', due: '2026-11-02', cardId: 'f1', cardType: 'feature', checks: [{ id: 'c1', text: 'list them' }, { id: 'c2', text: 'call', done: true }], notes: 'mornings' }))
await deny('a task with a title too long', () => addDoc(sub(bob.fs, 'tasks'), { ...task, title: 'x'.repeat(201) }))
await deny('a task without an order', () => addDoc(sub(bob.fs, 'tasks'), { ...task, order: 'first' }))
await deny('a task due on a day not written as a day', () => addDoc(sub(bob.fs, 'tasks'), { ...task, due: 'next week' }))
await deny('a task for an unknown kind of card', () => addDoc(sub(bob.fs, 'tasks'), { ...task, cardId: 'x', cardType: 'video' }))
await deny('a task with a field nobody knows', () => addDoc(sub(bob.fs, 'tasks'), { ...task, points: 3 }))
await allow('a finished task with what it taught logged (D-254)', () => addDoc(sub(bob.fs, 'tasks'), { ...task, cardId: 'p1', cardType: 'problem', learned: 'ev1' }))
await deny('a task whose learned is not text', () => addDoc(sub(bob.fs, 'tasks'), { ...task, learned: true }))
await allow('a task with labels and a priority (D-256)', () => addDoc(sub(bob.fs, 'tasks'), { ...task, labels: ['research', 'ops'], priority: 'P1' }))
await deny('a task with an unknown priority', () => addDoc(sub(bob.fs, 'tasks'), { ...task, priority: 'urgent' }))
await deny('a task with labels that are not a list', () => addDoc(sub(bob.fs, 'tasks'), { ...task, labels: 'research' }))
await allow('a kanban column with a limit (D-256)', () => addDoc(sub(bob.fs, 'pieces'), { ...piece, kind: 'kanban', kanban: { cols: [{ id: 'k1', name: 'doing', limit: 3 }] } }))
await deny('a task with a checklist that is not a list', () => addDoc(sub(bob.fs, 'tasks'), { ...task, checks: 'all of it' }))
// Cards on a plane (D-187).
await allow('an idea on a plane', () => addDoc(sub(bob.fs, 'ideas'), { title: '', pieceId: 'p1', x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
await allow('a competitor on a plane', () => addDoc(sub(bob.fs, 'competitors'), { name: 'Crewly', pieceId: 'p1', x: 25, y: 50, createdAt: 1, updatedAt: 1 }))
await deny('a card with a numeric plane', () => addDoc(sub(bob.fs, 'ideas'), { title: '', pieceId: 5, x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
// Text anywhere in the workspace (D-188).
await allow('a heading on the canvas', () => addDoc(sub(bob.fs, 'labels'), { text: 'Plan', pieceId: 'canvas', x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
await allow('a big section on the canvas', () => addDoc(sub(bob.fs, 'labels'), { text: 'Q1', kind: 'section', pieceId: 'canvas', x: 0, y: 0, w: 4800, h: 3000, createdAt: 1, updatedAt: 1 }))
await allow('a sticky note on a plane', () => addDoc(sub(bob.fs, 'labels'), { text: 'ask Bob', kind: 'sticky', pieceId: 'p1', uid: bob.uid, author: 'Bob', x: 0, y: 0, w: 200, createdAt: 1, updatedAt: 1 }))
await deny('text with a numeric space', () => addDoc(sub(bob.fs, 'labels'), { text: 'x', pieceId: 3, x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
await allow('a link from a package', () => addDoc(sub(bob.fs, 'edges'), { fromId: 'k1', fromType: 'package', toId: 'p1', toType: 'problem', kind: 'solves' }))
// Status and evidence (D-137).
await allow('problem with a validation status', () => addDoc(sub(bob.fs, 'problems'), { ...card, validation: 'testing' }))
await deny('problem with an unknown validation status', () => addDoc(sub(bob.fs, 'problems'), { ...card, validation: 'proven' }))
const ev = { nodeId: 'p1', nodeType: 'problem', kind: 'interview', text: 'We lose three shifts a week', stance: 'supports', createdAt: 1, updatedAt: 1 }
await allow('evidence on a problem', () => addDoc(sub(bob.fs, 'evidence'), { ...ev, source: 'Anna, café owner', date: '2026-10-12' }))
await deny('evidence without text', () => addDoc(sub(bob.fs, 'evidence'), { ...ev, text: '' }))
await deny('evidence on a feature', () => addDoc(sub(bob.fs, 'evidence'), { ...ev, nodeType: 'feature' }))
await deny('evidence with an unknown stance', () => addDoc(sub(bob.fs, 'evidence'), { ...ev, stance: 'maybe' }))
await deny('evidence with a free-text date', () => addDoc(sub(bob.fs, 'evidence'), { ...ev, date: 'last week' }))
// Criteria (D-133): a short list on the feature, scored per cell.
const crit = (n) => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, text: `must ${i}` }))
await allow('feature with criteria', () => addDoc(sub(bob.fs, 'features'), { ...card, criteria: crit(3) }))
await deny('feature with more than 8 criteria', () => addDoc(sub(bob.fs, 'features'), { ...card, criteria: crit(9) }))
await deny('feature with criteria that are not a list', () => addDoc(sub(bob.fs, 'features'), { ...card, criteria: 'trace' }))
const compRef = await addDoc(sub(alice.fs, 'competitors'), { name: 'Rival', url: 'https://rival.example', pieceId: 'p1', x: 0, y: 0, createdAt: 1, updatedAt: 1 })
await allow('competitor', () => getDoc(compRef))
await deny('competitor without a name', () => addDoc(sub(bob.fs, 'competitors'), { url: 'x', pieceId: 'p1', x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
await deny('competitor on no plane (1.0, D-248)', () => addDoc(sub(bob.fs, 'competitors'), { name: 'x', createdAt: 1, updatedAt: 1 }))
await allow('competitor feature', () => addDoc(sub(bob.fs, 'competitorFeatures'), { competitorId: compRef.id, name: 'SSO', category: 'auth', createdAt: 1, updatedAt: 1 }))
await allow('competitor feature with availability and source', () => addDoc(sub(bob.fs, 'competitorFeatures'), { competitorId: compRef.id, name: 'SSO', availability: 'enterprise', url: 'https://rival.example/sso', createdAt: 1, updatedAt: 1 }))
await deny('competitor feature with an unknown availability', () => addDoc(sub(bob.fs, 'competitorFeatures'), { competitorId: compRef.id, name: 'SSO', availability: 'cheap', createdAt: 1, updatedAt: 1 }))
await deny('competitor feature without its competitor', () => addDoc(sub(bob.fs, 'competitorFeatures'), { name: 'SSO', createdAt: 1, updatedAt: 1 }))
const cell = (id, data) => writeBatch(bob.fs).set(doc(sub(bob.fs, 'comparisons'), id), data).commit()
await allow('a match keyed by feature_competitor', () => cell(`f1_${compRef.id}`, { featureId: 'f1', competitorId: compRef.id, competitorFeatureId: 'cf1' }))
await deny('a match with a free id', () => cell('random', { featureId: 'f1', competitorId: compRef.id }))
await allow('matrix cell with criterion scores', () => cell(`f3_${compRef.id}`, { featureId: 'f3', competitorId: compRef.id, criteria: { c0: 'met', c1: 'part', c2: 'no' }, updatedAt: 1 }))
await deny('matrix cell with an unknown criterion score', () => cell(`f4_${compRef.id}`, { featureId: 'f4', competitorId: compRef.id, criteria: { c0: 'maybe' }, updatedAt: 1 }))
await deny('matrix cell with criteria that are not a map', () => cell(`f5_${compRef.id}`, { featureId: 'f5', competitorId: compRef.id, criteria: ['met'], updatedAt: 1 }))
await allow('edge between an idea and a feature', () => addDoc(sub(bob.fs, 'edges'), { fromId: 'a', fromType: 'feature', toId: 'b', toType: 'idea', kind: 'inspired-by' }))
await deny('edge to itself', () => addDoc(sub(bob.fs, 'edges'), { fromId: 'a', fromType: 'idea', toId: 'a', toType: 'idea', kind: 'relates' }))
await deny('edge with an unknown node type', () => addDoc(sub(bob.fs, 'edges'), { fromId: 'a', fromType: 'user', toId: 'b', toType: 'idea', kind: 'relates' }))
await deny('the retired domains (D-048)', () => addDoc(sub(bob.fs, 'domains'), { name: 'Dev tools', createdAt: 1 }))
await allow('competitor moved on its plane', () => updateDoc(compRef, { x: 2, y: 3 }))
await deny('competitor with a text position', () => updateDoc(compRef, { x: 'left' }))
await allow('competitor with tags (D-056)', () => updateDoc(compRef, { tags: ['direct', 'enterprise'] }))
await deny('competitor with tags as a string', () => updateDoc(compRef, { tags: 'direct' }))
await allow('competitor with regions (D-145)', () => updateDoc(compRef, { regions: ['US', 'Germany'] }))
await deny('competitor with regions as a string', () => updateDoc(compRef, { regions: 'US' }))
await deny('competitor with over 20 regions', () => updateDoc(compRef, { regions: Array.from({ length: 21 }, (_, i) => `r${i}`) }))
await allow('edge tagging an idea for a customer', () => addDoc(sub(bob.fs, 'edges'), { fromId: 'a', fromType: 'idea', toId: 'c', toType: 'customer', kind: 'for' }))
await allow('edge from an idea to a problem', () => addDoc(sub(bob.fs, 'edges'), { fromId: 'a', fromType: 'idea', toId: 'p', toType: 'problem', kind: 'solves' }))
// Bend points the user put on a link (D-155): up to 8.
await allow('edge with bend points', () => addDoc(sub(bob.fs, 'edges'), { fromId: 'a', fromType: 'idea', toId: 'p', toType: 'problem', kind: 'solves', bends: [{ x: -1.5, y: 0.25 }, { x: 2, y: 1 }] }))
await deny('edge with too many bend points', () => addDoc(sub(bob.fs, 'edges'), { fromId: 'a', fromType: 'idea', toId: 'p', toType: 'problem', kind: 'solves', bends: Array.from({ length: 9 }, (_, i) => ({ x: i, y: 0 })) }))
await deny('edge with bend points that are not a list', () => addDoc(sub(bob.fs, 'edges'), { fromId: 'a', fromType: 'idea', toId: 'p', toType: 'problem', kind: 'solves', bends: { x: 1, y: 2 } }))
// Labels: text on the board (D-050). Groups are retired (D-049).
await deny('text in no space (1.0, D-248)', () => addDoc(sub(bob.fs, 'labels'), { text: 'x', x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
await allow('text label', () => addDoc(sub(bob.fs, 'labels'), { pieceId: 'canvas', text: 'COMPETITORS', x: 0, y: 5, createdAt: 1, updatedAt: 1 }))
await allow('text label as a note', () => addDoc(sub(bob.fs, 'labels'), { pieceId: 'canvas', text: 'check pricing', size: 'note', x: 0, y: 4, createdAt: 1, updatedAt: 1 }))
await allow('the project title block', () => addDoc(sub(bob.fs, 'labels'), { pieceId: 'canvas', text: '', kind: 'title', x: 0, y: 8, createdAt: 1, updatedAt: 1 }))
await allow('a section (D-130)', () => addDoc(sub(bob.fs, 'labels'), { pieceId: 'canvas', text: 'Onboarding', kind: 'section', x: 0, y: 0, w: 14, h: 9, createdAt: 1, updatedAt: 1 }))
await allow('an H3 in bold italic caps (D-130)', () => addDoc(sub(bob.fs, 'labels'), { pieceId: 'canvas', text: 'Pricing', size: 'minor', bold: true, italic: true, caps: true, x: 0, y: 2, createdAt: 1, updatedAt: 1 }))
await deny('text with italic as a string', () => addDoc(sub(bob.fs, 'labels'), { pieceId: 'canvas', text: 'x', italic: 'yes', x: 0, y: 2, createdAt: 1, updatedAt: 1 }))
await deny('a section without a size', () => addDoc(sub(bob.fs, 'labels'), { pieceId: 'canvas', text: 'Onboarding', kind: 'section', x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
await deny('a section with a negative width', () => addDoc(sub(bob.fs, 'labels'), { pieceId: 'canvas', text: 'x', kind: 'section', x: 0, y: 0, w: -2, h: 4, createdAt: 1, updatedAt: 1 }))
await deny('a section with a text height', () => addDoc(sub(bob.fs, 'labels'), { pieceId: 'canvas', text: 'x', kind: 'section', x: 0, y: 0, w: 2, h: 'tall', createdAt: 1, updatedAt: 1 }))
await deny('a label of an unknown kind', () => addDoc(sub(bob.fs, 'labels'), { pieceId: 'canvas', text: 'x', kind: 'banner', x: 0, y: 4, createdAt: 1, updatedAt: 1 }))
await deny('text label with an unknown size', () => addDoc(sub(bob.fs, 'labels'), { pieceId: 'canvas', text: 'x', size: 'huge', x: 0, y: 4, createdAt: 1, updatedAt: 1 }))
await deny('label without a position', () => addDoc(sub(bob.fs, 'labels'), { pieceId: 'canvas', text: 'x', createdAt: 1, updatedAt: 1 }))
await deny('label with a numeric text', () => addDoc(sub(bob.fs, 'labels'), { pieceId: 'canvas', text: 3, x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
// Paragraphs, turned text, small lines (D-156); a section's name up its left edge (D-157).
await allow('a long paragraph (D-156)', () => addDoc(sub(bob.fs, 'labels'), { pieceId: 'canvas', text: 'x'.repeat(3000), size: 'note', w: 6.25, x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
await deny('a heading as long as a paragraph', () => addDoc(sub(bob.fs, 'labels'), { pieceId: 'canvas', text: 'x'.repeat(300), x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
await deny('a paragraph over 4000', () => addDoc(sub(bob.fs, 'labels'), { pieceId: 'canvas', text: 'x'.repeat(4001), size: 'note', x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
await allow('text turned a quarter with a small line', () => addDoc(sub(bob.fs, 'labels'), { pieceId: 'canvas', text: 'Early adopters', rotate: 90, kicker: '01 who', x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
await deny('text turned 45', () => addDoc(sub(bob.fs, 'labels'), { pieceId: 'canvas', text: 'x', rotate: 45, x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
await deny('a small line over 60', () => addDoc(sub(bob.fs, 'labels'), { pieceId: 'canvas', text: 'x', kicker: 'k'.repeat(61), x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
await allow('a section named up its left edge (D-157)', () => addDoc(sub(bob.fs, 'labels'), { pieceId: 'canvas', text: 'Ideas', kind: 'section', side: 'left', x: 0, y: 0, w: 10, h: 6, createdAt: 1, updatedAt: 1 }))
await deny('a section named on its right edge', () => addDoc(sub(bob.fs, 'labels'), { pieceId: 'canvas', text: 'Ideas', kind: 'section', side: 'right', x: 0, y: 0, w: 10, h: 6, createdAt: 1, updatedAt: 1 }))
await allow('a large paragraph (D-160)', () => addDoc(sub(bob.fs, 'labels'), { pieceId: 'canvas', text: 'x', size: 'note', scale: 'large', x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
await allow('a medium paragraph (D-161)', () => addDoc(sub(bob.fs, 'labels'), { pieceId: 'canvas', text: 'x', size: 'note', scale: 'medium', x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
await deny('a paragraph at a huge size', () => addDoc(sub(bob.fs, 'labels'), { pieceId: 'canvas', text: 'x', size: 'note', scale: 'huge', x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
// Sticky notes (D-158): long text, signed.
await allow('a sticky note, signed', () => addDoc(sub(bob.fs, 'labels'), { pieceId: 'canvas', text: 'x'.repeat(2000), kind: 'sticky', uid: 'bob', author: 'Bob', w: 3.125, x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
await deny('a sticky note over 4000', () => addDoc(sub(bob.fs, 'labels'), { pieceId: 'canvas', text: 'x'.repeat(4001), kind: 'sticky', x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
await allow('a sticky note folded', () => addDoc(sub(bob.fs, 'labels'), { pieceId: 'canvas', text: 'x', kind: 'sticky', folded: true, x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
await deny('a sticky note folded by a word', () => addDoc(sub(bob.fs, 'labels'), { pieceId: 'canvas', text: 'x', kind: 'sticky', folded: 'yes', x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
await deny('a sticky note signed with a number', () => addDoc(sub(bob.fs, 'labels'), { pieceId: 'canvas', text: 'x', kind: 'sticky', author: 7, x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
await deny('the retired groups (D-049)', () => addDoc(sub(bob.fs, 'groups'), { name: 'Pricing', x: 0, y: 0, w: 6, h: 4, createdAt: 1, updatedAt: 1 }))
await deny('the retired attachments (D-248)', () => setDoc(doc(bob.fs, 'workspaces', wid, 'attachments', 'a1'), { nodeId: 'n1', nodeType: 'idea', name: 'a.pdf', contentType: 'application/pdf', size: 1, path: `workspaces/${wid}/attachments/a1/a.pdf`, uid: bob.uid, createdAt: 1 }))
// Storage (D-248): nothing stored until documents' files come.
const file = (who, name) => fileRef(who.st, `workspaces/${wid}/documents/f1/${name}`)
const pdf = new Uint8Array(2048)
await deny('member uploads a file', () => uploadBytes(file(bob, 'plan.pdf'), pdf, { contentType: 'application/pdf' }))
await deny('member reads a file', () => getBytes(file(alice, 'plan.pdf')))
await deny('member promotes self to owner', () => join(bob, { [`roles.${bob.uid}`]: 'owner' }))
await deny('member takes ownership', () => join(bob, { ownerId: bob.uid }))
await deny('member adds someone else', () => join(bob, { memberIds: arrayUnion(carol.uid) }))
await deny('member changes the invite code', () => join(bob, { inviteCode: 'BOBCODE2' }))
await deny('member deletes workspace', () => writeBatch(bob.fs).delete(doc(bob.fs, 'workspaces', wid)).commit())

// The assistant's workspace key and usage log (D-079).
const aiConfig = (fs) => doc(fs, 'workspaces', wid, 'ai', 'config')
await allow('owner chooses who may use the workspace key', () => setDoc(aiConfig(alice.fs), { access: 'chosen', allowed: [bob.uid] }))
await allow('member reads the key settings', () => getDoc(aiConfig(bob.fs)))
await deny('outsider reads the key settings', () => getDoc(aiConfig(carol.fs)))
await deny('member lets themselves use the key', () => updateDoc(aiConfig(bob.fs), { allowed: [bob.uid, carol.uid] }))
await deny('owner fakes a key on the client', () => updateDoc(aiConfig(alice.fs), { hasKey: true, keyHint: 'sk-…abcd' }))
await deny('owner writes an unknown access mode', () => updateDoc(aiConfig(alice.fs), { access: 'anyone' }))
await allow('owner opens the key to everyone', () => updateDoc(aiConfig(alice.fs), { access: 'everyone' }))
// Models on the workspace key (D-104).
await allow("owner sets the workspace key's models", () => updateDoc(aiConfig(alice.fs), { models: { chat: 'gpt-6-luna', deep: 'gpt-6.1-sol' }, allowedModels: ['gpt-5.6-luna'] }))
await deny('member sets the workspace key\'s models', () => updateDoc(aiConfig(bob.fs), { models: { chat: 'gpt-5.5' } }))
await deny('models for an unknown task', () => updateDoc(aiConfig(alice.fs), { models: { summarize: 'gpt-5.5' } }))
await deny('a model id that is not text', () => updateDoc(aiConfig(alice.fs), { models: { chat: 5 } }))
await deny('allowed models as a string', () => updateDoc(aiConfig(alice.fs), { allowedModels: 'gpt-5.5' }))
await deny('owner reads the encrypted key', () => getDoc(doc(alice.fs, 'aiSecrets', wid)))
await deny('owner writes the encrypted key', () => setDoc(doc(alice.fs, 'aiSecrets', wid), { data: 'x' }))

const usage = (fs) => collection(fs, 'workspaces', wid, 'aiUsage')
const entry = (who, extra = {}) => ({
  uid: who.uid, name: 'Bob', keySource: 'own', task: 'chat', model: 'gpt-6-luna',
  inputTokens: 1200, cachedTokens: 0, outputTokens: 80, reasoningTokens: 0, webSearches: 0,
  tools: [], status: 'done', ms: 900, at: Date.now(), ...extra,
})
const bobOwn = await addDoc(usage(bob.fs), entry(bob))
await allow('member logs an own-key call', () => getDoc(bobOwn))
await deny('member logs a call as someone else', () => addDoc(usage(bob.fs), entry(alice)))
await deny('member logs a workspace-key call (server only)', () => addDoc(usage(bob.fs), entry(bob, { keySource: 'workspace' })))
await deny('usage with negative tokens', () => addDoc(usage(bob.fs), entry(bob, { inputTokens: -1 })))
await deny('usage with the message text', () => addDoc(usage(bob.fs), entry(bob, { prompt: 'secret plans' })))
await deny('outsider logs usage', () => addDoc(usage(carol.fs), entry(carol)))
await deny('member edits a usage entry', () => updateDoc(bobOwn, { outputTokens: 1 }))
await deny('member deletes a usage entry', () => writeBatch(bob.fs).delete(bobOwn).commit())
await deny("owner reads someone's own-key usage", () => getDoc(doc(alice.fs, bobOwn.path)))
// Workspace-key entries are written by the server (admin); the emulator's `owner` token stands in for it.
const adminAdd = async (id, data) => {
  const fields = Object.fromEntries(Object.entries(data).map(([k, v]) => [k,
    Array.isArray(v) ? { arrayValue: {} } : typeof v === 'number' ? { integerValue: String(v) } : { stringValue: v }]))
  const r = await fetch(`http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents/workspaces/${wid}/aiUsage?documentId=${id}`, {
    method: 'POST', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }),
  })
  if (!r.ok) throw new Error(await r.text())
}
await adminAdd('bobShared', entry(bob, { keySource: 'workspace' }))
await allow("owner reads a member's workspace-key usage", () => getDoc(doc(alice.fs, 'workspaces', wid, 'aiUsage', 'bobShared')))
await allow('member reads their own workspace-key usage', () => getDoc(doc(bob.fs, 'workspaces', wid, 'aiUsage', 'bobShared')))
await allow('owner lists workspace-key usage', () => getDocs(query(usage(alice.fs), where('keySource', '==', 'workspace'))))
await allow('member lists their own usage', () => getDocs(query(usage(bob.fs), where('uid', '==', bob.uid))))
await deny('member lists everyone\'s usage', () => getDocs(usage(bob.fs)))
await deny('member lists workspace-key usage', () => getDocs(query(usage(bob.fs), where('keySource', '==', 'workspace'))))

// Research reports (D-090) from before documents: read and deleted while they're moved over (D-232); nothing writes them.
const reports = (fs) => collection(fs, 'workspaces', wid, 'reports')
const repDoc = (fs, id) => doc(fs, 'workspaces', wid, 'reports', id)
const bodyDoc = (fs, id) => doc(fs, 'workspaces', wid, 'reports', id, 'content', 'body')
const summaryOf = (uid, extra = {}) => ({ title: 'Market', answer: 'Small.', topic: 'market', uid, name: 'x', model: 'm', shared: false, createdAt: 1, sectionCount: 1, sourceCount: 1, ...extra })
const body = { sections: [{ question: 'Who?', points: [{ text: 'A', sources: [1] }] }], implications: [], openQuestions: [], sources: [{ title: 'S', url: 'https://example.com' }] }
const seedReport = async (id, uid, extra) => {
  await seed(`workspaces/${wid}/reports/${id}`, summaryOf(uid, extra))
  await seed(`workspaces/${wid}/reports/${id}/content/body`, body)
}
await seedReport('r1', bob.uid)
await seedReport('r2', bob.uid, { shared: true })
await deny('member writes a report', () => setDoc(repDoc(bob.fs, 'r3'), summaryOf(bob.uid)))
await deny('author shares their old report', () => updateDoc(repDoc(bob.fs, 'r1'), { shared: true }))
await allow('author reads their private report and its body', async () => { await getDoc(repDoc(bob.fs, 'r1')); await getDoc(bodyDoc(bob.fs, 'r1')) })
await deny('another member reads a private report', () => getDoc(repDoc(dave.fs, 'r1')))
await deny('owner reads a private report', () => getDoc(repDoc(alice.fs, 'r1')))
await deny('member lists every report', () => getDocs(reports(dave.fs)))
await allow('member lists their own reports', () => getDocs(query(reports(bob.fs), where('uid', '==', bob.uid))))
await allow('member lists shared reports', () => getDocs(query(reports(dave.fs), where('shared', '==', true))))
await allow('member reads a shared report', () => getDoc(repDoc(dave.fs, 'r2')))
await deny('outsider reads a shared report', () => getDoc(repDoc(carol.fs, 'r2')))
await deny('another member deletes a shared report', () => deleteDoc(repDoc(dave.fs, 'r2')))
await deny('owner deletes a private report', () => deleteDoc(repDoc(alice.fs, 'r1')))
await allow('author deletes their report and its body (moved over)', () => { const b = writeBatch(bob.fs); b.delete(bodyDoc(bob.fs, 'r1')); b.delete(repDoc(bob.fs, 'r1')); return b.commit() })

// Roles (D-098): viewers read only; any number of owners, never none.
const role = (who, uid, r) => join(who, { [`roles.${uid}`]: r })
await allow('owner makes a member a viewer', () => role(alice, dave.uid, 'viewer'))
await allow('viewer reads ideas', () => getDocs(ideas(dave.fs)))
await deny('viewer creates an idea', () => addDoc(ideas(dave.fs), { title: 'x', pieceId: 'p1', x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
await deny('viewer puts a plane on the canvas (D-176)', () => addDoc(sub(dave.fs, 'pieces'), { kind: 'plane', x: 0, y: 0, w: 1, h: 1, createdAt: 1, updatedAt: 1 }))
await allow('viewer reads the canvas', () => getDocs(sub(dave.fs, 'pieces')))
await deny('viewer fills a matrix cell (D-204)', () => setDoc(doc(sub(dave.fs, 'cells'), 'm1_f9_a1'), { matrixId: 'm1', row: 'f9', col: 'a1', value: 'no', updatedAt: 1 }))
await allow('viewer reads the matrices\' cells', () => getDocs(sub(dave.fs, 'cells')))
await deny('viewer deletes an idea', async () => {
  const one = (await getDocs(ideas(dave.fs))).docs[0]
  await deleteDoc(doc(dave.fs, one.ref.path))
})
await deny('viewer renames the workspace', () => join(dave, { name: 'Mine' }))
await deny('viewer uploads a file', () => uploadBytes(file(dave, 'v.pdf'), pdf, { contentType: 'application/pdf' }))
await deny('viewer makes themselves an editor', () => role(dave, dave.uid, 'editor'))
await deny('owner gives an unknown role', () => role(alice, dave.uid, 'admin'))
await deny('owner gives a role to someone outside', () => role(alice, erin.uid, 'editor'))

// Members directory (D-098).
const memberDoc = (fs, uid) => doc(fs, 'workspaces', wid, 'members', uid)
const member = (name, extra = {}) => ({ name, email: `${name}@example.com`, joinedAt: 1, ...extra })
await allow('member writes their own entry', () => setDoc(memberDoc(dave.fs, dave.uid), member('dave')))
await deny("member writes someone else's entry", () => setDoc(memberDoc(dave.fs, bob.uid), member('bob')))
await allow('owner writes an entry for someone they let in', () => setDoc(memberDoc(alice.fs, bob.uid), member('bob')))
await deny('entry with an unknown field', () => setDoc(memberDoc(dave.fs, dave.uid), member('dave', { role: 'owner' })))
await allow('member lists the members', () => getDocs(collection(bob.fs, 'workspaces', wid, 'members')))
await deny('outsider lists the members', () => getDocs(collection(erin.fs, 'workspaces', wid, 'members')))

// Documents (D-232): every file the workspace keeps; private until shared; content in content/body.
const docsCol = (fs) => collection(fs, 'workspaces', wid, 'documents')
const docDoc = (fs, id) => doc(fs, 'workspaces', wid, 'documents', id)
const docBody = (fs, id) => doc(fs, 'workspaces', wid, 'documents', id, 'content', 'body')
const docOf = (who, extra = {}) => ({ kind: 'markdown', title: 'Interviews', excerpt: 'Six owners', origin: 'upload', uid: who.uid, name: 'x', shared: false, contentType: 'text/markdown', size: 12, words: 2, createdAt: 1, updatedAt: 1, ...extra })
const saveDoc = (who, id, extra, b = { text: '# Interviews\nSix owners' }) => {
  const w = writeBatch(who.fs)
  w.set(docDoc(who.fs, id), docOf(who, extra))
  w.set(docBody(who.fs, id), b)
  return w.commit()
}
await allow('member uploads a .md as a document', () => saveDoc(bob, 'd1'))
await allow('viewer uploads their own document', () => saveDoc(dave, 'd2'))
await deny('member adds a document as someone else', () => saveDoc(bob, 'd3', { uid: dave.uid }))
await deny('outsider adds a document', () => saveDoc(carol, 'd4'))
await deny('document of an unknown kind', () => saveDoc(bob, 'd5', { kind: 'video' }))
await deny('document with an unknown field', () => saveDoc(bob, 'd6', { secret: 1 }))
await deny('document with an empty title', () => saveDoc(bob, 'd7', { title: '' }))
await deny('document body over 900 000 characters', () => saveDoc(bob, 'd8', {}, { text: 'x'.repeat(900001) }))
await deny('document file outside its own folder', () => saveDoc(bob, 'd9', { kind: 'pdf', contentType: 'application/pdf', path: `workspaces/${wid}/documents/other/a.pdf` }))
await allow('document file in its own folder', () => saveDoc(bob, 'd10', { kind: 'pdf', contentType: 'application/pdf', path: `workspaces/${wid}/documents/d10/a.pdf` }, {}))
await allow('author reads their private document and its text', async () => { await getDoc(docDoc(bob.fs, 'd1')); await getDoc(docBody(bob.fs, 'd1')) })
await deny('another member reads a private document', () => getDoc(docDoc(alice.fs, 'd1')))
await deny("another member reads a private document's text", () => getDoc(docBody(alice.fs, 'd1')))
await allow('member reads a document not there yet', () => getDoc(docDoc(alice.fs, 'nothing')))
await deny('member lists every document', () => getDocs(docsCol(alice.fs)))
await allow('member lists the shared documents', () => getDocs(query(docsCol(alice.fs), where('shared', '==', true))))
await allow('member lists their own documents', () => getDocs(query(docsCol(bob.fs), where('uid', '==', bob.uid))))
await deny('another member shares it', () => updateDoc(docDoc(alice.fs, 'd1'), { shared: true }))
await deny('author changes its kind', () => updateDoc(docDoc(bob.fs, 'd1'), { kind: 'pdf' }))
await allow('author shares and renames it', () => updateDoc(docDoc(bob.fs, 'd1'), { shared: true, title: 'Owner interviews', updatedAt: 2 }))
await allow("member reads a shared document's text", () => getDoc(docBody(alice.fs, 'd1')))
await deny('outsider reads a shared document', () => getDoc(docDoc(carol.fs, 'd1')))
await deny('another member deletes a shared document', () => deleteDoc(docDoc(dave.fs, 'd1')))
await allow('owner deletes a shared document with its text', () => { const w = writeBatch(alice.fs); w.delete(docBody(alice.fs, 'd1')); w.delete(docDoc(alice.fs, 'd1')); return w.commit() })
await allow("owner's undo restores someone's shared document", () => saveDoc(alice, 'd1', { uid: bob.uid, shared: true }))
await deny('owner restores someone else\'s document as private', () => saveDoc(alice, 'd11', { uid: bob.uid }))
await allow('owner moves an old shared report over as its author\'s', () => saveDoc(alice, 'd12', { kind: 'report', origin: 'moved', uid: bob.uid, shared: true, reportKind: 'research', sections: 1, sources: 1 }, { answer: 'Small.', sections: [], implications: [], openQuestions: [], sources: [] }))
await allow('author deletes their document', () => { const w = writeBatch(bob.fs); w.delete(docBody(bob.fs, 'd10')); w.delete(docDoc(bob.fs, 'd10')); return w.commit() })
await deny('viewer puts a document on the canvas', () => addDoc(sub(dave.fs, 'pieces'), { kind: 'document', docId: 'd1', x: 0, y: 0, w: 1, h: 1, createdAt: 1, updatedAt: 1 }))
await allow('editor puts a document on the canvas', () => addDoc(sub(alice.fs, 'pieces'), { kind: 'document', docId: 'd1', x: 0, y: 0, w: 1, h: 1, createdAt: 1, updatedAt: 1 }))
await deny('a document piece without its document', () => addDoc(sub(alice.fs, 'pieces'), { kind: 'document', x: 0, y: 0, w: 1, h: 1, createdAt: 1, updatedAt: 1 }))
await allow('editor puts a documents list on the canvas', () => addDoc(sub(alice.fs, 'pieces'), { kind: 'documents', documents: { view: 'shelf', kinds: ['markdown', 'report'], sort: { col: 'added', desc: true }, pageSize: 10 }, x: 0, y: 0, w: 1, h: 1, createdAt: 1, updatedAt: 1 }))
await deny('a documents list of an unknown view', () => addDoc(sub(alice.fs, 'pieces'), { kind: 'documents', documents: { view: 'grid' }, x: 0, y: 0, w: 1, h: 1, createdAt: 1, updatedAt: 1 }))
await allow('a documents list opened onto the canvas (D-234)', () => addDoc(sub(alice.fs, 'pieces'), { kind: 'documents', documents: { view: 'table' }, open: true, x: 0, y: 0, w: 1, h: 1, createdAt: 1, updatedAt: 1 }))
await allow('a document opened onto the canvas (D-234)', () => addDoc(sub(alice.fs, 'pieces'), { kind: 'document', docId: 'd1', open: true, x: 0, y: 0, w: 1, h: 1, createdAt: 1, updatedAt: 1 }))
await deny('a plane holding a docId', () => addDoc(sub(alice.fs, 'pieces'), { kind: 'plane', docId: 'd1', x: 0, y: 0, w: 1, h: 1, createdAt: 1, updatedAt: 1 }))

// Comment threads (D-159): any member, viewers too, as themselves.
const thr = (fs, id) => doc(fs, 'workspaces', wid, 'threads', id)
const msg = (fs, tid, id) => doc(fs, 'workspaces', wid, 'threads', tid, 'messages', id)
const threadOf = (who, extra = {}) => Object.fromEntries(Object.entries({ on: 'card', targetId: 'c1', planeId: 'p1', x: 1, y: 2, uid: who.uid, name: 'x', count: 1, lastAt: 1, createdAt: 1, updatedAt: 1, ...extra }).filter(([, v]) => v !== undefined))
const start = (who, id, extra) => {
  const b = writeBatch(who.fs)
  b.set(thr(who.fs, id), threadOf(who, extra))
  b.set(msg(who.fs, id, 'm1'), { uid: who.uid, name: 'x', text: 'Is ten minutes real?', createdAt: 1 })
  return b.commit()
}
await allow('viewer starts a thread', () => start(dave, 't1'))
await deny('a thread on a spot (1.0, D-248)', () => start(bob, 't2', { on: 'spot', targetId: undefined }))
await deny('a thread in no space (1.0, D-248)', () => start(bob, 't2s', { planeId: undefined }))
await allow('a thread on a plane (D-193)', () => start(bob, 't2p', { on: 'plane', targetId: 'p1', planeId: 'canvas' }))
await allow('a thread on a kanban task (D-260)', () => start(bob, 't2t', { on: 'task', targetId: 'tk1', planeId: 'kb1' }))
await deny('a thread on a plane without its id', () => start(bob, 't2q', { on: 'plane', targetId: undefined }))
await deny('a thread for someone else', () => setDoc(thr(bob.fs, 't3'), threadOf(dave)))
await deny('a thread on a card without its id', () => setDoc(thr(bob.fs, 't4'), { ...threadOf(bob), targetId: undefined }))
await deny('a non-member reads threads', () => getDocs(collection(carol.fs, 'workspaces', wid, 'threads')))
await allow('editor answers', () => {
  const b = writeBatch(bob.fs)
  b.set(msg(bob.fs, 't1', 'm2'), { uid: bob.uid, name: 'b', text: 'Only without menus.', createdAt: 2 })
  b.update(thr(bob.fs, 't1'), { count: 2, lastAt: 2, updatedAt: 2 })
  return b.commit()
})
await deny('a message in someone else\'s name', () => setDoc(msg(bob.fs, 't1', 'm3'), { uid: dave.uid, name: 'd', text: 'x', createdAt: 3 }))
await deny('an empty message', () => setDoc(msg(bob.fs, 't1', 'm4'), { uid: bob.uid, name: 'b', text: '', createdAt: 3 }))
await deny('a message in no thread', () => setDoc(msg(bob.fs, 'nope', 'm1'), { uid: bob.uid, name: 'b', text: 'x', createdAt: 3 }))
await deny('editing someone else\'s message', () => updateDoc(msg(dave.fs, 't1', 'm2'), { text: 'changed', editedAt: 4 }))
await allow('editing your own message', () => updateDoc(msg(dave.fs, 't1', 'm1'), { text: 'Is 10 min real?', editedAt: 4 }))
await deny('moving a thread', () => updateDoc(thr(dave.fs, 't1'), { x: 9 }))
await allow('viewer resolves a thread', () => updateDoc(thr(dave.fs, 't1'), { resolved: true, resolvedBy: dave.uid }))
await deny('resolving in someone else\'s name', () => updateDoc(thr(bob.fs, 't1'), { resolvedBy: alice.uid }))
await deny('viewer deletes an editor\'s message', () => deleteDoc(msg(dave.fs, 't1', 'm2')))
await deny('starter deletes a thread others answered', () => deleteDoc(thr(dave.fs, 't1')))
// Only a message's writer deletes it (D-166); an owner takes others' messages only along with the whole thread.
await deny('editor deletes someone else\'s message', () => deleteDoc(msg(bob.fs, 't1', 'm1')))
await deny('owner deletes someone else\'s message on its own', () => deleteDoc(msg(alice.fs, 't1', 'm1')))
await deny('editor deletes a thread others answered', () => deleteDoc(thr(bob.fs, 't1')))
await allow('writer deletes their own message', () => {
  const b = writeBatch(bob.fs)
  b.delete(msg(bob.fs, 't1', 'm2'))
  b.update(thr(bob.fs, 't1'), { count: 1, updatedAt: 5 })
  return b.commit()
})
await allow('owner deletes a thread with its messages', () => {
  const b = writeBatch(alice.fs)
  b.delete(msg(alice.fs, 't1', 'm1'))
  b.delete(thr(alice.fs, 't1'))
  return b.commit()
})
// Mentions, who wrote last (D-166).
await allow('a reply that mentions someone', async () => {
  await start(bob, 't6')
  const b = writeBatch(dave.fs)
  b.set(msg(dave.fs, 't6', 'm2'), { uid: dave.uid, name: 'd', text: '@Bob look', mentions: [bob.uid], createdAt: 2 })
  b.update(thr(dave.fs, 't6'), { count: 2, lastAt: 2, lastUid: dave.uid, lastName: 'd', lastText: '@Bob look', mentions: [bob.uid], updatedAt: 2 })
  return b.commit()
})
await deny('saying someone else wrote last', () => updateDoc(thr(dave.fs, 't6'), { lastUid: bob.uid, lastAt: 3 }))
// What you've read (D-166): yours alone.
const reads = (fs, uid) => doc(fs, 'workspaces', wid, 'threadReads', uid)
await allow('marking threads read', () => setDoc(reads(dave.fs, dave.uid), { seen: { t6: 2 }, updatedAt: 2 }, { merge: true }))
await allow('reading what you have read', () => getDoc(reads(dave.fs, dave.uid)))
await deny('reading what someone else has read', () => getDoc(reads(bob.fs, dave.uid)))
await deny('writing someone else\'s reads', () => setDoc(reads(bob.fs, dave.uid), { seen: {}, updatedAt: 3 }))
await allow('starter deletes their unanswered thread', async () => {
  await start(dave, 't5')
  await deleteDoc(msg(dave.fs, 't5', 'm1'))
  await deleteDoc(thr(dave.fs, 't5'))
})
await seedReport('r20', bob.uid)
await deny('body written for an old report', () => setDoc(bodyDoc(bob.fs, 'r21'), body))
await allow('author reads the body', () => getDoc(bodyDoc(bob.fs, 'r20')))
await deny('another member reads a private body', () => getDoc(bodyDoc(dave.fs, 'r20')))
await seedReport('r20', bob.uid, { shared: true })
await allow('member reads a shared body', () => getDoc(bodyDoc(dave.fs, 'r20')))
await deny('another member deletes a shared body', () => deleteDoc(bodyDoc(dave.fs, 'r2')))
await allow('owner deletes a shared report and its body', () => {
  const b = writeBatch(alice.fs)
  b.delete(bodyDoc(alice.fs, 'r2'))
  b.delete(repDoc(alice.fs, 'r2'))
  return b.commit()
})
await seedReport('r20', bob.uid, { shared: true })

// Several owners.
await allow('owner makes a member a co-owner', () => role(alice, bob.uid, 'owner'))
await allow("co-owner lists the workspace's requests", () => getDocs(query(collection(bob.fs, 'joinRequests'), where('workspaceId', '==', wid))))
await allow('co-owner invites an email', () => join(bob, { invitedEmails: arrayUnion('frank@example.com') }))
await allow('co-owner deletes a shared report', () => deleteDoc(repDoc(bob.fs, 'r20')))
await deny('editor lists the workspace\'s requests', async () => {
  await role(alice, dave.uid, 'editor')
  await getDocs(query(collection(dave.fs, 'joinRequests'), where('workspaceId', '==', wid)))
})
await allow('owner steps down while another owner remains', () => role(alice, alice.uid, 'editor'))
await deny('former owner makes themselves owner again', () => role(alice, alice.uid, 'owner'))
await allow('co-owner makes them owner again', () => role(bob, alice.uid, 'owner'))
await allow('co-owner steps down to editor', () => role(bob, bob.uid, 'editor'))
await deny('the last owner steps down', () => role(alice, alice.uid, 'editor'))
await deny('the last owner leaves', () => join(alice, { memberIds: arrayRemove(alice.uid), [`roles.${alice.uid}`]: deleteField() }))
await allow('an owner leaves while another owner remains', async () => {
  await role(alice, dave.uid, 'owner')
  await join(dave, { memberIds: arrayRemove(dave.uid), [`roles.${dave.uid}`]: deleteField() })
})
await allow('owner removes a member and their entry', async () => {
  await join(alice, { memberIds: arrayUnion(dave.uid), [`roles.${dave.uid}`]: 'viewer' })
  const b = writeBatch(alice.fs)
  b.update(doc(alice.fs, 'workspaces', wid), { memberIds: arrayRemove(dave.uid), [`roles.${dave.uid}`]: deleteField() })
  b.delete(memberDoc(alice.fs, dave.uid))
  return b.commit()
})

await deny('outsider still cannot read after others join', () => getDoc(doc(carol.fs, 'workspaces', wid)))

await deny('member removes someone else', () => join(bob, { memberIds: arrayRemove(alice.uid) }))
await deny('leave but keep your role', () => join(bob, { memberIds: arrayRemove(bob.uid) }))
await deny('owner leaves (must delete instead)', () =>
  join(alice, { memberIds: arrayRemove(alice.uid), [`roles.${alice.uid}`]: deleteField() }),
)
await allow('member leaves', () => join(bob, { memberIds: arrayRemove(bob.uid), [`roles.${bob.uid}`]: deleteField() }))
await deny('former member reads workspace', () => getDoc(doc(bob.fs, 'workspaces', wid)))
await deny('former member lists ideas', () => getDocs(ideas(bob.fs)))

const presence = (who, uid) => ref(who.rt, `presence/${wid}/${uid}`)
const me = (name, extra = {}) => ({ name, color: '#2de2e6', view: 'canvas', ts: serverTimestamp(), ...extra })
await allow('write own presence', () => rtSet(presence(bob, bob.uid), me('Bob')))
await allow('presence with cursor, selection and photo', () =>
  rtSet(presence(bob, bob.uid), me('Bob', { x: 1.5, y: -2, sel: 'abc', photo: 'https://example.com/a.png', since: serverTimestamp() })),
)
await allow('presence with a selection of several (D-124)', () => rtSet(presence(bob, bob.uid), me('Bob', { sel: 'abc', more: 'def ghi' })))
await allow('presence dragging a task (D-260)', () => rtSet(presence(bob, bob.uid), me('Bob', { sel: 'tk1', drag: 'tk1 120 340 2' })))
await deny('presence with too long a drag', () => rtSet(presence(bob, bob.uid), me('Bob', { drag: 'x'.repeat(201) })))
await deny('presence with too long a selection', () => rtSet(presence(bob, bob.uid), me('Bob', { sel: 'abc', more: 'x'.repeat(2049) })))
await deny('write someone else\'s presence', () => rtSet(presence(bob, alice.uid), me('Fake')))
await deny('presence without required fields', () => rtSet(presence(bob, bob.uid), { x: 1 }))
await deny('presence with an unknown field', () => rtSet(presence(bob, bob.uid), me('Bob', { secret: 1 })))
await allow('presence in a plane (D-191)', () => rtSet(presence(bob, bob.uid), me('Bob', { plane: 'p1' })))
await deny('presence with a numeric plane', () => rtSet(presence(bob, bob.uid), me('Bob', { plane: 5 })))
await deny('presence on an old view (1.0, D-248)', () => rtSet(presence(bob, bob.uid), me('Bob', { view: 'board' })))
await allow('presence on the canvas (D-174)', () => rtSet(presence(bob, bob.uid), me('Bob', { view: 'canvas' })))
await deny('presence with an unknown view', () => rtSet(presence(bob, bob.uid), me('Bob', { view: 'kanban' })))
await deny('presence with a non-hex colour', () => rtSet(presence(bob, bob.uid), me('Bob', { color: 'red' })))
await deny('presence with the retired typing fields (D-071)', () => rtSet(presence(bob, bob.uid), me('Bob', { edit: 'abc', field: 'title' })))
await deny('presence with a text join time', () => rtSet(presence(bob, bob.uid), me('Bob', { since: 'now' })))
await deny('presence with a text cursor', () => rtSet(presence(bob, bob.uid), me('Bob', { x: 'far' })))
await deny('presence from the future', () => rtSet(presence(bob, bob.uid), me('Bob', { ts: Date.now() + 3_600_000 })))
await allow('remove own presence', () => rtRemove(presence(bob, bob.uid)))
await deny('remove someone else\'s presence', () => rtRemove(presence(bob, alice.uid)))
await allow('signed-in user reads presence', () => rtGet(ref(alice.rt, `presence/${wid}`)))
await deny('signed-out user reads presence', () => rtGet(ref(anon.rt, `presence/${wid}`)))
await deny('read outside /presence', () => rtGet(ref(alice.rt, '/')))

await deny('member deletes the invite code', () => writeBatch(carol.fs).delete(doc(carol.fs, 'inviteCodes', CODE)).commit())
await allow('owner deletes children, invite code, then workspace', async () => {
  const children = await getDocs(ideas(alice.fs))
  const b1 = writeBatch(alice.fs)
  children.forEach((d) => b1.delete(d.ref))
  await b1.commit()
  const b2 = writeBatch(alice.fs)
  b2.delete(doc(alice.fs, 'inviteCodes', CODE))
  b2.delete(doc(alice.fs, 'workspaces', wid))
  await b2.commit()
})

// Many reports at once. Deleting a body reads its summary twice, and a batch's rules may read at most 20 documents, so a
// workspace delete takes reports a few to a batch (REPORTS_PER_BATCH in src/data/workspaces.ts).
{
  const w = doc(collection(alice.fs, 'workspaces'))
  await setDoc(w, { name: 'Many', ownerId: alice.uid, memberIds: [alice.uid], roles: { [alice.uid]: 'owner' }, inviteCode: 'MANYCODE', createdAt: Date.now() })
  const rep = (id) => doc(alice.fs, 'workspaces', w.id, 'reports', id)
  const ids = Array.from({ length: 25 }, (_, i) => `m${i}`)
  const inBatches = async (n, write) => {
    for (let i = 0; i < ids.length; i += n) {
      const b = writeBatch(alice.fs)
      for (const id of ids.slice(i, i + n)) write(b, id)
      await b.commit()
    }
  }
  for (const id of ids) {
    await seed(`workspaces/${w.id}/reports/${id}`, summaryOf(alice.uid))
    await seed(`workspaces/${w.id}/reports/${id}/content/body`, body)
  }
  const remove = (b, id) => b.delete(doc(rep(id), 'content', 'body')).delete(rep(id))
  await deny('one batch deletes 25 reports (over the 20 reads a batch may make)', () => inBatches(25, remove))
  await allow('owner deletes 25 reports six to a batch (workspace delete)', () => inBatches(6, remove))
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
