// Live cursors on the board (Phase 3, D-065). Your pointer goes out as a world-space point; everyone else's comes back,
// glides to where it was last heard (writes arrive at ~16 Hz) and leaves a short trail of cells behind (DESIGN.md §6).
// Names are DOM (drei <Html>), so they stay crisp and the same size at any zoom.
import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { MathUtils, Plane, Raycaster, Vector2, Vector3, type Group, type Mesh, type MeshBasicMaterial } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { setCursor, usePresence, type Peer } from '../../data/presence'
import { isReducedMotion } from '../../state/motion'
import { glideDt } from './cardLayout'
import styles from './PeerCursors.module.css'

const BOARD = new Plane(new Vector3(0, 0, 1), 0)
const TRAIL = 7
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

export function PeerCursors() {
  const peers = usePresence((s) => s.peers)
  const here = peers.filter((p) => p.view === 'board' && p.x !== undefined && p.y !== undefined)
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
  const cells = useRef<(Mesh | null)[]>([])
  const camera = useThree((s) => s.camera)
  const to = useRef<[number, number]>([peer.x!, peer.y!])
  to.current = [peer.x!, peer.y!]
  // Where the cursor has been, newest first: one sample per frame while it moves.
  const trail = useMemo(() => Array.from({ length: TRAIL }, () => new Vector3(peer.x!, peer.y!, Z)), [])
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => invalidate(), [peer.x, peer.y, invalidate])

  useFrame((_, delta) => {
    const g = group.current
    if (!g) return
    const [x, y] = to.current
    const reduced = isReducedMotion()
    if (reduced) g.position.set(x, y, Z)
    else {
      const dt = glideDt(delta)
      g.position.x = MathUtils.damp(g.position.x, x, 18, dt)
      g.position.y = MathUtils.damp(g.position.y, y, 18, dt)
    }
    trail.pop()
    trail.unshift(g.position.clone())

    // Cells stay the same size on screen whatever the zoom.
    const size = camera.position.z * 0.006
    let moving = Math.hypot(g.position.x - x, g.position.y - y) > 1e-3
    cells.current.forEach((m, i) => {
      if (!m) return
      const p = trail[i + 1]
      const gone = p.distanceTo(g.position) < size * 0.5
      m.visible = !reduced && !gone
      m.position.set(p.x, p.y, Z - 0.001)
      m.scale.setScalar(size * (1 - i / TRAIL) * 0.9)
      ;(m.material as MeshBasicMaterial).opacity = 0.6 * (1 - i / TRAIL)
      if (!gone && !reduced) moving = true
    })
    if (moving) invalidate()
  })

  return (
    <>
      <group ref={group} position={[peer.x!, peer.y!, Z]}>
        <Html className={styles.anchor} zIndexRange={[1, 1]} pointerEvents="none">
          <div className={styles.cursor} style={{ ['--peer' as string]: peer.color }}>
            <svg className={styles.arrow} viewBox="0 0 16 16" aria-hidden>
              <path d="M1 1 L1 13 L4.5 9.5 L7.5 15 L9.5 14 L6.6 8.6 L11.5 8.6 Z" />
            </svg>
            <span className={styles.name}>{peer.name}</span>
          </div>
        </Html>
      </group>
      {Array.from({ length: TRAIL - 1 }, (_, i) => (
        <mesh key={i} ref={(m) => void (cells.current[i] = m)} visible={false}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color={peer.color} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </>
  )
}
