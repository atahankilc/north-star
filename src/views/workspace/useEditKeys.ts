// Workspace keyboard: ⌘Z / Ctrl+Z undo, ⇧⌘Z / Ctrl+Y redo, Delete or Backspace deletes the selected item (Q-013).
// Text fields keep their own undo and Backspace.
import { useEffect } from 'react'
import { deleteEdge } from '../../data/edges'
import { deleteLabel } from '../../data/labels'
import { redo, undo, useHistory } from '../../data/history'
import type { BoardType } from '../../data/model'
import { deleteNode } from '../../data/nodes'
import { ALL, unplace } from '../../data/planes'
import { deleteMany, type Piece } from '../../data/selection'
import { usePlaneView } from '../../state/plane'
import { useCanvas } from '../../state/canvasStore'
import { BOARD_KINDS } from '../canvas/boardKinds'
import { useWs } from './context'

// Typing, or inside the settings dialog: the board's shortcuts stay out of the way.
const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || Boolean(t.closest('input, textarea, select, dialog')))

export const UNDO_HINT = navigator.platform.toLowerCase().includes('mac') ? '⌘Z' : 'Ctrl+Z'

export function useEditKeys() {
  const ws = useWs()
  const { wid } = ws

  useEffect(() => useHistory.getState().reset(wid), [wid])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()
      if (mod && key === 'z') {
        e.preventDefault()
        void (e.shiftKey ? redo() : undo())
      } else if (mod && key === 'y') {
        e.preventDefault()
        void redo()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !mod) {
        const { selectedId: id, edgeId, selection } = useCanvas.getState()
        if (edgeId) {
          e.preventDefault()
          removeLink(wid, edgeId)
          return
        }
        // On a plane other than All (D-139), Delete takes cards off the plane; they stay everywhere else.
        const plane = usePlaneView.getState().plane
        if (plane !== ALL) {
          const ids = selection.length > 1 ? selection : id ? [id] : []
          const cards = ids.filter((x) => findItem(ws, x))
          if (cards.length) {
            e.preventDefault()
            unplaceCards(ws, plane, cards)
            const labels = ids.filter((x) => ws.labels.some((l) => l.id === x))
            if (labels.length) removeSelection(ws, labels)
            return
          }
        }
        if (selection.length > 1) {
          e.preventDefault()
          removeSelection(ws, selection)
          return
        }
        if (!id) return
        const label = ws.labels.find((l) => l.id === id)
        const found = !label && findItem(ws, id)
        if (!label && !found) return
        e.preventDefault()
        if (label) removeLabel(wid, id, label.text, label.kind === 'section')
        else if (found) removeItem(wid, found.type, id, found.title)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ws, wid])
}

export function findItem(ws: ReturnType<typeof useWs>, id: string): { type: BoardType; title: string } | null {
  const lists: [BoardType, { id: string; title?: string; name?: string }[]][] = [
    ['customer', ws.customers],
    ['problem', ws.problems],
    ['idea', ws.ideas],
    ['competitor', ws.competitors],
    ['feature', ws.features],
  ]
  for (const [type, list] of lists) {
    const n = list.find((x) => x.id === id)
    if (n) return { type, title: n.title ?? n.name ?? '' }
  }
  return null
}

// Deletes an item and says how to get it back.
export function removeItem(wid: string, type: BoardType, id: string, title: string) {
  useCanvas.getState().select(null)
  void deleteNode(wid, type, id)
  const name = title.trim() ? ` "${title.trim()}"` : ''
  useHistory.getState().say(`Deleted ${BOARD_KINDS[type].label}${name} · ${UNDO_HINT} to undo`)
}

// Deletes a text label and says how to get it back.
// A section (D-130) goes alone: what it held stays on the board.
export function removeLabel(wid: string, id: string, text: string, section = false) {
  useCanvas.getState().select(null)
  void deleteLabel(wid, id)
  const quoted = text.trim() ? ` "${text.trim()}"` : ''
  useHistory.getState().say(`Deleted ${section ? 'section' : 'text'}${quoted} · ${UNDO_HINT} to undo`)
}

// Takes cards off a plane (D-139) and says where they still are.
export function unplaceCards(ws: ReturnType<typeof useWs>, planeId: string, ids: string[]) {
  useCanvas.getState().select(null)
  void unplace(ws.wid, planeId, ids)
  const name = ws.planes.find((p) => p.id === planeId)?.name ?? 'this plane'
  const what = ids.length === 1 ? `"${findItem(ws, ids[0])?.title.trim() || 'Untitled'}"` : `${ids.length} cards`
  useHistory.getState().say(`Took ${what} off ${name} (still on All) · ${UNDO_HINT} to undo`)
}

// Removes a link and says how to get it back (D-108).
export function removeLink(wid: string, id: string) {
  useCanvas.getState().selectEdge(null)
  void deleteEdge(wid, id)
  useHistory.getState().say(`Removed link · ${UNDO_HINT} to undo`)
}

// Deletes everything selected (cards with what hangs off them, and text) as one step (D-108).
export function removeSelection(ws: ReturnType<typeof useWs>, ids: string[]) {
  const pieces = ids.flatMap((id): Piece[] => {
    if (ws.labels.some((l) => l.id === id)) return [{ kind: 'label', id }]
    const found = findItem(ws, id)
    return found ? [{ kind: found.type, id }] : []
  })
  if (pieces.length === 0) return
  useCanvas.getState().select(null)
  void deleteMany(ws.wid, pieces)
  useHistory.getState().say(`Deleted ${pieces.length} things · ${UNDO_HINT} to undo`)
}
