// Every value in the CSS is a token (D-325, docs/specs/tokens.md). Counts the raw values left in each CSS file under src/
// (tokens.css itself and the dev-only gallery left out) and fails when a file has more than scripts/tokens-baseline.json
// allows. As files are converted the baseline goes down; at 0 any raw value fails.
//   npm run check:tokens            check
//   npm run check:tokens -- --list  print every raw value, file by file
//   npm run check:tokens -- --write lower the baseline to today's counts (never raises it)
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const baselinePath = path.join(root, 'scripts/tokens-baseline.json')
const skip = [/^src\/styles\/tokens\.css$/, /^src\/gallery\//]

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (e.name.endsWith('.css')) out.push(path.relative(root, p))
  }
  return out
}

// What counts as raw. `0`, %, ch, em, vw/vh and unitless calc() multipliers are fine.
const RULES = [
  ['px', /(?<![\w.-])-?(?!0+(\.0+)?px)\d*\.?\d+px\b/g],
  ['time', /(?<![\w.-])\d*\.?\d+m?s\b/g],
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

function scan(file) {
  const src = fs.readFileSync(path.join(root, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
  const found = []
  const lines = src.split('\n')
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
const counts = {}
const all = {}
for (const f of files) {
  const found = scan(f)
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
