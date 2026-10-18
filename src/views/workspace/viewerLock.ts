// Viewers (D-098) read a workspace but don't change it. While you're one, the app's box is locked like the preview
// (previewLock.ts, viewer mode: the HUD, filters, Settings and reports stay usable), tracked writes are refused with a
// toast (history.ts), and board drags and creating don't start (`editLocked`).
import { useEffect } from 'react'
import { create } from 'zustand'
import { setReadOnly } from '../../data/history'
import { lockApp } from './previewLock'
import { isPreviewing } from './preview'

const VIEWER = "You're a viewer in this workspace: an owner can make you an editor."

export const useViewer = create<{ viewer: boolean }>(() => ({ viewer: false }))

// Nothing on the board may be moved, made or edited: a preview is open, or you only view this workspace.
export const editLocked = () => isPreviewing() || useViewer.getState().viewer

export function useViewerLock(viewer: boolean) {
  useEffect(() => {
    useViewer.setState({ viewer })
    if (!viewer) return
    setReadOnly(VIEWER, 'viewer')
    const app = document.querySelector<HTMLElement>('[data-app]')
    const unlock = app ? lockApp(app, 'viewer') : undefined
    return () => {
      unlock?.()
      setReadOnly(null, 'viewer')
      useViewer.setState({ viewer: false })
    }
  }, [viewer])
}
