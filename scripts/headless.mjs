// What the checks that run in headless Chrome share (D-401; check-gallery-live had it inline): puppeteer-core kept out of
// the repo (memory: visual checks) in a cache of its own (CHECK_LIVE_CACHE, else ~/.cache/north-star/check-gallery-live),
// the Chrome on the machine (CHROME_PATH, else the usual places), and a dev server of their own on a free port.
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { createServer } from 'node:net'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { root } from './lib.mjs'

// `who`: the check asking, for what it prints.
export async function headless(who) {
  const cache = process.env.CHECK_LIVE_CACHE || join(process.env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'north-star', 'check-gallery-live')
  const lib = join(cache, 'node_modules', 'puppeteer-core')
  if (!existsSync(lib)) {
    mkdirSync(cache, { recursive: true })
    console.log(`${who}: installing puppeteer-core in ${cache}`)
    execFileSync('npm', ['install', '--prefix', cache, '--no-save', '--no-audit', '--no-fund', '--silent', 'puppeteer-core@24'], { stdio: 'inherit' })
  }
  const { default: puppeteer } = await import(pathToFileURL(join(lib, 'lib', 'esm', 'puppeteer', 'puppeteer-core.js')).href)
  const chrome =
    process.env.CHROME_PATH ||
    ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(existsSync)
  if (!chrome) {
    console.error(`${who}: no Chrome found; set CHROME_PATH`)
    process.exit(2)
  }
  // Each launch its own browser: a tab behind another gets its frames paused and its timers slowed (the flags don't
  // stop it in headless Chrome), and what runs in it then never does, saying nothing (seen 2026-11-03).
  const launch = () => puppeteer.launch({ executablePath: chrome, headless: 'new', args: ['--no-sandbox'] })
  return { launch }
}

// A dev server on a free port; `stop` ends it (the whole group: npx and the vite under it).
export async function devServer() {
  const port = await new Promise((ok) => {
    const s = createServer().listen(0, () => {
      const { port } = s.address()
      s.close(() => ok(port))
    })
  })
  const server = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'], detached: true })
  await new Promise((ok, no) => {
    server.stdout.on('data', (d) => String(d).includes('ready in') && ok())
    server.on('exit', (c) => no(new Error(`vite stopped (${c})`)))
  })
  return { url: `http://localhost:${port}`, stop: () => process.kill(-server.pid) }
}
