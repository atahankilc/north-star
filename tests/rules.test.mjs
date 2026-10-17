// Security-rule tests (Q-011) against the local emulators.
// Run: npm run test:rules
import assert from 'node:assert/strict'
import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, GoogleAuthProvider, signInWithCredential } from 'firebase/auth'
import { connectDatabaseEmulator, get as rtGet, getDatabase, ref, set as rtSet } from 'firebase/database'
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  connectFirestoreEmulator,
  deleteField,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'

const PROJECT = 'demo-north-star'
const config = { apiKey: 'demo-key', projectId: PROJECT, databaseURL: `http://127.0.0.1:9010?ns=${PROJECT}-default-rtdb` }

async function client(name) {
  const app = initializeApp(config, name)
  const auth = getAuth(app)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  const fs = getFirestore(app)
  connectFirestoreEmulator(fs, '127.0.0.1', 8080)
  const rt = getDatabase(app)
  connectDatabaseEmulator(rt, '127.0.0.1', 9010)
  let uid = null
  if (name !== 'anon') {
    const token = JSON.stringify({ sub: `test-${name}`, email: `${name}@example.com`, email_verified: true })
    uid = (await signInWithCredential(auth, GoogleAuthProvider.credential(token))).user.uid
  }
  return { fs, rt, uid }
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
const anon = await client('anon')

// Alice creates a workspace + invite code in one batch, like createWorkspace().
const wsRef = doc(collection(alice.fs, 'workspaces'))
const wid = wsRef.id
const CODE = 'TESTCODE'
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
await allow('owner creates idea', () => addDoc(ideas(alice.fs), { title: 'First', x: 0, y: 0, createdAt: 1, updatedAt: 1 }))

await deny('non-member reads workspace', () => getDoc(doc(bob.fs, 'workspaces', wid)))
await deny('non-member lists ideas', () => getDocs(ideas(bob.fs)))
await deny('non-member creates idea', () => addDoc(ideas(bob.fs), { title: 'x', x: 0, y: 0 }))
await deny('signed-out user reads invite code', () => getDoc(doc(anon.fs, 'inviteCodes', CODE)))
await allow('signed-in user gets invite code by exact value', () => getDoc(doc(bob.fs, 'inviteCodes', CODE)))
await deny('anyone lists invite codes', () => getDocs(collection(bob.fs, 'inviteCodes')))

const join = (who, fields) => updateDoc(doc(who.fs, 'workspaces', wid), fields)
await deny('join with a wrong code', () => join(bob, { memberIds: arrayUnion(bob.uid), [`roles.${bob.uid}`]: 'editor', joinCode: 'WRONG' }))
await deny('join as owner role', () => join(bob, { memberIds: arrayUnion(bob.uid), [`roles.${bob.uid}`]: 'owner', joinCode: CODE }))
await deny('join and add someone else too', () => join(bob, { memberIds: arrayUnion(bob.uid, carol.uid), [`roles.${bob.uid}`]: 'editor', joinCode: CODE }))
await deny('join and rename in the same write', () => join(bob, { memberIds: arrayUnion(bob.uid), [`roles.${bob.uid}`]: 'editor', joinCode: CODE, name: 'Mine' }))
await allow('join with the right code', () => join(bob, { memberIds: arrayUnion(bob.uid), [`roles.${bob.uid}`]: 'editor', joinCode: CODE }))

await allow('member reads workspace', () => getDoc(doc(bob.fs, 'workspaces', wid)))
await allow('member lists ideas', () => getDocs(ideas(bob.fs)))
await allow('member creates idea', () => addDoc(ideas(bob.fs), { title: 'Bob', x: 1, y: 1, createdAt: 1, updatedAt: 1 }))
await allow('member renames workspace', () => join(bob, { name: 'Acme 2' }))

// Content shapes (D-036 to D-038).
const sub = (fs, name) => collection(fs, 'workspaces', wid, name)
const card = { title: 'Card', x: 0, y: 0, createdAt: 1, updatedAt: 1 }
await deny('unknown collection', () => addDoc(sub(bob.fs, 'secrets'), { title: 'x' }))
await deny('idea without a position', () => addDoc(ideas(bob.fs), { title: 'x', createdAt: 1, updatedAt: 1 }))
await deny('idea with a numeric title', () => addDoc(ideas(bob.fs), { ...card, title: 5 }))
await allow('feature with priority, status, effort', () => addDoc(sub(bob.fs, 'features'), { ...card, priority: 'P1', status: 'planned', effort: 'M' }))
await deny('feature with an unknown status', () => addDoc(sub(bob.fs, 'features'), { ...card, status: 'someday' }))
const compRef = await addDoc(sub(alice.fs, 'competitors'), { name: 'Rival', url: 'https://rival.example', createdAt: 1, updatedAt: 1 })
await allow('competitor', () => getDoc(compRef))
await deny('competitor without a name', () => addDoc(sub(bob.fs, 'competitors'), { url: 'x', createdAt: 1, updatedAt: 1 }))
await allow('competitor feature', () => addDoc(sub(bob.fs, 'competitorFeatures'), { competitorId: compRef.id, name: 'SSO', category: 'auth', createdAt: 1, updatedAt: 1 }))
await deny('competitor feature without its competitor', () => addDoc(sub(bob.fs, 'competitorFeatures'), { name: 'SSO', createdAt: 1, updatedAt: 1 }))
const cell = (id, data) => writeBatch(bob.fs).set(doc(sub(bob.fs, 'comparisons'), id), data).commit()
await allow('matrix cell keyed by feature_competitor', () => cell(`f1_${compRef.id}`, { featureId: 'f1', competitorId: compRef.id, coverage: 'partial', updatedAt: 1 }))
await deny('matrix cell with a free id', () => cell('random', { featureId: 'f1', competitorId: compRef.id, coverage: 'full', updatedAt: 1 }))
await deny('matrix cell with an unknown coverage', () => cell(`f2_${compRef.id}`, { featureId: 'f2', competitorId: compRef.id, coverage: 'meh', updatedAt: 1 }))
await allow('edge between an idea and a feature', () => addDoc(sub(bob.fs, 'edges'), { fromId: 'a', fromType: 'feature', toId: 'b', toType: 'idea', kind: 'inspired-by' }))
await deny('edge to itself', () => addDoc(sub(bob.fs, 'edges'), { fromId: 'a', fromType: 'idea', toId: 'a', toType: 'idea', kind: 'relates' }))
await deny('edge with an unknown node type', () => addDoc(sub(bob.fs, 'edges'), { fromId: 'a', fromType: 'user', toId: 'b', toType: 'idea', kind: 'relates' }))
await deny('member promotes self to owner', () => join(bob, { [`roles.${bob.uid}`]: 'owner' }))
await deny('member takes ownership', () => join(bob, { ownerId: bob.uid }))
await deny('member adds someone else', () => join(bob, { memberIds: arrayUnion(carol.uid) }))
await deny('member changes the invite code', () => join(bob, { inviteCode: 'BOBCODE2' }))
await deny('member deletes workspace', () => writeBatch(bob.fs).delete(doc(bob.fs, 'workspaces', wid)).commit())

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
const me = (name) => ({ name, color: '#fff', view: 'canvas', ts: Date.now() })
await allow('write own presence', () => rtSet(presence(bob, bob.uid), me('Bob')))
await deny('write someone else\'s presence', () => rtSet(presence(bob, alice.uid), me('Fake')))
await deny('presence without required fields', () => rtSet(presence(bob, bob.uid), { x: 1 }))
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

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
