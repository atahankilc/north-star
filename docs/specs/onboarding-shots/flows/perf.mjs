// Speed (onboarding-run.md O16; how the canvas's frame time was measured before: state-history.md D-279, D-287): the
// canvas's frames during a pan and a zoom on a busy seeded workspace, in three conditions, each in a fresh page:
//   coach  — the coach mounted, no lesson showing (seen-state: welcome done);
//   lesson — a lesson showing with its demo playing (side-nav: 4 pages, its scene looping in the frame);
//   none   — the baseline: the coach not mounted. Without editing the app: the dev server's `/src/onboarding/Coach.tsx`
//            is answered with a stub (`Coach = () => null`), so nothing of the coach runs (no queue, events, busy
//            polling, seen-state, demo frame). The `?` button (GuideButton) still mounts; it does nothing on its own.
// Frames: requestAnimationFrame intervals while the pan (a drag, 3 × 60 steps) or the zoom (60 wheel steps, in then
// out) runs, and 10 s with no input (`idle`: what the coach costs on its own); long tasks from a PerformanceObserver. Reported per condition: median and p95 frame ms, frames over
// 20 ms, long tasks (count, total ms). ROUNDS rounds, the conditions in a rotating order (default 3).
// Dev server (not a production build): the absolute numbers are dev's; compare the conditions with each other.
//   PUPPETEER_CORE=… FS_PORT=8280 node docs/specs/onboarding-shots/flows/perf.mjs
import { writeBatch, doc, collection } from 'firebase/firestore'
import { launch, page, signIn, revealed, wait, log, BASE, W, H, waitFor } from './lib.mjs'
import { as, seedPazar, seenDoc, writeSeen } from './seed.mjs'

const ROUNDS = Number(process.env.ROUNDS ?? 3)
const tag = Date.now().toString(36)
const me = await as('Speed' + tag)
const seed = await seedPazar(me)
// Busy: three more planes of 25 cards each.
{
  const now = Date.now()
  const b = writeBatch(me.fs)
  const types = [['customers', 'title'], ['problems', 'title'], ['ideas', 'title'], ['features', 'title'], ['competitors', 'name']]
  for (let k = 0; k < 3; k++) {
    const pl = doc(collection(me.fs, 'workspaces', seed.wid, 'pieces'))
    b.set(pl, { kind: 'plane', x: k * 1400, y: 1300, w: 1300, h: 650, name: `0${4 + k} More ${k + 1}`, createdAt: now + k, updatedAt: now + k })
    for (let i = 0; i < 25; i++) {
      const [col, f] = types[i % 5]
      b.set(doc(collection(me.fs, 'workspaces', seed.wid, col)), { [f]: `Card ${k}-${i} for the lunch run`, pieceId: pl.id, x: 25 + (i % 5) * 250, y: 25 + Math.floor(i / 5) * 125, createdAt: now + 100 + i, updatedAt: now + 100 + i })
    }
  }
  await b.commit()
}
await writeSeen(me, seenDoc())
log('workspace', seed.wid)

const STUB = 'export const Coach = () => null; export const coachDev = { current: null }; export const openGuide = () => {};'
const b = await launch()

async function measure(cond) {
  const p = await page(b, 'dark', cond === 'none' ? { stub: { re: /\/src\/onboarding\/Coach\.tsx/, body: STUB } } : {})
  await signIn(p, me.name)
  await p.goto(`${BASE}/workspaces/${seed.wid}`); await revealed(p)
  await wait(3000)
  await p.keyboard.press('0'); await wait(2000)
  const mounted = await p.evaluate(async () => { try { return (await window.__mod('/src/onboarding/progress.ts')).useProgress.getState().loaded } catch { return false } })
  if (cond === 'lesson') {
    await p.evaluate(async () => (await window.__mod('/src/onboarding/learn.ts')).learn('sidenav-rest'))
    const ok = await waitFor(() => p.evaluate(() => !!document.querySelector('section[data-coach][aria-label^="lesson:"] iframe') && !!document.querySelector('section[data-coach] [data-ready]')), 15000)
    if (!ok) log('  !! no lesson with a ready demo')
    await wait(1500)
  }
  const nodes = await p.evaluate(() => document.querySelectorAll('*').length)
  await p.evaluate(() => {
    window.__perf = { frames: [], long: [], on: false }
    new PerformanceObserver((l) => { if (window.__perf.on) for (const e of l.getEntries()) window.__perf.long.push(e.duration) }).observe({ type: 'longtask', buffered: false })
    let last = 0
    const tick = (t) => { if (window.__perf.on && last) window.__perf.frames.push(t - last); last = t; requestAnimationFrame(tick) }
    requestAnimationFrame(tick)
  })
  const run = async (what) => {
    await p.evaluate(() => { window.__perf.frames = []; window.__perf.long = []; window.__perf.on = true })
    if (what === 'pan') {
      for (let k = 0; k < 3; k++) {
        const x0 = W * 0.55, y0 = H * 0.55, dx = k % 2 ? 300 : -300
        await p.mouse.move(x0, y0); await p.mouse.down()
        for (let i = 1; i <= 60; i++) { await p.mouse.move(x0 + (dx * i) / 60, y0 + (dx * i) / 120); await wait(16) }
        await p.mouse.up(); await wait(200)
      }
    } else if (what === 'idle') {
      // The pointer off every piece (resting on one shows its console, and that is a lesson: piece-console).
      await wait(10000)
    } else {
      await p.mouse.move(W * 0.55, H * 0.55)
      for (let i = 0; i < 60; i++) { await p.mouse.wheel({ deltaY: i < 30 ? -60 : 60 }); await wait(16) }
      await wait(400)
    }
    const r = await p.evaluate(() => { window.__perf.on = false; return { frames: window.__perf.frames, long: window.__perf.long } })
    return r
  }
  const pan = await run('pan')
  const zoom = await run('zoom')
  await p.mouse.move(W - 30, 70); await wait(300)
  const idleUp = async () => p.evaluate(() => [...document.querySelectorAll('section[data-coach][aria-label^="lesson:"]')].map((e) => e.getAttribute('aria-label')))
  const before = await idleUp()
  const idle = await run('idle')
  idle.lessons = [...new Set([...before, ...(await idleUp())])]
  const still = cond !== 'lesson' || (await p.evaluate(() => !!document.querySelector('section[data-coach][aria-label^="lesson:"]')))
  await p.browserContext().close()
  return { cond, mounted, nodes, pan, zoom, idle, lessonStillUp: still }
}

const stats = (xs) => { const s = [...xs].sort((a, b) => a - b); const q = (f) => (s.length ? s[Math.min(s.length - 1, Math.floor(f * s.length))] : 0); return { n: s.length, med: q(0.5), p95: q(0.95), over20: s.filter((x) => x > 20).length } }
const all = { none: { pan: [], zoom: [], long: { pan: [], zoom: [] } }, coach: { pan: [], zoom: [], long: { pan: [], zoom: [] } }, lesson: { pan: [], zoom: [], long: { pan: [], zoom: [] } } }
const order = ['none', 'coach', 'lesson']
for (let r = 0; r < ROUNDS; r++) {
  for (let i = 0; i < 3; i++) {
    const cond = order[(i + r) % 3]
    const m = await measure(cond)
    log(`round ${r + 1} ${cond}: coach loaded ${m.mounted}, ${m.nodes} nodes, pan ${JSON.stringify(stats(m.pan.frames))} long ${m.pan.long.length}/${Math.round(m.pan.long.reduce((a, b) => a + b, 0))} ms; zoom ${JSON.stringify(stats(m.zoom.frames))} long ${m.zoom.long.length}/${Math.round(m.zoom.long.reduce((a, b) => a + b, 0))} ms; idle 10 s ${JSON.stringify(stats(m.idle.frames))} long ${m.idle.long.length}/${Math.round(m.idle.long.reduce((a, b) => a + b, 0))} ms (lessons up: ${m.idle.lessons.join(', ') || 'none'})${cond === 'lesson' ? `; lesson still up ${m.lessonStillUp}` : ''}`)
    all[cond].pan.push(...m.pan.frames); all[cond].zoom.push(...m.zoom.frames)
    all[cond].long.pan.push(...m.pan.long); all[cond].long.zoom.push(...m.zoom.long)
  }
}
log('\nRESULT (all rounds pooled; frame ms):')
log('condition | pan median | pan p95 | pan >20ms | pan long tasks (n / ms) | zoom median | zoom p95 | zoom >20ms | zoom long tasks (n / ms)')
for (const c of order) {
  const a = all[c], ps = stats(a.pan), zs = stats(a.zoom)
  const sum = (x) => Math.round(x.reduce((s, v) => s + v, 0))
  log(`${c} | ${ps.med.toFixed(1)} | ${ps.p95.toFixed(1)} | ${ps.over20}/${ps.n} | ${a.long.pan.length} / ${sum(a.long.pan)} | ${zs.med.toFixed(1)} | ${zs.p95.toFixed(1)} | ${zs.over20}/${zs.n} | ${a.long.zoom.length} / ${sum(a.long.zoom)}`)
}
await b.close()
process.exit(0)
