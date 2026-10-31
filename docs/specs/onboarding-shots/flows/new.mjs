// Flow: a NEW person (onboarding.md §8.6). A fresh test user → the workspaces page's empty state → a workspace made →
// the welcome's 4 pages → the empty-canvas hint → `+` with the kind guide → a plane → its lessons → its console →
// focus → the empty-plane hint → cards (made and named, the panel, status, links, for, several, a package, a
// competitor) → the plane's filter → guides → text (heading, sticky, section) → the finder → the side nav's rest.
// Every lesson from its real trigger, through the UI. Shots: each lesson cropped with its anchor, a full screen per step.
//   PUPPETEER_CORE=… node docs/specs/onboarding-shots/flows/new.mjs [dark|light]
import { launch, page, signIn, revealed, watch, collector, results, until, closeLesson, settle, shootLesson, cropShot, stepShot, lessonShot, lessonGeom,
  surfaces, progress, activeDesc, box, mid, drag, press, plus, fit, editDone, cardSel, makeCard, welcomeUp, welcomeTitle, waitFor, wait, log, BASE, failShotOf, W, H } from './lib.mjs'

const theme = process.argv[2] ?? 'dark'
const R = results(`new (${theme})`)
const C = collector()
setTimeout(() => { log('FLOW TIMEOUT'); R.summary(); process.exit(3) }, Number(process.env.LIMIT ?? 1500000))
const shot = new Set()
let failShot = async (n) => { try { await failShotOf(p)(n) } catch {} }
const b = await launch()
const p = await page(b, theme)
// Any lesson met on the way to another: shot once (it's real, anchored), then closed.
const onOther = async (l) => { if (l.id && !shot.has(l.id)) { shot.add(l.id); await shootLesson(p, R, l.id, lessonShot(l.id), { soft: true }) } }
async function lesson(id, opts = {}) {
  const l = await until(p, id, opts.ms ?? 15000, { onOther })
  R.expect(!!l, `${id} shows from its trigger`)
  if (l && !shot.has(id)) { shot.add(id); await shootLesson(p, R, id, lessonShot(id)) }
  return l
}
let stepN = 0
const lessonsUpIds = async () => (await (await import('./lib.mjs')).lessonsUp(p)).map((l) => l.id)
const full = (name) => stepShot(p, `O16-new-${String(++stepN).padStart(2, '0')}-${name}`)
async function step(name, fn) {
  log(`· ${name}`)
  try { await fn() } catch (e) { R.expect(false, `${name}: threw ${String(e.message ?? e).slice(0, 160)}`); await failShot(name) }
}

const name = 'New' + Date.now().toString(36)
await signIn(p, name)

await step('workspaces: the empty state', async () => {
  await p.goto(BASE + '/workspaces'); await revealed(p); await watch(p)
  await p.waitForSelector('[data-learn="workspaces-empty"] [data-coach]', { timeout: 15000 })
  await wait(800)
  const choices = await p.$$eval('[data-learn="workspaces-empty"] [data-coach] button', (els) => els.map((e) => e.textContent.trim()))
  R.expect(choices.length === 3, `three ways to start (${choices.join(' | ')})`)
  await cropShot(p, lessonShot('workspaces-empty'), [await box(p, '[data-learn="workspaces-empty"]')])
  await full('workspaces-empty')
  await p.click('[data-learn="workspaces-empty"] [data-coach] button')
  R.expect(await p.evaluate(() => document.activeElement?.id === 'ws-name'), 'the first choice focuses the name field')
  await p.keyboard.type('Pazar lunches')
  await p.keyboard.press('Enter')
  await p.waitForFunction(() => location.pathname.startsWith('/workspaces/'), { timeout: 30000 })
  await C.take(p, 'workspaces')
})

await step('the welcome', async () => {
  await revealed(p); await watch(p)
  R.expect(await waitFor(() => welcomeUp(p), 30000), 'the welcome opens on the first canvas')
  await wait(1200)
  R.expect(await p.evaluate(() => document.activeElement?.closest('[role=dialog]') != null), 'focus is inside the welcome')
  const titles = []
  for (let i = 0; i < 4; i++) {
    titles.push(await welcomeTitle(p))
    await p.waitForFunction(() => document.querySelector('[role=dialog] [data-ready]') || !document.querySelector('[role=dialog] iframe'), { timeout: 8000 }).catch(() => {})
    await wait(600)
    await cropShot(p, lessonShot('welcome', `-new-p${i + 1}`), [await box(p, '[role="dialog"][aria-modal="true"]')], { pad: 24 })
    if (i === 0) await full('welcome')
    await p.keyboard.press('ArrowRight'); await wait(1300)
  }
  log('    titles', JSON.stringify(titles))
  R.expect(titles.length === 4 && /Add anything/.test(titles[2] ?? ''), 'four pages, page 3 "Add anything with +"')
  R.expect(!(await welcomeUp(p)), 'the welcome closes after page 4')
  await wait(800)
  const d = await activeDesc(p)
  R.expect(!/coach|dialog/.test(d), `focus left the welcome (${d})`)
})

await step('the empty canvas', async () => {
  R.expect(await waitFor(() => p.evaluate(() => !!document.querySelector('[data-coach][role="note"]')), 8000), 'the empty-canvas hint shows')
  await wait(800)
  await cropShot(p, lessonShot('empty-canvas'), [await box(p, '[data-coach][role="note"]'), await box(p, '[data-learn="plus"]')])
  await full('empty-canvas')
})

await step('`+` and the kind guide', async () => {
  await p.click('[data-learn="plus"]')
  R.expect(await waitFor(() => p.evaluate(() => [...document.querySelectorAll('[class*="glued"]')].some((e) => e.getBoundingClientRect().width > 0)), 5000), 'the kind guide shows beside the `+` menu')
  await wait(900)
  await cropShot(p, lessonShot('kind-guide'), [await box(p, '[role="menu"]'), await box(p, '[class*="glued"]')], { pad: 24 })
  R.expect(!(await p.evaluate(() => [...document.querySelectorAll('[data-coach][role="note"]')].some((e) => getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().width > 0 && (() => { const a = e.getBoundingClientRect(); const m = document.querySelector('[role="menu"]')?.getBoundingClientRect(); return m && a.left < m.right && a.right > m.left && a.top < m.bottom && a.bottom > m.top })()))), 'the empty hint does not sit over the `+` menu')
  // The guide follows the keys: ↓ twice.
  const before = await p.evaluate(() => document.querySelector('[class*="glued"]')?.textContent.slice(0, 60))
  await p.keyboard.press('ArrowDown'); await wait(250); await p.keyboard.press('ArrowDown'); await wait(900)
  const after = await p.evaluate(() => document.querySelector('[class*="glued"]')?.textContent.slice(0, 60))
  R.expect(before !== after, 'the kind guide follows the picked row')
  await p.waitForFunction(() => document.querySelector('[class*="glued"] [data-ready]') || !document.querySelector('[class*="glued"] iframe'), { timeout: 8000 }).catch(() => {})
  await wait(500)
  await cropShot(p, lessonShot('kind-guide', '-row'), [await box(p, '[role="menu"]'), await box(p, '[class*="glued"]')], { pad: 24 })
  await full('plus-kind-guide')
  await p.keyboard.press('Escape'); await wait(600)
  await plus(p, 'plane')
  R.expect(!(await p.evaluate(() => [...document.querySelectorAll('[data-coach][role="note"]')].some((e) => e.getBoundingClientRect().width > 0))), 'the empty hint is gone at the first piece')
})

await step('a plane: piece-made, esc closes it', async () => {
  const l = await lesson('piece-made')
  if (l) {
    await full('piece-made')
    const before = await activeDesc(p)
    await p.keyboard.press('Escape'); await wait(900)
    const up = (await surfaces(p)).filter((s) => s.startsWith('lesson:'))
    R.expect(!up.some((s) => /edit mode/i.test(s) && !/done/.test(s)), `esc closes the lesson (${up.join(', ') || 'none left'})`)
    const after = await activeDesc(p)
    R.expect(after === before, `focus stays where it was (${before} → ${after})`)
  }
  await wait(800)
  await settle(p, 1500, { onOther })
  if (await p.$('[data-learn="piece"][data-editing]')) await editDone(p)
  await settle(p, 2000, { onOther })
})

await step('the console', async () => {
  const pl = await box(p, '[data-kind="plane"]')
  await p.mouse.move(pl.x + pl.w * 0.6, pl.y + pl.h * 0.6); await wait(800)
  if (!shot.has('piece-console')) await lesson('piece-console', { ms: 8000 })
  await closeLesson(p)
})

await step('focus a plane', async () => {
  const pl = await box(p, '[data-kind="plane"]')
  await p.mouse.click(pl.x + pl.w / 2, pl.y + pl.h / 2, { clickCount: 2 })
  await wait(1200)
  if (await lesson('focus-plane')) await full('focus-plane')
  await closeLesson(p)
  R.expect(await waitFor(() => p.evaluate(() => [...document.querySelectorAll('[data-coach][role="note"]')].some((e) => e.getBoundingClientRect().width > 0)), 6000), 'the empty-plane hint shows after the focus lesson')
  await wait(700)
  await cropShot(p, lessonShot('empty-plane'), [await box(p, '[data-coach][role="note"]')])
})

let problem, idea, cust
await step('a card, made and named', async () => {
  await makeCard(p, { x: 420, y: 330 }, 'r', 'Lunch near the office costs €14')
  if (await lesson('card-made')) await full('card-made')
  await p.keyboard.press('Enter'); await wait(1500)
  problem = await cardSel(p, 'Lunch near')
  R.expect(!!problem, 'the card is kept')
  await settle(p, 2500, { onOther })
})

await step('the card panel and status', async () => {
  const g = await box(p, `[data-target="${problem}"]`)
  await p.mouse.click(g.x + 40, g.y + 20); await wait(1200)
  // card-panel is `unless: card-made` (its page 2 taught the panel): it mustn't show now.
  await wait(2500)
  R.expect(!(await lessonsUpIds()).includes('card-panel'), 'card-panel stays retired after card-made (its page 2 taught the panel)')
  await press(p, 'testing', '[data-learn="panel-status"]'); await wait(1300)
  await lesson('status-evidence')
  await closeLesson(p)
  await p.keyboard.press('Escape'); await wait(700)
})

await step('a link', async () => {
  await makeCard(p, { x: 420, y: 650 }, 'i', 'Home cooks sell tomorrow’s lunch tonight')
  await p.keyboard.press('Enter'); await wait(1500); await settle(p, 1500, { onOther })
  idea = await cardSel(p, 'Home cooks')
  const ib = await box(p, `[data-target="${idea}"]`), pb = await box(p, `[data-target="${problem}"]`)
  await p.mouse.move(ib.x + ib.w / 2, ib.y + ib.h / 2); await wait(500)
  const h = await box(p, `[data-target="${idea}"] [aria-label="Drag to another card to link"]`)
  R.expect(!!h, 'the card shows its link handle')
  if (h) await drag(p, mid(h), mid(pb))
  if (await lesson('link-made')) await full('link-made')
  await p.keyboard.press('Escape'); await wait(400); await closeLesson(p); await p.keyboard.press('Escape'); await wait(600)
})

await step('a for link', async () => {
  await makeCard(p, { x: 420, y: 150 }, 'c', 'Office workers in Levent')
  await p.keyboard.press('Enter'); await wait(1500); await settle(p, 1500, { onOther })
  cust = await cardSel(p, 'Office workers')
  const cb = await box(p, `[data-target="${cust}"]`), pb = await box(p, `[data-target="${problem}"]`)
  await p.mouse.move(pb.x + pb.w / 2, pb.y + pb.h / 2); await wait(500)
  const h = await box(p, `[data-target="${problem}"] [aria-label="Drag to another card to link"]`)
  if (h) await drag(p, mid(h), mid(cb))
  await lesson('for-links')
  await p.keyboard.press('Escape'); await wait(400); await closeLesson(p); await p.keyboard.press('Escape'); await wait(600)
})

await step('several at once, a package', async () => {
  const a = await box(p, `[data-target="${problem}"]`), c = await box(p, `[data-target="${idea}"]`)
  await p.mouse.click(a.x + 30, a.y + 20); await wait(500)
  await p.keyboard.down('Shift'); await p.mouse.click(c.x + 30, c.y + 20); await p.keyboard.up('Shift'); await wait(700)
  await lesson('multi-select')
  await closeLesson(p)
  await press(p, 'package these', '[data-learn="card-panel"]'); await wait(1500)
  if (await lesson('package-made')) await full('package-made')
  await closeLesson(p); await p.keyboard.press('Escape'); await wait(800)
})

await step('a competitor', async () => {
  await makeCard(p, { x: 1080, y: 330 }, 'o', 'Yemeksepeti')
  await p.keyboard.press('Enter'); await wait(1500); await settle(p, 1500, { onOther })
  const s = await cardSel(p, 'Yemeksepeti')
  R.expect(!!s, 'the competitor card is made')
  const sb = await box(p, `[data-target="${s}"]`)
  await p.mouse.click(10, 10); await wait(300)
  await p.mouse.move(sb.x + 40, sb.y + 20); await wait(600)
  await p.mouse.click(sb.x + 40, sb.y + 20); await wait(900)
  await lesson('competitor-features')
  await closeLesson(p); await p.keyboard.press('Escape'); await wait(600)
})

await step('the plane filter', async () => {
  const f = await p.$('button[title="what this plane shows"]')
  R.expect(!!f, 'the dock has [filter]')
  if (f) { await f.click(); await wait(1200) }
  await lesson('plane-filter')
  await closeLesson(p)
  await p.click('button[title="close the filters"]').catch(() => {}); await wait(800)
})

await step('guides while dragging (the watcher checks nothing opens mid-drag)', async () => {
  const s = await cardSel(p, 'Yemeksepeti')
  const sb = await box(p, `[data-target="${s}"]`)
  // A slow drag: 2 s held, so a lesson due now would have to wait.
  await p.mouse.move(sb.x + 60, sb.y + 30); await p.mouse.down(); await p.mouse.move(sb.x + 66, sb.y + 34, { steps: 3 })
  for (let k = 0; k < 20; k++) { await p.mouse.move(sb.x + 66, sb.y + 34 + k * 10, { steps: 2 }); await wait(100) }
  const mid1 = await surfaces(p)
  await p.mouse.up(); await wait(500)
  R.expect(!mid1.some((s) => s.startsWith('lesson:lesson')), `no lesson while the card is held (${mid1.join(', ') || 'none'})`)
  await lesson('guides-snap')
  await closeLesson(p); await p.keyboard.press('Escape'); await wait(600)
})

await step('out of focus', async () => {
  await p.keyboard.press('Escape'); await wait(2600)
  await settle(p, 2500, { onOther })
  await full('back-on-canvas')
})

await step('text: a heading', async () => {
  await p.mouse.click(1300, 140); await wait(500)
  await plus(p, 'heading')
  await p.keyboard.type('Who we beat', { delay: 30 }); await wait(400)
  if (await lesson('text-made')) await full('text-made')
  await p.keyboard.press('Enter'); await wait(1200)
  await closeLesson(p)
  await lesson('headings-places', { ms: 10000 })
  await closeLesson(p)
  await p.mouse.click(1300, 120); await wait(600)
})

await step('text: a sticky note', async () => {
  await plus(p, 'sticky')
  await p.keyboard.type('Ask Jonas about the permit before Friday', { delay: 20 }); await wait(400)
  await lesson('sticky-made')
  await closeLesson(p)
  await p.keyboard.down('Meta'); await p.keyboard.press('Enter'); await p.keyboard.up('Meta'); await wait(1000)
  await p.mouse.click(1300, 120); await wait(600)
})

await step('text: a section', async () => {
  await plus(p, 'section')
  await lesson('section-draw')
  await closeLesson(p)
  await p.keyboard.press('Escape'); await wait(800)
})

await step('the finder', async () => {
  await p.mouse.click(1300, 900); await wait(300)
  await p.keyboard.down('Meta'); await p.keyboard.press('f'); await p.keyboard.up('Meta'); await wait(600)
  await lesson('finder', { ms: 10000 })
  await closeLesson(p)
  R.expect(await p.evaluate(() => !!document.querySelector('[role="dialog"][aria-label="Find"]')), 'closing the lesson leaves the finder open')
  await p.keyboard.press('Escape'); await wait(1000)
  R.expect(!(await p.evaluate(() => !!document.querySelector('[role="dialog"][aria-label="Find"]'))), 'esc then closes the finder')
})

await step('the side nav, rested on', async () => {
  await settle(p, 1500, { onOther })
  if ((await progress(p)).seen['side-nav']) { R.expect(shot.has('side-nav'), 'side-nav showed already (the pointer rested on the side nav reaching `+`)'); return }
  const s = await box(p, '[data-learn="sidenav"]')
  await p.mouse.move(s.x + s.w / 2, s.y + s.h / 2); await wait(300)
  await p.mouse.move(s.x + s.w / 2, s.y + s.h / 2 + 2)
  await lesson('side-nav', { ms: 8000 })
  await closeLesson(p)
})

await C.take(p, 'canvas')
const pr = await progress(p)
log('    seen', Object.keys(pr.seen).join(', '))
const w = C.all
R.expect(w.twos.length === 0, `never two coach surfaces at once (${JSON.stringify(w.twos)})`)
R.expect(w.busyOpens.length === 0, `nothing opened during a drag or the focus ink (${JSON.stringify(w.busyOpens)})`)
R.expect(w.covers.length === 0, `no lesson covered its anchor for 300 ms or more (${JSON.stringify(w.covers)})`)
if (w.blips.length) R.note(`a lesson over its anchor for under 300 ms (placed again): ${JSON.stringify(w.blips)}`)
const hintWithFocus = w.events.find((e) => e.surfaces.includes('lesson:focus-plane') && e.surfaces.some((x) => /^empty: press \+ or right-click/.test(x)))
const iHint = w.events.findIndex((e) => e.surfaces.some((x) => /^empty: press \+ or right-click/.test(x)))
const iFocus = w.events.findIndex((e) => e.surfaces.includes('lesson:focus-plane'))
R.expect(!hintWithFocus && !(iHint >= 0 && iHint < iFocus), `the empty-plane hint waits for focus-plane (after: focus-plane)${hintWithFocus ? ` — both up at t=${hintWithFocus.t}` : ''}${iHint >= 0 && iHint < iFocus ? ` — the hint showed first, t=${w.events[iHint].t}` : ''}`)
log('    every surface, in order:', JSON.stringify(w.events.map((e) => `${e.t}: ${e.surfaces.join(' | ')}`)))
log('    shot lessons:', [...shot].join(', '))
const bad = R.summary()
await b.close()
process.exit(bad ? 1 : 0)
