// Workspace keyboard: ⌘Z / Ctrl+Z undo, ⇧⌘Z / Ctrl+Y redo, Delete or Backspace deletes the selected item (Q-013).
// Text fields keep their own undo and Backspace.
import { useEffect } from 'react'
import { deleteLabel } from '../../data/labels'
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
        const label = ws.labels.find((l) => l.id === id)
        const found = !label && findItem(ws, id)
        if (!label && !found) return
        e.preventDefault()
        if (label) removeLabel(wid, id, label.text)
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

// Deletes a text label and says how to get it back.
export function removeLabel(wid: string, id: string, text: string) {
  useCanvas.getState().select(null)
  void deleteLabel(wid, id)
  const quoted = text.trim() ? ` "${text.trim()}"` : ''
  useHistory.getState().say(`Deleted text${quoted} · ${UNDO_HINT} to undo`)
}
