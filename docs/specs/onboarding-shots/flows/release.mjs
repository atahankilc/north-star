// Flow: a person BACK AFTER A RELEASE (onboarding.md §4.4, §8.6). A seen-state doc from before (welcome done,
// lastRelease `launch`, `timeline` and `piece-made` seen) and the dev-only sample release (`?release=sample`): what's new
// only (no welcome), its lessons armed, its pages, `[show me]` on decks and days opens the side view and its lesson
// shows marked NEW, `?` marks NEW and the side nav's dot; a reload opens nothing again. Then an OLD ACCOUNT WITH NO DOC
// (a workspace made 60 days ago, no seen-state): the full welcome, no what's new.
//   PUPPETEER_CORE=… node docs/specs/onboarding-shots/flows/release.mjs [dark|light]
import { launch, page, signIn, revealed, watch, collector, results, until, closeLesson, settle, shootLesson, cropShot, stepShot, lessonShot,
  box, progress, welcomeUp, waitFor, wait, log, BASE, failShotOf } from './lib.mjs'
import { as, seedPazar, seenDoc, writeSeen } from './seed.mjs'

const theme = process.argv[2] ?? 'dark'
const R = results(`back after a release (${theme})`)
const C = collector()
setTimeout(() => { log('FLOW TIMEOUT'); R.summary(); process.exit(3) }, Number(process.env.LIMIT ?? 600000))
const tag = Date.now().toString(36)
const back = await as('Back' + tag)
const seed = await seedPazar(back)
await writeSeen(back, seenDoc({ seen: { timeline: 1, 'piece-made': 1 } }))
log('workspace', seed.wid)
const b = await launch()
const p = await page(b, theme)
let stepN = 0
const full = (pg, name) => stepShot(pg, `O16-release-${String(++stepN).padStart(2, '0')}-${name}`)
async function step(name, fn) {
  log(`· ${name}`)
  try { await fn() } catch (e) { R.expect(false, `${name}: threw ${String(e.message ?? e).slice(0, 160)}`); await failShotOf(p)(name).catch(() => {}) }
}
const news = (pg) => pg.evaluate(() => document.getElementById('coach-news-title')?.textContent ?? null)
const dot = (pg) => pg.evaluate(() => !!document.querySelector('button[aria-label*="something new"]'))

await signIn(p, back.name)
await step("what's new opens, alone", async () => {
  await p.goto(`${BASE}/workspaces/${seed.wid}?release=sample`); await revealed(p); await watch(p)
  R.expect(await waitFor(async () => !!(await news(p)), 10000), "what's new opens")
  await wait(1200)
  R.expect(!(await welcomeUp(p)), 'no welcome')
  const st = await progress(p)
  R.expect(st.lastRelease === 'launch', `lastRelease still launch while it shows (${st.lastRelease})`)
  R.expect(st.armed.length > 0 && !st.armed.some((a) => a.startsWith('timeline@')), `its lessons armed, timeline (seen at v1) not (${st.armed.join(', ')})`)
  R.expect(await p.evaluate(() => document.activeElement?.closest('[role=dialog]') != null), 'focus inside')
  const titles = []
  for (let i = 0; i < 6; i++) {
    const t = await news(p)
    if (!t || titles.includes(t)) break
    titles.push(t)
    await p.waitForFunction(() => document.querySelector('[role=dialog] [data-ready]') || !document.querySelector('[role=dialog] iframe'), { timeout: 8000 }).catch(() => {})
    await wait(600)
    await cropShot(p, `O14-${String(i + 1).padStart(2, '0')}-whats-new-p${i + 1}`, [await box(p, '[role="dialog"][aria-modal="true"]')], { pad: 24 })
    if (i === 0) await full(p, 'whats-new')
    // → on the last page closes it: stop there.
    if (/more$/.test(t)) break
    await p.keyboard.press('ArrowRight'); await wait(1000)
  }
  log('    pages', JSON.stringify(titles))
  R.expect(titles[0] === 'Decks and days' && /more/.test(titles.at(-1) ?? ''), `pages from "Decks and days" to "… more" (${titles.join(' / ')})`)
  // The pages' tabs: none cut with "…" (O14's idea list).
  const tabs = await p.evaluate(() => [...document.querySelectorAll('[role=dialog] nav[aria-label="pages"] button')].map((e) => ({ t: e.textContent, cut: e.scrollWidth > e.clientWidth + 1 })))
  R.expect(!tabs.some((t) => t.cut || /…/.test(t.t)), `the page tabs read whole (${tabs.map((t) => t.t + (t.cut ? ' [cut]' : '')).join(' | ')})`)
  // The modal's top stays put between pages (O14's idea list).
  for (let k = 0; k < 6; k++) { await p.keyboard.press('ArrowLeft'); await wait(500) }
  const tops = []
  for (let k = 0; k < titles.length; k++) { tops.push(Math.round((await box(p, '[role="dialog"][aria-modal="true"]')).y)); if (k < titles.length - 1) { await p.keyboard.press('ArrowRight'); await wait(700) } }
  for (let k = 0; k < 6; k++) { await p.keyboard.press('ArrowLeft'); await wait(400) }
  R.expect(new Set(tops).size === 1, `the modal's top stays put across pages (${tops.join(', ')})`)
})

await step('`[show me]` → the side view, its lesson NEW', async () => {
  const ok = await p.evaluate(() => { const x = [...document.querySelectorAll('[role="dialog"] button')].find((e) => e.textContent.includes('show me')); x?.click(); return !!x })
  R.expect(ok, '`[show me]` on Decks and days')
  await wait(1500)
  R.expect(!(await news(p)), "what's new closed")
  const st = await progress(p)
  R.expect(st.lastRelease === '2026-11', `lastRelease = the newest (${st.lastRelease})`)
  R.expect(await p.evaluate(async () => (await window.__mod('/src/views/workspace/sideState.ts')).useTasksSide.getState().open), 'the side view opened')
  const l = await until(p, 'side-view', 10000)
  R.expect(!!l, 'its lesson shows')
  if (l) {
    R.expect(await p.evaluate(() => [...document.querySelectorAll('section[data-coach][aria-label^="lesson:"]')].some((e) => e.textContent.includes('NEW'))), 'marked NEW')
    await shootLesson(p, R, 'side-view', lessonShot('side-view', '-new'))
    await full(p, 'side-view-new')
    await closeLesson(p)
  }
  await p.evaluate(async () => (await window.__mod('/src/views/workspace/sideState.ts')).closeTasksSide())
  await wait(900)
  R.expect(await dot(p), 'the dot on the side nav’s `?`')
  const d = await box(p, 'button[aria-label^="Guide:"]')
  await cropShot(p, 'O14-06-dot', [d], { minW: 300, minH: 260 })
})

await step('`?` shows NEW', async () => {
  await p.mouse.click(1300, 930); await wait(300)
  await p.keyboard.press('?'); await wait(1200)
  const t = await p.evaluate(() => document.querySelector('[role="dialog"][aria-label^="Guide"]')?.textContent ?? '')
  R.expect(t.includes('NEW'), '`?` shows NEW')
  await cropShot(p, 'O14-07-guide-new', [await box(p, '[role="dialog"][aria-label^="Guide"]')], { pad: 24 })
  await p.keyboard.press('Escape'); await wait(700)
})

await step('a reload opens nothing again', async () => {
  await p.goto(`${BASE}/workspaces/${seed.wid}?release=sample`); await revealed(p); await watch(p)
  await wait(5000)
  R.expect(!(await news(p)) && !(await welcomeUp(p)), 'nothing opens after a reload')
  R.expect(await dot(p), 'the dot stays while lessons are armed')
})
await C.take(p, 'back')

// An old account with no doc: the full welcome.
const old = await as('Old' + tag)
const oseed = await seedPazar(old, [], { made: Date.now() - 864e5 * 60 })
const p2 = await page(b, theme)
await signIn(p2, old.name)
await step('an old account with no doc', async () => {
  await p2.goto(`${BASE}/workspaces/${oseed.wid}?release=sample`); await revealed(p2); await watch(p2)
  R.expect(await waitFor(() => welcomeUp(p2), 10000), 'the welcome (like a new person)')
  R.expect(!(await news(p2)), "no what's new")
  for (let k = 0; k < 6 && (await welcomeUp(p2)); k++) { await p2.keyboard.press('Enter'); await wait(900) }
  await wait(4000)
  R.expect(!(await news(p2)), "no what's new after the welcome either")
  const st = await progress(p2)
  R.expect(st.lastRelease === '2026-11' && st.armed.length === 0, `lastRelease the newest, nothing armed (${st.lastRelease}, ${st.armed.length})`)
  await settle(p2, 1000)
})
await C.take(p2, 'old')

const w = C.all
R.expect(w.twos.length === 0, `never two coach surfaces at once (${JSON.stringify(w.twos)})`)
R.expect(w.covers.length === 0, `no lesson covered its anchor for 300 ms or more (${JSON.stringify(w.covers)})`)
log('    every surface, in order:', JSON.stringify(w.events.map((e) => `${e.where} ${e.t}: ${e.surfaces.join(' | ')}`)))
const bad = R.summary()
await b.close()
process.exit(bad ? 1 : 0)
