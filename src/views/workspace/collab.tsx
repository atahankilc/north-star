// Working together on the canvas (D-065, D-067, D-169, D-170; D-191). Presence says which space you're in (`plane`: the
// plane in focus, none = the canvas), where your pointer is in that space's px, and what you have selected. Others in
// the same space see your cursor (smoothed, a little in the past, D-169) and a frame in your colour round what you've
// selected. Following someone is total: you go where they go, into the plane they focus and back out (with the ink),
// their cursor stays in view at your own zoom, gliding back to the middle when it leaves it, and what they select is
// selected for you; your own pan, Escape, or a click on their square stops it (zooming doesn't, D-193).
import { useEffect, useRef, type RefObject } from 'react'
import { cursorAt, hasSelected, onCursorMove, selectionOf, setCursor, setPresencePlane, setPresenceSelection, usePresence, type Peer } from '../../data/presence'
import { camOf, setCam, useCanvasView } from '../../state/canvasView'
import { isReducedMotion } from '../../state/motion'
import { useThemeAccent } from '../../state/theme'
import { CANVAS } from '../../data/labels'
import { firebase } from '../../data/firebase'
import { useWs } from './context'
import styles from './collab.module.css'

// Which space a peer is in: the canvas, or the plane they have in focus.
export const spaceOf = (p: Pick<Peer, 'plane'>) => p.plane ?? CANVAS

// A point in a space's px as it is on screen (px from the canvas's corner): the canvas's camera, or the focused plane's
// own view.
type ToScreen = (x: number, y: number) => [number, number] | null

// What this tab says about itself: its space and what it has selected.
// Several selected on a plane (D-227, D-229): the first is `sel`, the rest go in `more` (D-124), so others see a frame
// round each of them (D-230).
export function usePresenceReport(space: string) {
  const multi = useCanvasView((s) => s.cardMulti)
  const sel = useCanvasView((s) => s.cardSelected ?? s.labelSelected ?? s.selected) ?? multi[0] ?? null
  useEffect(() => setPresencePlane(space === CANVAS ? undefined : space), [space])
  useEffect(() => setPresenceSelection(sel, multi), [sel, multi])
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

  // Their selection becomes yours, several too (D-230).
  const sel = leader?.sel
  const more = leader?.more
  useEffect(() => {
    if (leader === null) return
    if (!sel) return useCanvasView.setState({ cardSelected: null, labelSelected: null, cardMulti: [] })
    const all = selectionOf(leader).filter((id) => cards.some((c) => c.id === id) || labels.some((l) => l.id === id))
    if (all.length > 1) useCanvasView.setState({ cardMulti: all, cardSelected: null, labelSelected: null })
    else if (cards.some((c) => c.id === sel)) useCanvasView.setState({ cardSelected: sel, labelSelected: null, cardMulti: [] })
    else if (labels.some((l) => l.id === sel)) useCanvasView.setState({ labelSelected: sel, cardSelected: null, cardMulti: [] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, more])

  // Their cursor kept in view, at your zoom (D-193): while it's in the middle of your screen nothing moves; once it
  // leaves that middle, the view glides (eased by time, not by frame) until it's centred again, like following in Figma.
  const uid = leader && (leader.plane ?? null) === focusId && (!focusId || arrived) ? leader.uid : null
  const { wid } = useWs()
  useEffect(() => {
    if (!uid) return
    let raf = 0
    let last = performance.now()
    // Gliding back to centre: starts when the cursor leaves the middle, stops once it's there.
    let chasing = true
    const frame = (now: number) => {
      raf = 0
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const c = cursorAt(uid)
      if (!c) return
      const { size, planeCam } = useCanvasView.getState()
      // Where their cursor is on screen, from the middle.
      const cam = focusId ? planeCam : camOf(wid)
      if (!cam) return
      const zoom = cam.zoom
      const sx = focusId && planeCam ? planeCam.ox + c.x * zoom - size.w / 2 : (cam as { x: number }).x + c.x * zoom
      const sy = focusId && planeCam ? planeCam.oy + c.y * zoom - size.h / 2 : (cam as { y: number }).y + c.y * zoom
      if (Math.abs(sx) > size.w * MIDDLE || Math.abs(sy) > size.h * MIDDLE) chasing = true
      if (chasing && Math.hypot(sx, sy) < 2) chasing = false
      if (chasing) {
        // Exponential ease by time: the same feel at any frame rate.
        const k = isReducedMotion() ? 1 : 1 - Math.exp(-dt / EASE_S)
        if (focusId && planeCam) useCanvasView.setState({ planeCam: { ...planeCam, ox: planeCam.ox - sx * k, oy: planeCam.oy - sy * k } })
        else {
          const cc = camOf(wid)
          setCam(wid, { ...cc, x: cc.x - sx * k, y: cc.y - sy * k })
        }
      }
      if (c.moving || chasing) raf = requestAnimationFrame(frame)
    }
    const kick = () => {
      if (raf) return
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }
    kick()
    const off = onCursorMove(kick)
    return () => {
      off()
      cancelAnimationFrame(raf)
    }
  }, [uid, focusId, wid])

  return null
}

// The middle of your screen their cursor may roam in without the view moving: ±22 % of its width and height from the
// centre. And how long the glide back takes to cover most of the way (s).
const MIDDLE = 0.22
const EASE_S = 0.45

// Your own pan stops following (a zoom doesn't, D-193).
export const stopFollowing = () => usePresence.getState().following && usePresence.getState().follow(null)

// Who else, in this space, has `id` selected: a frame in their colour round it, with their name (D-067, D-068).
export function PeerRing({ id, space }: { id: string; space: string }) {
  const peers = usePresence((s) => s.peers)
  const tone = useThemeAccent()
  // Never yourself (presence leaves you out; this makes sure, other tabs of yours included).
  const me = firebase?.auth.currentUser?.uid
  const on = peers.filter((p) => p.uid !== me && spaceOf(p) === space && hasSelected(p, id))
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
