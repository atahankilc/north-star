// Plain paths, no `#` (D-070). GitHub Pages has no rewrites, so the build copies index.html to 404.html and every deep
// link still boots the app.
import { MotionConfig } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '../data/auth'
import { useHoldCurtain } from '../state/curtain'
import { useDisplay } from '../state/display'
import { useMotion } from '../state/motion'
import { Backdrop } from '../three/Backdrop'
import { Curtain } from '../ui/Curtain'
import { BoardView } from '../views/canvas/BoardView'
import { FlowView } from '../views/flow/FlowView'
import { Landing } from '../views/landing/Landing'
import { MatrixView } from '../views/matrix/MatrixView'
import { TableView } from '../views/table/TableView'
import { WorkspaceLayout } from '../views/workspace/WorkspaceLayout'
import { Workspaces } from '../views/workspaces/Workspaces'
import { upgradeLegacyUrl, WORKSPACES } from './paths'

upgradeLegacyUrl()

export function App() {
  const reduced = useMotion((s) => s.reduced)
  return (
    // The in-app motion setting (follow system / full / reduced) drives every motion animation.
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Shell />
      </BrowserRouter>
    </MotionConfig>
  )
}

function Shell() {
  const { isLoading, user, error } = useAuth()
  const { pathname } = useLocation()
  const onBoard = Boolean(user) && pathname.startsWith(`${WORKSPACES}/`)
  // Signing out goes back to the landing at `/`. Opening a link while signed out shows the landing at `/` too, and
  // signing in then continues to that link; a link left over from signing out is not remembered.
  const wasSignedIn = useRef(false)
  useEffect(() => {
    if (!isLoading) wasSignedIn.current = Boolean(user)
  }, [isLoading, user])
  const fontsReady = useFontsReady()
  // Switching the background off applies to signed-in pages only; the landing always flows (D-063). While auth
  // is still loading, assume the choice applies, so a signed-in user who turned it off never sees it flash in.
  const field = useDisplay((s) => s.background) === 'on' || (!isLoading && !user)
  useHoldCurtain('auth', isLoading)
  useHoldCurtain('fonts', !fontsReady)

  return (
    <>
      {/* The ambient field steps back on the board so cards stay legible. */}
      {field && <Backdrop dim={onBoard} />}
      {!isLoading && (
        <Routes>
          {user ? (
            <>
              <Route path={WORKSPACES} element={<Workspaces user={user} />} />
              <Route path={`${WORKSPACES}/:wid`} element={<WorkspaceLayout />}>
                <Route index element={<BoardView />} />
                <Route path="flow" element={<FlowView />} />
                <Route path="table" element={<TableView />} />
                <Route path="matrix" element={<MatrixView />} />
                {/* Old per-type pages (D-036) now live on the board (D-040). */}
                <Route path="*" element={<Navigate to=".." replace />} />
              </Route>
              <Route path="/" element={<AfterSignIn />} />
              <Route path="*" element={<Navigate to={WORKSPACES} replace />} />
            </>
          ) : (
            <>
              <Route path="/" element={<Landing error={error?.message} />} />
              <Route path="*" element={<ToLanding remember={!wasSignedIn.current} />} />
            </>
          )}
        </Routes>
      )}
      <Curtain field={field} />
    </>
  )
}

type Continue = { next?: string }

function ToLanding({ remember }: { remember: boolean }) {
  const { pathname, search } = useLocation()
  const state: Continue | undefined = remember ? { next: pathname + search } : undefined
  return <Navigate to="/" replace state={state} />
}

function AfterSignIn() {
  const next = (useLocation().state as Continue | null)?.next
  return <Navigate to={next ?? WORKSPACES} replace />
}

function useFontsReady() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let alive = true
    void document.fonts.ready.then(() => alive && setReady(true))
    return () => {
      alive = false
    }
  }, [])
  return ready
}
