// Packages (D-141): a piece of the chain made one card. Made from a selection; its home plane holds its members laid out.
import { collection, doc, writeBatch, type DocumentReference } from 'firebase/firestore'
import { db } from './firebase'
import { absent, tracked } from './history'
import { MAX_MEMBERS, type BoardType } from './model'
import { ALL, placementRef, type Placed } from './planes'

const col = (wid: string, name: string) => collection(db(), 'workspaces', wid, name)

// `members`: the cards and where they are on the open plane. On a plane other than All, that plane is its home; on All a
// new plane is made for it, named after it, holding the members where they are. The package itself goes on All at
// `allAt`. One undo step; returns the package's id and its home plane's.
export async function packageThese(
  wid: string,
  openPlane: string,
  name: string,
  members: (Placed & { type: Exclude<BoardType, 'package'> })[],
  allAt: [number, number],
  planeOrder: number,
): Promise<{ id: string; home: string }> {
  const now = Date.now()
  const ref = doc(col(wid, 'packages'))
  const kept = members.slice(0, MAX_MEMBERS)
  const writes: [DocumentReference, object][] = []
  let home = openPlane
  if (openPlane === ALL) {
    const plane = doc(col(wid, 'planes'))
    home = plane.id
    writes.push([plane, { name, order: planeOrder, createdAt: now, updatedAt: now }])
    for (const m of kept) writes.push([placementRef(wid, home, m.id), { planeId: home, itemId: m.id, itemType: m.type, x: m.x, y: m.y }])
  }
  writes.push([ref, { title: name, memberIds: kept.map((m) => m.id), homePlaneId: home, x: allAt[0], y: allAt[1], createdAt: now, updatedAt: now }])
  const refs = writes.map(([r]) => r)
  await tracked(
    'package',
    refs,
    async () => {
      const batch = writeBatch(db())
      for (const [r, d] of writes) batch.set(r, d)
      await batch.commit()
    },
    { before: absent(refs) },
  )
  return { id: ref.id, home }
}
