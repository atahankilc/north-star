// The marks of anything selectable (D-265): four L's round it, the same for everything. Their size is screen px in three
// tiers: S for cells, rows, heads and chips, M for cards and text, L for pieces and sections, a tier down when the thing
// is small on screen (`tierFor`); where they are says the state: grey a little out
// on hover, on the corners and longer while pressed, just outside once selected; their colour is what the thing is
// (`tone`), cyan when it has none or for what you can do to it (a link's target). Hover glides them in, a press snaps
// them on, a release springs them out; something selected without a press (a box, a key, a peer, a follow) springs out
// from the corners too. While it's dragged they're on `<Landing>`, where it will land; let go, it grows into them and
// they spring out. Others who have it selected get the same L's in their colour, their name on a tag. Reduced motion:
// states switch at once.
// Resizing (D-265): handles on the ring, in cyan, where the caller says (only while it's selected, or a piece in edit
// mode): a corner's is that corner's L, an edge's a bar at its middle; hovered they grow like a pressed L. While one is
// dragged (`resizing`) the edges it moves light cyan along their whole length, and `readout` says the size beside them.
// Drawn inside a space scaled by `zoom` (screen px per space px), so the sizes are divided back by it (`--zs`); without
// `zoom` it's the `--zs` its space sets (`zsOf`), so a memoised cell needn't draw again as the view zooms.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { flushSync } from 'react-dom'
import { useMotion } from '../state/motion'
import styles from './Marks.module.css'

export type Tier = 's' | 'm' | 'l'
export type Handle = 'n' | 'e' | 's' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
export const EVERY_HANDLE: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
export type PeerMark = { uid: string; name: string; color: string }

// A kind's tier, a step down while its short side on screen is too small for it: L under 120 px, M under 24 px.
export function tierFor(tier: Tier, screenPx: number): Tier {
  if (tier === 'l' && screenPx < 120) tier = 'm'
  if (tier === 'm' && screenPx < 24) tier = 's'
  return tier
}

// How long a dropped thing takes to grow back into its marks before they spring out.
const SETTLE_MS = 180

// What a space sets for the marks inside it, when they don't each get its zoom.
export const zsOf = (zoom: number) => ({ '--zs': 1 / zoom }) as CSSProperties
// The same for a space that may sit on the canvas: there its view's zoom times the canvas's, read in CSS from the piece's
// `--z`, so the camera moving never draws the space again (read in React, every kanban, table and matrix redrew on each
// wheel step, and zooming crawled).
export const zsIn = (viewZoom: number, onCanvas: boolean) =>
  (onCanvas ? { '--zs': `calc(1 / (var(--z, 1) * ${viewZoom}))` } : zsOf(viewZoom)) as CSSProperties

// What's at screen size follows a zoom as shown: the camera's, once it stops changing for ZOOM_SETTLE_MS (D-278). Until
// then it's scaled with the rest, so a wheel step moves only a transform, not every mark's `--zs`. A press takes the
// zoom at once, so a drag right after reads the zoom it's under.
export const ZOOM_SETTLE_MS = 120
// A space's own view's zoom as shown, while `settling` (in a focus); otherwise the zoom itself.
export function useSettledZoom(zoom: number, settling: boolean) {
  const [shown, setShown] = useState(zoom)
  const want = useRef(zoom)
  want.current = zoom
  if (!settling && shown !== zoom) setShown(zoom)
  useEffect(() => {
    if (!settling || zoom === shown) return
    const now = () => flushSync(() => setShown(want.current))
    const t = window.setTimeout(() => setShown(want.current), ZOOM_SETTLE_MS)
    window.addEventListener('pointerdown', now, true)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('pointerdown', now, true)
    }
  }, [zoom, shown, settling])
  return settling ? shown : zoom
}

type Props = {
  zoom?: number
  // Its kind's tier, and its short side in its space's px (a tier down when small on screen).
  tier?: Tier
  short?: number
  tone?: string
  // Space px between the thing's box and where the marks go round it (text keeps clear of its glyphs).
  pad?: number
  // The pointer over the box shows the hover marks; `hover` says it instead when the box isn't what's hovered.
  live?: boolean
  hover?: boolean
  selected?: boolean
  pressed?: boolean
  dragging?: boolean
  target?: boolean
  peers?: PeerMark[]
  handles?: Handle[]
  onHandle?: (h: Handle, e: ReactPointerEvent<HTMLElement>) => void
  resizing?: Handle | null
  readout?: string
}

type State = 'none' | 'hover' | 'sel' | 'press' | 'arrive' | 'drag' | 'target'

export function Marks({ zoom, tier = 'm', short = Infinity, tone, pad = 0, live = true, hover, selected = false, pressed = false, dragging = false, target = false, peers, handles, onHandle, resizing, readout }: Props) {
  const reduced = useMotion((s) => s.reduced)
  // Selected without a press: a frame on the corners first, then the spring out (`arrive`). Let go after a drag: on the
  // corners while it grows back (`settle`), then the spring.
  const [phase, setPhase] = useState<'arrive' | 'settle' | null>(null)
  const was = useRef({ selected, pressed, dragging })
  const timer = useRef(0)
  useLayoutEffect(() => {
    const before = was.current
    was.current = { selected, pressed, dragging }
    window.clearTimeout(timer.current)
    if (!reduced && before.dragging && !dragging) {
      setPhase('settle')
      timer.current = window.setTimeout(() => setPhase(null), SETTLE_MS)
    } else if (!reduced && selected && !before.selected && !pressed && !before.pressed && !dragging) {
      setPhase('arrive')
      // Two frames: the corners drawn once, then the spring from there.
      timer.current = window.setTimeout(() => requestAnimationFrame(() => setPhase(null)), 16)
    } else setPhase(null)
  }, [selected, pressed, dragging, reduced])
  useLayoutEffect(() => () => window.clearTimeout(timer.current), [])

  const state: State = dragging
    ? 'drag'
    : pressed || phase === 'settle'
      ? 'press'
      : phase === 'arrive'
        ? 'arrive'
        : target
          ? 'target'
          : selected
            ? 'sel'
            : hover
              ? 'hover'
              : 'none'
  const style = {
    ...(zoom && { '--zs': 1 / zoom }),
    '--pad': `${pad}px`,
    ...(tone && { '--tone': tone }),
  } as CSSProperties
  const t = tierFor(tier, short * (zoom ?? 1))
  return (
    <>
      <span
        className={styles.marks}
        // Hidden while zooming (D-293) only when drawn: on every card it would restyle hundreds of spans at a zoom's start.
        data-screen-sized={state !== 'none' || (live && hover === undefined) || undefined}
        style={style}
        data-tier={t}
        data-state={state}
        data-live={(live && hover === undefined) || undefined}
        data-reduced={reduced || undefined}
        aria-hidden
      >
        <Ls />
      </span>
      {!!handles?.length && !dragging && (
        <span className={styles.handles} data-screen-sized style={style} data-tier={t} data-reduced={reduced || undefined}>
          {handles.map((h) => (
            <span key={h} className={styles.handle} data-h={h} data-k={h.length === 2 ? 'c' : 'b'} data-on={resizing === h || undefined} onPointerDown={(e) => onHandle?.(h, e)} aria-hidden />
          ))}
          {resizing && [...resizing].map((e) => <span key={e} className={styles.edge} data-e={e} aria-hidden />)}
          {resizing && readout && (
            <span className={styles.readout} data-at={/[ns]/.test(resizing) ? 'below' : 'right'}>
              {readout}
            </span>
          )}
        </span>
      )}
      {peers?.map((p, i) => (
        <span key={p.uid} className={styles.marks} data-screen-sized style={{ ...style, '--peer': p.color, '--i': i } as CSSProperties} data-tier={t} data-state="peer" data-reduced={reduced || undefined} aria-hidden>
          <Ls />
          <span className={styles.tag}>{p.name}</span>
        </span>
      ))}
    </>
  )
}

// Where something being dragged will land (D-265): its L's at full size there, on the corners, stepping grid to grid.
export function Landing({ x, y, w, h, zoom, tier = 'm', tone, pad = 0 }: { x: number; y: number; w: number; h: number; zoom: number; tier?: Tier; tone?: string; pad?: number }) {
  const reduced = useMotion((s) => s.reduced)
  const style = { left: x, top: y, width: w, height: h, '--zs': 1 / zoom, '--pad': `${pad}px`, ...(tone && { '--tone': tone }) } as CSSProperties
  return (
    <span className={styles.landing} data-screen-sized style={style} data-reduced={reduced || undefined} aria-hidden>
      <span className={styles.marks} data-tier={tierFor(tier, Math.min(w, h) * zoom)} data-state="press" data-reduced={reduced || undefined}>
        <Ls />
      </span>
    </span>
  )
}

// Alt+drag's box (D-227, D-265): a cyan wash, cyan L's on its corners.
export function BoxSelect({ x, y, w, h, zoom }: { x: number; y: number; w: number; h: number; zoom: number }) {
  return (
    <span className={styles.box} data-screen-sized style={{ left: x, top: y, width: w, height: h, '--zs': 1 / zoom } as CSSProperties} aria-hidden>
      <span className={styles.marks} data-state="box">
        <Ls />
      </span>
    </span>
  )
}

function Ls() {
  return (
    <>
      <i data-c="nw" />
      <i data-c="ne" />
      <i data-c="se" />
      <i data-c="sw" />
    </>
  )
}
