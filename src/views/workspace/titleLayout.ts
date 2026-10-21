// The project title's layout (D-118, D-132, D-194), in space px: the old board's sizes × 80. Inside the corner brackets,
// top to bottom: the caption (the north star and PROJECT), the name, the rule (a magenta lead, then a hairline), what
// it's building. Folded (too far out to read the description): the name alone, as big as fits the unfolded block
// without breaking a word, the star beside its first line; the block shrinks to it.
export const T = { pad: 44, caption: 18, name: 92, nameLead: 1.05, desc: 26, descLead: 1.4, gap: 27, rule: 4, star: 15, arm: 48, stroke: 3 }
export const NAME_TRACK = -0.045
// What the description says until someone writes it (editors only).
export const ABOUT_HINT = "What are you building? Double-click to write it."
// The description is set this much of the block's text width.
export const DESC_SHARE = 0.86
// The description is too small to read under this many screen px: the block folds.
export const FOLD_BELOW_PX = 6

// Folded: the star's radius beside the name, and how far the name is indented past it, from the name's size.
export const foldStar = (size: number) => size * 0.42
export const foldIndent = (size: number) => size * 0.42 * 2 + 24

let ctx: CanvasRenderingContext2D | null = null
const family = () => getComputedStyle(document.documentElement).getPropertyValue('--font-display').trim() || 'sans-serif'

// How many lines `text` takes at `size` px wrapped at `width` by words, and whether a word is wider than a line.
function wrap(text: string, size: number, width: number, weight: number, track = 0) {
  ctx ??= document.createElement('canvas').getContext('2d')
  if (!ctx) return { lines: 1, broke: false }
  ctx.font = `${weight} ${size}px ${family()}`
  const c = ctx
  const measure = (s: string) => c.measureText(s).width + s.length * track * size
  const space = measure(' ')
  let lines = 0
  let broke = false
  for (const para of text.split('\n')) {
    lines++
    let line = 0
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const ww = measure(word)
      if (ww > width) {
        broke = true
        lines += Math.ceil(ww / width) - 1
      }
      if (line && line + space + ww > width) {
        lines++
        line = ww
      } else line = line ? line + space + ww : ww
    }
  }
  return { lines: Math.max(1, lines), broke }
}

// `w` the block's width; `about` the description as shown, or null when none is.
export function titleLayout(name: string, about: string | null, w: number) {
  const tw = w - T.pad * 2
  const text = name || 'Untitled'
  const nameH = wrap(text, T.name, tw, 500, NAME_TRACK).lines * T.name * T.nameLead
  const descH = about === null ? 0 : wrap(about, T.desc, tw * DESC_SHARE, 400).lines * T.desc * T.descLead
  const fullH = T.caption + T.gap + nameH + T.gap + T.rule + (about === null ? 0 : T.gap + descH)
  // The biggest size whose lines fit the unfolded height, none of its words broken; usually bigger than unfolded.
  const fits = (s: number) => {
    const r = wrap(text, s, tw - foldIndent(s), 500, NAME_TRACK)
    return !r.broke && r.lines * s * T.nameLead <= fullH
  }
  let lo = T.name * 0.6
  let hi = T.name * 4
  let fold = lo
  if (fits(hi)) fold = hi
  else if (fits(lo)) {
    for (let i = 0; i < 16; i++) {
      const mid = (lo + hi) / 2
      if (fits(mid)) lo = mid
      else hi = mid
    }
    fold = lo
  }
  const foldH = wrap(text, fold, tw - foldIndent(fold), 500, NAME_TRACK).lines * fold * T.nameLead
  return { fullH, fold, foldH }
}
