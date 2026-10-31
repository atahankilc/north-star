// Flow: an INVITED editor (onboarding.md §8.6). Alice owns a filled "Pazar" (two planes of cards, a deck) and has it
// open; she invites Bob by email. Bob: the workspaces page's invite row → join → the invited welcome ("Alice… started
// this workspace") → people here (Alice is) → following her → a comment → the threads panel → the canvases prompt →
// Settings → a competitor's card → a deck's focus → the tasks side view → a task Alice gives him. Alice then opens
// Settings → people (the owner's lesson). Shots: every lesson cropped with its anchor, a full screen per step.
//   PUPPETEER_CORE=… node docs/specs/onboarding-shots/flows/invited.mjs [dark|light]
import { doc, updateDoc } from 'firebase/firestore'
import { lessonGeom, lessonsUp, launch, page, signIn, revealed, watch, collector, results, until, closeLesson, settle, shootLesson, cropShot, stepShot, lessonShot,
  surfaces, box, mid, press, fit, cardSel, welcomeUp, welcomeTitle, waitFor, wait, log, BASE, failShotOf } from './lib.mjs'
import { as, seedPazar } from './seed.mjs'

const theme = process.argv[2] ?? 'dark'
const R = results(`invited (${theme})`)
const C = collector()
setTimeout(() => { log('FLOW TIMEOUT'); R.summary(); process.exit(3) }, Number(process.env.LIMIT ?? 1200000))
const tag = Date.now().toString(36)
const alice = await as('Alice' + tag)
const bob = await as('Bob' + tag)
const seed = await seedPazar(alice)
log('workspace', seed.wid)
const b = await launch()
const shot = new Set()
let failShot = async (n) => { try { await failShotOf(B)(n) } catch {} }
const mk = (p) => ({
  onOther: async (l) => { if (l.id && !shot.has(l.id)) { shot.add(l.id); await shootLesson(p, R, l.id, lessonShot(l.id), { soft: true }) } },
})
async function lesson(p, id, opts = {}) {
  const l = await until(p, id, opts.ms ?? 15000, mk(p))
  R.expect(!!l, `${id} shows from its trigger`)
  if (l && !shot.has(id)) { shot.add(id); await shootLesson(p, R, id, lessonShot(id, opts.suffix ?? '')) }
  return l
}
let stepN = 0
const full = (p, name) => stepShot(p, `O16-invited-${String(++stepN).padStart(2, '0')}-${name}`)
async function step(name, fn) {
  log(`· ${name}`)
  try { await fn() } catch (e) { R.expect(false, `${name}: threw ${String(e.message ?? e).slice(0, 160)}`); await failShot(name) }
}

// Alice, there first.
const A = await page(b, theme)
await signIn(A, alice.name)
await A.goto(`${BASE}/workspaces/${seed.wid}`); await revealed(A)
if (await waitFor(() => welcomeUp(A), 15000)) { await wait(800); await A.keyboard.press('Escape'); await wait(1500) }
await settle(A, 2500, mk(A))
await A.evaluate(async (email) => { const ws = (await window.__mod('/src/state/wsStore.ts')).getWs(); const W = await window.__mod('/src/data/workspaces.ts'); await W.inviteEmail(ws.workspace, email) }, `${bob.name.toLowerCase()}@example.com`)

const B = await page(b, theme)
await signIn(B, bob.name)
await step('the invite row', async () => {
  await B.goto(BASE + '/workspaces'); await revealed(B); await watch(B)
  R.expect(await waitFor(() => B.evaluate(() => [...document.querySelectorAll('button')].some((x) => x.textContent.trim() === 'join')), 15000), 'the invite row with [join]')
  await full(B, 'invite-row')
  await B.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'join').click())
  await B.waitForFunction(() => location.pathname.startsWith('/workspaces/'), { timeout: 20000 })
  await C.take(B, 'workspaces')
})

await step('the invited welcome', async () => {
  await revealed(B); await watch(B)
  R.expect(await waitFor(() => welcomeUp(B), 30000), 'the welcome opens')
  await wait(1200)
  const titles = []
  for (let i = 0; i < 4; i++) {
    titles.push(await welcomeTitle(B))
    await B.waitForFunction(() => document.querySelector('[role=dialog] [data-ready]') || !document.querySelector('[role=dialog] iframe'), { timeout: 8000 }).catch(() => {})
    await wait(600)
    await cropShot(B, lessonShot('welcome', `-invited-p${i + 1}`), [await box(B, '[role="dialog"][aria-modal="true"]')], { pad: 24 })
    if (i === 0) await full(B, 'welcome-invited')
    await B.keyboard.press(i % 2 ? 'Enter' : 'ArrowRight'); await wait(1300)
  }
  log('    titles', JSON.stringify(titles))
  R.expect(titles[0] === `${alice.name} started this workspace`, `page 1 names the owner ("${titles[0]}")`)
  R.expect(/Add anything/.test(titles[2] ?? ''), 'page 3 for an editor: "Add anything with +"')
  R.expect(!(await welcomeUp(B)), 'closed after page 4')
  R.expect(!(await B.evaluate(() => [...document.querySelectorAll('[data-coach][role="note"]')].some((e) => e.getBoundingClientRect().width > 0))), 'no empty-canvas hint on a filled canvas')
})

await step('people here', async () => {
  await lesson(B, 'people-here', { ms: 20000 })
  await full(B, 'people-here')
  await closeLesson(B)
})

await step('following Alice', async () => {
  await settle(B, 1500, mk(B))
  const sq = await box(B, `[data-learn="people"] button[aria-label^="${alice.name}"]`)
  R.expect(!!sq, "Alice's square in people here")
  if (sq) await B.mouse.click(sq.x + sq.w / 2, sq.y + sq.h / 2)
  await lesson(B, 'following')
  await closeLesson(B)
  await B.keyboard.press('Escape'); await wait(900)
  R.expect(!(await B.$('[data-learn="follow-label"]')), 'esc stops following')
})

await step('a comment', async () => {
  await fit(B); await settle(B, 1500, mk(B))
  const pl = await box(B, '[data-target^="plane:"]')
  await B.mouse.click(pl.x + 30, pl.y + pl.h - 30, { button: 'right' }); await wait(900)
  // The right-click lesson shows on the open menu (where it can be tried) and stays a moment after it closes (O16c).
  if (await until(B, 'right-click', 5000, { closeOthers: false })) {
    shot.add('right-click')
    await shootLesson(B, R, 'right-click', lessonShot('right-click'))
    await B.keyboard.press('Escape'); await wait(1200)
    const ups = await lessonsUp(B)
    const up = ups.some((l) => l.id === 'right-click' && !l.done)
    if (!up) log('    lessons up after the menu closed:', JSON.stringify(ups), JSON.stringify(await surfaces(B)))
    R.expect(up, 'the right-click lesson stays after its menu closes')
    if (up) {
      const g = await lessonGeom(B, 'right-click')
      R.expect(g && g.anchor && g.over <= 0, `after its menu closed it still keeps clear of where the menu was (over ${g?.over} px², lesson ${JSON.stringify(g?.lesson)}, menu ${JSON.stringify(g?.anchor)})`)
    }
    await B.mouse.click(pl.x + 30, pl.y + pl.h - 30, { button: 'right' }); await wait(900)
  }
  const row = await B.$('[role="menu"] [data-key="comment"]')
  R.expect(!!row, 'the right-click prompt has comment')
  if (row) await row.click()
  await lesson(B, 'comment')
  await closeLesson(B)
  const field = await box(B, '[data-learn="thread"] textarea')
  if (field) { await B.mouse.click(field.x + 20, field.y + 10); await B.keyboard.type('Can we test 12 dishes next week?'); await B.keyboard.press('Enter'); await wait(1500) }
  await B.keyboard.press('Escape'); await wait(1200)
})

await step('the threads panel', async () => {
  const t = await box(B, 'button[aria-label^="Threads"]')
  if (t) await B.mouse.click(t.x + t.w / 2, t.y + t.h / 2)
  await lesson(B, 'threads-panel')
  await full(B, 'threads-panel')
  await closeLesson(B)
  const shut = await box(B, '[aria-label="Close threads"]')
  if (shut) await B.mouse.click(shut.x + shut.w / 2, shut.y + shut.h / 2)
  await wait(1200)
})

await step('the canvases prompt', async () => {
  await settle(B, 1000, mk(B))
  const c = await box(B, '[data-learn="crumb"]')
  await B.mouse.click(c.x + c.w / 2, c.y + c.h / 2)
  await lesson(B, 'canvases')
  await closeLesson(B)
  await B.keyboard.press('Escape'); await wait(1000)
})

await step('settings', async () => {
  const g = await box(B, 'header button[aria-haspopup="dialog"][aria-label^="Settings"]')
  await B.mouse.click(g.x + g.w / 2, g.y + g.h / 2)
  await lesson(B, 'settings')
  await full(B, 'settings')
  await closeLesson(B)
  await B.keyboard.press('Escape'); await wait(1000)
})

await step("a competitor's card", async () => {
  await fit(B); await settle(B, 1000, mk(B))
  const rivals = await B.evaluate((id) => { const e = document.querySelector(`[data-target="plane:${id}"]`); const r = e?.getBoundingClientRect(); return r && { x: r.left, y: r.top, w: r.width, h: r.height } }, seed.planes[1])
  await B.mouse.click(rivals.x + rivals.w / 2, rivals.y + rivals.h - 20, { clickCount: 2 }); await wait(3200)
  await settle(B, 2000, mk(B))
  const s = await cardSel(B, 'Shef')
  const sb = await box(B, `[data-target="${s}"]`)
  await B.mouse.move(sb.x + 40, sb.y + 20); await wait(500)
  await B.mouse.click(sb.x + 40, sb.y + 20); await wait(1000)
  for (let k = 0; k < 3; k++) { const l = await until(B, 'competitor-features', 6000, mk(B)); if (l) break }
  if (!shot.has('competitor-features')) await lesson(B, 'competitor-features')
  await closeLesson(B)
  await B.keyboard.press('Escape'); await wait(600)
  await B.keyboard.press('Escape'); await wait(2600)
})

await step("a deck's focus", async () => {
  await settle(B, 1500, mk(B))
  const d = await box(B, '[data-kind="kanban"]')
  await B.mouse.click(d.x + 80, d.y + 60, { clickCount: 2 }); await wait(3500)
  await lesson(B, 'deck', { ms: 20000 })
  await full(B, 'deck')
  await closeLesson(B)
  await B.keyboard.press('Escape'); await wait(2600)
})

await step('the tasks side view', async () => {
  await settle(B, 1500, mk(B))
  await B.mouse.click(1300, 930); await wait(300)
  await B.keyboard.press('t'); await wait(1800)
  await lesson(B, 'side-view')
  await full(B, 'side-view')
  await closeLesson(B)
  await B.keyboard.press('t'); await wait(1500)
})

await step('a task Alice gives Bob', async () => {
  await settle(B, 2500, mk(B))
  const tasks = await A.evaluate(() => (window.__ws?.tasks ?? []).map((t) => t.id))
  const tid = tasks[0] ?? (await A.evaluate(async () => { const ws = (await window.__mod('/src/state/wsStore.ts')).getWs(); return ws.tasks?.[0]?.id }))
  R.expect(!!tid, 'a task to give')
  await updateDoc(doc(alice.fs, 'workspaces', seed.wid, 'tasks', tid), { assignee: bob.uid, assigneeName: bob.name, givenAt: Date.now(), givenBy: alice.uid, updatedAt: Date.now() })
  await lesson(B, 'tasks-given', { ms: 25000 })
  await closeLesson(B)
})

await step("Alice: Settings' people page (owner)", async () => {
  await watch(A)
  await settle(A, 2000, mk(A))
  const g = await box(A, 'header button[aria-haspopup="dialog"][aria-label^="Settings"]')
  await A.mouse.click(g.x + g.w / 2, g.y + g.h / 2); await wait(1200)
  await settle(A, 2500, mk(A))
  const pp = await A.evaluate(() => { const e = [...document.querySelectorAll('[data-learn="settings-menu"] button')].find((b) => b.textContent.trim().startsWith('people')); const r = e?.getBoundingClientRect(); return r && { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
  if (pp) await A.mouse.click(pp.x, pp.y)
  await lesson(A, 'people-settings')
  await full(A, 'people-settings-owner')
  await closeLesson(A)
  await A.keyboard.press('Escape'); await wait(800)
})

await C.take(B, 'bob'); await C.take(A, 'alice')
const w = C.all
R.expect(w.twos.length === 0, `never two coach surfaces at once (${JSON.stringify(w.twos)})`)
R.expect(w.busyOpens.length === 0, `nothing opened during a drag or the focus ink (${JSON.stringify(w.busyOpens)})`)
R.expect(w.covers.length === 0, `no lesson covered its anchor for 300 ms or more (${JSON.stringify(w.covers)})`)
if (w.blips.length) R.note(`a lesson over its anchor for under 300 ms (placed again): ${JSON.stringify(w.blips)}`)
log('    every surface, in order:', JSON.stringify(w.events.map((e) => `${e.where} ${e.t}: ${e.surfaces.join(' | ')}`)))
log('    shot lessons:', [...shot].join(', '))
const bad = R.summary()
await b.close()
process.exit(bad ? 1 : 0)
