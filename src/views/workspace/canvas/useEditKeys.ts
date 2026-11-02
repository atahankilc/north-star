// Workspace keyboard: ⌘Z / Ctrl+Z undo, ⇧⌘Z / Ctrl+Y redo (D-046). Text fields keep their own undo. Deleting what's
// selected belongs to the canvas (CanvasView.tsx); the board's keys are archived (D-177).
import { useEffect } from 'react'
import { redo, undo, useHistory } from '../../../data/history'
import { keysTaken } from '../../../ui/foundation/focus'


export function useEditKeys(wid: string) {
  useEffect(() => useHistory.getState().reset(wid), [wid])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Typing, or a menu or Settings has the keys: the workspace's shortcuts stay out of the way.
      if (keysTaken(e.target)) return
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()
      if (mod && key === 'z') {
        e.preventDefault()
        void (e.shiftKey ? redo() : undo())
      } else if (mod && key === 'y') {
        e.preventDefault()
        void redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
