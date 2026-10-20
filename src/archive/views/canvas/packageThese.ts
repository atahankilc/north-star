// `package these` (D-141): the selected cards become a package. On a plane other than All, that plane is its home and the
// package lands on All's right column; on All, a new plane is made for it with the cards where they are, and the package
// goes just right of them.
import { useHistory } from '../../data/history'
import type { BoardType } from '../../data/model'
import { packageThese } from '../../data/packages'
import { ALL } from '../../data/planes'
import { useCanvas } from '../../state/canvasStore'
import { usePlaneView } from '../../state/plane'
import type { WorkspaceCtx } from '../workspace/context'
import { UNDO_HINT } from '../workspace/useEditKeys'
import type { BoardItem } from './boardKinds'
import { CARD_W, findFreeSpot } from './cardLayout'
import { allSpot, placesOn } from './planes'

export async function packageSelection(ws: WorkspaceCtx, cards: BoardItem[]) {
  const plane = usePlaneView.getState().plane
  const at = placesOn(ws.placements, plane)
  const members = cards.flatMap((c) => {
    if (c.type === 'package') return []
    const p = plane === ALL ? c : at.get(c.id)
    return p ? [{ id: c.id, type: c.type as Exclude<BoardType, 'package'>, x: p.x, y: p.y }] : []
  })
  if (!members.length) return
  // Every card's place on All, to keep the package clear of them there.
  const onAll = [...ws.customers, ...ws.problems, ...ws.ideas, ...ws.features, ...ws.competitors, ...ws.packages].flatMap((d) =>
    d.x !== undefined && d.y !== undefined ? [{ x: d.x, y: d.y }] : [],
  )
  const allAt =
    plane === ALL
      ? findFreeSpot([Math.max(...members.map((m) => m.x)) + CARD_W + 0.6, Math.max(...members.map((m) => m.y))], onAll)
      : allSpot(onAll)
  const order = Math.max(0, ...ws.planes.map((p) => p.order)) + 1
  const name = `Package ${ws.packages.length + 1}`
  const { id } = await packageThese(ws.wid, plane, name, members, allAt, order)
  useCanvas.getState().select(plane === ALL ? id : null)
  useHistory
    .getState()
    .say(`Packaged ${members.length} card${members.length === 1 ? '' : 's'} as "${name}"${plane === ALL ? ', with a plane of its own' : ''} · ${UNDO_HINT} to undo`)
}
