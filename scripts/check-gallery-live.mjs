// `npm run check:gallery:live` (D-324, docs/specs/gallery.md §7): the gallery's examples that act (press, drag,
// right-click or wait for something on the page), run in headless Chrome; any `[gallery]` warning (a step that found
// nothing: the 2026-11-03 wizards pressed `2` while their tabs read `02`) or an error on the page fails it.
// Slow (about three minutes), so not in the write hook or the commit check: by hand and in CI's own job.
// `npm run check:gallery:live -- table` runs only the examples whose file has `table` in its path.
// puppeteer-core is kept out of the repo (memory: visual checks), installed once in a cache of its own
// (CHECK_LIVE_CACHE, else ~/.cache/north-star/check-gallery-live); Chrome is the one on the machine (CHROME_PATH, else
// the usual places). Its own dev server on a free port, stopped at the end.
import { fileURLToPath } from 'node:url'
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync, mkdirSync } from 'node:fs'
import { createServer } from 'node:net'
import { homedir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ACTS = /\b(press|drag|rightClick|find)\(/
// How long a state gets to do what it does (its steps wait up to 2 s for what they look for) and how many at once.
const SETTLE_MS = 7000
const AT_ONCE = Number(process.env.CHECK_LIVE_AT_ONCE) || 4

const cache = process.env.CHECK_LIVE_CACHE || join(process.env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'north-star', 'check-gallery-live')
const lib = join(cache, 'node_modules', 'puppeteer-core')
if (!existsSync(lib)) {
  mkdirSync(cache, { recursive: true })
  console.log(`check:gallery:live: installing puppeteer-core in ${cache}`)
  execFileSync('npm', ['install', '--prefix', cache, '--no-save', '--no-audit', '--no-fund', '--silent', 'puppeteer-core@24'], { stdio: 'inherit' })
}
const { default: puppeteer } = await import(pathToFileURL(join(lib, 'lib', 'esm', 'puppeteer', 'puppeteer-core.js')).href)

const chrome =
  process.env.CHROME_PATH ||
  ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(existsSync)
if (!chrome) {
  console.error('check:gallery:live: no Chrome found; set CHROME_PATH')
  process.exit(2)
}

// The examples that act.
const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]))
const acting = new Set(
  walk(join(ROOT, 'src'))
    .filter((p) => p.endsWith('.gallery.tsx') && ACTS.test(readFileSync(p, 'utf8')))
    .map((p) => `/${relative(ROOT, p).split('\\').join('/')}`)
    .filter((p) => !process.argv[2] || p.includes(process.argv[2])),
)

const port = await new Promise((ok) => {
  const s = createServer().listen(0, () => {
    const { port } = s.address()
    s.close(() => ok(port))
  })
})
const server = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'], detached: true })
await new Promise((ok, no) => {
  server.stdout.on('data', (d) => String(d).includes('ready in') && ok())
  server.on('exit', (c) => no(new Error(`vite stopped (${c})`)))
})
const base = `http://localhost:${port}/gallery.html`

const problems = []
// Each worker its own browser with one tab: a tab behind another gets its frames paused and its timers slowed (the
// flags don't stop it in headless Chrome), and a state's steps then never run, saying nothing (seen 2026-11-03).
const launch = () => puppeteer.launch({ executablePath: chrome, headless: 'new', args: ['--no-sandbox'] })
const first = await launch()
const browsers = [first]
try {
  const index = await first.newPage()
  await index.goto(base, { waitUntil: 'load', timeout: 180000 })
  await index.waitForFunction(() => Array.isArray(window.__gallery), { timeout: 60000 })
  const entries = (await index.evaluate(() => window.__gallery)).filter((e) => acting.has(e.path))
  await index.close()
  const runs = entries.flatMap((e) => e.states.map((s) => ({ c: e.c, s, path: e.path })))
  const one = async (browser, { c, s, path }) => {
    const page = await browser.newPage()
    await page.setViewport({ width: 1400, height: 900 })
    const said = []
    page.on('console', (m) => m.text().includes('[gallery]') && said.push(m.text()))
    page.on('pageerror', (e) => said.push(`error: ${e.message}`))
    try {
      await page.goto(`${base}#c=${c}&s=${s}&theme=dark&motion=reduced&alone`, { waitUntil: 'load', timeout: 60000 })
      await new Promise((r) => setTimeout(r, SETTLE_MS))
    } catch (e) {
      said.push(`didn't load: ${e.message}`)
    }
    for (const w of said) problems.push(`${path.slice(1)} · ${s}: ${w}`)
    await page.close()
  }
  for (let i = 1; i < Math.min(AT_ONCE, runs.length); i++) browsers.push(await launch())
  const queue = [...runs]
  await Promise.all(browsers.map(async (b) => {
    for (let r = queue.shift(); r; r = queue.shift()) await one(b, r)
  }))
  console.log(`check:gallery:live: ${runs.length} states in ${entries.length} examples that act`)
} finally {
  await Promise.all(browsers.map((b) => b.close()))
  // The whole group: npx and the vite under it.
  process.kill(-server.pid)
}

if (problems.length) {
  console.error(`check:gallery:live: ${problems.length} problem${problems.length === 1 ? '' : 's'}\n` + problems.map((p) => `  - ${p}`).join('\n'))
  process.exit(1)
}
console.log('gallery live ok')
