// Repeats kept from coming back (D-391, docs/specs/shared-code.md R4.3, R4.4). Three things the other checks can't see,
// each held to scripts/repeats-baseline.json, which only shrinks:
//   names   an exported name declared in two files (`norm`, `clone`, `usageOf` got in this way): a new one is either the
//           same helper written twice (import the first) or two things under one name (rename one). Fast, so the write
//           hook and the commit check run it (`--names`).
//   copies  copy-pasted blocks (jscpd): a pair of files that shares more lines than the baseline says.
//   unused  files and exports nothing imports (knip): a new one is dead code, or an `export` nobody needs.
// copies and unused are slow (about half a minute): CI and by hand. Their tools are kept out of the repo, installed
// once in a cache of their own (CHECK_REPEATS_CACHE, else ~/.cache/north-star/check-repeats), as check-gallery-live's.
//   npm run check:repeats                    all three
//   npm run check:repeats -- --names         only the names (what the hook runs)
//   npm run check:repeats -- --list          print what's found, baseline or not
//   npm run check:repeats -- --write         lower the baseline to today's (never raises it)
//   npm run check:repeats -- --admit names   take today's names (or copies, unused) into the baseline, on purpose
import { fileURLToPath } from 'node:url'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const baselinePath = path.join(root, 'scripts/repeats-baseline.json')
const args = process.argv.slice(2)
const only = args.includes('--names') ? ['names'] : ['names', 'copies', 'unused']
const TOOLS = { jscpd: '4.3.0', knip: '5.88.1', typescript: '5.9.3' }

// The dev-only gallery, the demo realm, tests: their own helpers may share a name with the app's.
const apart = [/^src\/gallery\//, /^src\/demo\//, /\.gallery\.tsx$/, /\.test\.tsx?$/, /\.d\.ts$/]

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(e.name)) out.push(path.relative(root, p).split(path.sep).join('/'))
  }
  return out
}

// ---- names: { name: [files] } for every exported function, const or class declared in two files or more. A
// re-export (`export { x } from`) declares nothing and isn't counted.
function names() {
  const by = new Map()
  for (const f of walk(path.join(root, 'src')).filter((f) => !apart.some((r) => r.test(f)))) {
    const src = fs.readFileSync(path.join(root, f), 'utf8')
    for (const m of src.matchAll(/^export (?:async )?(?:function\*?|const|let|class) ([A-Za-z_$][\w$]*)/gm)) by.set(m[1], [...new Set([...(by.get(m[1]) ?? []), f])])
  }
  return Object.fromEntries([...by].filter(([, files]) => files.length > 1).sort(([a], [b]) => a.localeCompare(b)))
}

// ---- the tools, in their cache.
function tool(name) {
  const cache = process.env.CHECK_REPEATS_CACHE || path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'north-star', 'check-repeats')
  const want = Object.entries(TOOLS).map(([n, v]) => `${n}@${v}`)
  const stamp = path.join(cache, 'installed.txt')
  if (!fs.existsSync(stamp) || fs.readFileSync(stamp, 'utf8') !== want.join(' ')) {
    fs.mkdirSync(cache, { recursive: true })
    console.log(`check:repeats: installing ${want.join(', ')} in ${cache}`)
    execFileSync('npm', ['install', '--prefix', cache, '--no-save', '--no-audit', '--no-fund', '--silent', ...want], { stdio: 'inherit' })
    fs.writeFileSync(stamp, want.join(' '))
  }
  return path.join(cache, 'node_modules', '.bin', name)
}

// ---- copies: { "a <> b": lines } for every pair of files that shares a copied block (a file with itself too).
function copies() {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'repeats-'))
  const ignore = ['**/node_modules/**', '**/fixtures/**', '**/golden/**', 'evals/results/**', 'functions/lib/**', '**/*.gallery.tsx']
  spawnSync(
    tool('jscpd'),
    ['src', 'functions/src', 'scripts', 'evals', '--format', 'typescript,tsx,css,javascript', '--min-tokens', '50', '--min-lines', '6', '--ignore', ignore.join(','), '--reporters', 'json', '--output', out, '--silent'],
    { cwd: root, stdio: 'ignore' },
  )
  const file = path.join(out, 'jscpd-report.json')
  if (!fs.existsSync(file)) throw new Error('jscpd wrote no report')
  const report = JSON.parse(fs.readFileSync(file, 'utf8'))
  fs.rmSync(out, { recursive: true, force: true })
  const by = {}
  for (const d of report.duplicates) {
    const key = [d.firstFile.name, d.secondFile.name].sort().join(' <> ')
    by[key] = (by[key] ?? 0) + d.lines
  }
  return Object.fromEntries(Object.keys(by).sort().map((k) => [k, by[k]]))
}

// ---- unused: { files: [...], exports: { file: [names] } }.
function unused() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repeats-'))
  const config = path.join(dir, 'knip.json')
  fs.writeFileSync(
    config,
    JSON.stringify({
      // What starts something: the three pages, tests, the evals, the scripts; a gallery example is found by a glob.
      entry: ['index.html', 'demo.html', 'gallery.html', 'src/main.tsx', 'src/demo/main.tsx', 'src/demo/firebaseStub.ts', 'src/gallery/main.tsx', 'src/**/*.gallery.tsx', 'src/**/*.test.ts', 'tests/**/*.{ts,mjs}', 'evals/**/*.{ts,mjs}', 'scripts/*.mjs'],
      project: ['src/**/*.{ts,tsx}'],
      ignoreDependencies: ['.*'],
    }),
  )
  const r = spawnSync(tool('knip'), ['--config', config, '--include', 'files,exports', '--no-progress', '--reporter', 'json'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  fs.rmSync(dir, { recursive: true, force: true })
  const at = r.stdout.indexOf('{')
  if (at < 0) throw new Error(`knip gave no report:\n${r.stderr.slice(0, 2000)}`)
  const report = JSON.parse(r.stdout.slice(at))
  const exports = {}
  for (const i of report.issues) if (i.exports?.length) exports[i.file] = i.exports.map((e) => e.name).sort()
  return { files: [...report.files].sort(), exports: Object.fromEntries(Object.keys(exports).sort().map((k) => [k, exports[k]])) }
}

const FIND = { names, copies, unused }
const now = Object.fromEntries(only.map((k) => [k, FIND[k]()]))
const baseline = fs.existsSync(baselinePath) ? JSON.parse(fs.readFileSync(baselinePath, 'utf8')) : null
const save = (b) => fs.writeFileSync(baselinePath, JSON.stringify(b, null, 2) + '\n')

if (args.includes('--list')) console.log(JSON.stringify(now, null, 2))

// Today's, taken whole into the baseline for the parts named (a new rule's first day, or a repeat kept on purpose).
const admit = args.flatMap((a, i) => (a === '--admit' ? [args[i + 1]] : []))
if (admit.length) {
  const next = { ...(baseline ?? {}) }
  for (const k of admit) {
    if (!(k in FIND)) throw new Error(`--admit takes names, copies or unused, not ${k}`)
    next[k] = now[k] ?? FIND[k]()
  }
  save(next)
  console.log(`check:repeats: today's ${admit.join(', ')} taken into the baseline`)
  process.exit(0)
}

// What of `today` the baseline doesn't allow, and what the baseline allows that is gone (it can be lowered).
const both = (a = [], b = []) => a.filter((x) => b.includes(x))
function compare(kind, today, base = {}) {
  const over = []
  let under = 0
  if (kind === 'names') {
    for (const [name, files] of Object.entries(today)) {
      const fresh = files.filter((f) => !(base[name] ?? []).includes(f))
      // A name is new when it wasn't there, or when a file joined those that already had it.
      if (fresh.length && (!base[name] || fresh.length)) over.push(`${name}: also declared in ${fresh.join(', ')}${base[name] ? '' : ` (${files.filter((f) => !fresh.includes(f)).join(', ') || 'new today'})`}`)
    }
    for (const [name, files] of Object.entries(base)) if (both(files, today[name]).length < files.length) under++
  } else if (kind === 'copies') {
    for (const [pair, lines] of Object.entries(today)) if (lines > (base[pair] ?? 0)) over.push(`${pair}: ${lines} copied lines (baseline ${base[pair] ?? 0})`)
    for (const [pair, lines] of Object.entries(base)) if ((today[pair] ?? 0) < lines) under++
  } else {
    for (const f of today.files) if (!(base.files ?? []).includes(f)) over.push(`${f}: nothing imports this file`)
    for (const [f, list] of Object.entries(today.exports)) {
      const fresh = list.filter((n) => !(base.exports?.[f] ?? []).includes(n))
      if (fresh.length) over.push(`${f}: exported and used nowhere else: ${fresh.join(', ')}`)
    }
    under += (base.files ?? []).filter((f) => !today.files.includes(f)).length
    for (const [f, list] of Object.entries(base.exports ?? {})) if (both(list, today.exports[f]).length < list.length) under++
  }
  return { over, under }
}

// Never raises: each part is what's both in the baseline and there today (a part with no baseline yet is today's).
function lowered(kind, today, base) {
  if (!base) return today
  if (kind === 'names') return Object.fromEntries(Object.entries(base).flatMap(([n, files]) => (both(files, today[n]).length > 1 ? [[n, both(files, today[n])]] : [])))
  if (kind === 'copies') return Object.fromEntries(Object.entries(base).flatMap(([p, lines]) => (today[p] ? [[p, Math.min(lines, today[p])]] : [])))
  return {
    files: both(base.files, today.files),
    exports: Object.fromEntries(Object.entries(base.exports ?? {}).flatMap(([f, list]) => (both(list, today.exports[f]).length ? [[f, both(list, today.exports[f])]] : []))),
  }
}

if (args.includes('--write')) {
  const next = { ...(baseline ?? {}) }
  for (const k of only) next[k] = lowered(k, now[k], baseline?.[k])
  save(next)
  console.log(`check:repeats: baseline written (${only.join(', ')})`)
  process.exit(0)
}

if (!baseline) {
  console.error('check:repeats: no scripts/repeats-baseline.json yet (npm run check:repeats -- --write)')
  process.exit(1)
}

const HINT = {
  names: 'An exported name declared in a second file. The same helper: import the first one. Two different things: rename one. Meant: npm run check:repeats -- --admit names',
  copies: 'Copied blocks. Give the shared part one home and import it (docs/specs/shared-code.md). Meant: npm run check:repeats -- --admit copies',
  unused: 'Dead code. Delete the file, or drop the `export` (or the code) nothing else uses. Meant: npm run check:repeats -- --admit unused',
}
const said = []
let failed = false
for (const k of only) {
  const { over, under } = compare(k, now[k], baseline[k])
  if (over.length) {
    failed = true
    console.error(`check:repeats: ${k}: more than the baseline allows (D-391)\n  ${over.join('\n  ')}\n  ${HINT[k]}`)
  }
  const n = k === 'names' ? Object.keys(now[k]).length : k === 'copies' ? Object.values(now[k]).reduce((a, b) => a + b, 0) : now[k].files.length + Object.values(now[k].exports).reduce((a, l) => a + l.length, 0)
  said.push(`${k} ${n}${k === 'copies' ? ' lines' : ''}${under ? ` (${under} below the baseline)` : ''}`)
}
if (failed) process.exit(1)
console.log(`check:repeats: ${said.join(', ')}, all in the baseline${said.some((s) => s.includes('below')) ? ' (npm run check:repeats -- --write lowers it)' : ''}`)
