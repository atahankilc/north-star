// What a scene mounts of the real app (D-315, onboarding.md §6.2b.1): the whole screen, the app's own WorkspaceScreen
// (the HUD over the real CanvasView, which draws a piece in focus too: `?focus=<id>` in the stage's route), over the
// stage's own store. WorkspaceLayout itself can't be mounted (it loads the workspace from Firestore).
// The side nav is the app's own (SideNav.tsx); a pick in its `+` menu is refused like every write (the scene shows what
// it would have made with set()).
import { useContext, useLayoutEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MAIN, setCanvasHere } from '../data/canvases'
import { useCanvasSwap, WorkspaceScreen } from '../views/workspace/canvas/WorkspaceScreen'
import { useWs, WorkspaceContext } from '../views/workspace/canvas/context'

// The router's navigate, for the director's `ui.focus`.
export function Navigator({ onNavigate }: { onNavigate: (go: (to: string) => void) => void }) {
  const navigate = useNavigate()
  useLayoutEffect(() => onNavigate((to) => navigate(to)), [navigate, onNavigate])
  return null
}

// The canvas asked for (`?canvas=`, D-302) as WorkspaceLayout's useShownCanvas follows it: the old one breaks cell by
// cell, the cameras swap, the store shows the new one and its canvas builds. (Here the store is the stage's own.)
function useShownCanvas(wid: string) {
  const store = useContext(WorkspaceContext)!
  const [params] = useSearchParams()
  const asked = params.get('canvas') ?? MAIN
  // Read through useWs, so the screen draws again when it changes.
  const shown = useWs().canvas
  setCanvasHere(shown)
  useCanvasSwap(wid, asked, shown, (canvas) => {
    store.set({ ...store.get(), canvas })
    store.tell()
  })
  return shown
}

export function CanvasScreen() {
  const { wid } = useWs()
  return <WorkspaceScreen shown={useShownCanvas(wid)} editor />
}
