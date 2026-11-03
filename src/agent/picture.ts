// A picture of a plane or a canvas for the model (D-327 phase 2, the `look` tool): a schematic SVG drawn from the same
// boxes the app and the evals use (cardsOn, foldsOf, packageBox, labelBox), so what the model sees is where things
// are. Not a screenshot: cards are boxes in their type's colour with their short id and title, links are lines,
// sections and packages frames, headings and notes their words. Drawn from whatever workspace it's given; inside a
// turn that is the one with the pending changes on it, so the model can look at its own proposal.
//
// Pure (no DOM, no Firebase), but outside src/agent/read because it reads tokens.ts' palette: the SVG goes to env.render (the browser's canvas, or resvg in the evals) to become a PNG. The colours
// are tokens.ts' dark palette (WebGL's mirror of tokens.css), never raw values here.
import { colors } from '../styles/tokens'
import { CARD, type Card } from '../model/cards'
import { cardsOn } from '../model/placement'
import { foldsOf, packageBox } from '../model/cardInside'
import { labelBox } from '../model/labelBox'
import { kindOf } from '../model/labels'
import { kindOfPiece } from '../model/pieces'
import { canvasOf } from '../model/canvases'
import { piecesShown } from '../model/textPlace'
import { FOR } from '../model/edges'
import type { ReadWs } from './read/types'
import type { Ids } from './read/ids'
import { boundsOf } from '../model/layout'

export type Picture = { svg: string; w: number; h: number; text: string }

// The longest side of a picture, px: big enough to read a card's id, small enough to cost little (~1–2k tokens).
export const PICTURE_MAX = 1400
const MARGIN = 40
// The app's own font (D-337, Inter): the renderers embed it, since neither sees the page's web fonts (src/agent/ui/render.ts,
// evals/render.ts).
export const PICTURE_FONT = 'Inter'

const TONE: Record<string, string> = { customer: colors.green, problem: colors.magenta, competitor: colors.yellow, idea: colors.fg, feature: colors.cyan, package: colors.blue }
export const LEGEND = 'Colours: customer green, problem magenta, competitor yellow, idea white, feature cyan, package blue (a frame round its members when unfolded). Lines are links (dashed: for and relates, which the app hides until a card is picked). Grey frames are sections.'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const cut = (s: string, n: number) => {
  const flat = s.replace(/\s+/g, ' ').trim()
  return flat.length > n ? `${flat.slice(0, n - 1)}…` : flat
}

type Box = { x: number; y: number; w: number; h: number }

// The drawing's frame: everything in `bounds`, scaled down to fit PICTURE_MAX.
function frame(bounds: Box) {
  const b = { x: bounds.x - MARGIN, y: bounds.y - MARGIN, w: bounds.w + 2 * MARGIN, h: bounds.h + 2 * MARGIN }
  const k = Math.min(1, PICTURE_MAX / Math.max(b.w, b.h))
  const w = Math.max(1, Math.round(b.w * k))
  const h = Math.max(1, Math.round(b.h * k))
  return { b, k, w, h, open: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${b.x} ${b.y} ${b.w} ${b.h}" font-family="${PICTURE_FONT}, sans-serif"><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="${colors.bg}"/>` }
}

// Text that stays readable after scaling: at least ~9 px on the picture.
const fontFor = (k: number, base: number) => Math.max(base, 9 / k)

export function planePicture(ws: ReadWs, ids: Ids, planeId: string): Picture | null {
  const plane = ws.pieces.find((p) => p.id === planeId)
  if (!plane || kindOfPiece(plane) !== 'plane') return null
  const cards = cardsOn(ws.cards as Card[], ws.places, plane.id)
  const folds = foldsOf(cards, ws.edges)
  const shown = cards.filter((c) => !folds.hidden.has(c.id))
  const frames: { id: string; box: Box; name: string }[] = []
  const boxes: { c: Card; box: Box }[] = []
  for (const c of shown) {
    if (c.type === 'package' && !c.folded) {
      const f = packageBox((folds.members.get(c.id) ?? []).map((m: Card) => ({ x: m.x, y: m.y, w: CARD.w, h: CARD.h })))
      if (f) frames.push({ id: c.id, box: f, name: c.title ?? '' })
      continue
    }
    boxes.push({ c, box: { x: c.x, y: c.y, w: CARD.w, h: CARD.h } })
  }
  const labels = ws.labels.filter((l) => l.pieceId === plane.id)
  // A plane has no edge for its content: the app fits whatever is on it into the plane's window, on the canvas and in
  // focus (D-186, D-187). So the picture is the content, and the words say how it fits that window.
  const all = [...boxes.map((b) => b.box), ...frames.map((f) => f.box), ...labels.map((l) => labelBox(l))]
  if (!all.length) return null
  const f = frame(boundsOf(all))
  const small = fontFor(f.k, 13)
  const out: string[] = [f.open]
  // Sections and text under everything else.
  for (const l of labels) {
    const b = labelBox(l)
    const kind = kindOf(l)
    const words = esc(cut(l.text ?? '', kind === 'paragraph' || kind === 'sticky' ? 60 : 50))
    if (kind === 'section') {
      out.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" stroke="${colors.fgDim}" stroke-width="${2 / f.k}"/>`)
      if (words) out.push(`<text x="${b.x + 8}" y="${b.y + small + 4}" fill="${colors.fgDim}" font-size="${small}">${words}</text>`)
    } else if (kind === 'heading' || kind === 'title') {
      const size = Math.max(fontFor(f.k, 22), Math.min(b.h * 0.7, 60))
      out.push(`<text x="${b.x}" y="${b.y + size}" fill="${colors.fg}" font-size="${size}" font-weight="700">${words}</text>`)
    } else {
      out.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="${colors.fgDim}" fill-opacity="0.25"/>`)
      out.push(`<text x="${b.x + 6}" y="${b.y + small + 4}" fill="${colors.fg}" font-size="${small}">${words}</text>`)
    }
  }
  for (const p of frames) {
    out.push(`<rect x="${p.box.x}" y="${p.box.y}" width="${p.box.w}" height="${p.box.h}" fill="none" stroke="${colors.blue}" stroke-width="${3 / f.k}"/>`)
    out.push(`<text x="${p.box.x + 6}" y="${p.box.y - 6}" fill="${colors.blue}" font-size="${small}">${esc(`${ids.short('card', p.id)} ${cut(p.name, 40)}`)}</text>`)
  }
  // Links between cards drawn here, centre to centre.
  const at = new Map(boxes.map((b) => [b.c.id, b.box]))
  let links = 0
  for (const e of ws.edges) {
    const a = at.get(e.fromId)
    const z = at.get(e.toId)
    if (!a || !z) continue
    links++
    const quiet = e.kind === FOR || e.kind === 'relates'
    out.push(`<line x1="${a.x + a.w / 2}" y1="${a.y + a.h / 2}" x2="${z.x + z.w / 2}" y2="${z.y + z.h / 2}" stroke="${colors.fgDim}" stroke-width="${(quiet ? 1.5 : 2.5) / f.k}"${quiet ? ` stroke-dasharray="${6 / f.k} ${6 / f.k}"` : ''}/>`)
  }
  for (const { c, box } of boxes) {
    const tone = TONE[c.type] ?? colors.fg
    out.push(`<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="${tone}" fill-opacity="0.18" stroke="${tone}" stroke-width="${2 / f.k}"/>`)
    const fs = fontFor(f.k, 14)
    out.push(`<text x="${box.x + 6}" y="${box.y + fs + 4}" fill="${tone}" font-size="${fs}" font-weight="700">${esc(ids.short('card', c.id))}</text>`)
    out.push(`<text x="${box.x + 6}" y="${box.y + 2 * fs + 8}" fill="${colors.fg}" font-size="${fs}">${esc(cut(c.title ?? '', 26))}</text>`)
  }
  out.push('</svg>')
  // How the content fits the plane's window: the closer its shape to the window's, the larger it reads there.
  const content = boundsOf(all)
  const fit = Math.min(plane.w / content.w, plane.h / content.h)
  const text = [
    `A picture of ${ids.short('piece', plane.id)} "${cut(plane.name ?? '', 40)}" as it is now (with your pending changes): ${boxes.length} cards, ${frames.length} unfolded packages, ${links} links drawn, ${labels.length} texts. Its content is ${Math.round(content.w)} × ${Math.round(content.h)}; the app fits it into the plane's ${plane.w} × ${plane.h} window, shown there at ${Math.round(Math.min(1, fit) * 100)} % (content shaped like the window reads largest). ${f.w} × ${f.h} px.`,
    LEGEND,
  ].join('\n')
  return { svg: out.join(''), w: f.w, h: f.h, text }
}

export function canvasPicture(ws: ReadWs, ids: Ids, canvasId: string): Picture | null {
  const pieces = piecesShown(canvasId, ws.pieces, ws.spots)
  const labels = ws.labels.filter((l) => l.pieceId === 'canvas' && canvasOf(l) === canvasId)
  if (!pieces.length && !labels.length) return null
  const boxes = [...pieces.map((p) => ({ x: p.x, y: p.y, w: p.w, h: p.h })), ...labels.map((l) => labelBox(l))]
  const f = frame(boundsOf(boxes))
  const fs = fontFor(f.k, 28)
  const out: string[] = [f.open]
  const home = new Map<string, string>()
  for (const p of pieces) if (kindOfPiece(p) === 'plane') for (const c of cardsOn(ws.cards as Card[], ws.places, p.id)) if (!home.has(c.id)) home.set(c.id, p.id)
  // Links whose cards are on two different planes here: one line per pair of planes, its count beside it.
  const pairs = new Map<string, number>()
  for (const e of ws.edges) {
    const [a, z] = [home.get(e.fromId), home.get(e.toId)]
    if (!a || !z || a === z) continue
    const k = [a, z].sort().join('|')
    pairs.set(k, (pairs.get(k) ?? 0) + 1)
  }
  const centre = new Map(pieces.map((p) => [p.id, { x: p.x + p.w / 2, y: p.y + p.h / 2 }]))
  for (const [k, n] of pairs) {
    const [a, z] = k.split('|').map((id) => centre.get(id)!)
    out.push(`<line x1="${a.x}" y1="${a.y}" x2="${z.x}" y2="${z.y}" stroke="${colors.magenta}" stroke-opacity="0.6" stroke-width="${Math.min(12, 1 + n / 4) / f.k}"/>`)
    out.push(`<text x="${(a.x + z.x) / 2}" y="${(a.y + z.y) / 2}" fill="${colors.magenta}" font-size="${fs}">${n}</text>`)
  }
  for (const p of pieces) {
    const kind = kindOfPiece(p)
    const n = kind === 'plane' ? cardsOn(ws.cards as Card[], ws.places, p.id).length : 0
    out.push(`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${colors.fgDim}" fill-opacity="0.15" stroke="${kind === 'plane' ? colors.fg : colors.fgDim}" stroke-width="${2 / f.k}"/>`)
    out.push(`<text x="${p.x + 12}" y="${p.y + fs + 8}" fill="${colors.fg}" font-size="${fs}" font-weight="700">${esc(`${ids.short('piece', p.id)} ${cut(p.name ?? '', 30)}`)}</text>`)
    out.push(`<text x="${p.x + 12}" y="${p.y + 2 * fs + 16}" fill="${colors.fgDim}" font-size="${fs * 0.8}">${esc(kind === 'plane' ? `plane · ${n} cards` : kind)}</text>`)
  }
  for (const l of labels) {
    const b = labelBox(l)
    if (kindOf(l) === 'section') out.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" stroke="${colors.fgDim}" stroke-width="${2 / f.k}"/>`)
    out.push(`<text x="${b.x}" y="${b.y + fs}" fill="${colors.fg}" font-size="${fs}">${esc(cut(l.text ?? '', 40))}</text>`)
  }
  out.push('</svg>')
  const text = [
    `A picture of ${ids.short('canvas', canvasId)} as it is now (with your pending changes): ${pieces.length} pieces, ${labels.length} texts; magenta lines join planes whose cards are linked, with how many links (no plane draws those). ${f.w} × ${f.h} px.`,
  ].join('\n')
  return { svg: out.join(''), w: f.w, h: f.h, text }
}
