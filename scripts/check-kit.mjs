// The UI is built from the kit (D-326, docs/foundation-audit-2026-10-31.md): outside src/ui, counts what the kit already
// is (a raw <button>, <input>, <textarea>, an own role="dialog" or portal; in CSS a bracket drawn by hand, a caps label
// declared by hand, the old `small`/`button` composes) and fails when a file has more than scripts/kit-baseline.json
// allows. The baseline only shrinks: moving an area onto the kit lowers it (`--write`). A line that truly needs its own
// says why with `// kit-ok: why` (TSX) or `/* kit-ok: why */` (CSS). `--admit <rule>` takes today's hits of a rule that's
// new into the baseline once (the rule then only stops new ones).
//   npm run check:kit            check
//   npm run check:kit -- --list  print every hit, file by file
//   npm run check:kit -- --write lower the baseline to today's counts (never raises it)
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const baselinePath = path.join(root, 'scripts/kit-baseline.json')
// The kit itself, the dev-only gallery and the demo realm's stage, tests.
const skip = [/^src\/ui\//, /^src\/gallery\//, /^src\/demo\//, /\.gallery\.tsx$/, /\.test\.tsx?$/]

const RULES = {
  tsx: [
    ['button', /<button\b/g],
    ['input', /<input\b/g],
    ['textarea', /<textarea\b/g],
    ['dialog', /role="dialog"/g],
    ['portal', /createPortal\(/g],
    // D-338's round: a menu hosted by hand (the kit's ContextMenu, Menu or InPlaceMenu hosts PromptPanel), a `[verb]`'s brackets drawn
    // in spans (Button, or Button `look` inside a target), a text cap typed as a number (model/limits.ts).
    ['menuHost', /<(?:MenuPanel|PromptPanel)\b/g],
    ['bracketSpan', /<span[^>]*>\s*[[\]]\s*<\/span>/g],
    ['rawLimit', /maxLength=\{\d+\}/g],
  ],
  css: [
    ['bracket', /content:\s*['"][[\]]['"]/g],
    ['caps', /text-transform:\s*uppercase/g],
    ['small', /composes:\s*\w+\s+from\s+['"][^'"]*Button\.module\.css['"]/g],
    // D-338's round: numbers made by a CSS counter (the kit's Num), a piece's graphite drawn by hand (PieceCard).
    ['counter', /counter-increment\s*:/g],
    ['pieceSurface', /background:\s*var\(--piece\)\s*;/g],
  ],
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(tsx|module\.css)$/.test(e.name)) out.push(path.relative(root, p).split(path.sep).join('/'))
  }
  return out
}

function count(file) {
  const kind = file.endsWith('.css') ? 'css' : 'tsx'
  const lines = fs.readFileSync(path.join(root, file), 'utf8').split('\n')
  const hits = []
  lines.forEach((line, i) => {
    if (/kit-ok/.test(line)) return
    for (const [name, re] of RULES[kind]) for (const _ of line.matchAll(re)) hits.push({ name, line: i + 1, text: line.trim() })
  })
  return hits
}

const files = walk(path.join(root, 'src')).filter((f) => !skip.some((r) => r.test(f)))
const now = {}
const all = {}
for (const f of files) {
  const hits = count(f)
  if (!hits.length) continue
  all[f] = hits
  now[f] = hits.reduce((m, h) => ((m[h.name] = (m[h.name] ?? 0) + 1), m), {})
}

const args = process.argv.slice(2)
const baseline = fs.existsSync(baselinePath) ? JSON.parse(fs.readFileSync(baselinePath, 'utf8')) : null

if (args.includes('--list')) {
  for (const [f, hits] of Object.entries(all)) {
    console.log(f)
    for (const h of hits) console.log(`  ${h.line} ${h.name}: ${h.text.slice(0, 110)}`)
  }
}

// A rule just added: today's hits of it go into the baseline, once, so it stops only new ones (`--admit menuHost`).
const admit = args.flatMap((a, i) => (a === '--admit' ? [args[i + 1]] : []))
if (admit.length && baseline) {
  for (const [f, c] of Object.entries(now))
    for (const k of admit) if (c[k] && !baseline[f]?.[k]) (baseline[f] ??= {})[k] = c[k]
  const sorted = Object.fromEntries(Object.keys(baseline).sort().map((k) => [k, baseline[k]]))
  fs.writeFileSync(baselinePath, JSON.stringify(sorted, null, 2) + '\n')
  console.log(`check:kit: admitted today's ${admit.join(', ')} into the baseline`)
  process.exit(0)
}

if (args.includes('--write')) {
  // Never raises: a file's count is today's or its baseline's, whichever is lower; a file not in the baseline is taken
  // as it is only when there is no baseline yet.
  const next = {}
  for (const [f, c] of Object.entries(now)) {
    const was = baseline?.[f]
    if (baseline && !was) continue
    const kinds = {}
    for (const [k, n] of Object.entries(c)) {
      const m = was ? Math.min(n, was[k] ?? 0) : n
      if (m) kinds[k] = m
    }
    if (Object.keys(kinds).length) next[f] = kinds
  }
  const sorted = Object.fromEntries(Object.keys(next).sort().map((k) => [k, next[k]]))
  fs.writeFileSync(baselinePath, JSON.stringify(sorted, null, 2) + '\n')
  const total = Object.values(sorted).reduce((s, c) => s + Object.values(c).reduce((a, b) => a + b, 0), 0)
  console.log(`check:kit: baseline written, ${total} hand-made in ${Object.keys(sorted).length} files`)
  process.exit(0)
}

if (!baseline) {
  console.error('check:kit: no scripts/kit-baseline.json yet (npm run check:kit -- --write)')
  process.exit(1)
}

const over = []
const under = []
for (const [f, c] of Object.entries(now))
  for (const [k, n] of Object.entries(c)) {
    const allowed = baseline[f]?.[k] ?? 0
    if (n > allowed) over.push(`${f}: ${k} ${n} (baseline ${allowed})`)
  }
for (const [f, c] of Object.entries(baseline))
  for (const [k, n] of Object.entries(c)) if ((now[f]?.[k] ?? 0) < n) under.push(`${f}: ${k} ${now[f]?.[k] ?? 0} (baseline ${n})`)

const total = Object.values(now).reduce((s, c) => s + Object.values(c).reduce((a, b) => a + b, 0), 0)
if (over.length) {
  console.error(`check:kit: more hand-made UI than the baseline allows (use the kit in src/ui, D-326; or say why with kit-ok):\n  ${over.join('\n  ')}`)
  process.exit(1)
}
console.log(`check:kit: ${total} hand-made left in ${Object.keys(now).length} files${under.length ? ` (${under.length} below the baseline: npm run check:kit -- --write)` : ''}`)
