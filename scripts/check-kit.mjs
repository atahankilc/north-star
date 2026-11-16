// The UI is built from the kit (D-326, docs/foundation-audit-2026-10-31.md): outside src/ui, counts what the kit already
// is (a raw <button>, <input>, <textarea>, an own role="dialog" or portal; in CSS a bracket drawn by hand, a caps label
// declared by hand, the old `small`/`button` composes) and fails when a file has more than scripts/kit-baseline.json
// allows. The baseline only shrinks: moving an area onto the kit lowers it (`--write`). A line that truly needs its own
// says why with `// kit-ok: why` (TSX) or `/* kit-ok: why */` (CSS). `--admit <rule>` takes today's hits of a rule that's
// new into the baseline once (the rule then only stops new ones).
// Behaviour too (D-391, docs/specs/shared-code.md R4.1), the `code` rules: what has one shared home and got written
// again by hand: a key or pointer listener on the window (ui/foundation: useEscapeLayer, useDismiss, dragPointer,
// pressDrag, panPointer, keysTaken), a frame loop (motion.ts' tween), localStorage (state/local.ts), a text or list cut
// at a typed number in model/, ops/ or data/ (model/limits.ts), a raw <button>/<input>/<textarea> inside the kit's
// patterns (its primitives). They look in .ts too, and inside src/ui. Today's are in the baseline and counted apart.
//   npm run check:kit            check
//   npm run check:kit -- --list  print every hit, file by file
//   npm run check:kit -- --write lower the baseline to today's counts (never raises it)
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
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
    // D-358: a card's colour under its old second name (CARD_TONE, ui/foundation/cardTone.ts).
    ['typeAccent', /\bTYPE_ACCENT\b/g],
  ],
  css: [
    ['bracket', /content:\s*['"][[\]]['"]/g],
    ['caps', /text-transform:\s*uppercase/g],
    ['small', /composes:\s*\w+\s+from\s+['"][^'"]*Button\.module\.css['"]/g],
    // D-338's round: numbers made by a CSS counter (the kit's Num), a piece's graphite drawn by hand (PieceCard).
    ['counter', /counter-increment\s*:/g],
    ['pieceSurface', /background:\s*var\(--piece\)\s*;/g],
    // D-358: a card's face or edge drawn by hand (its type's tint, its colour down the left): CardFace, CardRow in
    // src/views/workspace/cards/, where they're allowed.
    ['cardFace', /var\(--card-tint\)/g, /^src\/views\/workspace\/cards\//],
    ['cardEdge', /inset var\(--(?:w-card-edge|line-w-bold)\) 0 0 var\(--(?:type|tone)\b/g, /^src\/views\/workspace\/cards\//],
    // D-377: a scroll bar styled by hand (global.css draws them all, from the --scroll-* tokens): in Chrome it silently
    // brings the system's bar back on that element. The kit too: see `everywhere`.
    ['scrollbar', /::-webkit-scrollbar|scrollbar-(?:width|color)\s*:/g],
    // D-384: "on" written again (the line under a pressed control): it's written once, in Button.module.css, and everything
    // that can be on composes it. InlineEdit's line is a field's underline, not a state. The kit too: see `everywhere`.
    ['onLook', /inset 0 calc\(-1 \* var\(--line-w\)\) 0 var\(--(?:accent|button-on)/g, /^src\/ui\/primitives\/InlineEdit\.module\.css$/],
    // D-387: a corner L drawn by hand. A surface is round with a line; what's selected has Marks; only a console on a
    // piece (square, as its piece) keeps its own L's. The kit too: see `everywhere`.
    ['cornerMark', /var\(--corner-mark\)/g, /^src\/ui\/patterns\/Console\.module\.css$/],
  ],
}

// Behaviour written by hand (D-391): [name, pattern, where it's at home (exempt), where it looks (unset: all of src)].
// A comment line is never counted.
RULES.code = [
  ['windowKeys', /\b(?:window|document)\.addEventListener\(\s*['"](?:key|pointer|mouse|wheel|click|contextmenu)/g, /^src\/ui\/foundation\//],
  // A loop: the frame's own function handed back to requestAnimationFrame (a one-off passes an arrow). The backdrop's
  // clock (src/three) is its own.
  ['rafLoop', /requestAnimationFrame\(\s*[A-Za-z_$][\w$.]*\s*\)/g, /^src\/(?:ui\/foundation|three)\//],
  ['storage', /\blocalStorage\./g, /^src\/state\/local\.ts$/],
  ['rawCut', /\.slice\(0,\s*\d{2,}\)|\.length\s*(?:>=?|<=?)\s*\d{2,}/g, /^src\/model\/limits\.ts$/, /^src\/(?:model|ops|data)\//],
  // The raw element's homes are the primitives that are it.
  ['kitRaw', /<(?:button|input|textarea)\b/g, /^src\/ui\/primitives\/(?:Button|ToolButton|Checkbox|Chip|Field|Tabs)\.tsx$/, /^src\/ui\//],
]
const HINT = {
  windowKeys: 'a key or pointer listener on the window: use ui/foundation (useEscapeLayer, useDismiss, pressDrag, dragPointer, panPointer, keysTaken)',
  rafLoop: "a frame loop by hand: use ui/foundation/motion.ts' tween()",
  storage: 'localStorage by hand: use state/local.ts (readLocal, readLocalJson, keepLocal)',
  rawCut: 'a cut at a typed number: name it in model/limits.ts and import it',
  kitRaw: 'a raw element inside the kit: build the pattern from the primitives (Button, Field, Checkbox…)',
}
const isCode = (name) => name in HINT
// Where the code rules never look: the dev-only gallery, the demo realm's stage, tests.
const codeSkip = [/^src\/gallery\//, /^src\/demo\//, /\.gallery\.tsx$/, /\.test\.tsx?$/, /\.d\.ts$/]

// Rules that hold inside the kit as well, where the others don't look.
const everywhere = new Set(['scrollbar', 'onLook', 'cornerMark'])

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(tsx?|module\.css)$/.test(e.name)) out.push(path.relative(root, p).split(path.sep).join('/'))
  }
  return out
}

const skipped = (file) => skip.some((r) => r.test(file))

function count(file) {
  const kinds = file.endsWith('.css') ? ['css'] : file.endsWith('.tsx') ? ['tsx', 'code'] : ['code']
  const lines = fs.readFileSync(path.join(root, file), 'utf8').split('\n')
  const hits = []
  lines.forEach((line, i) => {
    if (/kit-ok/.test(line)) return
    for (const kind of kinds)
      for (const [name, re, home, scope] of RULES[kind]) {
        if (home?.test(file)) continue
        if (kind === 'code') {
          if (codeSkip.some((r) => r.test(file)) || (scope && !scope.test(file)) || /^\s*(?:\/\/|\*|\/\*)/.test(line)) continue
        } else if (skipped(file) && !everywhere.has(name)) continue
        for (const _ of line.matchAll(re)) hits.push({ name, line: i + 1, text: line.trim() })
      }
  })
  return hits
}

const files = walk(path.join(root, 'src'))
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

// Hand-made UI and behaviour by hand are counted apart: the first is at 0 and stays there.
const sum = (pick) => {
  let n = 0
  const files = new Set()
  for (const [f, c] of Object.entries(now)) for (const [k, v] of Object.entries(c)) if (pick(k)) ((n += v), files.add(f))
  return [n, files.size]
}
const [ui, uiFiles] = sum((k) => !isCode(k))
const [code, codeFiles] = sum(isCode)
if (over.length) {
  const hints = [...new Set(over.map((o) => o.split(': ')[1].split(' ')[0]).filter(isCode))].map((k) => `  ${k}: ${HINT[k]}`)
  console.error(
    `check:kit: more by hand than the baseline allows (use the kit in src/ui, D-326, or the shared code, D-391; or say why with kit-ok):\n  ${over.join('\n  ')}` +
      (hints.length ? `\n${hints.join('\n')}` : ''),
  )
  process.exit(1)
}
console.log(
  `check:kit: ${ui} hand-made left in ${uiFiles} files; behaviour by hand: ${code} in ${codeFiles} files (in the baseline, only shrinks)` +
    (under.length ? ` (${under.length} below the baseline: npm run check:kit -- --write)` : ''),
)
