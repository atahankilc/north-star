// Flow: a VIEWER (onboarding.md §8.6). Carol, a viewer of Alice's filled "Pazar": the viewer's welcome (page 1 names
// the owner, page 3 "Find your way", page 4's viewer line), no empty hint, no kind guide (no `+`), focus a plane (the
// viewer's page), a card's panel, a refused edit (the viewer lesson by the toast), the finder; every lesson shown is
// one for viewers; `?` lists only viewer notes. Shots: lessons cropped with their anchors (suffix `-viewer`).
//   PUPPETEER_CORE=… node docs/specs/onboarding-shots/flows/viewer.mjs [dark|light]
import { launch, page, signIn, revealed, watch, collector, results, until, closeLesson, settle, shootLesson, cropShot, stepShot, lessonShot, lessonById,
  box, mid, drag, fit, cardSel, welcomeUp, welcomeTitle, waitFor, wait, log, BASE, failShotOf, LESSONS } from './lib.mjs'
import { as, seedPazar } from './seed.mjs'

const theme = process.argv[2] ?? 'dark'
const R = results(`viewer (${theme})`)
const C = collector()
setTimeout(() => { log('FLOW TIMEOUT'); R.summary(); process.exit(3) }, Number(process.env.LIMIT ?? 900000))
const tag = Date.now().toString(36)
const alice = await as('Alice' + tag)
const carol = await as('Carol' + tag)
const seed = await seedPazar(alice, [{ user: carol, role: 'viewer' }])
log('workspace', seed.wid)
const b = await launch()
const p = await page(b, theme)
const shot = new Set()
const shown = new Set()
const onOther = async (l) => { if (l.id) shown.add(l.id); if (l.id && !shot.has(l.id)) { shot.add(l.id); await shootLesson(p, R, l.id, lessonShot(l.id, '-viewer'), { soft: true }) } }
async function lesson(id, opts = {}) {
  const l = await until(p, id, opts.ms ?? 15000, { onOther })
  R.expect(!!l, `${id} shows from its trigger`)
  if (l) shown.add(id)
  if (l && !shot.has(id)) { shot.add(id); await shootLesson(p, R, id, lessonShot(id, '-viewer')) }
  return l
}
let stepN = 0
const lessonsUpIds = async () => (await (await import('./lib.mjs')).lessonsUp(p)).map((l) => l.id)
const full = (name) => stepShot(p, `O16-viewer-${String(++stepN).padStart(2, '0')}-${name}`)
async function step(name, fn) {
  log(`· ${name}`)
  try { await fn() } catch (e) { R.expect(false, `${name}: threw ${String(e.message ?? e).slice(0, 160)}`); await failShotOf(p)(name).catch(() => {}) }
}

await signIn(p, carol.name)
await step('the viewer welcome', async () => {
  await p.goto(`${BASE}/workspaces/${seed.wid}`); await revealed(p); await watch(p)
  R.expect(await waitFor(() => welcomeUp(p), 30000), 'the welcome opens')
  await wait(1200)
  const pages = []
  for (let i = 0; i < 4; i++) {
    pages.push({ title: await welcomeTitle(p), body: await p.evaluate(() => document.querySelector('[role="dialog"][aria-modal="true"]')?.innerText ?? '') })
    await p.waitForFunction(() => document.querySelector('[role=dialog] [data-ready]') || !document.querySelector('[role=dialog] iframe'), { timeout: 8000 }).catch(() => {})
    await wait(600)
    await cropShot(p, lessonShot('welcome', `-viewer-p${i + 1}`), [await box(p, '[role="dialog"][aria-modal="true"]')], { pad: 24 })
    if (i === 0) await full('welcome-viewer')
    await p.keyboard.press('ArrowRight'); await wait(1300)
  }
  log('    titles', JSON.stringify(pages.map((x) => x.title)))
  R.expect(pages[0].title === `${alice.name} started this workspace`, `page 1 names the owner (${pages[0].title})`)
  R.expect(pages[2].title === 'Find your way', `page 3 "Find your way" (${pages[2].title})`)
  R.expect(/As a viewer you read, comment and keep your own documents/.test(pages[3].body), 'page 4 has the viewer line')
  R.expect(!pages.some((x) => /Add anything/.test(x.title)), 'no "Add anything" page')
  R.expect(!(await welcomeUp(p)), 'closed after page 4')
  await wait(1500)
  R.expect(!(await p.evaluate(() => [...document.querySelectorAll('[data-coach][role="note"]')].some((e) => e.getBoundingClientRect().width > 0))), 'no empty hint')
  R.expect(!(await p.$('[data-learn="plus"]')), 'no `+` for a viewer (so no kind guide)')
})

await step('focus a plane', async () => {
  await settle(p, 2000, { onOther })
  const pl = await p.evaluate((id) => { const e = document.querySelector(`[data-target="plane:${id}"]`); const r = e?.getBoundingClientRect(); return r && { x: r.left, y: r.top, w: r.width, h: r.height } }, seed.planes[0])
  await p.mouse.click(pl.x + pl.w / 2, pl.y + pl.h - 20, { clickCount: 2 }); await wait(1200)
  if (await lesson('focus-plane')) {
    const body = await p.evaluate(() => [...document.querySelectorAll('section[data-coach][aria-label^="lesson:"]')].at(-1)?.innerText ?? '')
    R.expect(/click a card to read it/.test(body) && !/adds cards/.test(body), 'the viewer page of focus-plane (read, not add)')
    await full('focus-plane')
  }
  await closeLesson(p)
  await settle(p, 2000, { onOther })
})

await step("a card's panel", async () => {
  const s = await cardSel(p, 'Office workers')
  const sb = await box(p, `[data-target="${s}"]`)
  await p.mouse.click(sb.x + 40, sb.y + 20); await wait(1200)
  await lesson('card-panel')
  await closeLesson(p)
  await p.keyboard.press('Escape'); await wait(700)
})

await step('a refused edit', async () => {
  const s = await cardSel(p, 'Students')
  const sb = await box(p, `[data-target="${s}"]`)
  // A drag (viewers' cards don't move), then a press on Delete with it selected, then ⌘Z: any write is refused with the
  // viewer notice, which shows the lesson.
  await drag(p, { x: sb.x + 60, y: sb.y + 30 }, { x: sb.x + 60, y: sb.y + 200 })
  await wait(1500)
  if (!(await lessonsUpIds()).includes('viewer')) { await p.mouse.click(sb.x + 60, sb.y + 30); await wait(500); await p.keyboard.press('Delete'); await wait(1500) }
  if (!(await lessonsUpIds()).includes('viewer')) { await p.keyboard.down('Meta'); await p.keyboard.press('z'); await p.keyboard.up('Meta'); await wait(1500) }
  const notice = await p.evaluate(() => document.querySelector('[data-learn="toast"]')?.textContent ?? '')
  log('    toast:', notice)
  await lesson('viewer', { ms: 10000 })
  await full('viewer')
  await closeLesson(p)
  await p.keyboard.press('Escape'); await wait(2600)
})

await step('the finder', async () => {
  await settle(p, 1500, { onOther })
  await p.mouse.click(1300, 930); await wait(300)
  await p.keyboard.down('Meta'); await p.keyboard.press('f'); await p.keyboard.up('Meta'); await wait(700)
  await lesson('finder', { ms: 10000 })
  await closeLesson(p)
  await p.keyboard.press('Escape'); await wait(1000)
})

await step('`?` lists only notes for viewers', async () => {
  await settle(p, 1500, { onOther })
  const m = await p.evaluate(async () => {
    const gm = await window.__mod('/src/onboarding/guideModel.ts')
    const { useProgress } = await window.__mod('/src/onboarding/progress.ts')
    // The role as the app knows it (the workspace's roles), not Guide.tsx's store: a module another session is editing
    // gets a new URL (?t=…) in the dev server, and importing it here would read a second, empty copy.
    const { getWs } = await window.__mod('/src/state/wsStore.ts')
    const { firebase } = await window.__mod('/src/data/firebase.ts')
    const role = getWs()?.workspace?.roles?.[firebase.auth.currentUser.uid] ?? null
    const model = gm.guideModel(useProgress.getState(), role)
    return { role, ids: model.areas.flatMap((a) => a.notes.map((x) => x.id)), keys: model.keys.map((k) => k.keys ?? k.key ?? JSON.stringify(k)).slice(0, 80) }
  })
  R.expect(m.role === 'viewer', `the workspace says viewer (${m.role})`)
  const wrong = m.ids.filter((id) => { const l = lessonById(id); return l && !l.roles.includes('viewer') })
  R.expect(wrong.length === 0, `\`?\` lists ${m.ids.length} notes, none for editors only (${wrong.join(', ')})`)
  await p.keyboard.press('?'); await wait(900)
  await full('guide-viewer')
  const g = await box(p, '[role="dialog"][aria-label^="Guide"]')
  await cropShot(p, 'O15-01-guide-viewer', [g], { pad: 24 })
  await p.keyboard.press('Escape'); await wait(600)
})

await C.take(p, 'carol')
const w = C.all
const editorOnly = [...shown].filter((id) => { const l = lessonById(id); return l && !l.roles.includes('viewer') })
R.expect(editorOnly.length === 0, `no editing lesson shown to the viewer (shown: ${[...shown].join(', ')})`)
R.expect(w.twos.length === 0, `never two coach surfaces at once (${JSON.stringify(w.twos)})`)
R.expect(w.busyOpens.length === 0, `nothing opened during a drag or the focus ink (${JSON.stringify(w.busyOpens)})`)
R.expect(w.covers.length === 0, `no lesson covered its anchor for 300 ms or more (${JSON.stringify(w.covers)})`)
if (w.blips.length) R.note(`a lesson over its anchor for under 300 ms: ${JSON.stringify(w.blips)}`)
log('    every surface, in order:', JSON.stringify(w.events.map((e) => `${e.t}: ${e.surfaces.join(' | ')}`)))
void LESSONS; void mid; void fit
const bad = R.summary()
await b.close()
process.exit(bad ? 1 : 0)
