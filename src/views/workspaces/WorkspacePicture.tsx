// A workspace's picture on the workspaces page (D-338, docs/specs/workspaces-page.md §3): its first canvas drawn from
// the summary doc (src/model/summary.ts), shapes only: pieces on their graphite with their kind's band, a plane's grid
// dots and its cards in their type's tint. The canvas itself has no dots (only planes have a grid, D-332). Without a
// summary (`sample`): a made-up canvas of the same shapes, nothing to read, for a first visit and a workspace nobody
// has pictured yet. Drawn on a 2D canvas from the tokens, again when the theme changes.
import { useEffect, useRef } from 'react'
import type { PieceKind } from '../../data/model'
import { CARD_UNITS, type Summary } from '../../model/summary'
import { tokenPx, tokenText } from '../../styles/cssToken'
import { useTheme } from '../../state/theme'
import { CARD_TONE } from '../../ui/foundation/cardTone'
import { DUR } from '../../ui/foundation/motionTokens'
import styles from './WorkspacePicture.module.css'

// Each kind's band, as the canvas draws it (CanvasView.module.css `--kind`).
const BAND: Record<PieceKind, `--${string}`> = {
  plane: '--fg',
  matrix: '--link-solves',
  table: '--link-part',
  kanban: '--link-draws',
  timeline: '--link-draws',
  documents: '--link-depends',
  document: '--link-depends',
}
// How faint an empty workspace's made-up canvas is.
const GHOST = 0.4
const varName = (v: string) => v.slice(4, -1) as `--${string}` // 'var(--x)' → '--x'

// The made-up canvas for `sample`: a heading, a plane with cards, a deck, a table (0–1000; cards 0–100).
const SAMPLE: Summary = {
  at: 0,
  n: 7,
  pieces: [
    { kind: 'plane', x: 0, y: 120, w: 560, h: 380 },
    { kind: 'kanban', x: 620, y: 120, w: 380, h: 220 },
    { kind: 'table', x: 620, y: 380, w: 380, h: 180 },
  ],
  cards: [
    { piece: 0, type: 'idea', x: 0, y: 0 },
    { piece: 0, type: 'idea', x: 13, y: 0 },
    { piece: 0, type: 'idea', x: 26, y: 0 },
    { piece: 0, type: 'idea', x: 0, y: 8 },
    { piece: 0, type: 'idea', x: 13, y: 8 },
    { piece: 0, type: 'idea', x: 0, y: 16 },
    { piece: 0, type: 'idea', x: 26, y: 12 },
  ],
}

// No summary (a first visit, an empty or not yet pictured workspace): the made-up canvas, shapes only; `sample` draws
// it at full strength (the first visit's START), else faint, so an empty workspace's card looks like the others.
type Props = { summary: Summary | null; sample?: boolean; className?: string }

export function WorkspacePicture({ summary, sample = false, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const theme = useTheme((s) => s.theme)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const draw = () => paint(cv, summary, sample)
    draw()
    // The theme's colours ease in (tokens.css): drawn again once they've arrived.
    const later = window.setTimeout(draw, DUR.med)
    const ro = new ResizeObserver(draw)
    ro.observe(cv)
    return () => {
      window.clearTimeout(later)
      ro.disconnect()
    }
  }, [summary, sample, theme])
  return <canvas ref={ref} className={[styles.picture, className].filter(Boolean).join(' ')} aria-hidden />
}

function paint(cv: HTMLCanvasElement, summary: Summary | null, wantSample: boolean) {
  const dpr = window.devicePixelRatio || 1
  const W = cv.clientWidth
  const H = cv.clientHeight
  if (!W || !H) return
  cv.width = Math.round(W * dpr)
  cv.height = Math.round(H * dpr)
  const g = cv.getContext('2d')
  if (!g) return
  g.scale(dpr, dpr)
  g.fillStyle = tokenText('--bg')
  g.fillRect(0, 0, W, H)
  const sample = !summary || !summary.pieces.length
  const s = sample ? SAMPLE : summary
  // An empty one's ghost: the same drawing, faint.
  const base = sample && !wantSample ? GHOST : 1
  g.globalAlpha = base
  const shapesOnly = sample

  // The pieces' box (0–1000 on its longer side) fitted into the picture with a margin, centred.
  // A margin all round, more on top: the piece's name is cut into its top edge, over the picture.
  const pad = Math.max(tokenPx('--space-2'), Math.min(W, H) * 0.06)
  const top = pad + tokenPx('--space-3')
  const bw = Math.max(...s.pieces.map((p) => p.x + p.w), 1)
  const bh = Math.max(...s.pieces.map((p) => p.y + p.h), 1)
  const k = Math.min((W - 2 * pad) / bw, (H - top - pad) / bh)
  const ox = (W - bw * k) / 2
  const oy = top + (H - top - pad - bh * k) / 2

  const piece = tokenText('--piece')
  const edge = tokenText('--piece-edge')
  const mark = tokenText('--piece-mark')
  const grid = tokenText('--grid-mark') || mark
  s.pieces.forEach((p, i) => {
    const x = ox + p.x * k
    const y = oy + p.y * k
    const w = Math.max(2, p.w * k)
    const h = Math.max(2, p.h * k)
    g.fillStyle = piece
    g.fillRect(x, y, w, h)
    g.strokeStyle = edge
    g.lineWidth = 1
    g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
    // What's drawn inside a piece stays inside it, however small the picture.
    g.save()
    g.beginPath()
    g.rect(x, y, w, h)
    g.clip()
    g.fillStyle = tokenText(BAND[p.kind])
    g.globalAlpha = base * (shapesOnly ? 0.7 : 1)
    g.fillRect(x, y, w, 2)
    g.globalAlpha = base
    if (p.kind === 'plane') {
      // Its grid, then its cards fitted inside it.
      const step = Math.max(4, Math.min(w, h) / 24)
      g.fillStyle = grid
      g.globalAlpha = base * 0.7
      for (let gx = x + step; gx < x + w - 1; gx += step) for (let gy = y + step; gy < y + h - 1; gy += step) g.fillRect(gx, gy, 1, 1)
      g.globalAlpha = base
      // Its cards by their own box (a card is CARD_UNITS), fitted inside with a margin, keeping their spacing.
      const mine = s.cards.filter((c) => c.piece === i)
      if (mine.length) {
        const bw = Math.max(...mine.map((c) => c.x)) + CARD_UNITS.w
        const bh = Math.max(...mine.map((c) => c.y)) + CARD_UNITS.h
        const m = Math.min(w, h) * 0.1
        const u = Math.min((w - 2 * m) / bw, (h - 2 * m - 2) / bh)
        const cx0 = x + (w - bw * u) / 2
        const cy0 = y + 2 + (h - 2 - bh * u) / 2
        const cw = Math.max(2, CARD_UNITS.w * u * 0.9)
        const ch = Math.max(1, CARD_UNITS.h * u * 0.85)
        for (const c of mine) {
          const cx = cx0 + c.x * u
          const cy = cy0 + c.y * u
          if (shapesOnly) {
            g.fillStyle = mark
            g.fillRect(cx, cy, cw, ch)
            continue
          }
          g.fillStyle = tokenText(varName(CARD_TONE[c.type]))
          g.globalAlpha = base * 0.28
          g.fillRect(cx, cy, cw, ch)
          g.globalAlpha = base
          g.fillRect(cx, cy, Math.max(1, cw * 0.06), ch)
        }
      }
    } else if (p.kind === 'kanban' || p.kind === 'timeline') {
      // Columns of sheets.
      const cols = 3
      const colW = (w - 8) / cols
      for (let c = 0; c < cols; c++) {
        const cx = x + 4 + c * colW
        g.fillStyle = mark
        g.fillRect(cx, y + 8, colW - 6, 1)
        for (let t = 0; t < 3 - c && y + 14 + t * 10 + 6 < y + h; t++) g.fillRect(cx, y + 12 + t * 10, colW - 6, 6)
      }
    } else {
      // Rows.
      g.fillStyle = mark
      for (let ry = y + 10; ry < y + h - 6; ry += 8) {
        g.fillRect(x + 6, ry, w * 0.22, 2)
        g.fillRect(x + 12 + w * 0.22, ry, w * 0.6, 2)
      }
    }
    g.restore()
  })
  if (shapesOnly) {
    // The sample's heading and its rule fading right, over the plane.
    const hx = ox
    const hy = oy + 30 * k
    g.fillStyle = mark
    g.fillRect(hx, hy, 220 * k, Math.max(3, 22 * k))
    const grad = g.createLinearGradient(hx, 0, hx + 420 * k, 0)
    grad.addColorStop(0, mark)
    grad.addColorStop(1, 'transparent')
    g.fillStyle = grad
    g.fillRect(hx, hy + 40 * k, 420 * k, 1)
  }
}
