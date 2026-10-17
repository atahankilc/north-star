// HashRouter because GitHub Pages has no server-side rewrites (D-001).
import { MotionConfig } from 'motion/react'
import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '../data/auth'
import { useHoldCurtain } from '../state/curtain'
import { useMotion } from '../state/motion'
import { Backdrop } from '../three/Backdrop'
import { Curtain } from '../ui/Curtain'
import { CanvasView } from '../views/canvas/CanvasView'
import { Landing } from '../views/landing/Landing'
import { Workspaces } from '../views/workspaces/Workspaces'

export function App() {
  const reduced = useMotion((s) => s.reduced)
  return (
    // The in-app motion setting (follow system / full / reduced) drives every motion animation.
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      <HashRouter>
        <Shell />
      </HashRouter>
    </MotionConfig>
  )
}

function Shell() {
  const { isLoading, user, error } = useAuth()
  const { pathname } = useLocation()
  const onBoard = Boolean(user) && pathname.startsWith('/w/')
  const fontsReady = useFontsReady()
  useHoldCurtain('auth', isLoading)
  useHoldCurtain('fonts', !fontsReady)

  return (
    <>
      {/* The ambient field steps back on the board so cards stay legible. */}
      <Backdrop dim={onBoard} />
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
      <Curtain />
    </>
  )
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
