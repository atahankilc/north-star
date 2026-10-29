// The preview's marks (S15, D-312; docs/specs/agent.md §4.5 point 4): ONE layer over the app that finds the element
// drawing each changed thing and marks it, in one shared look for every kind (DESIGN.md tokens; the L's of Marks,
// D-265): added = it builds cell by cell (runCells, D-034) + a cyan `+`; changed = lit (yellow), `was → now` on hover;
// removed = faint and struck, a magenta `−`, the agent's reason on hover; moved = a faint dashed ghost where it was and a
// line to where it goes. The item the stepper is on is lit stronger.
//
// The components draw the previewed workspace themselves (the store's overlay, preview.ts); this layer only marks it.
// It finds elements by the attributes the views already carry (preview.ts' targets: data-target, data-task, data-cell,
// data-find, the canvas prompt's data-key), so no component has preview code. Links are drawn here, between their two
// cards' boxes and cut at their edges (so never over a card's title), also when the plane hides their kind (D-128).
//
// CHIPS never cover readable text: a card's, text's or piece's chip sits outside its top edge at the right end, flipped
// below it when text is there (a heading, the card above), else (no room round it) one glyph on its top-right corner,
// half in the gap; never on another chip; a
// link's stroke is masked where it crosses a card; a small thing (a row, a cell, a task, a bar, a prompt row) gets one glyph inside its own
// top-right corner instead (its words on hover); many rows of one table share one chip on the table. One element marked
// by two changes (a card placed here, which also counts its planes) gets one chip.
//
// COST: the elements are found again, with the visibility check (one of five points must hit it: not under the HUD, a
// panel or a menu), every 300 ms; between, their boxes are measured each frame only while something moves (the world's
// transform, a zoom, a focus's ink, a glide: a MutationObserver on the app's style attributes, a resize, a scroll), and
// for 400 ms after. Nothing is written on the world or what holds the contents (D-279); the only writes on content
// elements are a `data-preview` attribute once per element (faint for removed, CSS below) and the one cell-by-cell build
// of an added one. Clipped to the app's box ([data-app]), so a mark never lies over the agent's column. Reduced motion: no
// build, no transitions.
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { isReducedMotion } from '../../state/motion'
import { runCells } from '../../ui/Appear'
import { previewState, setBeforeOpen, subscribePreview, type PreviewState, type Target } from '../preview'
import styles from './PreviewMarks.module.css'

export function usePreview(): PreviewState | null {
  return useSyncExternalStore(subscribePreview, previewState, () => null)
}

type Rect = { x: number; y: number; w: number; h: number }
type Drawn = { key: string; t: Target; r: Rect; ghost?: Rect; line?: [number, number, number, number]; away?: boolean; was: string[]; tag: string }
type Chip = { key: string; d: Drawn; x: number; y: number; text: string; inside: boolean }

// Where an element was drawn when the preview opened, relative to the transformed world holding it (so it follows the
// camera): for tasks moved to another column, bars to other days.
type Snap = { container: Element; piece: string | null; rel: Rect }
const snaps = new Map<string, Snap[]>()

const pieceOfEl = (el: Element): string | null => el.closest('[data-target^="plane:"]')?.getAttribute('data-target')?.slice(6) ?? null
// The nearest ancestor that moves with the view (a world's inline transform), else the page.
const worldOf = (el: Element): Element => el.parentElement?.closest('[style*="transform"]') ?? document.documentElement
const rectOf = (el: Element): Rect => {
  const b = el.getBoundingClientRect()
  return { x: b.left, y: b.top, w: b.width, h: b.height }
}

// An element is inside a piece when the nearest piece holding it is that one, or (in a focus, beside) when no piece
// holds it and that piece is the one in focus or beside it.
function inPiece(el: Element, piece: string): boolean {
  const p = pieceOfEl(el)
  if (p) return p === piece
  const q = new URLSearchParams(location.search)
  return q.get('focus') === piece || (q.get('beside') ?? '').split(',').includes(piece)
}

// One of five points of it hits it (the middle and four points in from the corners).
function seen(el: Element, r: Rect): boolean {
  if (r.w < 2 || r.h < 2) return false
  const pts: [number, number][] = [
    [r.x + r.w / 2, r.y + r.h / 2],
    [r.x + r.w * 0.2, r.y + r.h * 0.2],
    [r.x + r.w * 0.8, r.y + r.h * 0.2],
    [r.x + r.w * 0.2, r.y + r.h * 0.8],
    [r.x + r.w * 0.8, r.y + r.h * 0.8],
  ]
  for (const [x, y] of pts) {
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue
    const hit = document.elementFromPoint(x, y)
    if (hit && (hit === el || el.contains(hit) || hit.contains(el))) return true
  }
  return false
}

function elementsOf(t: Target): Element[] {
  if (!t.sel) return []
  const out: Element[] = []
  for (const e of document.querySelectorAll(t.sel)) {
    if (e.closest('[data-agent]')) continue
    const el = t.up ? (e.closest(t.up) ?? e) : e
    if (t.within && !inPiece(el, t.within)) continue
    if (!out.includes(el)) out.push(el)
  }
  return out
}

// A card drawn and really seen (for a link's ends): the last one that passes the visibility check.
function cardEl(id: string): Element | null {
  const all = [...document.querySelectorAll(`[data-target="card:${id}"]`)].filter((e) => !e.closest('[data-agent]'))
  for (let i = all.length - 1; i >= 0; i--) if (seen(all[i], rectOf(all[i]))) return all[i]
  return null
}

// The segment between two boxes' middles, cut where it leaves each box (4 px clear); null when they overlap.
function cut(a: Rect, b: Rect): [number, number, number, number] | null {
  const ax = a.x + a.w / 2
  const ay = a.y + a.h / 2
  const bx = b.x + b.w / 2
  const by = b.y + b.h / 2
  const dx = bx - ax
  const dy = by - ay
  const t = (r: Rect) => Math.min(dx ? (r.w / 2 + 4) / Math.abs(dx) : Infinity, dy ? (r.h / 2 + 4) / Math.abs(dy) : Infinity)
  const t1 = t(a)
  const t2 = t(b)
  if (t1 + t2 >= 1) return null
  return [ax + dx * t1, ay + dy * t1, bx - dx * t2, by - dy * t2]
}

// Taken just before the store is overlaid: where each thing with a snap ghost is drawn now.
function takeSnaps(targets: Target[]) {
  snaps.clear()
  for (const t of targets) {
    if (!t.snap) continue
    const list: Snap[] = []
    for (const el of elementsOf(t)) {
      const r = rectOf(el)
      if (r.w < 2) continue
      const container = worldOf(el)
      const c = rectOf(container)
      if (!c.w || !c.h) continue
      list.push({ container, piece: pieceOfEl(el), rel: { x: (r.x - c.x) / c.w, y: (r.y - c.y) / c.h, w: r.w / c.w, h: r.h / c.h } })
    }
    if (list.length) snaps.set(t.id, list)
  }
}

const near = (p?: Rect, q?: Rect) => (!p && !q) || (!!p && !!q && Math.abs(p.x - q.x) < 0.5 && Math.abs(p.y - q.y) < 0.5 && Math.abs(p.w - q.w) < 0.5 && Math.abs(p.h - q.h) < 0.5)
const same = (a: Drawn[], b: Drawn[]) =>
  a.length === b.length && a.every((x, i) => x.key === b[i].key && x.t === b[i].t && near(x.r, b[i].r) && near(x.ghost, b[i].ghost) && (x.line?.map(Math.round).join() ?? '') === (b[i].line?.map(Math.round).join() ?? ''))

// The chips placed: a small thing's glyph inside its top-right corner; the rest outside the top edge at the right end,
// moved up a row while it would meet one already placed.
const CHIP_H = 17
const chipW = (text: string) => text.length * 6.6 + 14
const hits = (r: Rect, list: Rect[]) => list.some((p) => r.x < p.x + p.w && r.x + r.w > p.x && r.y < p.y + p.h && r.y + r.h > p.y)
// `cards`: the boxes of the cards on screen, kept clear by a link's chip (it goes in a gap along its line).
function placeChips(drawn: Drawn[], cards: Rect[]): Chip[] {
  const out: Chip[] = []
  const placed: Rect[] = []
  const meets = (r: Rect) => hits(r, placed)
  for (const d of drawn) {
    if (d.t.quiet) continue
    if (d.line) {
      const text = d.tag
      const w = chipW(text)
      const [x1, y1, x2, y2] = d.line
      const at = (t: number) => ({ x: x1 + (x2 - x1) * t - w / 2, y: y1 + (y2 - y1) * t - CHIP_H / 2, w, h: CHIP_H })
      // The middle, else the point nearest it whose chip covers no card (and no chip).
      // Along the line first, then a step up or down off it (into the gap between rows of cards).
      const tries = [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8]
      const offs = [0, -1, 1, -2, 2, -3, 3].map((k) => k * (CHIP_H + 4))
      const r = offs.flatMap((dy) => tries.map((t) => ({ ...at(t), y: at(t).y + dy }))).find((x) => !hits(x, cards) && !meets(x)) ?? at(0.5)
      while (meets(r)) r.y -= CHIP_H + 2
      placed.push(r)
      out.push({ key: d.key, d, x: r.x, y: r.y, text, inside: false })
      continue
    }
    // A group's first row: the group's words inside its own box, at its right end.
    if (d.t.groupTag) {
      const w = chipW(d.t.groupTag)
      out.push({ key: d.key, d, x: d.r.x + d.r.w - w - 2, y: d.r.y + (d.r.h - CHIP_H) / 2, text: d.t.groupTag, inside: false })
      continue
    }
    if (d.t.tier === 's') {
      const r = { x: d.r.x + d.r.w - 13, y: d.r.y + 1, w: 12, h: 12 }
      out.push({ key: d.key, d, x: r.x, y: r.y, text: d.away ? '↦' : d.tag.slice(0, 1), inside: true })
      continue
    }
    // Above its top edge at the right end; flipped below when text is there (a heading, the card above); else inside
    // its own top edge. Never on another thing's text, never on another chip.
    const text = d.tag
    const w = chipW(text)
    const x = d.r.x + d.r.w - w
    const others = cards.filter((b) => !(Math.abs(b.x - d.r.x) < 1 && Math.abs(b.y - d.r.y) < 1))
    const tries = [
      { x, y: d.r.y - CHIP_H - 6, w, h: CHIP_H },
      { x, y: d.r.y + d.r.h + 6, w, h: CHIP_H },
    ]
    const r = tries.find((t) => !hits(t, others) && !meets(t))
    if (r) {
      placed.push(r)
      out.push({ key: d.key, d, x: r.x, y: r.y, text, inside: false })
    } else {
      // No room round it (a dense plane): its glyph on its top-right corner, half in the gap, half in the card's padding,
      // clear of its title; words on hover.
      out.push({ key: d.key, d, x: d.r.x + d.r.w - 7, y: d.r.y - 7, text: d.away ? '↦' : text.slice(0, 1), inside: true })
    }
  }
  return out
}

export function PreviewMarks() {
  const st = usePreview()
  const [drawn, setDrawn] = useState<Drawn[]>([])
  const [app, setApp] = useState<Rect | null>(null)
  const [hover, setHover] = useState<{ d: Drawn; x: number; y: number } | null>(null)
  // What chips keep clear of (cards' and text's boxes), and the cards' alone (a link's stroke is masked where it crosses one).
  const [boxes, setBoxes] = useState<{ all: Rect[]; cards: Rect[] }>({ all: [], cards: [] })
  const last = useRef<Drawn[]>([])

  // The snapshot before the overlay goes on (preview.ts calls it from openPreview).
  useLayoutEffect(() => {
    setBeforeOpen(takeSnaps)
    return () => setBeforeOpen(null)
  }, [])

  useEffect(() => {
    if (!st) {
      setDrawn([])
      last.current = []
      return
    }
    // Within targets first: an element two changes mark gets one chip, the other's words joined to it.
    const targets = [...st.targets].sort((a, b) => Number(!!b.within) - Number(!!a.within))
    let found: { t: Target; els: Element[]; was: string[] }[] = []
    let ends = new Map<string, [Element, Element]>()
    const firstSeen = new Map<Element, number>()
    const marked = new Set<Element>()
    let raf = 0
    let until = 0

    // Every 300 ms: the elements, what's really seen, the cell build of new ones, the faint removed ones.
    const resolve = () => {
      const now = performance.now()
      const claimed = new Map<Element, { t: Target; was: string[] }>()
      const next: typeof found = []
      for (const t of targets) {
        if (t.line) continue
        const els = elementsOf(t).filter((el) => {
          const r = rectOf(el)
          const fresh = now - (firstSeen.get(el) ?? now) < 500 && r.w > 1
          return fresh || seen(el, r)
        })
        const mine: Element[] = []
        for (const el of els) {
          const had = claimed.get(el)
          if (had) {
            had.was.push(...t.was.filter((w) => !had.was.includes(w)))
            continue
          }
          const entry = { t, was: [...t.was] }
          claimed.set(el, entry)
          mine.push(el)
          if (!firstSeen.has(el)) {
            firstSeen.set(el, now)
            if (t.change === 'added' && !isReducedMotion() && el instanceof HTMLElement && !el.style.clipPath) runCells(el, 'enter', 0, 320)
          }
          if ((t.change === 'removed' || t.change === 'added') && el.getAttribute('data-preview') !== t.change) {
            el.setAttribute('data-preview', t.change)
            marked.add(el)
          }
        }
        next.push({ t, els: mine, was: mine.length ? claimed.get(mine[0])!.was : t.was })
      }
      // Links: between their cards' boxes when both are seen; else the plane's own hit line.
      ends = new Map()
      for (const t of targets) {
        if (!t.line) continue
        const a = t.ends && cardEl(t.ends[0])
        const b = t.ends && cardEl(t.ends[1])
        if (a && b) {
          ends.set(t.key, [a, b])
          next.push({ t, els: [], was: t.was })
        } else next.push({ t, els: elementsOf(t).filter((e) => e instanceof SVGLineElement).slice(-1), was: t.was })
      }
      found = next
      measure()
    }

    const measure = () => {
      const a = document.querySelector('[data-app]')
      const ar = a ? rectOf(a) : { x: 0, y: 0, w: innerWidth, h: innerHeight }
      const out: Drawn[] = []
      for (const { t, els, was } of found) {
        if (t.line) {
          const two = ends.get(t.key)
          let line: [number, number, number, number] | null = null
          if (two) line = cut(rectOf(two[0]), rectOf(two[1]))
          else if (els[0] instanceof SVGLineElement) {
            const el = els[0]
            const m = el.getScreenCTM()
            if (m) {
              const p1 = new DOMPoint(el.x1.baseVal.value, el.y1.baseVal.value).matrixTransform(m)
              const p2 = new DOMPoint(el.x2.baseVal.value, el.y2.baseVal.value).matrixTransform(m)
              line = [p1.x, p1.y, p2.x, p2.y]
            }
          }
          if (line) out.push({ key: `${t.key}:l`, t, r: { x: Math.min(line[0], line[2]), y: Math.min(line[1], line[3]), w: Math.abs(line[2] - line[0]) || 1, h: Math.abs(line[3] - line[1]) || 1 }, line, was, tag: t.tag })
          continue
        }
        els.forEach((el, i) => {
          if (!el.isConnected) return
          const r = rectOf(el)
          if (r.w < 1) return
          const d: Drawn = { key: `${t.key}:${i}`, t, r, was, tag: t.tag }
          if (t.ghost && el instanceof HTMLElement && el.offsetWidth) {
            const k = r.w / el.offsetWidth
            d.ghost = { x: r.x + t.ghost.dx * k, y: r.y + t.ghost.dy * k, w: r.w, h: r.h }
          } else if (t.snap) {
            const list = snaps.get(t.id) ?? []
            const p = pieceOfEl(el)
            const s = list.find((x) => x.piece === p && x.container.isConnected) ?? list.find((x) => x.piece === p)
            const c = s && (s.container.isConnected ? rectOf(s.container) : rectOf(worldOf(el)))
            if (s && c) {
              const g = { x: c.x + s.rel.x * c.w, y: c.y + s.rel.y * c.h, w: s.rel.w * c.w, h: s.rel.h * c.h }
              if (Math.abs(g.x - r.x) > 2 || Math.abs(g.y - r.y) > 2 || Math.abs(g.w - r.w) > 2) d.ghost = g
            }
          }
          out.push(d)
        })
        // Gone to another canvas: where it was on this one (the canvas's transform read off a plane drawn here).
        if (t.away && st && !new URLSearchParams(location.search).get('focus') && st.ws.canvas === t.away.to) {
          const ref = st.ws.pieces.find((p) => p.kind === 'plane' && p.id !== t.id && document.querySelector(`[data-target="plane:${p.id}"]`))
          const el = ref && document.querySelector(`[data-target="plane:${ref.id}"]`)
          if (ref && el) {
            const rr = rectOf(el)
            const k = rr.w / ref.w
            out.push({ key: `${t.key}:away`, t, r: { x: rr.x + (t.away.x - ref.x) * k, y: rr.y + (t.away.y - ref.y) * k, w: t.away.w * k, h: t.away.h * k }, away: true, was, tag: t.tag })
          }
        }
      }
      if (!same(out, last.current)) {
        last.current = out
        setDrawn(out)
        const cards = [...document.querySelectorAll('[data-app] [data-target^="card:"]')].map(rectOf).filter((r) => r.w > 4)
        const text = [...document.querySelectorAll('[data-app] [data-target^="label:"]')].map(rectOf).filter((r) => r.w > 4)
        setBoxes({ all: [...cards, ...text], cards })
      }
      setApp((w) => (w && w.x === ar.x && w.y === ar.y && w.w === ar.w && w.h === ar.h ? w : ar))
    }

    // Frames only while something moves, and 400 ms after.
    const frame = () => {
      measure()
      raf = performance.now() < until ? requestAnimationFrame(frame) : 0
    }
    const moving = () => {
      until = performance.now() + 400
      if (!raf) raf = requestAnimationFrame(frame)
    }
    const appEl = document.querySelector('[data-app]') ?? document.body
    const mo = new MutationObserver(moving)
    mo.observe(appEl, { subtree: true, attributes: true, attributeFilter: ['style', 'data-zooming'] })
    window.addEventListener('resize', moving)
    window.addEventListener('scroll', moving, true)
    resolve()
    moving()
    const every = window.setInterval(resolve, 300)
    return () => {
      cancelAnimationFrame(raf)
      window.clearInterval(every)
      mo.disconnect()
      window.removeEventListener('resize', moving)
      window.removeEventListener('scroll', moving, true)
      for (const el of marked) el.removeAttribute('data-preview')
    }
  }, [st])

  // `was → now` and the agent's reason on hover: the smallest mark under the pointer that has something to say. The
  // layer takes no pointer events (the app under it is locked anyway, and a pan still works).
  useEffect(() => {
    if (!st) return setHover(null)
    const on = (e: PointerEvent) => {
      const at = last.current.filter((d) => (d.was.length || d.t.why) && e.clientX >= d.r.x - 4 && e.clientX <= d.r.x + d.r.w + 4 && e.clientY >= d.r.y - 4 && e.clientY <= d.r.y + d.r.h + 4)
      const d = at.sort((a, b) => a.r.w * a.r.h - b.r.w * b.r.h)[0]
      setHover((h) => (!d ? null : h && h.d.key === d.key ? { ...h, x: e.clientX, y: e.clientY } : { d, x: e.clientX, y: e.clientY }))
    }
    window.addEventListener('pointermove', on, { passive: true })
    return () => window.removeEventListener('pointermove', on)
  }, [st])

  if (!st || !app) return null
  const current = st.current
  const chips = placeChips(drawn, boxes.all)
  const o = (x: number, y: number) => [x - app.x, y - app.y]
  return (
    <div className={styles.layer} style={{ left: app.x, top: app.y, width: app.w, height: app.h }} aria-hidden data-preview-marks>
      <svg className={styles.lines} width={app.w} height={app.h}>
        {/* A link's stroke never runs over a card's text: masked out where it crosses a card's box. */}
        <defs>
          <mask id="preview-link-mask" maskUnits="userSpaceOnUse" x={0} y={0} width={app.w} height={app.h}>
            <rect x={0} y={0} width={app.w} height={app.h} fill="white" />
            {boxes.cards.map((b, i) => (
              <rect key={i} x={b.x - app.x} y={b.y - app.y} width={b.w} height={b.h} fill="black" />
            ))}
          </mask>
        </defs>
        {drawn.map((d) => {
          if (d.line) {
            const [x1, y1] = o(d.line[0], d.line[1])
            const [x2, y2] = o(d.line[2], d.line[3])
            return <line key={`l${d.key}`} mask="url(#preview-link-mask)" className={styles.link} data-change={d.t.change} data-current={(current && d.t.item === current) || undefined} x1={x1} y1={y1} x2={x2} y2={y2} />
          }
          if (!d.ghost) return null
          const [ax, ay] = o(d.ghost.x + d.ghost.w / 2, d.ghost.y + d.ghost.h / 2)
          const [bx, by] = o(d.r.x + d.r.w / 2, d.r.y + d.r.h / 2)
          // A long trail would cross half the screen: the ghost alone says where it was.
          if (Math.hypot(bx - ax, by - ay) > 600) return null
          return <line key={`g${d.key}`} className={styles.trail} x1={ax} y1={ay} x2={bx} y2={by} />
        })}
      </svg>
      {drawn.map((d) => {
        if (d.line) return null
        const lit = (current && d.t.item === current) || undefined
        return (
          <div key={d.key}>
            {d.ghost && <div className={styles.ghost} style={{ left: d.ghost.x - app.x, top: d.ghost.y - app.y, width: d.ghost.w, height: d.ghost.h }} />}
            <div className={styles.mark} data-change={d.away ? 'away' : d.t.change} data-tier={d.t.tier} data-current={lit} style={{ left: d.r.x - app.x, top: d.r.y - app.y, width: d.r.w, height: d.r.h }}>
              <i />
              <i />
              <i />
              <i />
              {d.t.change === 'removed' && !d.away && <b className={styles.strike} />}
            </div>
          </div>
        )
      })}
      {chips.map((c) => (
        <span
          key={`c${c.key}`}
          className={c.inside ? styles.badge : c.d.line ? styles.linkTag : styles.tag}
          data-change={c.d.away ? 'away' : c.d.t.change}
          data-current={(current && c.d.t.item === current) || undefined}
          style={{ left: c.x - app.x, top: c.y - app.y }}
        >
          {c.text}
        </span>
      ))}
      {hover && (
        <div className={styles.was} style={{ left: Math.min(hover.x + 14 - app.x, app.w - 300), top: hover.y + 16 - app.y }}>
          <p className={styles.wasHead}>{hover.d.tag}</p>
          {hover.d.t.why && (
            <p className={styles.why}>
              <span className={styles.wasMark}>−</span> {hover.d.t.why}
            </p>
          )}
          {hover.d.was.length > 0 && hover.d.t.change !== 'added' && hover.d.t.change !== 'removed' && <p className={styles.wasHead}>was → now</p>}
          {hover.d.was.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
      )}
    </div>
  )
}
