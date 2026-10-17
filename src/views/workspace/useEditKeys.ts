// Workspace keyboard: ⌘Z / Ctrl+Z undo, ⇧⌘Z / Ctrl+Y redo, Delete or Backspace deletes the selected item (Q-013).
// Text fields keep their own undo and Backspace.
import { useEffect } from 'react'
import { deleteGroup } from '../../data/groups'
import { redo, undo, useHistory } from '../../data/history'
import type { BoardType } from '../../data/model'
import { deleteNode } from '../../data/nodes'
import { useCanvas } from '../../state/canvasStore'
import { BOARD_KINDS } from '../canvas/boardKinds'
import { useWs } from './context'

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || Boolean(t.closest('input, textarea, select')))

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
        const id = useCanvas.getState().selectedId
        if (!id) return
        const group = ws.groups.find((g) => g.id === id)
        const found = !group && findItem(ws, id)
        if (!group && !found) return
        e.preventDefault()
        if (group) removeGroup(wid, id, group.name)
        else if (found) removeItem(wid, found.type, id, found.title)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ws, wid])
}

function findItem(ws: ReturnType<typeof useWs>, id: string): { type: BoardType; title: string } | null {
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

// Deletes a frame (not its cards) and says how to get it back.
export function removeGroup(wid: string, id: string, name: string) {
  useCanvas.getState().select(null)
  void deleteGroup(wid, id)
  const label = name.trim() ? ` "${name.trim()}"` : ''
  useHistory.getState().say(`Deleted group${label} · ${UNDO_HINT} to undo`)
}
