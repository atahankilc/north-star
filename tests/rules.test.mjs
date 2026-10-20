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
await allow('member describes workspace', () => join(bob, { description: 'Shift scheduling for small restaurants' }))
await deny('workspace description too long', () => join(bob, { description: 'x'.repeat(1001) }))
await deny('workspace description not text', () => join(bob, { description: 5 }))

// Content shapes (D-036 to D-038).
const sub = (fs, name) => collection(fs, 'workspaces', wid, name)
const card = { title: 'Card', x: 0, y: 0, createdAt: 1, updatedAt: 1 }
await deny('unknown collection', () => addDoc(sub(bob.fs, 'secrets'), { title: 'x' }))
await deny('idea without a position', () => addDoc(ideas(bob.fs), { title: 'x', createdAt: 1, updatedAt: 1 }))
await deny('idea with a numeric title', () => addDoc(ideas(bob.fs), { ...card, title: 5 }))
await allow('feature with priority, status, effort', () => addDoc(sub(bob.fs, 'features'), { ...card, priority: 'P1', status: 'planned', effort: 'M' }))
await allow('feature with an impact', () => addDoc(sub(bob.fs, 'features'), { ...card, impact: 'high' }))
await deny('feature with an unknown impact', () => addDoc(sub(bob.fs, 'features'), { ...card, impact: 'huge' }))
await deny('feature with an unknown status', () => addDoc(sub(bob.fs, 'features'), { ...card, status: 'someday' }))
// Parts folded into a feature (D-164): on All the feature's, on a plane the placement's.
await allow('feature with its parts folded', () => addDoc(sub(bob.fs, 'features'), { ...card, folded: true }))
await deny('feature folded with a non-bool', () => addDoc(sub(bob.fs, 'features'), { ...card, folded: 'yes' }))
// Planes and placements (D-139).
await allow('a plane', () => addDoc(sub(bob.fs, 'planes'), { name: 'Competitors', order: 1, createdAt: 1, updatedAt: 1 }))
await deny('a plane without a name', () => addDoc(sub(bob.fs, 'planes'), { name: '', order: 1, createdAt: 1, updatedAt: 1 }))
const place = (id, data) => writeBatch(bob.fs).set(doc(sub(bob.fs, 'placements'), id), data).commit()
await allow('a card placed on a plane', () => place('p1_c1', { planeId: 'p1', itemId: 'c1', itemType: 'competitor', x: 1, y: 2 }))
await deny('a placement with a free id', () => place('random', { planeId: 'p1', itemId: 'c1', itemType: 'competitor', x: 1, y: 2 }))
await deny('a placement of a competitor feature', () => place('p1_f1', { planeId: 'p1', itemId: 'f1', itemType: 'competitorFeature', x: 1, y: 2 }))
await deny('a placement without a position', () => place('p1_c2', { planeId: 'p1', itemId: 'c2', itemType: 'idea' }))
await allow('a feature folded on a plane', () => place('p1_x1', { planeId: 'p1', itemId: 'x1', itemType: 'feature', x: 1, y: 2, folded: true }))
await deny('a placement folded with a non-bool', () => place('p1_x2', { planeId: 'p1', itemId: 'x2', itemType: 'feature', x: 1, y: 2, folded: 1 }))
await allow('text on a plane', () => addDoc(sub(bob.fs, 'labels'), { text: 'MVP', planeId: 'p1', x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
// Packages (D-141).
await allow('a package', () => addDoc(sub(bob.fs, 'packages'), { ...card, memberIds: ['a', 'b'], homePlaneId: 'p1', impact: 'high', effort: 'M' }))
await deny('a package without its home plane', () => addDoc(sub(bob.fs, 'packages'), { ...card, memberIds: ['a'] }))
await deny('a package with members that are not a list', () => addDoc(sub(bob.fs, 'packages'), { ...card, memberIds: 'a', homePlaneId: 'p1' }))
await allow('a package placed on a plane', () => place('p1_k1', { planeId: 'p1', itemId: 'k1', itemType: 'package', x: 0, y: 0 }))
// The canvas (D-176): planes placed on it (D-180).
const piece = { kind: 'plane', x: -480, y: -300, w: 960, h: 600, createdAt: 1, updatedAt: 1 }
await allow('a plane on the canvas', () => addDoc(sub(bob.fs, 'pieces'), piece))
await allow('a named plane on the canvas', () => addDoc(sub(bob.fs, 'pieces'), { ...piece, name: 'Pricing' }))
await allow('a piece still called a board (before D-180)', () => addDoc(sub(bob.fs, 'pieces'), { ...piece, kind: 'board' }))
await deny('a canvas piece of an unknown kind', () => addDoc(sub(bob.fs, 'pieces'), { ...piece, kind: 'video' }))
await deny('a canvas piece without a size', () => addDoc(sub(bob.fs, 'pieces'), { ...piece, w: 0 }))
await deny('a canvas piece without a place', () => addDoc(sub(bob.fs, 'pieces'), { kind: 'board', w: 1, h: 1, createdAt: 1, updatedAt: 1 }))
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
const compRef = await addDoc(sub(alice.fs, 'competitors'), { name: 'Rival', url: 'https://rival.example', createdAt: 1, updatedAt: 1 })
await allow('competitor', () => getDoc(compRef))
await deny('competitor without a name', () => addDoc(sub(bob.fs, 'competitors'), { url: 'x', createdAt: 1, updatedAt: 1 }))
await allow('competitor feature', () => addDoc(sub(bob.fs, 'competitorFeatures'), { competitorId: compRef.id, name: 'SSO', category: 'auth', createdAt: 1, updatedAt: 1 }))
await allow('competitor feature with availability and source', () => addDoc(sub(bob.fs, 'competitorFeatures'), { competitorId: compRef.id, name: 'SSO', availability: 'enterprise', url: 'https://rival.example/sso', createdAt: 1, updatedAt: 1 }))
await deny('competitor feature with an unknown availability', () => addDoc(sub(bob.fs, 'competitorFeatures'), { competitorId: compRef.id, name: 'SSO', availability: 'cheap', createdAt: 1, updatedAt: 1 }))
await deny('competitor feature without its competitor', () => addDoc(sub(bob.fs, 'competitorFeatures'), { name: 'SSO', createdAt: 1, updatedAt: 1 }))
const cell = (id, data) => writeBatch(bob.fs).set(doc(sub(bob.fs, 'comparisons'), id), data).commit()
await allow('matrix cell keyed by feature_competitor', () => cell(`f1_${compRef.id}`, { featureId: 'f1', competitorId: compRef.id, coverage: 'partial', updatedAt: 1 }))
await deny('matrix cell with a free id', () => cell('random', { featureId: 'f1', competitorId: compRef.id, coverage: 'full', updatedAt: 1 }))
await deny('matrix cell with an unknown coverage', () => cell(`f2_${compRef.id}`, { featureId: 'f2', competitorId: compRef.id, coverage: 'meh', updatedAt: 1 }))
await allow('matrix cell with criterion scores', () => cell(`f3_${compRef.id}`, { featureId: 'f3', competitorId: compRef.id, criteria: { c0: 'met', c1: 'part', c2: 'no' }, updatedAt: 1 }))
await deny('matrix cell with an unknown criterion score', () => cell(`f4_${compRef.id}`, { featureId: 'f4', competitorId: compRef.id, criteria: { c0: 'maybe' }, updatedAt: 1 }))
await allow('matrix cell not relevant, with a confidence', () => cell(`f6_${compRef.id}`, { featureId: 'f6', competitorId: compRef.id, notRelevant: true, confidence: 'inferred', updatedAt: 1 }))
await deny('matrix cell with an unknown confidence', () => cell(`f7_${compRef.id}`, { featureId: 'f7', competitorId: compRef.id, confidence: 'sure', updatedAt: 1 }))
await deny('matrix cell with a text notRelevant', () => cell(`f8_${compRef.id}`, { featureId: 'f8', competitorId: compRef.id, notRelevant: 'yes', updatedAt: 1 }))
await deny('matrix cell with criteria that are not a map', () => cell(`f5_${compRef.id}`, { featureId: 'f5', competitorId: compRef.id, criteria: ['met'], updatedAt: 1 }))
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
await allow('text label', () => addDoc(sub(bob.fs, 'labels'), { text: 'COMPETITORS', x: 0, y: 5, createdAt: 1, updatedAt: 1 }))
await allow('text label as a note', () => addDoc(sub(bob.fs, 'labels'), { text: 'check pricing', size: 'note', x: 0, y: 4, createdAt: 1, updatedAt: 1 }))
await allow('the project title block', () => addDoc(sub(bob.fs, 'labels'), { text: '', kind: 'title', x: 0, y: 8, createdAt: 1, updatedAt: 1 }))
await allow('a section (D-130)', () => addDoc(sub(bob.fs, 'labels'), { text: 'Onboarding', kind: 'section', x: 0, y: 0, w: 14, h: 9, createdAt: 1, updatedAt: 1 }))
await allow('an H3 in bold italic caps (D-130)', () => addDoc(sub(bob.fs, 'labels'), { text: 'Pricing', size: 'minor', bold: true, italic: true, caps: true, x: 0, y: 2, createdAt: 1, updatedAt: 1 }))
await deny('text with italic as a string', () => addDoc(sub(bob.fs, 'labels'), { text: 'x', italic: 'yes', x: 0, y: 2, createdAt: 1, updatedAt: 1 }))
await deny('a section without a size', () => addDoc(sub(bob.fs, 'labels'), { text: 'Onboarding', kind: 'section', x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
await deny('a section with a negative width', () => addDoc(sub(bob.fs, 'labels'), { text: 'x', kind: 'section', x: 0, y: 0, w: -2, h: 4, createdAt: 1, updatedAt: 1 }))
await deny('a section with a text height', () => addDoc(sub(bob.fs, 'labels'), { text: 'x', kind: 'section', x: 0, y: 0, w: 2, h: 'tall', createdAt: 1, updatedAt: 1 }))
await deny('a label of an unknown kind', () => addDoc(sub(bob.fs, 'labels'), { text: 'x', kind: 'banner', x: 0, y: 4, createdAt: 1, updatedAt: 1 }))
await deny('text label with an unknown size', () => addDoc(sub(bob.fs, 'labels'), { text: 'x', size: 'huge', x: 0, y: 4, createdAt: 1, updatedAt: 1 }))
await deny('label without a position', () => addDoc(sub(bob.fs, 'labels'), { text: 'x', createdAt: 1, updatedAt: 1 }))
await deny('label with a numeric text', () => addDoc(sub(bob.fs, 'labels'), { text: 3, x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
// Paragraphs, turned text, small lines (D-156); a section's name up its left edge (D-157).
await allow('a long paragraph (D-156)', () => addDoc(sub(bob.fs, 'labels'), { text: 'x'.repeat(3000), size: 'note', w: 6.25, x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
await deny('a heading as long as a paragraph', () => addDoc(sub(bob.fs, 'labels'), { text: 'x'.repeat(300), x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
await deny('a paragraph over 4000', () => addDoc(sub(bob.fs, 'labels'), { text: 'x'.repeat(4001), size: 'note', x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
await allow('text turned a quarter with a small line', () => addDoc(sub(bob.fs, 'labels'), { text: 'Early adopters', rotate: 90, kicker: '01 who', x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
await deny('text turned 45', () => addDoc(sub(bob.fs, 'labels'), { text: 'x', rotate: 45, x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
await deny('a small line over 60', () => addDoc(sub(bob.fs, 'labels'), { text: 'x', kicker: 'k'.repeat(61), x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
await allow('a section named up its left edge (D-157)', () => addDoc(sub(bob.fs, 'labels'), { text: 'Ideas', kind: 'section', side: 'left', x: 0, y: 0, w: 10, h: 6, createdAt: 1, updatedAt: 1 }))
await deny('a section named on its right edge', () => addDoc(sub(bob.fs, 'labels'), { text: 'Ideas', kind: 'section', side: 'right', x: 0, y: 0, w: 10, h: 6, createdAt: 1, updatedAt: 1 }))
await allow('a large paragraph (D-160)', () => addDoc(sub(bob.fs, 'labels'), { text: 'x', size: 'note', scale: 'large', x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
await allow('a medium paragraph (D-161)', () => addDoc(sub(bob.fs, 'labels'), { text: 'x', size: 'note', scale: 'medium', x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
await deny('a paragraph at a huge size', () => addDoc(sub(bob.fs, 'labels'), { text: 'x', size: 'note', scale: 'huge', x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
// Sticky notes (D-158): long text, signed.
await allow('a sticky note, signed', () => addDoc(sub(bob.fs, 'labels'), { text: 'x'.repeat(2000), kind: 'sticky', uid: 'bob', author: 'Bob', w: 3.125, x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
await deny('a sticky note over 4000', () => addDoc(sub(bob.fs, 'labels'), { text: 'x'.repeat(4001), kind: 'sticky', x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
await deny('a sticky note signed with a number', () => addDoc(sub(bob.fs, 'labels'), { text: 'x', kind: 'sticky', author: 7, x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
await deny('new group (retired)', () => addDoc(sub(bob.fs, 'groups'), { name: 'Pricing', x: 0, y: 0, w: 6, h: 4, createdAt: 1, updatedAt: 1 }))
// Attachments (D-083): metadata in Firestore, the file in Storage.
const attDoc = (fs, id) => doc(fs, 'workspaces', wid, 'attachments', id)
const att = (id, extra = {}) => ({
  nodeId: 'n1', nodeType: 'idea', name: 'plan.pdf', contentType: 'application/pdf', size: 1200,
  path: `workspaces/${wid}/attachments/${id}/plan.pdf`, uid: bob.uid, createdAt: 1, ...extra,
})
await allow('attachment record', () => setDoc(attDoc(bob.fs, 'a1'), att('a1')))
await allow('image attachment record with its size in pixels', () => setDoc(attDoc(bob.fs, 'a2'), att('a2', { name: 'shot.webp', contentType: 'image/webp', path: `workspaces/${wid}/attachments/a2/shot.webp`, width: 2560, height: 1440 })))
await allow('attachment record attached by someone else (undo restores it)', () => setDoc(attDoc(bob.fs, 'a3'), att('a3', { uid: alice.uid })))
await allow('image attachment record with its thumbnail', () => setDoc(attDoc(bob.fs, 'a8'), att('a8', { contentType: 'image/png', name: 'a.png', path: `workspaces/${wid}/attachments/a8/a.png`, thumbPath: `workspaces/${wid}/attachments/a8/~thumb.webp` })))
await deny('attachment record with a thumbnail elsewhere', () => setDoc(attDoc(bob.fs, 'a9'), att('a9', { thumbPath: `workspaces/${wid}/attachments/a1/~thumb.webp` })))
await deny('attachment record over 10 MB', () => setDoc(attDoc(bob.fs, 'a4'), att('a4', { size: 11 * 1024 * 1024 })))
await deny('attachment record of an .exe', () => setDoc(attDoc(bob.fs, 'a5'), att('a5', { contentType: 'application/x-msdownload' })))
await deny('attachment record pointing at another path', () => setDoc(attDoc(bob.fs, 'a6'), att('a6', { path: `workspaces/${wid}/attachments/a1/plan.pdf` })))
await deny('attachment record from a non-member', () => setDoc(attDoc(erin.fs, 'a7'), att('a7')))
await deny('non-member reads attachment records', () => getDocs(collection(erin.fs, 'workspaces', wid, 'attachments')))
await allow('member deletes an attachment record', () => deleteDoc(attDoc(bob.fs, 'a3')))

const file = (who, name) => fileRef(who.st, `workspaces/${wid}/attachments/f1/${name}`)
const pdf = new Uint8Array(2048)
await allow('member uploads a file', () => uploadBytes(file(bob, 'plan.pdf'), pdf, { contentType: 'application/pdf' }))
await allow('another member reads it', () => getBytes(file(alice, 'plan.pdf')))
await deny('non-member uploads a file', () => uploadBytes(file(erin, 'x.pdf'), pdf, { contentType: 'application/pdf' }))
await deny('non-member reads a file', () => getBytes(file(erin, 'plan.pdf')))
await deny('an 11 MB file', () => uploadBytes(file(bob, 'big.png'), new Uint8Array(11 * 1024 * 1024), { contentType: 'image/png' }))
await deny('an .exe content type', () => uploadBytes(file(bob, 'run.exe'), pdf, { contentType: 'application/x-msdownload' }))
await deny('a file outside attachments/', () => uploadBytes(fileRef(bob.st, `workspaces/${wid}/other/x.pdf`), pdf, { contentType: 'application/pdf' }))
await deny('non-member deletes a file', () => deleteObject(file(erin, 'plan.pdf')))
await allow('member deletes a file', () => deleteObject(file(bob, 'plan.pdf')))
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

// Research reports (D-090): yours until shared.
const reports = (fs) => collection(fs, 'workspaces', wid, 'reports')
const repDoc = (fs, id) => doc(fs, 'workspaces', wid, 'reports', id)
const report = (who, extra = {}) => ({
  title: 'Market', answer: 'Small.', sections: [{ question: 'Who?', points: [{ text: 'A', sources: [1] }] }],
  implications: [{ text: 'B', items: [] }], openQuestions: [], sources: [{ title: 'S', url: 'https://example.com' }],
  topic: 'market', uid: who.uid, name: 'Bob', model: 'gpt-6-luna', shared: false, createdAt: Date.now(), ...extra,
})
await allow('member saves their report', () => setDoc(repDoc(bob.fs, 'r1'), report(bob)))
await allow("member saves a chat's write-up", () => setDoc(repDoc(bob.fs, 'r7'), report(bob, { kind: 'chat' })))
await allow('member saves an uploaded .md report (D-091)', () => setDoc(repDoc(bob.fs, 'r9'), report(bob, { kind: 'upload', model: '', sections: Array(30).fill({ question: 'Q', points: [] }) })))
await deny('report with too many sections', () => setDoc(repDoc(bob.fs, 'r10'), report(bob, { kind: 'upload', sections: Array(31).fill({ question: 'Q', points: [] }) })))
await deny('report of an unknown kind', () => setDoc(repDoc(bob.fs, 'r8'), report(bob, { kind: 'memo' })))
await deny('member saves a report as someone else', () => setDoc(repDoc(bob.fs, 'r2'), report(dave)))
await deny('report with an unknown field', () => setDoc(repDoc(bob.fs, 'r3'), report(bob, { findings: 'raw' })))
await deny('report with too many sources', () => setDoc(repDoc(bob.fs, 'r4'), report(bob, { sources: Array(201).fill({ title: 'x', url: 'https://x' }) })))
await deny('outsider saves a report', () => setDoc(repDoc(carol.fs, 'r5'), report(carol)))
await allow('author reads their private report', () => getDoc(repDoc(bob.fs, 'r1')))
await allow('member reads a report not saved yet (the chat listens before saving)', () => getDoc(repDoc(dave.fs, 'unsaved')))
await deny('outsider reads a report not saved yet', () => getDoc(repDoc(carol.fs, 'unsaved')))
await deny('saving the same report again', () => setDoc(repDoc(bob.fs, 'r7'), report(bob, { kind: 'chat' })))
await deny('another member reads a private report', () => getDoc(repDoc(dave.fs, 'r1')))
await deny('owner reads a private report', () => getDoc(repDoc(alice.fs, 'r1')))
await deny('member lists every report', () => getDocs(reports(dave.fs)))
await allow('member lists their own reports', () => getDocs(query(reports(bob.fs), where('uid', '==', bob.uid))))
await allow('member lists shared reports', () => getDocs(query(reports(dave.fs), where('shared', '==', true))))
await deny('another member shares it', () => updateDoc(repDoc(dave.fs, 'r1'), { shared: true }))
await deny('author edits a saved report', () => updateDoc(repDoc(bob.fs, 'r1'), { title: 'Other' }))
await allow('author shares their report', () => updateDoc(repDoc(bob.fs, 'r1'), { shared: true }))
await allow('member reads a shared report', () => getDoc(repDoc(dave.fs, 'r1')))
await deny('outsider reads a shared report', () => getDoc(repDoc(carol.fs, 'r1')))
await deny('another member deletes a shared report', () => deleteDoc(repDoc(dave.fs, 'r1')))
await allow('owner deletes a shared report', () => deleteDoc(repDoc(alice.fs, 'r1')))
await allow("owner's undo restores the shared report", () => setDoc(repDoc(alice.fs, 'r1'), report(bob, { shared: true })))
await deny('owner restores it as private', () => setDoc(repDoc(alice.fs, 'r6'), report(bob)))
await allow('author unshares it', () => updateDoc(repDoc(bob.fs, 'r1'), { shared: false }))
await deny('owner deletes a private report', () => deleteDoc(repDoc(alice.fs, 'r1')))
await allow('author deletes their report', () => deleteDoc(repDoc(bob.fs, 'r1')))

// Roles (D-098): viewers read only; any number of owners, never none.
const role = (who, uid, r) => join(who, { [`roles.${uid}`]: r })
await allow('owner makes a member a viewer', () => role(alice, dave.uid, 'viewer'))
await allow('viewer reads ideas', () => getDocs(ideas(dave.fs)))
await deny('viewer creates an idea', () => addDoc(ideas(dave.fs), { title: 'x', x: 0, y: 0, createdAt: 1, updatedAt: 1 }))
await deny('viewer puts a plane on the canvas (D-176)', () => addDoc(sub(dave.fs, 'pieces'), { kind: 'plane', x: 0, y: 0, w: 1, h: 1, createdAt: 1, updatedAt: 1 }))
await allow('viewer reads the canvas', () => getDocs(sub(dave.fs, 'pieces')))
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

// Reports as a summary + body (D-098).
const bodyDoc = (fs, id) => doc(fs, 'workspaces', wid, 'reports', id, 'content', 'body')
const summaryOf = (who, extra = {}) => ({ title: 'Market', answer: 'Small.', topic: 'market', uid: who.uid, name: 'x', model: 'm', shared: false, createdAt: 1, sectionCount: 1, sourceCount: 1, ...extra })
const body = { sections: [{ question: 'Who?', points: [{ text: 'A', sources: [1] }] }], implications: [], openQuestions: [], sources: [{ title: 'S', url: 'https://example.com' }] }
const saveSplit = (who, id, extra) => {
  const b = writeBatch(who.fs)
  b.set(repDoc(who.fs, id), summaryOf(who, extra))
  b.set(bodyDoc(who.fs, id), body)
  return b.commit()
}
await allow('member saves a report as summary + body', () => saveSplit(bob, 'r20'))
await allow('viewer saves their own report', () => saveSplit(dave, 'r22'))

// Comment threads (D-159): any member, viewers too, as themselves.
const thr = (fs, id) => doc(fs, 'workspaces', wid, 'threads', id)
const msg = (fs, tid, id) => doc(fs, 'workspaces', wid, 'threads', tid, 'messages', id)
const threadOf = (who, extra = {}) => Object.fromEntries(Object.entries({ on: 'card', targetId: 'c1', x: 1, y: 2, uid: who.uid, name: 'x', count: 1, lastAt: 1, createdAt: 1, updatedAt: 1, ...extra }).filter(([, v]) => v !== undefined))
const start = (who, id, extra) => {
  const b = writeBatch(who.fs)
  b.set(thr(who.fs, id), threadOf(who, extra))
  b.set(msg(who.fs, id, 'm1'), { uid: who.uid, name: 'x', text: 'Is ten minutes real?', createdAt: 1 })
  return b.commit()
}
await allow('viewer starts a thread', () => start(dave, 't1'))
await allow('editor starts a thread on a spot', () => start(bob, 't2', { on: 'spot', targetId: undefined }))
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
await deny('summary without its counts', () => setDoc(repDoc(bob.fs, 'r23'), { ...summaryOf(bob), sectionCount: 'one' }))
await deny('body without its summary', () => setDoc(bodyDoc(bob.fs, 'r21'), body))
await allow('author reads the body', () => getDoc(bodyDoc(bob.fs, 'r20')))
await deny('another member reads a private body', () => getDoc(bodyDoc(dave.fs, 'r20')))
await allow('author shares it', () => updateDoc(repDoc(bob.fs, 'r20'), { shared: true }))
await allow('member reads a shared body', () => getDoc(bodyDoc(dave.fs, 'r20')))
await deny('another member deletes a shared body', () => deleteDoc(bodyDoc(dave.fs, 'r20')))
await allow('owner deletes a shared report and its body', () => {
  const b = writeBatch(alice.fs)
  b.delete(bodyDoc(alice.fs, 'r20'))
  b.delete(repDoc(alice.fs, 'r20'))
  return b.commit()
})
await allow('author removes a rewritten report and its body (research written again)', async () => {
  await saveSplit(dave, 'r24')
  const b = writeBatch(dave.fs)
  b.delete(bodyDoc(dave.fs, 'r24'))
  b.delete(repDoc(dave.fs, 'r24'))
  await b.commit()
})
await allow("owner's undo restores a shared summary + body", () => saveSplit({ fs: alice.fs, uid: bob.uid }, 'r20', { shared: true }))

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
const me = (name, extra = {}) => ({ name, color: '#2de2e6', view: 'board', ts: serverTimestamp(), ...extra })
await allow('write own presence', () => rtSet(presence(bob, bob.uid), me('Bob')))
await allow('presence with cursor, selection and photo', () =>
  rtSet(presence(bob, bob.uid), me('Bob', { x: 1.5, y: -2, sel: 'abc', photo: 'https://example.com/a.png', since: serverTimestamp() })),
)
await allow('presence with a selection of several (D-124)', () => rtSet(presence(bob, bob.uid), me('Bob', { sel: 'abc', more: 'def ghi' })))
await deny('presence with too long a selection', () => rtSet(presence(bob, bob.uid), me('Bob', { sel: 'abc', more: 'x'.repeat(2049) })))
await deny('write someone else\'s presence', () => rtSet(presence(bob, alice.uid), me('Fake')))
await deny('presence without required fields', () => rtSet(presence(bob, bob.uid), { x: 1 }))
await deny('presence with an unknown field', () => rtSet(presence(bob, bob.uid), me('Bob', { secret: 1 })))
await allow('presence on the reports tab (D-090)', () => rtSet(presence(bob, bob.uid), me('Bob', { view: 'reports' })))
await allow('presence on the overview (D-144)', () => rtSet(presence(bob, bob.uid), me('Bob', { view: 'overview' })))
await allow('presence on the priorities tab (D-138)', () => rtSet(presence(bob, bob.uid), me('Bob', { view: 'priorities' })))
await allow('presence on a plane (D-139)', () => rtSet(presence(bob, bob.uid), me('Bob', { view: 'board', plane: 'p1' })))
await deny('presence with a numeric plane', () => rtSet(presence(bob, bob.uid), me('Bob', { view: 'board', plane: 5 })))
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
// workspace delete takes reports a few to a batch (REPORTS_PER_BATCH in src/data/workspaces.ts). Writing them (import)
// fits in one batch.
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
  const save = (b, id) => b.set(rep(id), summaryOf(alice)).set(doc(rep(id), 'content', 'body'), body)
  const remove = (b, id) => b.delete(doc(rep(id), 'content', 'body')).delete(rep(id))
  await allow('owner writes 25 reports in one batch (import)', () => inBatches(25, save))
  await deny('one batch deletes 25 reports (over the 20 reads a batch may make)', () => inBatches(25, remove))
  await allow('owner deletes 25 reports six to a batch (workspace delete)', () => inBatches(6, remove))
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
