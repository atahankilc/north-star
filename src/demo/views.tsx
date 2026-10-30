// What a scene mounts of the real app (D-315, onboarding.md §6.2b.1): the whole screen as WorkspaceLayout puts it
// together, the HUD (breadcrumb, side nav, the bottom-left corner) over the real CanvasView, which draws a piece in focus
// too (`?focus=<id>` in the stage's route). WorkspaceLayout itself can't be mounted (it loads the workspace from
// Firestore), so its arrangement is repeated here.
// The side nav is the app's own (SideNav.tsx); a pick in its `+` menu is refused like every write (the scene shows what
// it would have made with set()).
import { useContext, useLayoutEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { canvasPath } from '../app/paths'
import { MAIN, setCanvasHere } from '../data/canvases'
import { swapCam } from '../state/canvasView'
import { isReducedMotion } from '../state/motion'
import { runCells } from '../ui/Appear'
import { CanvasCrumb } from '../views/workspace/CanvasSwitch'
import { Hud } from '../ui/Hud'
import { PeopleHere } from '../ui/PeopleHere'
import { CanvasView } from '../views/workspace/CanvasView'
import { Finder } from '../views/workspace/Finder'
import { InboxButton } from '../views/workspace/ThreadInbox'
import { SideNav } from '../views/workspace/SideNav'
import { useWs, WorkspaceContext } from '../views/workspace/context'
import { KIND_NAME, kindOfPiece } from '../data/pieces'
import layout from '../views/workspace/WorkspaceLayout.module.css'

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
  const swapped = useRef(false)
  const canvasEl = () => document.querySelector<HTMLElement>('[data-app] [role="application"][aria-label="Canvas"]')
  useLayoutEffect(() => {
    if (asked === shown) return
    const swap = () => {
      swapCam(wid, shown, asked)
      swapped.current = true
      store.set({ ...store.get(), canvas: asked })
      store.tell()
    }
    const el = canvasEl()
    if (!el || isReducedMotion()) return swap()
    return runCells(el, 'exit', 0, 200, swap)
  }, [wid, asked, shown, store])
  useLayoutEffect(() => {
    const el = canvasEl()
    if (!swapped.current || !el) return
    swapped.current = false
    return runCells(el, 'enter', 0, 320)
  }, [shown])
  return shown
}

export function CanvasScreen() {
  const { wid, workspace, pieces, threads, canvases } = useWs()
  const [params] = useSearchParams()
  const shown = useShownCanvas(wid)
  const focused = pieces.find((p) => p.id === params.get('focus'))
  // The crumbs as WorkspaceLayout has them: with one canvas the workspace's name opens the canvases (D-302); with more,
  // the canvas's own crumb does.
  const several = canvases.length > 1
  const canvasName = canvases.find((c) => c.id === shown)?.name ?? ''
  return (
    <div className={layout.app} data-app>
      <Hud
        crumbs={[
          { label: 'workspaces', to: '/workspaces' },
          several ? { label: workspace.name, to: canvasPath(wid, MAIN) } : focused ? { label: workspace.name, to: canvasPath(wid, shown) } : { label: <CanvasCrumb label={workspace.name} current /> },
          ...(several ? [focused ? { label: canvasName, to: canvasPath(wid, shown) } : { label: <CanvasCrumb label={canvasName} current /> }] : []),
          ...(focused ? [{ label: focused.name || KIND_NAME[kindOfPiece(focused)] }] : []),
        ]}
        settingsName={workspace.name}
        corner={
          <>
            <PeopleHere />
            <InboxButton wid={wid} threads={threads} />
          </>
        }
        side={<SideNav wid={wid} focused={focused} editor />}
      />
      <CanvasView key={shown} />
      {/* The finder (⌘F, the side nav's compass), as WorkspaceLayout mounts it: nothing drawn until it's opened. */}
      <Finder />
    </div>
  )
}
