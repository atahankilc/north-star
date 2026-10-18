// Live cursors on the board (Phase 3, D-065). Your pointer goes out as a world-space point; everyone else's comes back,
// glides to where it was last heard (writes arrive at ~16 Hz). No trail (the user found it ugly, D-067).
// Names are DOM (drei <Html>), so they stay crisp and the same size at any zoom.
import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { MathUtils, Plane, Raycaster, Vector2, Vector3, type Group } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { setCursor, usePresence, type Peer } from '../../data/presence'
import { ALL } from '../../data/planes'
import { usePlaneView } from '../../state/plane'
import { isReducedMotion } from '../../state/motion'
import { useThemeAccent } from '../../state/theme'
import { glideDt } from './cardLayout'
import styles from './PeerCursors.module.css'

const BOARD = new Plane(new Vector3(0, 0, 1), 0)
// Above cards and labels, below nothing that matters: cursors never take clicks.
const Z = 0.2

// Sends this tab's pointer, in board coordinates. Panning or zooming under a still pointer moves it on the board too.
export function CursorReporter() {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const camera = useThree((s) => s.camera)

  useEffect(() => {
    const el = controls?.domElement as HTMLElement | undefined
    if (!controls || !el) return
    const ray = new Raycaster()
    const ndc = new Vector2()
    const hit = new Vector3()
    let last: { x: number; y: number } | null = null
    const report = () => {
      if (!last) return
      const r = el.getBoundingClientRect()
      ndc.set(((last.x - r.left) / r.width) * 2 - 1, -((last.y - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      if (ray.ray.intersectPlane(BOARD, hit)) setCursor([hit.x, hit.y])
    }
    const move = (e: PointerEvent) => {
      last = { x: e.clientX, y: e.clientY }
      report()
    }
    const leave = () => {
      last = null
      setCursor(null)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    controls.addEventListener('change', report)
    return () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
      controls.removeEventListener('change', report)
      setCursor(null)
    }
  }, [controls, camera])

  return null
}

// Following someone (D-067): the camera keeps their cursor in the middle, at your own zoom. Any pan or zoom of
// your own stops it (as do Escape and clicking them again in the HUD).
export function FollowCamera() {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const camera = useThree((s) => s.camera)
  const invalidate = useThree((s) => s.invalidate)
  const following = usePresence((s) => s.following)
  const peer = usePresence((s) => s.peers.find((p) => p.uid === s.following))
  const to = useRef<[number, number] | null>(null)
  const plane = usePlaneView((s) => s.plane)
  // On another plane (D-139), their cursor isn't here: PeopleHere takes you to their plane first.
  to.current = peer && peer.view === 'board' && samePlane(peer, plane) && peer.x !== undefined && peer.y !== undefined ? [peer.x, peer.y] : null
  useEffect(() => invalidate(), [peer?.x, peer?.y, invalidate])

  useEffect(() => {
    if (!controls || !following) return
    const stop = () => usePresence.getState().follow(null)
    controls.addEventListener('start', stop)
    return () => controls.removeEventListener('start', stop)
  }, [controls, following])

  useFrame((_, delta) => {
    const at = to.current
    if (!at || !controls) return
    const reduced = isReducedMotion()
    const dt = glideDt(delta)
    const x = reduced ? at[0] : MathUtils.damp(controls.target.x, at[0], 6, dt)
    const y = reduced ? at[1] : MathUtils.damp(controls.target.y, at[1], 6, dt)
    camera.position.x += x - controls.target.x
    camera.position.y += y - controls.target.y
    controls.target.set(x, y, 0)
    controls.update()
    if (Math.hypot(at[0] - x, at[1] - y) > 0.01) invalidate()
  })

  return null
}

// Someone is on the plane you have open (D-139); no plane = All.
const samePlane = (p: Peer, plane: string) => (p.plane ?? ALL) === plane

export function PeerCursors() {
  const peers = usePresence((s) => s.peers)
  const plane = usePlaneView((s) => s.plane)
  const here = peers.filter((p) => p.view === 'board' && samePlane(p, plane) && p.x !== undefined && p.y !== undefined)
  return (
    <>
      {here.map((p) => (
        <PeerCursor key={p.uid} peer={p} />
      ))}
    </>
  )
}

function PeerCursor({ peer }: { peer: Peer }) {
  const group = useRef<Group>(null)
  const to = useRef<[number, number]>([peer.x!, peer.y!])
  const tone = useThemeAccent()
  to.current = [peer.x!, peer.y!]
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => invalidate(), [peer.x, peer.y, invalidate])

  useFrame((_, delta) => {
    const g = group.current
    if (!g) return
    const [x, y] = to.current
    if (isReducedMotion()) g.position.set(x, y, Z)
    else {
      const dt = glideDt(delta)
      g.position.x = MathUtils.damp(g.position.x, x, 18, dt)
      g.position.y = MathUtils.damp(g.position.y, y, 18, dt)
    }
    if (Math.hypot(g.position.x - x, g.position.y - y) > 1e-3) invalidate()
  })

  return (
    <group ref={group} position={[peer.x!, peer.y!, Z]}>
      <Html className={styles.anchor} zIndexRange={[1, 1]} pointerEvents="none">
        <div className={styles.cursor} style={{ ['--peer' as string]: tone(peer.color) }}>
          <svg className={styles.arrow} viewBox="0 0 16 16" aria-hidden>
            <path d="M1 1 L1 13 L4.5 9.5 L7.5 15 L9.5 14 L6.6 8.6 L11.5 8.6 Z" />
          </svg>
          <span className={styles.name}>{peer.name}</span>
        </div>
      </Html>
    </group>
  )
}
