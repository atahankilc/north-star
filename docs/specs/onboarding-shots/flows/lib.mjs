// Shared helpers for the onboarding's end-to-end flows (D-315, docs/specs/onboarding.md §8.6, onboarding-run.md O16).
// Headless Chrome via puppeteer-core against `npm run dev:emu` on the emulators. Nothing here is part of the app.
//
// Environment:
//   PUPPETEER_CORE  a puppeteer-core folder (npm i puppeteer-core@24 in a scratch folder, never in the repo). Required.
//   CHROME          the browser (default: macOS Chrome).
//   BASE            the dev server (default http://localhost:5244; started with `npm run dev:emu -- --port 5244`).
//   FS_PORT         the Firestore emulator the browsers and the seed talk to (default 8080). Another port: every
//                   browser request to :8080 is redirected there (when the shared emulator stops answering listens).
//   SHOTS           where shots go (default: docs/specs/onboarding-shots/). NO_SHOTS=1 takes none.
//   STEP_SHOTS      0 to skip the full-screen shot of every step (default on; saved resized to 1568 px wide via `sips`).
//
// Every flow prints `ok`/`FAIL` lines and a SUMMARY, and exits 1 on any FAIL. Each page gets a watcher (`watch`) that
// samples the coach every 50 ms and records: two coach surfaces at once, a lesson or nudge opening during a drag or the
// focus ink, a lesson covering its anchor (rects), and every surface that showed, in order.
import { existsSync, mkdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
if (!process.env.PUPPETEER_CORE) {
  console.error('flows: set PUPPETEER_CORE to a puppeteer-core folder (npm i puppeteer-core@24 somewhere else; not in the repo)')
  process.exit(2)
}
const entry = existsSync(join(process.env.PUPPETEER_CORE, 'lib/esm/puppeteer/puppeteer-core.js')) ? join(process.env.PUPPETEER_CORE, 'lib/esm/puppeteer/puppeteer-core.js') : process.env.PUPPETEER_CORE
const { default: puppeteer } = await import(pathToFileURL(entry).href)

export const BASE = (process.env.BASE ?? 'http://localhost:5244').replace(/\/$/, '')
export const FS_PORT = Number(process.env.FS_PORT ?? 8080)
export const SHOTS = resolve(process.env.SHOTS ?? join(here, '..'))
export const W = 1568
export const H = 980
mkdirSync(SHOTS, { recursive: true })
export const wait = (ms) => new Promise((r) => setTimeout(r, ms))
export const log = (...a) => console.log(...a)

// Results: ok/FAIL lines, a summary at the end.
export function results(name) {
  const fails = []
  const notes = []
  let oks = 0
  return {
    expect(ok, what) {
      if (ok) { oks++; log('  ok  ', what) } else { fails.push(what); log('  FAIL', what) }
      return ok
    },
    note(what) { notes.push(what); log('  note', what) },
    fails,
    summary() {
      log(`SUMMARY ${name}: ${oks} ok, ${fails.length} failed${notes.length ? `, ${notes.length} notes` : ''}`)
      for (const f of fails) log('  - FAIL', f)
      for (const n of notes) log('  - note', n)
      return fails.length
    },
  }
}

export async function launch() {
  return puppeteer.launch({
    executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    defaultViewport: { width: W, height: H, deviceScaleFactor: 2 },
  })
}

// A page in a context of its own (its own sign-in), in a theme, with the HMR socket quieted (other sessions edit the
// tree: a reload would cut a flow mid-way), and the Firestore port redirected if FS_PORT isn't 8080.
export async function page(b, theme = 'dark', { block, stub } = {}) {
  const ctx = await b.createBrowserContext()
  const p = await ctx.newPage()
  if (FS_PORT !== 8080 || block || stub) {
    await p.setRequestInterception(true)
    p.on('request', (r) => {
      const u = r.url()
      if (block && block.test(u)) return r.abort()
      if (stub && stub.re.test(u)) return r.respond({ status: 200, contentType: 'application/javascript', body: stub.body })
      if (FS_PORT !== 8080 && /\/\/(127\.0\.0\.1|localhost):8080\//.test(u)) r.continue({ url: u.replace(/:8080\//, `:${FS_PORT}/`) })
      else r.continue()
    })
  }
  p.errors = []
  p.on('pageerror', (e) => { p.errors.push(e.message.slice(0, 200)); log('  pageerror', e.message.slice(0, 200)) })
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED/.test(m.text())) { p.errors.push(m.text().slice(0, 200)); log('  console.error', m.text().slice(0, 200)) } })
  await p.evaluateOnNewDocument((t) => { try { localStorage.setItem('north-star.theme', t) } catch {} }, theme)
  await p.evaluateOnNewDocument(() => {
    const Real = window.WebSocket
    window.WebSocket = function (url, proto) {
      if (String(proto ?? '').includes('vite-hmr')) {
        return { readyState: 1, send() {}, close() {}, addEventListener(t, f) { if (t === 'open') setTimeout(() => f({}), 0) }, removeEventListener() {} }
      }
      return new Real(url, proto)
    }
    window.WebSocket.prototype = Real.prototype
    Object.assign(window.WebSocket, { OPEN: 1, CLOSED: 3, CONNECTING: 0, CLOSING: 2 })
  })
  // The app's own copy of a module: the dev server gives a module edited since it started a new URL (`?t=…`), and the
  // app imports that one; a plain import('/src/…') here would get a second copy with empty stores. The newest URL the
  // page fetched for the path is the app's.
  await p.evaluateOnNewDocument(() => {
    performance.setResourceTimingBufferSize(100000)
    window.__mod = (path) => {
      const seen = performance.getEntriesByType('resource').map((r) => r.name).filter((n) => new URL(n).pathname === path)
      return import(seen.at(-1) ?? path)
    }
  })
  p.theme = theme
  return p
}

export async function signIn(p, name) {
  await p.goto(BASE + '/')
  await p.waitForFunction(() => document.readyState === 'complete')
  await p.evaluate(async (n) => { const a = await window.__mod('/src/data/auth.ts'); await a.signInAsTestUser(n) }, name)
  await wait(800)
  return p.evaluate(async () => (await window.__mod('/src/data/firebase.ts')).firebase.auth.currentUser?.uid)
}

export async function revealed(p) {
  await p.waitForFunction(() => window.__curtain?.getState().revealed, { timeout: 120000 })
  await wait(900)
}

export const waitFor = async (fn, ms = 10000, every = 150) => {
  const s = Date.now()
  while (Date.now() - s < ms) { if (await fn()) return true; await wait(every) }
  return false
}

// ── The watcher ─────────────────────────────────────────────────────────────────────────────────────────────────────
// Installed into the page (again after each navigation: `watch(p)` is idempotent per document).
export async function watch(p) {
  await p.evaluate(async () => {
    if (window.__o16) return
    const o = (window.__o16 = { lastAnchor: {}, events: [], twos: [], busyOpens: [], covers: [], blips: [], overSince: {}, seenLabels: new Set(), last: '', started: performance.now() })
    const busyM = await window.__mod('/src/onboarding/busy.ts')
    const L = await window.__mod('/src/onboarding/lessons.ts')
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const plain = (s) => s.replace(/`/g, '')
    const titles = []
    for (const l of L.LESSONS) for (const pg of l.pages ?? []) titles.push({ re: new RegExp('^' + esc(plain(pg.title)).replace(/\\\{(owner|peer|piece)\\\}/g, '.+') + '$'), id: l.id, anchor: l.anchor })
    o.idOf = (label) => titles.find((t) => t.re.test(label.replace(/^lesson: /, '')))
    let down = null
    let dragging = false
    addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; dragging = false }, true)
    addEventListener('pointermove', (e) => { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) dragging = true }, true)
    addEventListener('pointerup', () => { down = null; setTimeout(() => (dragging = false), 0) }, true)
    const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight }
    const ov = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
    const R = (r) => [r.left, r.top, r.width, r.height].map(Math.round)
    o.surfaces = () => {
      const out = []
      for (const e of document.querySelectorAll('section[data-coach][aria-label^="lesson:"]:not([data-played])')) if (!e.hasAttribute('data-aside') && vis(e)) out.push({ kind: e.hasAttribute('data-done') ? 'lesson-done' : 'lesson', label: e.getAttribute('aria-label'), el: e })
      for (const e of document.querySelectorAll('section[data-played]')) out.push({ kind: 'played', label: e.getAttribute('aria-label'), el: e })
      const wt = document.getElementById('coach-welcome-title')
      if (wt) out.push({ kind: 'welcome', label: 'welcome: ' + wt.textContent, el: wt.closest('[role=dialog]') ?? wt })
      const nt = document.getElementById('coach-news-title')
      if (nt) out.push({ kind: 'news', label: "what's new: " + nt.textContent, el: nt.closest('[role=dialog]') ?? nt })
      const g = document.querySelector('[role="dialog"][aria-label^="Guide"]')
      if (g) out.push({ kind: 'guide', label: 'guide', el: g })
      for (const e of document.querySelectorAll('[data-coach][role="status"]')) if (vis(e)) out.push({ kind: 'nudge', label: 'nudge: ' + e.textContent.trim().slice(0, 60), el: e })
      for (const e of document.querySelectorAll('[class*="glued"]')) if (vis(e)) out.push({ kind: 'kind-guide', label: 'kind guide', el: e, beside: true })
      for (const e of document.querySelectorAll('[data-coach][role="note"]')) if (vis(e)) out.push({ kind: 'empty', label: 'empty: ' + e.textContent.trim().slice(0, 50), el: e, beside: true })
      for (const e of document.querySelectorAll('ul[data-coach][aria-label="ways to start"]')) if (vis(e)) out.push({ kind: 'choices', label: 'ways to start', el: e, beside: true })
      return out
    }
    const tick = () => {
      let s
      try { s = o.surfaces() } catch { return }
      const now = Math.round(performance.now() - o.started)
      // A surface's name: its kind and its lesson's id (titles decode letter by letter as they build).
      const nameOf = (x) => (x.kind === 'lesson' || x.kind === 'lesson-done' || x.kind === 'played' ? `${x.kind}:${o.idOf(x.label)?.id ?? x.label}` : x.kind === 'nudge' || x.kind === 'empty' ? x.label : x.kind)
      const names = [...new Set(s.map(nameOf))]
      const key = names.join(' | ')
      if (key !== o.last) { o.events.push({ t: now, surfaces: names }); o.last = key }
      const queue = [...new Set(s.filter((x) => !x.beside).map(nameOf))]
      if (queue.length > 1) {
        const k = queue.join(' + ')
        if (!o.twos.some((x) => x.k === k)) o.twos.push({ t: now, k })
      }
      let busy = {}
      try { busy = busyM.readBusy() } catch {}
      for (const x of s) {
        if (x.kind !== 'lesson' && x.kind !== 'nudge') continue
        if (!o.seenLabels.has(x.label)) {
          o.seenLabels.add(x.label)
          if (dragging || busy.focusMoving) o.busyOpens.push({ t: now, label: x.label, dragging, focusMoving: !!busy.focusMoving })
        }
        if (x.kind !== 'lesson') continue
        const info = o.idOf(x.label)
        if (!info?.anchor) continue
        const lr = x.el.getBoundingClientRect()
        const anchors = [...document.querySelectorAll(`[data-learn="${info.anchor}"]`)].filter((e) => !e.closest('[data-coach]') && vis(e))
        if (!anchors.length) continue
        // Its anchor's last rect while drawn (a lingering lesson's menu, once closed, is checked against where it was).
        o.lastAnchor[info.anchor] = R(anchors.sort((a, b) => (a.closest('[data-editing]') ? -1 : 0) - (b.closest('[data-editing]') ? -1 : 0))[0].getBoundingClientRect())
        const c = { x: lr.left + lr.width / 2, y: lr.top + lr.height / 2 }
        const dist = (e) => { const r = e.getBoundingClientRect(); const dx = Math.max(r.left - c.x, 0, c.x - r.right); const dy = Math.max(r.top - c.y, 0, c.y - r.bottom); return Math.hypot(dx, dy) }
        // The anchor the card points at: the one its lead line's tip touches; else the nearest to the card.
        const tip = [...document.querySelectorAll('div[class*="lead"][aria-hidden]')].map((e) => e.nextElementSibling).find((e) => e && /tip/.test(e.className))
        const tr = tip?.getBoundingClientRect()
        const tdist = (e) => { const r = e.getBoundingClientRect(); const x = tr.left + tr.width / 2, y = tr.top + tr.height / 2; return Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom)) }
        // No lead: a piece being made (in edit mode) is what a piece lesson is about; else the nearest.
        const ed = (e) => (e.closest('[data-editing]') || e.matches('[data-editing]') ? 0 : 1)
        const near = anchors.sort((a, b) => (tr ? tdist(a) - tdist(b) || dist(a) - dist(b) : ed(a) - ed(b) || dist(a) - dist(b)))[0]
        const nr = near.getBoundingClientRect()
        const over = ov(lr, nr)
        // Covering for 300 ms or more is a cover; shorter (a card placed again as its anchor moves in) a blip.
        const k = x.label
        if (over > 0) {
          o.overSince[k] ??= now
          const rec = { t: now, label: x.label, id: info.id, anchor: info.anchor, over: Math.round(over), lesson: R(lr), anchorRect: R(nr), anchors: anchors.length }
          if (now - o.overSince[k] >= 300) { if (!o.covers.some((y) => y.label === k)) o.covers.push({ ...rec, since: o.overSince[k] }) }
          else if (!o.blips.some((y) => y.label === k)) o.blips.push(rec)
        } else delete o.overSince[k]
      }
    }
    o.timer = setInterval(tick, 50)
    o.report = () => ({ events: o.events, twos: o.twos, busyOpens: o.busyOpens, covers: o.covers, blips: o.blips })
  })
}
// What the watcher saw since the last call (and resets it): for the flow's asserts.
export async function watched(p) {
  return p.evaluate(() => { const o = window.__o16; if (!o) return null; const r = JSON.parse(JSON.stringify(o.report())); o.events = []; o.twos = []; o.busyOpens = []; o.covers = []; o.blips = []; return r })
}
// Collected across pages and navigations.
export function collector() {
  const all = { events: [], twos: [], busyOpens: [], covers: [], blips: [] }
  return {
    all,
    async take(p, where = '') {
      const r = await watched(p).catch(() => null)
      if (!r) return
      for (const k of Object.keys(all)) all[k].push(...r[k].map((x) => ({ ...x, where })))
    },
  }
}

// ── The coach, read ────────────────────────────────────────────────────────────────────────────────────────────────
export const lessonsUp = (p) => p.evaluate(() => [...document.querySelectorAll('section[data-coach][aria-label^="lesson:"]:not([data-played])')].filter((e) => !e.hasAttribute('data-aside') && getComputedStyle(e).visibility !== 'hidden').map((e) => ({ label: e.getAttribute('aria-label'), done: e.hasAttribute('data-done'), id: window.__o16?.idOf(e.getAttribute('aria-label'))?.id ?? null })))
export const surfaces = (p) => p.evaluate(() => (window.__o16 ? window.__o16.surfaces().map((s) => s.kind + ':' + s.label) : []))
export const progress = (p) => p.evaluate(async () => { const s = (await window.__mod('/src/onboarding/progress.ts')).useProgress.getState(); return { loaded: s.loaded, seen: s.seen, armed: s.armed, tipsOff: s.tipsOff, welcome: s.welcome, lastRelease: s.lastRelease, audience: s.state?.audience ?? null } })
export const activeDesc = (p) => p.evaluate(() => { const a = document.activeElement; if (!a || a === document.body) return 'body'; return `${a.tagName.toLowerCase()}${a.id ? '#' + a.id : ''}${a.getAttribute('aria-label') ? `[${a.getAttribute('aria-label')}]` : ''}${a.dataset?.learn ? `{${a.dataset.learn}}` : ''}` })

// The lesson with id `id` showing (not done): any other lesson that shows on the way is logged and closed with `esc`
// (or ×). Returns its label or null.
export async function until(p, id, ms = 15000, { closeOthers = true, onOther } = {}) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    const up = (await lessonsUp(p).catch(() => [])).filter((l) => !l.done)
    const mine = up.find((l) => l.id === id)
    if (mine) { await wait(900); return mine.label }
    if (up.length && closeOthers) { log(`    (closing "${up[0].label}" [${up[0].id}] on the way to ${id})`); if (onOther) await onOther(up[0]); await closeLesson(p); continue }
    await wait(150)
  }
  log(`    !! ${id} did not show`)
  return null
}
// Close the showing lesson with its ×; returns whether there was one.
export async function closeLesson(p) {
  const x = await p.$('section[data-coach][aria-label^="lesson:"]:not([data-played]):not([data-aside]):not([data-done]) button[aria-label*="lose"]')
  if (x) { await x.click().catch(() => {}); await wait(1600); return true }
  return false
}
// Let what's queued come and close it, for `ms`.
export async function settle(p, ms = 4000, { onOther } = {}) {
  const t0 = Date.now()
  const closed = []
  while (Date.now() - t0 < ms) {
    const up = (await lessonsUp(p).catch(() => [])).filter((l) => !l.done)
    if (up.length) { closed.push(up[0].id ?? up[0].label); if (onOther) await onOther(up[0]); await closeLesson(p) } else await wait(250)
  }
  if (closed.length) log(`    (settled: closed ${closed.join(', ')})`)
  return closed
}

// The lesson's rect, its anchor's (the nearest visible), their overlap, its demo.
export async function lessonGeom(p, id) {
  return p.evaluate((id) => {
    const l = [...document.querySelectorAll('section[data-coach][aria-label^="lesson:"]:not([data-played]):not([data-aside])')].find((e) => window.__o16.idOf(e.getAttribute('aria-label'))?.id === id)
    if (!l) return null
    const info = window.__o16.idOf(l.getAttribute('aria-label'))
    const lr = l.getBoundingClientRect()
    const R = (r) => ({ x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) })
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[data-coach]') }
    const c = { x: lr.left + lr.width / 2, y: lr.top + lr.height / 2 }
    const dist = (e) => { const r = e.getBoundingClientRect(); return Math.hypot(Math.max(r.left - c.x, 0, c.x - r.right), Math.max(r.top - c.y, 0, c.y - r.bottom)) }
    const tip = [...document.querySelectorAll('div[class*="lead"][aria-hidden]')].map((e) => e.nextElementSibling).find((e) => e && /tip/.test(e.className))
    const tr = tip?.getBoundingClientRect()
    const tdist = (e) => { const r = e.getBoundingClientRect(); const x = tr.left + tr.width / 2, y = tr.top + tr.height / 2; return Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom)) }
    const ed = (e) => (e.closest('[data-editing]') || e.matches('[data-editing]') ? 0 : 1)
    const as = info.anchor ? [...document.querySelectorAll(`[data-learn="${info.anchor}"]`)].filter(vis).sort((a, b) => (tr ? tdist(a) - tdist(b) || dist(a) - dist(b) : ed(a) - ed(b) || dist(a) - dist(b))) : []
    // No anchor drawn now (a lingering lesson's menu closed): where it last was, as the watcher saw it.
    const last = !as[0] && info.anchor ? window.__o16.lastAnchor?.[info.anchor] : null
    const a = as[0]?.getBoundingClientRect() ?? (last ? { left: last[0], top: last[1], right: last[0] + last[2], bottom: last[1] + last[3], width: last[2], height: last[3] } : undefined)
    const over = a ? Math.max(0, Math.min(lr.right, a.right) - Math.max(lr.left, a.left)) * Math.max(0, Math.min(lr.bottom, a.bottom) - Math.max(lr.top, a.top)) : -1
    const gap = a ? Math.round(Math.hypot(Math.max(a.left - lr.right, 0, lr.left - a.right), Math.max(a.top - lr.bottom, 0, lr.top - a.bottom))) : null
    const fr = l.querySelector('iframe')
    return { label: l.getAttribute('aria-label'), lead: !!tr, gap, lesson: R(lr), anchorName: info.anchor ?? null, anchor: a ? R(a) : null, over: Math.round(over), scene: fr ? decodeURIComponent(fr.src.split('scene=')[1] ?? '').split('&')[0] : null, page: l.textContent.match(/\d+ \/ \d+/)?.[0] ?? null, body: l.querySelector('p')?.textContent?.slice(0, 160) ?? '' }
  }, id)
}

// ── Shots ──────────────────────────────────────────────────────────────────────────────────────────────────────────
export const shotsOn = !process.env.NO_SHOTS
const stepShots = process.env.STEP_SHOTS !== '0'
// A full-screen shot of a flow step, resized to 1568 px wide (1×) to keep the folder small.
export async function stepShot(p, name) {
  if (!shotsOn || !stepShots) return
  const f = join(SHOTS, `${name}-${p.theme}.png`)
  await p.screenshot({ path: f })
  try { execFileSync('sips', ['-Z', String(W), f], { stdio: 'ignore' }) } catch {}
  log('    shot', f.split('/').at(-1))
}
// A crop (2×) round the rects given (the lesson and its anchor), padded, at least min size, inside the screen.
export async function cropShot(p, name, rects, { pad = 48, minW = 640, minH = 400 } = {}) {
  if (!shotsOn) return
  rects = rects.filter(Boolean)
  if (!rects.length) return stepShot(p, name)
  let x0 = Math.min(...rects.map((r) => r.x)) - pad, y0 = Math.min(...rects.map((r) => r.y)) - pad
  let x1 = Math.max(...rects.map((r) => r.x + r.w)) + pad, y1 = Math.max(...rects.map((r) => r.y + r.h)) + pad
  if (x1 - x0 < minW) { const d = (minW - (x1 - x0)) / 2; x0 -= d; x1 += d }
  if (y1 - y0 < minH) { const d = (minH - (y1 - y0)) / 2; y0 -= d; y1 += d }
  const vw = p.viewport().width, vh = p.viewport().height
  if (x0 < 0) { x1 -= x0; x0 = 0 } if (y0 < 0) { y1 -= y0; y0 = 0 }
  x1 = Math.min(vw, x1); y1 = Math.min(vh, y1)
  const f = join(SHOTS, `${name}-${p.theme}.png`)
  await p.screenshot({ path: f, clip: { x: Math.round(x0), y: Math.round(y0), width: Math.round(x1 - x0), height: Math.round(y1 - y0) } })
  log('    crop', f.split('/').at(-1))
}
// The lesson `id` showing now: its crop (lesson + anchor) and the rect check. Returns the geometry.
export async function shootLesson(p, R, id, name, { soft = false } = {}) {
  await wait(500)
  const g = await lessonGeom(p, id)
  if (!g) { if (soft) R.note(`${id}: gone before its shot (closed with what it was about)`); else R.expect(false, `${id}: showing for its shot`); return null }
  if (g.anchor && !g.lead && g.gap > 200) R.note(`${id}: placed ${g.gap} px from its anchor ${g.anchorName} with no lead line (lesson ${JSON.stringify(g.lesson)}, anchor ${JSON.stringify(g.anchor)})`)
  R.expect(g.over <= 0, `${id}: the card doesn't cover its anchor ${g.anchorName ?? '(none)'} (over ${g.over} px², lesson ${JSON.stringify(g.lesson)}, anchor ${JSON.stringify(g.anchor)})`)
  if (g.scene) await p.waitForFunction(() => document.querySelector('section[data-coach] [data-ready]'), { timeout: 8000 }).catch(() => {})
  await wait(400)
  await cropShot(p, name, [g.lesson, g.anchor])
  return g
}

// ── The app, driven ────────────────────────────────────────────────────────────────────────────────────────────────
export const box = (p, sel) => p.evaluate((sel) => { const e = [...document.querySelectorAll(sel)].filter((x) => x.getBoundingClientRect().width > 0).at(-1); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height } }, sel)
export const mid = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 })
export async function drag(p, from, to, steps = 25) {
  await p.mouse.move(from.x, from.y); await p.mouse.down(); await p.mouse.move(from.x + 6, from.y + 4, { steps: 3 }); await p.mouse.move(to.x, to.y, { steps }); await wait(200); await p.mouse.up(); await wait(500)
}
// A button by its words (brackets and spaces ignored), the last visible one inside `within`.
export async function press(p, words, within = 'body') {
  const h = (await p.evaluateHandle((w, s) => [...document.querySelectorAll(`${s} button`)].filter((e) => e.textContent.replace(/\s+/g, ' ').trim().replace(/^\[\s*|\s*\]$/g, '').startsWith(w) && e.getBoundingClientRect().width > 0 && !e.closest('[data-coach]')).at(-1), words, within)).asElement()
  if (!h) { log(`    !! no button "${words}" in ${within}`); return false }
  await h.click(); return true
}
export async function plus(p, key) {
  await p.click('[data-learn="plus"]'); await wait(1100)
  const row = await p.$(`[role="menu"] [data-key="${key}"]`)
  if (!row) { log(`    !! no + row ${key}`); await p.keyboard.press('Escape'); return false }
  await row.evaluate((e) => e.scrollIntoView({ block: 'nearest' }))
  await row.click(); await wait(1600)
  return true
}
export const fit = async (p) => { const f = await p.$('[aria-label="Fit everything on the canvas"]'); if (f) { await f.click(); await wait(1500) } else { await p.keyboard.press('0'); await wait(1500) } }
// A piece in edit mode: its `[done]` (pointed at so its console shows).
export async function editDone(p) {
  const e = await box(p, '[data-learn="piece"][data-editing]')
  if (!e) return false
  await p.mouse.move(e.x + e.w / 2, e.y + e.h / 2); await wait(700)
  const ok = await press(p, 'done')
  await wait(1500)
  return ok
}
export async function focusPiece(p, kind) {
  await fit(p)
  const bx = await box(p, `[data-kind="${kind}"]`)
  if (!bx) { log(`    !! no ${kind} to focus`); return false }
  await p.mouse.click(Math.max(80, Math.min(W - 80, bx.x + 60)), Math.max(80, Math.min(H - 80, bx.y + 60)), { clickCount: 2 })
  await wait(3200)
  return true
}
export async function unfocus(p) { await p.keyboard.press('Escape'); await wait(2500); await toCanvas(p) }
export const cardSel = (p, title) => p.evaluate((t) => [...document.querySelectorAll('[data-target^="card:"]')].filter((x) => x.textContent.includes(t)).at(-1)?.getAttribute('data-target') ?? null, title)
// A card made from a focused plane's right-click: its letter, Enter, its title typed (not kept yet).
export async function makeCard(p, at, letter, title) {
  await p.mouse.click(at.x, at.y, { button: 'right' }); await wait(900)
  await p.keyboard.type(letter); await wait(300); await p.keyboard.press('Enter')
  // Typed only once the new card's panel has its title field focused (on a loaded machine it can take seconds; keys
  // typed before land on the canvas as shortcuts: `t` opens the side view…).
  const ok = await waitFor(() => p.evaluate(() => { const a = document.activeElement; return !!a && /INPUT|TEXTAREA/.test(a.tagName) && !!a.closest('[data-learn="card-panel"]') }), 8000, 100)
  if (!ok) { log(`    !! no title field focused for the new card (${title})`); return false }
  await wait(200)
  await p.keyboard.type(title, { delay: 20 }); await wait(400)
  return true
}
export const welcomeUp = (p) => p.evaluate(() => !!document.getElementById('coach-welcome-title'))
export const welcomeTitle = (p) => p.evaluate(() => document.getElementById('coach-welcome-title')?.textContent ?? null)

// ── Names ──────────────────────────────────────────────────────────────────────────────────────────────────────────
// A lesson's shot is named by the run's step that built it and its place among that step's lessons:
// `O10-03-status-evidence` (+ `-dark`/`-light`). The step by area (onboarding-run.md §1.5).
export const { LESSONS } = await import(pathToFileURL(resolve(here, '../../../../src/onboarding/lessons.ts')).href)
const STEP_OF = { start: 'O8', canvas: 'O9', planes: 'O10', links: 'O10', text: 'O11', lenses: 'O11', documents: 'O12', decks: 'O12', together: 'O13', canvases: 'O13', settings: 'O13' }
const ORDER = {}
for (const l of LESSONS) { const s = STEP_OF[l.area] ?? 'O9'; ORDER[s] ??= []; ORDER[s].push(l.id) }
export const stepOf = (id) => { const l = LESSONS.find((x) => x.id === id); return l ? (STEP_OF[l.area] ?? 'O9') : 'O16' }
export const lessonShot = (id, suffix = '') => { const s = stepOf(id); const i = (ORDER[s] ?? []).indexOf(id) + 1; return `${s}-${String(i).padStart(2, '0')}-${id}${suffix}` }
export const lessonById = (id) => LESSONS.find((x) => x.id === id)
// On a step's failure: the screen, into FAIL_SHOTS (default: the OS's temp folder), never into the gallery.
export const failShots = process.env.FAIL_SHOTS ?? (await import('node:os')).tmpdir()
export const failShotOf = (p) => async (name) => { const f = join(failShots, `fail-${name.replace(/\W+/g, '_').slice(0, 40)}-${p.theme}.png`); await p.screenshot({ path: f }).catch(() => {}); log('    fail shot', f) }
// Back on the canvas: esc until no focus is in the URL (a beside pane, a menu, a selection each take one).
export async function toCanvas(p) {
  for (let k = 0; k < 5; k++) {
    if (!(await p.evaluate(() => /[?&](focus|beside)=/.test(location.search)))) return true
    await p.keyboard.press('Escape'); await wait(1200)
  }
  await wait(1500)
  return !(await p.evaluate(() => /[?&](focus|beside)=/.test(location.search)))
}
