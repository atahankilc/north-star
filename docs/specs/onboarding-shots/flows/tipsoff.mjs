// Flow: TIPS OFF (onboarding.md §3.1.5, §4.6, §8.6). Two ways:
//  1. A new person presses `don't show tips` on their first lesson: it closes, nothing else opens by itself after it
//     (a plane focused, a card made, `+` opened: no lesson, no kind guide), the choice survives a reload, `?` still plays
//     a note, and `?`'s `on` turns tips back on (the next action's lesson shows again).
//  2. Someone back after a release with tips off (a seeded doc): no what's new modal, the lessons armed, the dot.
//   PUPPETEER_CORE=… node docs/specs/onboarding-shots/flows/tipsoff.mjs [dark|light]
import { launch, page, signIn, revealed, watch, collector, results, until, closeLesson, settle, cropShot, stepShot, lessonsUp,
  box, progress, plus, editDone, makeCard, welcomeUp, waitFor, wait, log, BASE, failShotOf } from './lib.mjs'
import { as, seedPazar, seenDoc, writeSeen } from './seed.mjs'

const theme = process.argv[2] ?? 'dark'
const R = results(`tips off (${theme})`)
const C = collector()
setTimeout(() => { log('FLOW TIMEOUT'); R.summary(); process.exit(3) }, Number(process.env.LIMIT ?? 700000))
const tag = Date.now().toString(36)
const b = await launch()
const p = await page(b, theme)
let stepN = 0
const full = (pg, name) => stepShot(pg, `O16-tipsoff-${String(++stepN).padStart(2, '0')}-${name}`)
async function step(name, fn) {
  log(`· ${name}`)
  try { await fn() } catch (e) { R.expect(false, `${name}: threw ${String(e.message ?? e).slice(0, 160)}`); await failShotOf(p)(name).catch(() => {}) }
}
// Anything the coach shows by itself, sampled while `fn` runs.
async function quiet(pg, what, fn) {
  const seen = new Set()
  let on = true
  const t = (async () => { while (on) { for (const l of await lessonsUp(pg).catch(() => [])) seen.add(l.id ?? l.label); if (await pg.evaluate(() => [...document.querySelectorAll('[class*="glued"]')].some((e) => e.getBoundingClientRect().width > 0)).catch(() => false)) seen.add('kind guide'); await wait(120) } })()
  await fn()
  await wait(2500)
  on = false; await t
  R.expect(seen.size === 0, `tips off: nothing opened by itself while ${what} (${[...seen].join(', ') || 'none'})`)
}

const me = await as('Quiet' + tag)
const seed = await seedPazar(me)
await signIn(p, me.name)
await step("the first lesson's `don't show tips`", async () => {
  await p.goto(`${BASE}/workspaces/${seed.wid}`); await revealed(p); await watch(p)
  if (await waitFor(() => welcomeUp(p), 15000)) { for (let k = 0; k < 6 && (await welcomeUp(p)); k++) { await p.keyboard.press('Enter'); await wait(900) } }
  await wait(1500)
  const pl = await box(p, '[data-kind="plane"]')
  await p.mouse.click(pl.x + pl.w / 2, pl.y + pl.h - 20, { clickCount: 2 }); await wait(1500)
  const l = await until(p, 'focus-plane', 15000)
  R.expect(!!l, 'a first lesson shows (focus-plane)')
  const off = await p.evaluate(() => { const x = [...document.querySelectorAll('section[data-coach][aria-label^="lesson:"] button')].find((e) => /don.t show tips/.test(e.textContent)); x?.click(); return !!x })
  R.expect(off, "the lesson has `don't show tips`")
  await wait(1500)
  R.expect((await lessonsUp(p)).length === 0, 'the lesson closed')
  R.expect((await progress(p)).tipsOff, 'tipsOff saved')
})

await step('nothing opens by itself', async () => {
  await quiet(p, 'a card was made, selected and linked', async () => {
    await makeCard(p, { x: 600, y: 700 }, 'i', 'A pickup shelf by the lifts')
    await p.keyboard.press('Enter'); await wait(1500)
    await p.keyboard.press('Escape'); await wait(500)
  })
  await quiet(p, 'the plane was left and `+` opened', async () => {
    await p.keyboard.press('Escape'); await wait(2600)
    await p.click('[data-learn="plus"]'); await wait(1200)
    await full(p, 'plus-no-kind-guide')
    await p.keyboard.press('Escape'); await wait(500)
  })
})

await step('kept through a reload; `?` still plays; `on` turns it back', async () => {
  await p.reload(); await revealed(p); await watch(p)
  await waitFor(async () => (await progress(p)).loaded, 15000)
  R.expect((await progress(p)).tipsOff, 'tips off survives a reload')
  await p.mouse.click(1300, 930); await wait(300)
  await p.keyboard.press('?'); await wait(1000)
  await cropShot(p, 'O15-02-guide-tips-off', [await box(p, '[role="dialog"][aria-label^="Guide"]')], { pad: 24 })
  // A note: the first unfolded area's first note.
  for (let k = 0; k < 3; k++) { await p.keyboard.press('ArrowDown'); await wait(80) }
  await p.keyboard.press('ArrowRight'); await wait(300); await p.keyboard.press('ArrowDown'); await wait(150); await p.keyboard.press('Enter'); await wait(800)
  R.expect(await p.evaluate(() => !!document.querySelector('section[data-played]')), 'tips off: `?` still plays a note')
  await p.keyboard.press('Escape'); await wait(700)
  await p.keyboard.press('?'); await wait(900)
  await p.evaluate(() => [...document.querySelectorAll('[role="dialog"][aria-label^="Guide"] button')].find((x) => x.textContent.trim() === 'on')?.click())
  await wait(400)
  R.expect(!(await progress(p)).tipsOff, "`?`'s `on` turns tips back on")
  await p.keyboard.press('Escape'); await wait(700)
  // Back on: an action's lesson shows again (a link → link-made, never seen).
  await plus(p, 'heading')
  await p.keyboard.type('Pickup shelves', { delay: 30 })
  const l = await until(p, 'text-made', 10000)
  R.expect(!!l, 'tips on again: the next lesson shows (text-made)')
  await p.keyboard.press('Enter'); await wait(800)
  await settle(p, 2000)
})
await C.take(p, 'tips off')

const back = await as('QuietBack' + tag)
const bseed = await seedPazar(back)
await writeSeen(back, seenDoc({ tipsOff: true, seen: { timeline: 1 } }))
const p2 = await page(b, theme)
await signIn(p2, back.name)
await step('back after a release with tips off', async () => {
  await p2.goto(`${BASE}/workspaces/${bseed.wid}?release=sample`); await revealed(p2); await watch(p2)
  await wait(5000)
  R.expect(!(await p2.evaluate(() => !!document.getElementById('coach-news-title'))), "no what's new modal")
  const st = await progress(p2)
  R.expect(st.armed.length > 0 && st.lastRelease === '2026-11', `its lessons armed, lastRelease moved on (${st.armed.join(', ')}; ${st.lastRelease})`)
  R.expect(await p2.evaluate(() => !!document.querySelector('button[aria-label*="something new"]')), 'the dot on `?`')
  await full(p2, 'tips-off-dot')
})
await C.take(p2, 'back, tips off')
const w = C.all
R.expect(w.twos.length === 0, `never two coach surfaces at once (${JSON.stringify(w.twos)})`)
const bad = R.summary()
await b.close()
process.exit(bad ? 1 : 0)
