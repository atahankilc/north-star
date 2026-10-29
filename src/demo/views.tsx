// What a scene mounts of the real app (D-315, onboarding.md §6.2b.1): the whole screen as WorkspaceLayout puts it
// together, the HUD (breadcrumb, side nav, the bottom-left corner) over the real CanvasView, which draws a piece in focus
// too (`?focus=<id>` in the stage's route). WorkspaceLayout itself can't be mounted (it loads the workspace from
// Firestore), so its arrangement is repeated here.
// The side nav is the app's own (SideNav.tsx); a pick in its `+` menu is refused like every write (the scene shows what
// it would have made with set()).
import { useLayoutEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Hud } from '../ui/Hud'
import { PeopleHere } from '../ui/PeopleHere'
import { CanvasView } from '../views/workspace/CanvasView'
import { InboxButton } from '../views/workspace/ThreadInbox'
import { SideNav } from '../views/workspace/SideNav'
import { useWs } from '../views/workspace/context'
import { KIND_NAME, kindOfPiece } from '../data/pieces'
import layout from '../views/workspace/WorkspaceLayout.module.css'

// The router's navigate, for the director's `ui.focus`.
export function Navigator({ onNavigate }: { onNavigate: (go: (to: string) => void) => void }) {
  const navigate = useNavigate()
  useLayoutEffect(() => onNavigate((to) => navigate(to)), [navigate, onNavigate])
  return null
}

export function CanvasScreen() {
  const { wid, workspace, pieces, threads } = useWs()
  const [params] = useSearchParams()
  const focused = pieces.find((p) => p.id === params.get('focus'))
  return (
    <div className={layout.app} data-app>
      <Hud
        crumbs={[
          { label: 'workspaces', to: '/workspaces' },
          focused ? { label: workspace.name, to: `/workspaces/${wid}` } : { label: workspace.name },
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
      <CanvasView />
    </div>
  )
}
