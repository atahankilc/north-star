// The workspace's screen as it's arranged (D-397): the HUD (breadcrumb, side nav, the bottom-left corner) over the
// canvas shown, and the finder. Pure: it reads the workspace it's given (`useWs()`), so the app (WorkspaceLayout, which
// loads it), a lesson's demo (demo/views.tsx) and the gallery mount this one and a change to the HUD reaches all three;
// the demo had a copy written by hand.
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { canvasPath, WORKSPACES } from '../../../app/paths'
import { MAIN } from '../../../data/canvases'
import { KIND_NAME, kindOfPiece } from '../../../data/pieces'
import { swapCam } from '../../../state/canvasView'
import { isReducedMotion } from '../../../state/motion'
import { DUR } from '../../../ui/foundation/motion'
import { Hud } from '../../../ui/patterns/Hud'
import { PeopleHere } from './PeopleHere'
import type { WorkspacePage } from '../../../ui/patterns/Settings'
import { runCells } from '../../../ui/primitives/Appear'
import { Finder } from '../find/Finder'
import { ThreadsTool } from '../threads/ThreadsTool'
import { TasksTool } from '../deck/TasksTool'
import { DocsTool } from '../documents/DocsTool'
import { CanvasBehind, Places } from '../places/Places'
import { closePlace, PLACE_NAME, usePlace } from '../places/placeStore'
import { Button } from '../../../ui/primitives/Button'
import { CanvasCrumb } from './CanvasSwitch'
import { CanvasView } from './CanvasView'
import { useWs } from './context'
import { SideNav } from './SideNav'
import styles from './WorkspaceLayout.module.css'

type Props = {
  // The canvas shown (D-302).
  shown: string
  // The workspace still loading: the HUD alone, its name not yet a prompt.
  loading?: boolean
  editor: boolean
  // A canvas's name when the workspace doesn't hold it yet (one the agent's preview adds).
  canvasName?: string
  settings?: (page: WorkspacePage) => ReactNode
  settingsBadge?: number
  // What else lies on the screen (the app's: a document's window, the toast, the coach).
  children?: ReactNode
}

export function WorkspaceScreen({ shown, loading = false, editor, canvasName, settings, settingsBadge, children }: Props) {
  const { wid, workspace, pieces, threads, canvases, documents } = useWs()
  const [params] = useSearchParams()
  // A plane in focus (D-184) is the view: its name ends the breadcrumb, and the canvas's `+` goes away.
  const focusId = params.get('focus')
  const focused = focusId ? pieces.find((p) => p.id === focusId) : undefined
  // With one canvas the workspace's name opens the canvases (D-302); with more, the canvas's own crumb does.
  const several = canvases.length > 1
  const name = canvases.find((c) => c.id === shown)?.name ?? canvasName ?? ''
  const placePage = usePlace((s) => (s.page ? s.open : null))
  return (
    <div className={styles.app} data-app>
      <Hud
        crumbs={
          // A place as the page (D-418): the workspace's name goes back to the canvas, the place's name ends it; the
          // canvases' switch is the canvas's own, not shown on a page.
          placePage
            ? [
                { label: 'workspaces', to: WORKSPACES },
                { label: <Button link onClick={closePlace} title="back to the canvas">{workspace.name}</Button> },
                { label: PLACE_NAME[placePage] },
              ]
            : [
          { label: 'workspaces', to: WORKSPACES },
          several
            ? { label: workspace.name, to: canvasPath(wid, MAIN) }
            : focused
              ? { label: workspace.name, to: canvasPath(wid, shown) }
              : { label: loading ? workspace.name : <CanvasCrumb label={workspace.name} current /> },
          ...(several ? [focused ? { label: name, to: canvasPath(wid, shown) } : { label: <CanvasCrumb label={name} current /> }] : []),
          // A document on its own goes by its document's title (D-232).
          ...(focused ? [{ label: focused.name || documents?.find((d) => d.id === focused.docId)?.title || KIND_NAME[kindOfPiece(focused)] }] : []),
        ]}
        settings={settings}
        settingsName={workspace.name}
        settingsBadge={settingsBadge}
        // Who's here, then the places over your square and the gear (D-412): Talk, Tasks, Docs.
        corner={<PeopleHere />}
        tools={
          <>
            <ThreadsTool wid={wid} threads={threads} />
            <TasksTool />
            <DocsTool />
          </>
        }
        side={<SideNav wid={wid} focused={focused} editor={editor} />}
      />
      {/* One per canvas (D-302): going to another builds it anew, its camera its own. */}
      <CanvasBehind>{!loading && <CanvasView key={shown} />}</CanvasBehind>
      {/* Talk, Tasks and Docs beside the canvas, or one as the page in its place (D-412). */}
      {!loading && <Places editor={editor} />}
      {/* The finder (⌘F, the side nav's compass): nothing drawn until it's opened. */}
      {!loading && <Finder />}
      {children}
    </div>
  )
}

// The canvas shown as it follows the one asked for (D-302): the old one breaks cell by cell, then the cameras swap
// (each canvas keeps its own), `show` makes the new one the one shown, and it builds. Reduced motion, at once. `once`:
// only after a canvas has been on screen (one found as the workspace loads, a focused plane's, isn't animated).
export function useCanvasSwap(wid: string, asked: string, shown: string, show: (canvas: string) => void, once = false) {
  const built = useRef(!once)
  const swapped = useRef(false)
  const latest = useRef(show)
  latest.current = show
  const canvasEl = () => document.querySelector<HTMLElement>('[data-app] [role="application"][aria-label="Canvas"]')
  useLayoutEffect(() => {
    if (asked === shown) return
    const swap = () => {
      swapCam(wid, shown, asked)
      swapped.current = true
      latest.current(asked)
    }
    const el = canvasEl()
    if (!built.current || !el || isReducedMotion()) return swap()
    return runCells(el, 'exit', 0, DUR.exit, swap)
  }, [wid, asked, shown])
  useEffect(() => void (built.current ||= !!canvasEl()))
  useLayoutEffect(() => {
    const el = canvasEl()
    if (!swapped.current || !el) return
    swapped.current = false
    return runCells(el, 'enter', 0, 320)
  }, [shown])
}
