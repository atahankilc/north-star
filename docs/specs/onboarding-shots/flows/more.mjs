// Flow: the NEW person, further along (onboarding.md §8.6, the rest of "… a good walk through the main lessons"): an
// owner past the welcome (seen-state: welcome done) on a filled "Pazar". The pieces beyond planes, each from its real
// trigger: a matrix (its wizard, unframe on edit, a drag near a plane → stick-hint, then stuck, its focus → focus-lens,
// matrix-keys), beside, a table (wizard, focus → table-keys, setup), unframed, documents, a deck (wizard, focus, a task
// with a card → task-card, its filter), a deck of cards, a timeline, a delete → hazard-undo.
//   PUPPETEER_CORE=… node docs/specs/onboarding-shots/flows/more.mjs [dark|light]
import { launch, page, signIn, revealed, watch, collector, results, until, closeLesson, settle, shootLesson, stepShot, lessonShot, lessonsUp,
  box, drag, press, plus, fit, toCanvas, editDone, focusPiece, unfocus, welcomeUp, waitFor, wait, log, BASE, failShotOf, W, H } from './lib.mjs'
import { as, seedPazar, seenDoc, writeSeen } from './seed.mjs'

const theme = process.argv[2] ?? 'dark'
const R = results(`further along (${theme})`)
const C = collector()
setTimeout(() => { log('FLOW TIMEOUT'); R.summary(); process.exit(3) }, Number(process.env.LIMIT ?? 1500000))
const tag = Date.now().toString(36)
const me = await as('Far' + tag)
const seed = await seedPazar(me)
// Past the welcome; the start's and planes' lessons seen (they're the `new` flow's), so these come one by one.
await writeSeen(me, seenDoc({ seen: { 'side-nav': 1, 'kind-guide': 1, 'piece-console': 1, 'focus-plane': 1, 'right-click': 1, 'card-panel': 1 } }))
const b = await launch()
const p = await page(b, theme)
const shot = new Set()
const onOther = async (l) => { if (l.id && !shot.has(l.id)) { shot.add(l.id); await shootLesson(p, R, l.id, lessonShot(l.id), { soft: true }) } }
async function lesson(id, opts = {}) {
  if (shot.has(id)) { log(`    (${id} shot already)`); return 'already' }
  const l = await until(p, id, opts.ms ?? 15000, { onOther })
  R.expect(!!l, `${id} shows from its trigger`)
  if (l) { shot.add(id); await shootLesson(p, R, id, lessonShot(id)) }
  return l
}
const calm = (ms = 2500) => settle(p, ms, { onOther })
let stepN = 0
const full = (name) => stepShot(p, `O16-more-${String(++stepN).padStart(2, '0')}-${name}`)
async function step(name, fn) {
  log(`· ${name}`)
  try { await fn() } catch (e) { R.expect(false, `${name}: threw ${String(e.message ?? e).slice(0, 160)}`); await failShotOf(p)(name).catch(() => {}) }
}
const consoleBtn = async (kind, title) => {
  const bx = await box(p, `[data-kind="${kind}"]`)
  await p.mouse.move(bx.x + bx.w * 0.6, bx.y + bx.h * 0.6); await wait(700)
  const e = await p.$(`[data-kind="${kind}"] [role="toolbar"] button[title^="${title}"]`)
  if (e) { await e.click(); await wait(1500) }
  return !!e
}

await signIn(p, me.name)
await p.goto(`${BASE}/workspaces/${seed.wid}`); await revealed(p); await watch(p)
R.expect(!(await welcomeUp(p)), 'no welcome (seen)')
await calm(3000)
// Zoomed out a little: room round the planes.
await fit(p)
await p.mouse.move(W / 2, H - 60)
for (let i = 0; i < 3; i++) { await p.mouse.wheel({ deltaY: 120 }); await wait(80) }
await wait(1500)

await step('a matrix: its wizard', async () => {
  await plus(p, 'matrix')
  await lesson('matrix-wizard')
  await full('matrix-wizard')
  await closeLesson(p)
  await press(p, 'make the matrix', '[data-learn="wizard"]'); await wait(2800)
  // Made in edit mode: piece-made, then unframe (edit-on of a lens).
  await lesson('unframe', { ms: 12000 })
  await closeLesson(p)
  await calm(1500)
})

await step('the matrix stuck to a plane', async () => {
  let mb = await box(p, '[data-kind="matrix"]')
  if (!(await p.$('[data-kind="matrix"][data-editing]'))) await consoleBtn('matrix', 'move, rename')
  mb = await box(p, '[data-kind="matrix"]')
  // A first move in edit mode: stick-hint.
  await drag(p, { x: mb.x + 30, y: mb.y + mb.h / 2 }, { x: mb.x + 30, y: mb.y + mb.h / 2 + 60 })
  await lesson('stick-hint', { ms: 8000 })
  await closeLesson(p)
  // Then to the right edge of 02 Rivals.
  const pl = await p.evaluate((id) => { const r = document.querySelector(`[data-target="plane:${id}"]`).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height } }, seed.planes[1])
  mb = await box(p, '[data-kind="matrix"]')
  await drag(p, { x: mb.x + 30, y: mb.y + mb.h / 2 }, { x: pl.x + pl.w + 50, y: pl.y + 40 + mb.h / 2 }, 35)
  await wait(1500)
  R.expect(!!(await p.$('[data-learn="bond"]')), 'the matrix is stuck (its bond shows)')
  await lesson('stuck', { ms: 10000 })
  await full('stuck')
  await closeLesson(p)
  await editDone(p); await calm(1500)
})

await step('beside', async () => {
  await fit(p)
  const pl = await p.evaluate((id) => { const r = document.querySelector(`[data-target="plane:${id}"]`).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height } }, seed.planes[1])
  await p.mouse.click(pl.x + pl.w / 2, pl.y + pl.h - 20, { clickCount: 2 }); await wait(3500)
  await calm(2000)
  const linked = await p.evaluateHandle(() => [...document.querySelectorAll('button')].find((e) => e.textContent.trim().startsWith('linked')))
  if (linked.asElement()) { await linked.asElement().click(); await wait(900) }
  const bes = await p.$('button[title="open it beside the plane"]')
  R.expect(!!bes, 'the dock offers the stuck matrix beside')
  if (bes) { await bes.click(); await wait(3500) }
  await lesson('beside', { ms: 10000 })
  await full('beside')
  await closeLesson(p)
  R.expect(await toCanvas(p), 'back on the canvas'); await wait(1500)
  await calm(1500)
})

await step("the matrix's focus", async () => {
  await focusPiece(p, 'matrix')
  await lesson('focus-lens', { ms: 10000 })
  await closeLesson(p)
  await lesson('matrix-keys', { ms: 10000 })
  await full('matrix-keys')
  await closeLesson(p)
  await unfocus(p); await calm(1500)
})

await step('a table: wizard, focus, setup', async () => {
  await p.mouse.click(W - 200, 120); await wait(400)
  await plus(p, 'table')
  await lesson('table-wizard')
  await closeLesson(p)
  await p.keyboard.down('Meta'); await p.keyboard.press('Enter'); await p.keyboard.up('Meta'); await wait(3000)
  await calm(1500)
  // unframed: edit mode's `[unframe]`.
  if (!(await p.$('[data-kind="table"][data-editing]'))) await consoleBtn('table', 'move, rename')
  if (await press(p, 'unframe', '[data-kind="table"]')) { await wait(1800); await lesson('unframed', { ms: 10000 }); await full('unframed'); await closeLesson(p) }
  else R.expect(false, 'the table console has [unframe]')
  await press(p, 'frame', '[data-kind="table"]'); await wait(1500)
  await editDone(p); await calm(1500)
  await focusPiece(p, 'table')
  await lesson('table-keys', { ms: 12000 })
  await full('table-keys')
  await closeLesson(p)
  await press(p, 'setup'); await wait(1500)
  await lesson('setup-open')
  await closeLesson(p)
  await p.keyboard.press('Escape'); await wait(800)
  await unfocus(p); await calm(1500)
})

await step('documents', async () => {
  await p.mouse.click(W - 200, 120); await wait(400)
  await plus(p, 'documents')
  await lesson('documents', { ms: 12000 })
  await full('documents')
  await closeLesson(p)
  await editDone(p); await calm(1500)
})

await step('a deck: wizard, focus, a task for a card', async () => {
  await p.mouse.click(W - 200, 120); await wait(400)
  await plus(p, 'kanban')
  await lesson('deck-wizard')
  await closeLesson(p)
  await press(p, 'make the deck', '[data-learn="wizard"]'); await wait(2800)
  await calm(1500); await editDone(p); await calm(1500)
  // The seeded deck (03 This week): its focus.
  await fit(p)
  const d = await p.evaluate((id) => { const r = document.querySelector(`[data-target="piece:${id}"], [data-kind="kanban"]`).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height } }, seed.deck)
  await p.mouse.click(d.x + 80, d.y + 60, { clickCount: 2 }); await wait(3500)
  await lesson('deck', { ms: 15000 })
  await full('deck')
  await closeLesson(p); await calm(1500)
  const tk = await box(p, '[data-task]')
  if (tk) { await p.mouse.click(tk.x + tk.w / 2, tk.y + 12); await wait(1500) }
  await calm(1500)
  const pick = (await press(p, '+ card', '[data-learn="card-panel"]')) || (await press(p, 'card', '[data-learn="card-panel"]'))
  await wait(1000)
  if (pick) { await p.keyboard.type('shelf', { delay: 40 }); await wait(700); await p.keyboard.press('Enter'); await wait(2000) }
  await lesson('task-card', { ms: 10000 })
  await closeLesson(p)
  await p.keyboard.press('Escape'); await wait(800)
  const f = await p.$('button[title="which tasks it shows"]')
  if (f) { await f.click(); await wait(1500) }
  await lesson('deck-filter', { ms: 10000 })
  await closeLesson(p)
  await p.keyboard.press('Escape'); await wait(600)
  await unfocus(p); await calm(1500)
})

await step('a deck of cards', async () => {
  await p.mouse.click(W - 200, 120); await wait(400)
  await plus(p, 'kanban'); await calm(1000)
  await press(p, 'features by status', '[data-learn="wizard"]'); await wait(600)
  await press(p, 'make the deck', '[data-learn="wizard"]'); await wait(2800)
  await lesson('card-deck', { ms: 12000 })
  await closeLesson(p)
  await editDone(p); await calm(1500)
})

await step('a timeline', async () => {
  await p.mouse.click(W - 200, 120); await wait(400)
  await plus(p, 'timeline')
  await lesson('timeline', { ms: 12000 })
  await full('timeline')
  await closeLesson(p)
  await editDone(p); await calm(1500)
})

await step('a delete, then undo', async () => {
  await fit(p)
  if (!(await consoleBtn('timeline', 'move, rename'))) R.note('no edit button on the timeline console')
  const del = await p.$('[data-kind="timeline"] [role="toolbar"] button[data-tone="danger"]')
  R.expect(!!del, 'edit mode has [delete]')
  if (del) { await del.click(); await wait(2500) }
  const btns = await p.$$('[role="alertdialog"] button')
  if (btns.length) { await btns.at(-1).click(); await wait(3000) }
  await lesson('hazard-undo', { ms: 10000 })
  await full('hazard-undo')
  await closeLesson(p)
})

await C.take(p, 'further')
const w = C.all
R.expect(w.twos.length === 0, `never two coach surfaces at once (${JSON.stringify(w.twos)})`)
R.expect(w.busyOpens.length === 0, `nothing opened during a drag or the focus ink (${JSON.stringify(w.busyOpens)})`)
R.expect(w.covers.length === 0, `no lesson covered its anchor for 300 ms or more (${JSON.stringify(w.covers)})`)
if (w.blips.length) R.note(`a lesson over its anchor for under 300 ms (placed again): ${JSON.stringify(w.blips)}`)
log('    every surface, in order:', JSON.stringify(w.events.map((e) => `${e.t}: ${e.surfaces.join(' | ')}`)))
log('    shot lessons:', [...shot].join(', '))
void lessonsUp; void waitFor
const bad = R.summary()
await b.close()
process.exit(bad ? 1 : 0)
