// Paragraphs on the board (D-156) and sticky notes (D-158): a few lines of light Markdown (the chat's, D-089), laid out
// in board units at a set width and drawn into a canvas. troika's SDF text has one face per block, so bold and italic
// words inside a paragraph can't be set with it; a canvas can, and is redrawn sharper as you zoom in.
//
// What it reads: a blank line starts a new paragraph, a line starting `- ` or `* ` is a bullet, `1. ` a numbered one;
// inside a line `**bold**`, `*italic*` or `_italic_`, `` `code` `` and `[text](url)` (shown as the text, underlined).
import { fonts } from '../../styles/tokens'

export type Run = { text: string; bold?: boolean; italic?: boolean; code?: boolean; link?: boolean }
type Block = { kind: 'p' | 'bullet' | 'number'; n?: number; runs: Run[] }

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g

export function inline(line: string): Run[] {
  const runs: Run[] = []
  let at = 0
  for (const m of line.matchAll(INLINE)) {
    if (m.index! > at) runs.push({ text: line.slice(at, m.index) })
    const t = m[0]
    if (t.startsWith('**')) runs.push({ text: t.slice(2, -2), bold: true })
    else if (t.startsWith('`')) runs.push({ text: t.slice(1, -1), code: true })
    else if (t.startsWith('[')) runs.push({ text: t.slice(1, t.indexOf('](')), link: true })
    else runs.push({ text: t.slice(1, -1), italic: true })
    at = m.index! + t.length
  }
  if (at < line.length) runs.push({ text: line.slice(at) })
  return runs
}

export function blocks(text: string): (Block | null)[] {
  // null: a blank line, a paragraph's gap.
  return text.split('\n').map((raw) => {
    const line = raw.trimEnd()
    if (!line.trim()) return null
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line)
    if (bullet) return { kind: 'bullet', runs: inline(bullet[1]) }
    const num = /^\s*(\d{1,3})[.)]\s+(.*)$/.exec(line)
    if (num) return { kind: 'number', n: Number(num[1]), runs: inline(num[2]) }
    return { kind: 'p', runs: inline(line) }
  })
}

// Laid-out text: each piece at its place (board units from the top-left, y down to the baseline).
export type Piece = Run & { x: number; y: number; w: number }
export type Marker = { text: string; x: number; y: number }
export type Layout = { pieces: Piece[]; markers: Marker[]; width: number; height: number }

export type Face = 'display' | 'mono'
export type Setting = { face: Face; size: number; leading: number; width: number; bold?: boolean; italic?: boolean }

const FAMILY: Record<Face, string> = { display: fonts.display, mono: fonts.mono }
// Measured at this many pixels per unit; widths scale with it.
const MEASURE_PPU = 100

export function fontOf(face: Face, size: number, run: Run, base: Pick<Setting, 'bold' | 'italic'> = {}) {
  const weight = run.bold || base.bold ? 650 : face === 'display' ? 420 : 400
  const style = run.italic || base.italic ? 'italic ' : ''
  return `${style}${weight} ${size}px "${run.code ? FAMILY.mono : FAMILY[face]}"`
}

let measurer: CanvasRenderingContext2D | null = null
function measure(font: string, text: string) {
  measurer ??= document.createElement('canvas').getContext('2d')!
  measurer.font = font
  return measurer.measureText(text).width / MEASURE_PPU
}

// Words wrap at `width`; a word longer than a line is broken where it has to be.
export function layout(text: string, s: Setting): Layout {
  const pieces: Piece[] = []
  const markers: Marker[] = []
  const line = s.size * s.leading
  const indent = s.size * 1.2
  let y = 0
  let widest = 0
  let gap = false
  for (const b of blocks(text)) {
    if (!b) {
      gap = pieces.length > 0
      continue
    }
    if (gap) y += line * 0.45
    gap = false
    const left = b.kind === 'p' ? 0 : indent
    if (b.kind !== 'p') markers.push({ text: b.kind === 'bullet' ? '•' : `${b.n}.`, x: s.size * 0.15, y: y + s.size })
    let x = left
    let rowStart = pieces.length
    const newRow = () => {
      widest = Math.max(widest, ...pieces.slice(rowStart).map((p) => p.x + p.w))
      y += line
      x = left
      rowStart = pieces.length
    }
    for (const run of b.runs) {
      const font = fontOf(s.face, s.size * MEASURE_PPU, run, s)
      // Words with the spaces after them, so a line break eats the space.
      for (const word of run.text.split(/(?<=\s)/)) {
        let rest = word
        while (rest) {
          const w = measure(font, rest)
          const bare = measure(font, rest.trimEnd())
          if (x + bare <= s.width || x === left) {
            if (x + bare > s.width && x === left) {
              // Too long for a line on its own: as many letters as fit.
              let n = rest.length
              while (n > 1 && measure(font, rest.slice(0, n)) > s.width - left) n--
              pieces.push({ ...run, text: rest.slice(0, n), x, y: y + s.size, w: measure(font, rest.slice(0, n)) })
              rest = rest.slice(n)
              newRow()
              continue
            }
            pieces.push({ ...run, text: rest, x, y: y + s.size, w: bare })
            x += w
            rest = ''
          } else newRow()
        }
      }
    }
    newRow()
  }
  // The last line's descenders.
  const height = Math.max(s.size * 1.25, y - line + s.size * 1.25)
  return { pieces, markers, width: Math.min(s.width, Math.max(widest, s.size)), height }
}

export type Ink = { text: string; strong: string; dim: string; link: string; code: string }

// Draws a layout into a canvas `box` units big at `ppu` pixels per unit, starting `pad` units in from its top-left.
export function draw(canvas: HTMLCanvasElement, l: Layout, s: Setting, ink: Ink, ppu: number, box: [number, number], pad: number) {
  canvas.width = Math.max(1, Math.ceil(box[0] * ppu))
  canvas.height = Math.max(1, Math.ceil(box[1] * ppu))
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.textBaseline = 'alphabetic'
  ctx.translate(pad * ppu, pad * ppu)
  const px = s.size * ppu
  for (const m of l.markers) {
    ctx.font = fontOf(s.face, px, { text: '' }, s)
    ctx.fillStyle = ink.dim
    ctx.fillText(m.text, m.x * ppu, m.y * ppu)
  }
  for (const p of l.pieces) {
    ctx.font = fontOf(s.face, p.code ? px * 0.92 : px, p, s)
    ctx.fillStyle = p.link ? ink.link : p.code ? ink.code : p.bold ? ink.strong : ink.text
    ctx.fillText(p.text.trimEnd(), p.x * ppu, p.y * ppu)
    if (p.link) ctx.fillRect(p.x * ppu, p.y * ppu + px * 0.14, p.w * ppu, Math.max(1, px * 0.06))
  }
}

// The DOM's Geist faces, loaded before anything is measured (a fallback font measures differently).
let loaded = false
export const fontsLoaded = () => loaded
export function loadFonts(): Promise<void> {
  const want = [`420 16px "${fonts.display}"`, `650 16px "${fonts.display}"`, `400 16px "${fonts.mono}"`, `650 16px "${fonts.mono}"`]
  return Promise.all(want.map((f) => document.fonts.load(f))).then(
    () => void (loaded = true),
    () => void (loaded = true),
  )
}
