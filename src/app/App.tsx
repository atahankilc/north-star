// HashRouter because GitHub Pages has no server-side rewrites (D-001).
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../data/auth'
import { Backdrop } from '../three/Backdrop'
import { Landing } from '../views/landing/Landing'
import { Workspaces } from '../views/workspaces/Workspaces'

export function App() {
  const { isLoading, user, error } = useAuth()

  return (
    <>
      <Backdrop cards={!user} />
      {!isLoading && (
        <HashRouter>
          <Routes>
            {user ? (
              <>
                <Route path="/w" element={<Workspaces email={user.email} />} />
                <Route path="*" element={<Navigate to="/w" replace />} />
              </>
            ) : (
              <Route path="*" element={<Landing error={error?.message} />} />
            )}
          </Routes>
        </HashRouter>
      )}
    </>
  )
}
