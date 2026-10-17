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
const dave = await client('dave')
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
await allow('owner creates idea', () => addDoc(ideas(alice.fs), { title: 'First', x: 0, y: 0, createdAt: 1, updatedAt: 1 }))

await deny('non-member reads workspace', () => getDoc(doc(bob.fs, 'workspaces', wid)))
await deny('non-member lists ideas', () => getDocs(ideas(bob.fs)))
await deny('non-member creates idea', () => addDoc(ideas(bob.fs), { title: 'x', x: 0, y: 0 }))
await deny('signed-out user reads invite code', () => getDoc(doc(anon.fs, 'inviteCodes', CODE)))
await allow('signed-in user gets invite code by exact value', () => getDoc(doc(bob.fs, 'inviteCodes', CODE)))
await deny('anyone lists invite codes', () => getDocs(collection(bob.fs, 'inviteCodes')))

const join = (who, fields) => updateDoc(doc(who.fs, 'workspaces', wid), fields)
// D-062: a code no longer joins by itself.
await deny('join directly with the right code (retired, D-062)', () => join(bob, { memberIds: arrayUnion(bob.uid), [`roles.${bob.uid}`]: 'editor', joinCode: CODE }))
await deny('join directly without a code', () => join(bob, { memberIds: arrayUnion(bob.uid), [`roles.${bob.uid}`]: 'editor' }))

// Join requests (D-062): a code sends a request; the owner approves or denies.
const reqRef = (fs, uid) => doc(fs, 'joinRequests', `${wid}_${uid}`)
const request = (who, extra = {}) => ({ workspaceId: wid, ownerId: alice.uid, uid: who.uid, name: who.name, email: `${who.name}@example.com`, code: CODE, createdAt: 1, ...extra })
bob.name = 'bob'
carol.name = 'carol'
await deny('request with a wrong code', () => setDoc(reqRef(bob.fs, bob.uid), request(bob, { code: 'WRONG' })))
await deny('request on behalf of someone else', () => setDoc(reqRef(bob.fs, carol.uid), request(carol)))
await deny('request with a made-up owner', () => setDoc(reqRef(bob.fs, bob.uid), request(bob, { ownerId: bob.uid })))
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
  getDocs(query(collection(alice.fs, 'joinRequests'), where('ownerId', '==', alice.uid), where('workspaceId', '==', wid))),
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
// Customers, problems; old domain fields still tolerated (D-042 to D-048).
await deny('new domain (retired, D-048)', () => addDoc(sub(bob.fs, 'domains'), { name: 'Dev tools', createdAt: 1 }))
await allow('customer in two domains', () => addDoc(sub(bob.fs, 'customers'), { ...card, domainIds: ['d1', 'd2'] }))
await allow('problem in one domain', () => addDoc(sub(bob.fs, 'problems'), { ...card, domainId: 'd1' }))
await deny('problem with a numeric domain', () => addDoc(sub(bob.fs, 'problems'), { ...card, domainId: 7 }))
await deny('customer with domainIds as a string', () => addDoc(sub(bob.fs, 'customers'), { ...card, domainIds: 'd1' }))
await allow('competitor placed on the board', () => updateDoc(compRef, { x: 2, y: 3, domainIds: ['d1'] }))
await deny('competitor with a text position', () => updateDoc(compRef, { x: 'left' }))
await allow('competitor with tags (D-056)', () => updateDoc(compRef, { tags: ['direct', 'enterprise'] }))
await deny('competitor with tags as a string', () => updateDoc(compRef, { tags: 'direct' }))
await allow('edge tagging an idea for a customer', () => addDoc(sub(bob.fs, 'edges'), { fromId: 'a', fromType: 'idea', toId: 'c', toType: 'customer', kind: 'for' }))
await allow('edge from an idea to a problem', () => addDoc(sub(bob.fs, 'edges'), { fromId: 'a', fromType: 'idea', toId: 'p', toType: 'problem', kind: 'solves' }))
// Labels: text on the board (D-050). Groups are retired (D-049).
await allow('text label', () => addDoc(sub(bob.fs, 'labels'), { text: 'COMPETITORS', x: 0, y: 5, createdAt: 1, updatedAt: 1 }))
await deny('label without a position', () => addDoc(sub(bob.fs, 'labels'), { text: 'x', createdAt: 1, updatedAt: 1 }))
await deny('label with a numeric text', () => addDoc(sub(bob.fs, 'labels'), { text: 3, x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
await deny('new group (retired)', () => addDoc(sub(bob.fs, 'groups'), { name: 'Pricing', x: 0, y: 0, w: 6, h: 4, createdAt: 1, updatedAt: 1 }))
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
const me = (name, extra = {}) => ({ name, color: '#2de2e6', view: 'board', ts: serverTimestamp(), ...extra })
await allow('write own presence', () => rtSet(presence(bob, bob.uid), me('Bob')))
await allow('presence with cursor, selection and photo', () =>
  rtSet(presence(bob, bob.uid), me('Bob', { x: 1.5, y: -2, sel: 'abc', photo: 'https://example.com/a.png' })),
)
await deny('write someone else\'s presence', () => rtSet(presence(bob, alice.uid), me('Fake')))
await deny('presence without required fields', () => rtSet(presence(bob, bob.uid), { x: 1 }))
await deny('presence with an unknown field', () => rtSet(presence(bob, bob.uid), me('Bob', { secret: 1 })))
await deny('presence with an unknown view', () => rtSet(presence(bob, bob.uid), me('Bob', { view: 'canvas' })))
await deny('presence with a non-hex colour', () => rtSet(presence(bob, bob.uid), me('Bob', { color: 'red' })))
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

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
