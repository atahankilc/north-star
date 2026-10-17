// HashRouter because GitHub Pages has no server-side rewrites (D-001).
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '../data/auth'
import { Backdrop } from '../three/Backdrop'
import { CanvasView } from '../views/canvas/CanvasView'
import { Landing } from '../views/landing/Landing'
import { Workspaces } from '../views/workspaces/Workspaces'

export function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  )
}

function Shell() {
  const { isLoading, user, error } = useAuth()
  const { pathname } = useLocation()
  const onBoard = Boolean(user) && pathname.startsWith('/w/')

  return (
    <>
      {/* The ambient field steps back on the board so cards stay legible. */}
      <Backdrop cards={!user} dim={onBoard} />
      {!isLoading && (
        <Routes>
          {user ? (
            <>
              <Route path="/w" element={<Workspaces user={user} />} />
              <Route path="/w/:wid" element={<CanvasView />} />
              <Route path="*" element={<Navigate to="/w" replace />} />
            </>
          ) : (
            <Route path="*" element={<Landing error={error?.message} />} />
          )}
        </Routes>
      )}
    </>
  )
}
