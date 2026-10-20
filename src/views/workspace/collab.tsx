// Working together on the canvas (D-065, D-067, D-169, D-170; D-191). Presence says which space you're in (`plane`: the
// plane in focus, none = the canvas), where your pointer is in that space's px, and what you have selected. Others in
// the same space see your cursor (smoothed, a little in the past, D-169) and a frame in your colour round what you've
// selected. Following someone is total: you go where they go, into the plane they focus and back out (with the ink),
// their cursor stays in the middle of your screen at your own zoom, and what they select is selected for you; your own
// pan or zoom, Escape, or a click on their square stops it.
import { useEffect, useRef, type RefObject } from 'react'
import { cursorAt, hasSelected, onCursorMove, setCursor, setPresencePlane, setPresenceSelection, usePresence, type Peer } from '../../data/presence'
import { camOf, setCam, useCanvasView } from '../../state/canvasView'
import { isReducedMotion } from '../../state/motion'
import { useThemeAccent } from '../../state/theme'
import { CANVAS } from '../../data/labels'
import { useWs } from './context'
import styles from './collab.module.css'

// Which space a peer is in: the canvas, or the plane they have in focus.
export const spaceOf = (p: Pick<Peer, 'plane'>) => p.plane ?? CANVAS

// A point in a space's px as it is on screen (px from the canvas's corner): the canvas's camera, or the focused plane's
// own view.
type ToScreen = (x: number, y: number) => [number, number] | null

// What this tab says about itself: its space and what it has selected.
export function usePresenceReport(space: string) {
  const sel = useCanvasView((s) => s.cardSelected ?? s.labelSelected ?? s.selected)
  useEffect(() => setPresencePlane(space === CANVAS ? undefined : space), [space])
  useEffect(() => setPresenceSelection(sel), [sel])
  useEffect(() => () => setCursor(null), [])
}

// Your pointer, in the space's px; re-sent when the view moves under a still pointer.
export function useCursorReport(root: RefObject<HTMLDivElement | null>, toSpace: (cx: number, cy: number) => [number, number] | null) {
  const last = useRef<[number, number] | null>(null)
  const toSpaceRef = useRef(toSpace)
  toSpaceRef.current = toSpace
  useEffect(() => {
    const el = root.current
    if (!el) return
    const report = () => {
      const at = last.current && toSpaceRef.current(last.current[0], last.current[1])
      setCursor(at ?? null)
    }
    const move = (e: PointerEvent) => {
      last.current = [e.clientX, e.clientY]
      report()
    }
    const leave = () => {
      last.current = null
      setCursor(null)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    const off = useCanvasView.subscribe((s, p) => (s.cams !== p.cams || s.planeCam !== p.planeCam) && report())
    return () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
      off()
    }
  }, [root])
}

// Everyone else's cursor in your space: an arrow in their colour and their name, moved every frame while they glide.
export function PeerCursors({ space, toScreen }: { space: string; toScreen: ToScreen }) {
  const peers = usePresence((s) => s.peers)
  const here = peers.filter((p) => spaceOf(p) === space && p.x !== undefined && p.y !== undefined)
  const tone = useThemeAccent()
  const els = useRef(new Map<string, HTMLDivElement>())
  const toScreenRef = useRef(toScreen)
  toScreenRef.current = toScreen

  useEffect(() => {
    let raf = 0
    const frame = () => {
      raf = 0
      let moving = false
      for (const [uid, el] of els.current) {
        const c = cursorAt(uid, isReducedMotion() ? Infinity : performance.now())
        const at = c && toScreenRef.current(c.x, c.y)
        if (!at) {
          el.style.visibility = 'hidden'
          continue
        }
        el.style.visibility = ''
        el.style.transform = `translate(${at[0]}px, ${at[1]}px)`
        moving ||= !!c?.moving
      }
      if (moving) raf = requestAnimationFrame(frame)
    }
    const kick = () => void (raf ||= requestAnimationFrame(frame))
    kick()
    const offMove = onCursorMove(kick)
    // The view moving moves them on screen too.
    const offView = useCanvasView.subscribe(kick)
    return () => {
      offMove()
      offView()
      cancelAnimationFrame(raf)
    }
  }, [here.length])

  return (
    <div className={styles.cursors} aria-hidden>
      {here.map((p) => (
        <div
          key={p.uid}
          ref={(el) => void (el ? els.current.set(p.uid, el) : els.current.delete(p.uid))}
          className={styles.cursor}
          style={{ ['--peer' as string]: tone(p.color) }}
        >
          <svg className={styles.arrow} viewBox="0 0 16 16">
            <path d="M1 1 L1 13 L4.5 9.5 L7.5 15 L9.5 14 L6.6 8.6 L11.5 8.6 Z" />
          </svg>
          <span className={styles.name}>{p.name}</span>
        </div>
      ))}
    </div>
  )
}

type FollowProps = {
  focusId: string | null
  focusTo: (planeId: string | null) => void
}

// Following someone (D-067, D-170, D-191): their space, their cursor in your middle, their selection.
export function Follow({ focusId, focusTo }: FollowProps) {
  const leader = usePresence((s) => s.peers.find((p) => p.uid === s.following) ?? null)
  const { cards, labels, pieces } = useWs()
  const arrived = useCanvasView((s) => s.focusArrived)
  const leaving = useCanvasView((s) => s.focusLeaving)
  const theirSpace = leader ? (leader.plane ?? null) : undefined

  // Their space: into the plane they focus, or back out to the canvas.
  useEffect(() => {
    if (theirSpace === undefined || leaving) return
    if (theirSpace !== focusId && (theirSpace === null || pieces.some((p) => p.id === theirSpace))) focusTo(theirSpace)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theirSpace, focusId, leaving])

  // Their selection becomes yours (no panel, D-187).
  const sel = leader?.sel
  useEffect(() => {
    if (leader === null) return
    if (!sel) return useCanvasView.setState({ cardSelected: null, labelSelected: null })
    if (cards.some((c) => c.id === sel)) useCanvasView.setState({ cardSelected: sel, labelSelected: null })
    else if (labels.some((l) => l.id === sel)) useCanvasView.setState({ labelSelected: sel, cardSelected: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel])

  // Their cursor in the middle of your screen, at your zoom, eased.
  const uid = leader && (leader.plane ?? null) === focusId && (!focusId || arrived) ? leader.uid : null
  const { wid } = useWs()
  useEffect(() => {
    if (!uid) return
    let raf = 0
    const frame = () => {
      raf = 0
      const c = cursorAt(uid)
      if (!c) return
      const { size, planeCam } = useCanvasView.getState()
      const k = isReducedMotion() ? 1 : 0.12
      let still = true
      if (focusId && planeCam) {
        const ox = size.w / 2 - c.x * planeCam.zoom
        const oy = size.h / 2 - c.y * planeCam.zoom
        const next = { ...planeCam, ox: planeCam.ox + (ox - planeCam.ox) * k, oy: planeCam.oy + (oy - planeCam.oy) * k }
        still = Math.hypot(ox - next.ox, oy - next.oy) < 0.5
        useCanvasView.setState({ planeCam: still ? { ...planeCam, ox, oy } : next })
      } else if (!focusId) {
        const cam = camOf(wid)
        const x = -c.x * cam.zoom
        const y = -c.y * cam.zoom
        const next = { ...cam, x: cam.x + (x - cam.x) * k, y: cam.y + (y - cam.y) * k }
        still = Math.hypot(x - next.x, y - next.y) < 0.5
        setCam(wid, still ? { ...cam, x, y } : next)
      }
      if (c.moving || !still) raf = requestAnimationFrame(frame)
    }
    const kick = () => void (raf ||= requestAnimationFrame(frame))
    kick()
    const off = onCursorMove(kick)
    return () => {
      off()
      cancelAnimationFrame(raf)
    }
  }, [uid, focusId, wid])

  return null
}

// Your own pan or zoom stops following.
export const stopFollowing = () => usePresence.getState().following && usePresence.getState().follow(null)

// Who else, in this space, has `id` selected: a frame in their colour round it, with their name (D-067, D-068).
export function PeerRing({ id, space }: { id: string; space: string }) {
  const peers = usePresence((s) => s.peers)
  const tone = useThemeAccent()
  const on = peers.filter((p) => spaceOf(p) === space && hasSelected(p, id))
  if (!on.length) return null
  return (
    <>
      {on.map((p, i) => (
        <span key={p.uid} className={styles.ring} style={{ ['--peer' as string]: tone(p.color), ['--i' as string]: i }} aria-hidden>
          <span className={styles.ringName}>{p.name}</span>
        </span>
      ))}
    </>
  )
}
