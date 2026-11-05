// Every value in the CSS is a token (D-325, docs/specs/tokens.md). Counts the raw values left in each CSS file under src/
// (tokens.css itself and the dev-only gallery left out), and in TS/TSX the design values written in place (a "13px",
// a hex colour, `fontSize: 12` in a style), and fails when a file has more than scripts/tokens-baseline.json allows.
// Where TS has to name a number itself (a font atlas, an off-screen holder), `// tokens-ok: why` on the line says so.
//   npm run check:tokens            check
//   npm run check:tokens -- --list  print every raw value, file by file
//   npm run check:tokens -- --write lower the baseline to today's counts (never raises it)
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const baselinePath = path.join(root, 'scripts/tokens-baseline.json')
const skip = [/^src\/styles\/tokens\.css$/, /^src\/gallery\//, /\.gallery\.tsx$/, /\.test\.tsx?$/]
// The sources themselves: tokens.ts (WebGL's palette), the card types' colours, motion's TS mirror, the world's geometry.
const sources = [/^src\/styles\/tokens\.ts$/, /^src\/ui\/cardTone\.ts$/, /^src\/ui\/motionTokens\.ts$/, /^src\/model\/world\.ts$/]

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(css|tsx?)$/.test(e.name)) out.push(path.relative(root, p).split(path.sep).join('/'))
  }
  return out
}

// What counts as raw. `0`, %, ch, em, vw/vh and unitless calc() multipliers are fine.
const RULES = [
  ['px', /(?<![\w.-])-?(?!0+(\.0+)?px)\d*\.?\d+px\b/g],
  ['time', /(?<![\w.-])(?!0+(\.0+)?m?s\b)\d*\.?\d+m?s\b/g],
  ['hex', /#[0-9a-fA-F]{3,8}\b/g],
  ['ease', /cubic-bezier\(/g],
]
// Properties whose bare numbers are raw (0 and 1 allowed where they mean none/all).
const NUMERIC = [
  ['z-index', /^z-index$/, (v) => /^-?\d+$/.test(v) && v !== '0'],
  ['opacity', /^opacity$/, (v) => /^\d*\.?\d+$/.test(v) && v !== '0' && v !== '1'],
  ['line-height', /^line-height$/, (v) => /^\d*\.?\d+$/.test(v)],
  ['font-weight', /^font-weight$/, (v) => /^\d+$/.test(v)],
  ['letter-spacing', /^letter-spacing$/, (v) => /^-?\d*\.?\d+em$/.test(v) && !/^-?0(\.0+)?em$/.test(v)],
]

// TS/TSX: what a style says in place. A px number not computed (`${x}px` is), a quoted hex colour, a style key given a
// bare number other than 0.
const TS_STYLE_KEYS = 'fontSize|fontWeight|padding\\w*|margin\\w*|gap|rowGap|columnGap|zIndex|letterSpacing|lineHeight|borderWidth|borderRadius'
function scanTs(file) {
  if (sources.some((r) => r.test(file))) return []
  const found = []
  const src = fs.readFileSync(path.join(root, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
  src.split(/\r?\n/).forEach((line, i) => {
    if (/tokens-ok/.test(line)) return
    const l = line.replace(/(^|\s)\/\/.*$/, '')
    for (const m of l.matchAll(/(?<![\w.$}-])-?(?!0+(\.0+)?px)\d*\.?\d+px\b/g)) found.push({ line: i + 1, kind: 'px', text: m[0] })
    for (const m of l.matchAll(/['"`]#[0-9a-fA-F]{3,8}\b/g)) found.push({ line: i + 1, kind: 'hex', text: m[0].slice(1) })
    for (const m of l.matchAll(new RegExp(`\\b(${TS_STYLE_KEYS})\\s*:\\s*(-?\\d*\\.?\\d+)\\b`, 'g'))) if (Number(m[2]) !== 0) found.push({ line: i + 1, kind: 'style', text: `${m[1]}: ${m[2]}` })
  })
  return found
}

function scan(file) {
  if (/\.tsx?$/.test(file)) return scanTs(file)
  const src = fs.readFileSync(path.join(root, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
  const found = []
  const lines = src.split(/\r?\n/)
  lines.forEach((line, i) => {
    // Breakpoints and container queries can't be variables (D-325: 760 and 640 only).
    if (/^\s*@(media|container)/.test(line)) return
    // The reduced-motion switch (0.01ms !important) isn't a duration; an inline SVG (url(...)) can't read variables.
    const l = line.replace(/0\.01ms\s*!important/g, '').replace(/url\((["']).*?\1\)/g, 'url()')
    for (const [kind, re] of RULES) for (const m of l.matchAll(re)) found.push({ line: i + 1, kind, text: m[0] })
    for (const m of l.matchAll(/color-mix\((?:[^()]|\([^()]*\))*?(\d+(\.\d+)?%)/g)) found.push({ line: i + 1, kind: 'mix', text: m[1] })
    // The font shorthand: a weight or a line height written in it (`font: 500 var(--text-lg) / 1.3 …`).
    const f = l.match(/^\s*font\s*:\s*([^;]+);/)
    if (f) {
      for (const m of f[1].matchAll(/(?:^|\s)([1-9]00)(?=\s)/g)) found.push({ line: i + 1, kind: 'font-weight', text: m[1] })
      for (const m of f[1].matchAll(/\/\s*(\d*\.?\d+)(?=\s)/g)) found.push({ line: i + 1, kind: 'line-height', text: m[1] })
    }
    const d = l.match(/^\s*([a-z-]+)\s*:\s*([^;]+);/)
    if (d) for (const [kind, prop, raw] of NUMERIC) if (prop.test(d[1]) && raw(d[2].replace(/\s*!important/, '').trim())) found.push({ line: i + 1, kind, text: d[2].trim() })
  })
  return found
}

const files = walk(path.join(root, 'src')).filter((f) => !skip.some((r) => r.test(f))).sort()

// Constants that aren't tokens have one home each (docs/specs/tokens.md §8). A name a home exports is defined nowhere
// else (import it), and the same UPPER_CASE name with the same number is not written in two files (move it home).
const HOMES = ['src/ui/foundation/feel.ts', 'src/model/limits.ts', 'src/model/world.ts', 'src/ui/foundation/motionTokens.ts', 'src/model/grid.ts']
const owned = new Map()
for (const h of HOMES) {
  if (!fs.existsSync(path.join(root, h))) continue
  for (const m of fs.readFileSync(path.join(root, h), 'utf8').matchAll(/^export const ([A-Z][A-Z0-9_]*)\b/gm)) owned.set(m[1], h)
}
const DEF = /^\s*(?:export\s+)?(?:const|let)\s+([A-Z][A-Z0-9_]*)\s*=\s*([^\n]*)$/gm
const numbers = new Map() // `NAME=value` → files
const homeless = {}
for (const f of files.filter((f) => /\.tsx?$/.test(f) && !HOMES.includes(f))) {
  const src = fs.readFileSync(path.join(root, f), 'utf8')
  for (const m of src.matchAll(DEF)) {
    const line = src.slice(0, m.index).split('\n').length
    if (owned.has(m[1])) (homeless[f] ??= []).push({ line, kind: 'owned', text: `${m[1]} is ${owned.get(m[1])}'s` })
    const v = m[2].replace(/\s*\/\/.*$/, '').trim()
    if (/^[\d_.\s*+\-/()]+$/.test(v) && /\d/.test(v)) {
      const k = `${m[1]}=${v.replace(/\s+/g, '')}`
      if (!numbers.has(k)) numbers.set(k, [])
      numbers.get(k).push({ f, line })
    }
  }
}
for (const [k, at] of numbers) if (new Set(at.map((a) => a.f)).size > 1) for (const a of at) (homeless[a.f] ??= []).push({ line: a.line, kind: 'twice', text: `${k} also in ${at.filter((b) => b.f !== a.f).map((b) => b.f).join(', ')}` })
const counts = {}
const all = {}
for (const f of files) {
  const found = [...scan(f), ...(homeless[f] ?? [])]
  all[f] = found
  if (found.length) counts[f] = found.length
}
const args = process.argv.slice(2)
const baseline = fs.existsSync(baselinePath) ? JSON.parse(fs.readFileSync(baselinePath, 'utf8')) : null

if (args.includes('--list')) {
  const only = args.find((a) => !a.startsWith('--'))
  for (const f of files) {
    if (only && !f.includes(only)) continue
    if (!all[f].length) continue
    console.log(`\n${f} (${all[f].length})`)
    for (const x of all[f]) console.log(`  ${x.line}\t${x.kind}\t${x.text}`)
  }
}

const total = Object.values(counts).reduce((s, n) => s + n, 0)
if (args.includes('--write')) {
  const next = {}
  for (const [f, n] of Object.entries(counts)) next[f] = baseline && f in baseline ? Math.min(n, baseline[f]) : baseline ? 0 : n
  fs.writeFileSync(baselinePath, JSON.stringify(next, null, 2) + '\n')
  console.log(`tokens baseline written: ${total} raw values in ${Object.keys(next).length} files`)
  process.exit(0)
}

const over = []
for (const [f, n] of Object.entries(counts)) {
  const allowed = baseline?.[f] ?? 0
  if (n > allowed) over.push(`${f}: ${n} raw values, baseline ${allowed}`)
}
const lower = baseline ? Object.entries(baseline).filter(([f, n]) => (counts[f] ?? 0) < n) : []
if (over.length) {
  console.error('check:tokens: raw values added (D-325, docs/specs/tokens.md). Use a token; `--list <file>` shows them.')
  for (const o of over) console.error('  ' + o)
  process.exit(1)
}
console.log(`check:tokens: ${total} raw values left in ${Object.keys(counts).length} files${lower.length ? ` (${lower.length} files below their baseline: run --write)` : ''}`)
