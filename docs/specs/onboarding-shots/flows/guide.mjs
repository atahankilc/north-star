// Flow: `?` REPLAYS (onboarding.md §4.6, §8.6; ported from the O15 builder's flow). An editor (or `viewer`) of a
// filled "Pazar", past the welcome: every note `?` lists for the role is reached by keys alone and played (each page's
// demo ready and drawing, the scene it names), closed by turns with ←, esc, ↵ and a click on `[‹ guide]`, focus back in
// the guide or where it was; each is then ✓ seen; the welcome replays. `extras` adds tips off/on and a reload, the dot,
// `?` ignored while typing, a 768 px window, typed narrowing. Gallery: each played lesson's first page, cropped, as
// `O15-played-<id>` — only for lessons with no anchored shot yet in SHOTS (the other flows run first).
//   PUPPETEER_CORE=… node docs/specs/onboarding-shots/flows/guide.mjs [dark|light] [viewer] [extras]
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { launch, page, signIn, revealed, BASE, wait, SHOTS, lessonShot, cropShot, stepShot } from './lib.mjs'
import { as, seedPazar, seenDoc, writeSeen } from './seed.mjs'
const role = process.argv.includes('viewer') ? 'viewer' : 'editor'
const theme = process.argv[2] === 'light' ? 'light' : 'dark'
const extras = process.argv.includes('extras') || process.env.EXTRAS === '1'
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null
const log = (...a) => console.log(...a)
const fails = []
const expect = (ok, what) => { if (!ok) { log('  FAIL', what); fails.push(what) } else if (process.env.V) log('  ok  ', what) ; return ok }
setTimeout(() => { log('FLOW TIMEOUT', fails); process.exit(3) }, Number(process.env.LIMIT ?? 1500000))
const tag = Date.now().toString(36)
const owner = await as('Gowner' + tag)
const me = await as((role === 'viewer' ? 'Gviewer' : 'Geditor') + tag)
const seed = await seedPazar(owner, [{ user: me, role }])
await writeSeen(me, seenDoc())
const wid = seed.wid
const who = me.name
log(role, theme, 'workspace', wid)
const b = await launch()
const p = await page(b, theme)
const shot = async (nm) => stepShot(p, `O15-${nm}${role === 'viewer' ? '-viewer' : ''}`)
const waitFor = async (fn, ms) => { const s = Date.now(); while (Date.now() - s < ms) { if (await fn()) return true; await wait(120) } return false }
const press = async (k, ms = 140) => { await p.keyboard.press(k); await wait(ms) }

// The played lesson's first page into the gallery, when no anchored shot of it exists yet.
async function galleryShot(id) {
  if (process.env.NO_SHOTS) return
  const sfx = role === 'viewer' ? '-viewer' : ''
  if (existsSync(join(SHOTS, `${lessonShot(id, sfx)}-${theme}.png`)) || existsSync(join(SHOTS, `${lessonShot(id)}-${theme}.png`))) return
  await wait(500)
  const r = await p.evaluate(() => { const e = document.querySelector('section[data-played]'); const q = e?.getBoundingClientRect(); return q && { x: q.left, y: q.top, w: q.width, h: q.height } })
  if (r) await cropShot(p, lessonShot(id, `-played${sfx}`), [r], { pad: 24 })
}

await signIn(p, who)
await p.goto(`${BASE}/workspaces/${wid}`)
await revealed(p)
await waitFor(() => p.evaluate(async () => (await window.__mod('/src/onboarding/progress.ts')).useProgress.getState().loaded), 15000)
await wait(1500)

// Anything the queue put up by itself on arrival: closed first (esc), so `?` starts clean.
const anchoredUp = () => p.evaluate(() => !!document.querySelector('section[data-coach][aria-label^="lesson:"]:not([data-played])'))
for (let k = 0; k < 5 && (await anchoredUp()); k++) { log('  (an arrival lesson showing: esc)'); await press('Escape', 900) }

// The coach knows the role once the workspace is in.
await waitFor(() => p.evaluate(async () => !!(await window.__mod('/src/onboarding/Guide.tsx')).useGuideRole.getState().role), 20000)
// The model `?` draws, for this role.
const model = await p.evaluate(async () => {
  const gm = await window.__mod('/src/onboarding/guideModel.ts')
  const { useProgress } = await window.__mod('/src/onboarding/progress.ts')
  const { useGuideRole } = await window.__mod('/src/onboarding/Guide.tsx')
  const { lessonById } = await window.__mod('/src/onboarding/lessons.ts')
  const { playable } = await window.__mod('/src/onboarding/Demo.tsx')
  const { pagesFor } = await window.__mod('/src/onboarding/queue.ts')
  const aud = useProgress.getState().state?.audience ?? 'new'
  const pageIf = (c) => (c === 'has-tasks-button' ? !!document.querySelector('[data-learn="tasks"]') : true)
  const role = useGuideRole.getState().role
  const m = gm.guideModel(useProgress.getState(), role)
  return { role, areas: m.areas.map((a) => ({ name: a.name, notes: a.notes.map((x) => { const l = lessonById(x.id); const scenes = l.format === 'lesson' ? pagesFor(l, role, aud, {}, pageIf).map((pg) => pg.scene ?? null) : l.rows.map((r) => r.scene); return { id: x.id, title: x.title, line: x.line, scene: x.scene ?? null, scenes, built: scenes.map((s) => (s ? playable(s) === s : null)) } }) })), keys: m.keys.length }
})
const all = model.areas.flatMap((a) => a.notes.map((x) => ({ ...x, area: a.name })))
log(`  role ${model.role}: ${model.areas.length} areas, ${all.length} notes, ${model.keys} keys`)
expect(model.role === role, `the coach knows the role (${model.role})`)
const titles = all.map((x) => x.title)
const dup = titles.filter((t, i) => titles.indexOf(t) !== i)
if (dup.length) log('  duplicate titles', dup)

// The guide's DOM.
const G = '[role="dialog"][aria-label^="Guide"]'
const guideUp = () => p.evaluate((g) => !!document.querySelector(g), G)
const rows = () => p.evaluate((g) => [...document.querySelectorAll(`${g} [role="option"]`)].map((e) => ({ title: e.querySelector('[class*="title"]')?.textContent ?? '', fold: e.hasAttribute('data-fold'), open: e.hasAttribute('data-open'), picked: e.hasAttribute('data-picked'), line: e.querySelector('[class*="what"]')?.textContent ?? '' })), G)
const desc = () => p.evaluate(() => { const a = document.activeElement; return a ? `${a.tagName.toLowerCase()}${a.getAttribute('aria-label') ? `[${a.getAttribute('aria-label')}]` : ''}${a.dataset?.learn ? `{${a.dataset.learn}}` : ''}` : 'none' })

// Keys only: walk to a note (opening its area) and pick it.
async function goTo(note) {
  for (let guard = 0; guard < 120; guard++) {
    const rs = await rows()
    const at = rs.findIndex((r) => r.picked)
    const ti = rs.findIndex((r) => !r.fold && r.title === note.title && r.line === note.line.replace(/`/g, ''))
    if (ti >= 0) {
      if (ti === at) return true
      await press(ti > at ? 'ArrowDown' : 'ArrowUp', 60)
      continue
    }
    const ai = rs.findIndex((r) => r.fold && r.title === note.area)
    if (ai < 0) return false
    if (ai === at) { await press(rs[ai].open ? 'ArrowLeft' : 'ArrowRight', 120); if (rs[ai].open) return false; continue }
    // Another area open: fold it on the way (← from any of its rows).
    await press(ai > at ? 'ArrowDown' : 'ArrowUp', 60)
  }
  return false
}

const played = () => p.evaluate(() => {
  const c = document.querySelector('section[data-played]')
  if (!c) return null
  const strip = c.querySelector('[class*="strip"] [class*="what"]')?.textContent ?? null
  const ready = !!c.querySelector('[data-ready]')
  const fr = c.querySelector('iframe')
  let drawn = 0
  try { drawn = fr?.contentDocument?.body?.querySelectorAll('*').length ?? 0 } catch {}
  const title = c.querySelector('h3')?.textContent ?? ''
  const count = [...c.querySelectorAll('[class*="foot"] span')].map((s) => s.textContent).find((t) => /^\d+ \/ \d+$/.test(t)) ?? null
  return { strip, ready, hasFrame: !!fr, drawn, title, count, focusIn: c.closest('[data-coach]')?.contains(document.activeElement) ?? false, focus: document.activeElement?.textContent?.trim().slice(0, 20) }
})

const results = []
let openedBy = 'key'
async function openGuide(how) {
  if (how === 'key') { await press('?', 500) } else {
    await p.click('button[aria-label^="Guide:"]')
    await wait(500)
  }
  return waitFor(guideUp, 3000)
}

// Where focus is before `?`: the fit button of the side nav (a real, focusable control), or the `?` button itself.
const before = async () => { await p.evaluate(() => { const f = document.querySelector('[data-learn="fit"]'); f?.focus() }); await wait(80); return desc() }

let ref = await before()
expect(await openGuide('key'), '`?` opens the guide')
await wait(400)
expect(/input/.test(await desc()), 'focus in the guide\'s field')
if (extras) await shot('01-closed-areas')

for (let i = 0; i < all.length; i++) {
  const note = all[i]
  if (ONLY && !ONLY.includes(note.id)) continue
  const r = { id: note.id, area: note.area, scenes: note.scenes, built: note.built, ok: true, notes: [] }
  const bad = (w) => { r.ok = false; r.notes.push(w); fails.push(`${note.id}: ${w}`) }
  if (!(await guideUp())) { if (!(await openGuide(openedBy))) { bad('guide did not open'); results.push(r); continue } }
  if (!(await goTo(note))) { bad('could not reach its row by keys'); results.push(r); await press('Escape', 400); continue }
  await press('Enter', 300)
  if (!(await waitFor(async () => !!(await played()), 3000))) { bad('no played lesson in the middle'); results.push(r); continue }
  if (await guideUp()) bad('guide still open under it')
  // Page through.
  let pg = await played()
  const total = Number(pg.count?.split(' / ')[1] ?? 1)
  r.pages = total
  for (let k = 0; k < total; k++) {
    pg = await played()
    if (!pg) { bad(`gone on page ${k + 1}`); break }
    if (!pg.focusIn) bad(`focus not inside it on page ${k + 1}`)
    const want = note.id === 'kind-guide' ? null : note.scenes[k]
    if (pg.hasFrame) {
      const ok = await waitFor(async () => (await played())?.ready, 12000)
      pg = await played()
      if (!ok) bad(`demo frame not ready on page ${k + 1}`)
      else if (pg.drawn < 5) bad(`demo frame drew nothing on page ${k + 1}`)
      const name = pg.strip?.replace(/^▸\s*(live demo · )?/, '')
      if (want && name !== want) bad(`page ${k + 1} names ${name}, wants ${want}`)
      ;(r.shown ??= []).push(name + (want && note.built[k] === false ? ' (placeholder)' : ''))
      if (k === 0) await galleryShot(note.id)
    } else {
      if (want) bad(`page ${k + 1} has no demo, wants ${want}`)
      ;(r.shown ??= []).push('still')
      if (k === 0) await galleryShot(note.id)
    }
    if (k < total - 1) {
      await press(k % 2 ? 'Enter' : 'ArrowRight', 350)
      const nx = await played()
      if (nx?.count !== `${k + 2} / ${total}`) { bad(`→/↵ didn't page (${nx?.count}, focus ${nx?.focus})`); break }
    }
  }
  if (extras && note.id === 'focus-plane') await shot('06-played-lesson')
  // Close: by turns ← ([‹ guide]), esc, ↵ (got it), a click on [‹ guide].
  const how = ['back', 'esc', 'back', 'enter', 'click'][i % 5]
  r.close = how
  // ← goes a page back (O16), from the first page back to the guide: one press per page.
  if (how === 'back') { for (let k = 0; k < total && (await played()); k++) await press('ArrowLeft', 350); await wait(300) }
  else if (how === 'esc') await press('Escape', 500)
  else if (how === 'enter') await press('Enter', 500)
  else { await p.evaluate(() => [...document.querySelectorAll('section[data-played] button')].find((x) => x.textContent.includes('guide'))?.click()); await wait(500) }
  if (!(await waitFor(async () => !(await played()), 3000))) bad(`didn't close by ${how}`)
  if (how === 'back' || how === 'click') {
    if (!(await waitFor(guideUp, 2000))) bad('[‹ guide] did not bring the guide back')
    else {
      await wait(300)
      const rs = await rows()
      const pk = rs.find((x) => x.picked)
      const area = rs.find((x) => x.fold && x.title === note.area)
      if (!area?.open) bad('back in the guide, its area not open')
      if (pk?.title !== note.title) bad(`back in the guide, picked "${pk?.title}"`)
      if (!/input/.test(await desc())) bad('back in the guide, focus not in its field')
      // Seen now.
      const st = await p.evaluate((g, t) => [...document.querySelectorAll(`${g} [role="option"]`)].find((e) => e.querySelector('[class*="title"]')?.textContent === t)?.querySelector('[aria-label="seen"]') != null, G, note.title)
      if (!st) bad('not marked ✓ after playing')
    }
  } else {
    await wait(300)
    if (await guideUp()) bad(`guide came back after ${how}`)
    const now = await desc()
    if (now !== ref) bad(`focus went to ${now}, was ${ref}`)
    // Next time by the other way in.
    openedBy = openedBy === 'key' ? 'button' : 'key'
    if (openedBy === 'button') ref = 'button[Guide: every note again]'
    else ref = await before()
  }
  results.push(r)
  log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${note.area} › ${note.id} (${r.pages}p: ${(r.shown ?? []).join(', ')}; ${how})${r.ok ? '' : ' — ' + r.notes.join('; ')}`)
}
if (await guideUp()) await press('Escape', 400)
// Every note replayed is seen now (✓ in `?`), the kind guide too.
{
  const ids = results.map((r) => r.id)
  const unseen = await p.evaluate(async (ids) => { const { lessonById } = await window.__mod('/src/onboarding/lessons.ts'); const s = (await window.__mod('/src/onboarding/progress.ts')).useProgress.getState(); return ids.filter((i) => (s.seen[i] ?? 0) < lessonById(i).v) }, ids)
  expect(unseen.length === 0, `every replayed note is seen (unseen: ${unseen.join(', ')})`)
}

// The `# start` rows: the welcome plays its pages (as a modal), what's new is off with no release.
if (!ONLY) {
  await openGuide('key')
  const rs = await rows()
  const wn = rs.find((x) => x.title === "what's new")
  expect(wn && /nothing yet/.test(wn.line), `what's new says nothing yet (${wn?.line})`)
  // The first row is the welcome.
  expect(rs.find((x) => x.picked)?.title === 'welcome', 'the welcome row picked first')
  await press('Enter', 900)
  const welcome = await p.evaluate(() => !!document.getElementById('coach-welcome-title'))
  expect(welcome, 'the welcome replays')
  for (let k = 0; k < 4; k++) await press('ArrowRight', 500)
  await press('Escape', 600)
  expect(!(await p.evaluate(() => !!document.getElementById('coach-welcome-title'))), 'the welcome closes')
}

if (extras) {
  // Typed: narrows across lessons and keys.
  await openGuide('key')
  await p.keyboard.type('undo', { delay: 30 }); await wait(400)
  let rs = await rows()
  const keysTyped = await p.evaluate((g) => document.querySelectorAll(`${g} [data-key-row]`).length, G)
  expect(rs.some((x) => !x.fold) && keysTyped > 0, `typed "undo": notes ${rs.filter((x) => !x.fold).length - keysTyped}, keys ${keysTyped}`)
  await p.evaluate((g) => { const i = document.querySelector(`${g} input`); i.select() }, G)
  await p.keyboard.type('focus', { delay: 30 }); await wait(500)
  rs = await rows()
  log('  typed "focus":', rs.filter((x) => !x.fold).map((x) => x.title).join(' | '))
  await shot('03-typed-filter')
  // Enter on a key row plays its lesson.
  await p.evaluate((g) => { const i = document.querySelector(`${g} input`); i.select() }, G)
  await p.keyboard.type('go to canvas', { delay: 30 }); await wait(400)
  for (let g = 0; g < 20 && !(await p.evaluate((g) => !!document.querySelector(`${g} [data-key-row][data-picked]`), G)); g++) await press('ArrowDown', 60)
  const krow = await p.evaluate((g) => document.querySelector(`${g} [data-key-row][data-picked]`)?.textContent ?? null, G)
  log('  picked key row:', krow)
  await press('Enter', 600)
  const viaKey = await played()
  expect(role === 'viewer' ? true : !!viaKey, `↵ on a key row plays its note (${viaKey?.title})`)
  if (viaKey) await press('Escape', 500)
  // # keys open.
  await openGuide('key')
  for (let g = 0; g < 40; g++) { const r2 = await rows(); const at = r2.findIndex((x) => x.picked); if (r2[at]?.fold && r2[at].title === 'every shortcut') break; await press('ArrowUp', 40) }
  await press('ArrowRight', 400)
  await shot('04-keys-open')
  await press('ArrowLeft', 200)
  // One area open.
  for (let g = 0; g < 40; g++) { const r2 = await rows(); const at = r2.findIndex((x) => x.picked); if (r2[at]?.title === 'planes and cards') break; await press('ArrowDown', 40) }
  await press('ArrowRight', 400)
  await shot('02-area-open')
  // Tips off by ⇥, kept through a reload.
  await press('Tab', 400)
  const off = await p.evaluate(async () => (await window.__mod('/src/onboarding/progress.ts')).useProgress.getState().tipsOff)
  expect(off, '⇥ in the guide turns tips off')
  await shot('05-tips-off')
  await press('Escape', 400)
  await wait(1500)
  await p.reload(); await revealed(p)
  await waitFor(() => p.evaluate(async () => (await window.__mod('/src/onboarding/progress.ts')).useProgress.getState().loaded), 15000)
  const off2 = await p.evaluate(async () => (await window.__mod('/src/onboarding/progress.ts')).useProgress.getState().tipsOff)
  expect(off2, 'tips off survives a reload')
  const docOff = await p.evaluate(async () => { const s = (await window.__mod('/src/onboarding/progress.ts')).useProgress.getState(); return { tipsOff: s.state?.tipsOff, hadDoc: s.hadDoc } })
  log('  after reload', JSON.stringify(docOff))
  // Tips off: a lesson that would answer an action doesn't open (focus a plane by double-click).
  if (role === 'editor') {
    // Not yet seen: focus-plane unseen again for this check.
    await p.evaluate(async () => { const m = await window.__mod('/src/onboarding/progress.ts'); const s = m.useProgress.getState(); void s })
    const box = await p.evaluate(() => { const e = document.querySelector('[data-piece-kind="plane"], [data-kind="plane"]') ?? document.querySelector('[data-learn="piece"]'); const r = e?.getBoundingClientRect(); return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null })
    log('  plane at', JSON.stringify(box))
    let lessonSeen = false
    const watch = setInterval(async () => { try { if (await anchoredUp()) lessonSeen = true } catch {} }, 150)
    // Fire events directly as well: an arrival, a focus.
    await p.evaluate(async () => { const e = await window.__mod('/src/onboarding/events.ts'); e.learn('focus-in', { kind: 'plane' }); e.learn('plus-open') })
    await wait(3500)
    clearInterval(watch)
    expect(!lessonSeen, 'tips off: nothing opened by itself')
    // `?` still plays.
    await openGuide('key')
    await press('ArrowDown', 80); await press('ArrowDown', 80)
    const rs3 = await rows(); const ai = rs3.findIndex((x) => x.fold)
    for (let g = 0; g < 10; g++) { const r2 = await rows(); if (r2.findIndex((x) => x.picked) === ai) break; await press('ArrowDown', 60) }
    await press('ArrowRight', 300); await press('ArrowDown', 120); await press('Enter', 600)
    expect(!!(await played()), 'tips off: `?` still plays a note')
    await press('Escape', 500)
  }
  // Back on (button), then the dot: one lesson armed.
  await openGuide('key')
  await p.evaluate((g) => [...document.querySelectorAll(`${g} button`)].find((x) => x.textContent.trim() === 'on')?.click(), G)
  await wait(300)
  expect(!(await p.evaluate(async () => (await window.__mod('/src/onboarding/progress.ts')).useProgress.getState().tipsOff)), 'the `on` button turns tips back on')
  await press('Escape', 400)
  const dot = () => p.evaluate(() => !!document.querySelector('button[aria-label^="Guide:"] [class*="dot"]'))
  expect(!(await dot()), 'no dot while nothing is armed')
  let lit
  const fresh = await p.evaluate(async (ids) => { const { lessonById } = await window.__mod('/src/onboarding/lessons.ts'); const { useProgress } = await window.__mod('/src/onboarding/progress.ts'); const s = useProgress.getState(); const id = ids.find((i) => (s.seen[i] ?? 0) < lessonById(i).v); if (id) s.arm([`${id}@${lessonById(id).v}`]); return id }, all.map((x) => x.id))
  await wait(400)
  lit = await dot()
  log('  armed', fresh)
  if (fresh) {
    expect(lit, `the dot shows while ${fresh} is armed and unseen`)
    await openGuide('button')
    const nw = await p.evaluate((g) => [...document.querySelectorAll(`${g} [role="option"]`)].filter((e) => e.textContent.includes('NEW')).map((e) => e.querySelector('[class*="title"]')?.textContent), G)
    expect(nw.length > 0, `NEW in the guide: ${nw.join(', ')}`)
    const note = all.find((x) => x.id === fresh)
    await goTo(note); await press('Enter', 600)
    for (let k = 0; k < 6 && (await played()); k++) await press('ArrowRight', 300)
    await press('Escape', 500)
    await wait(400)
    expect(!(await dot()), 'the dot clears once it is seen')
  } else log('  (every lesson seen: no fresh one to arm for the dot)')
  // `?` while typing: an input, a textarea, contenteditable.
  for (const kind of ['input', 'textarea', 'div']) {
    await p.evaluate((k) => { const e = document.createElement(k); e.id = 'o15-type'; if (k === 'div') e.contentEditable = 'true'; Object.assign(e.style, { position: 'fixed', left: '400px', top: '10px', width: '200px', height: '30px', zIndex: 99, background: '#222' }); document.body.append(e); e.focus() }, kind)
    await press('?', 300)
    const up = await guideUp()
    const typed = await p.evaluate(() => { const e = document.getElementById('o15-type'); const v = e.value ?? e.textContent; e.remove(); return v })
    expect(!up && typed === '?', `\`?\` ignored while typing in a ${kind === 'div' ? 'contenteditable' : kind} (typed "${typed}")`)
    if (up) await press('Escape', 300)
  }
  // The finder's field (the app's own input).
  await p.keyboard.down('Meta'); await p.keyboard.press('f'); await p.keyboard.up('Meta'); await wait(500)
  await press('?', 300)
  expect(!(await guideUp()), '`?` ignored in the finder\'s field')
  await press('Escape', 400)
  // A 768 px tall window: at most 768 − 96, the list scrolling inside with one area open.
  await p.setViewport({ width: 1366, height: 768, deviceScaleFactor: 2 }); await wait(600)
  await openGuide('key')
  for (let g = 0; g < 40; g++) { const r2 = await rows(); const at = r2.findIndex((x) => x.picked); if (r2[at]?.title === 'planes and cards') break; await press('ArrowDown', 40) }
  await press('ArrowRight', 500)
  const geo = await p.evaluate((g) => { const d = document.querySelector(g); const l = d.querySelector('[role="listbox"]'); const r = d.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: r.height, list: l.clientHeight, scroll: l.scrollHeight } }, G)
  log('  768:', JSON.stringify(geo))
  expect(geo.top >= 47 && geo.bottom <= 768 - 47, `the guide fits 768 px less 48 top and bottom (${geo.top}–${geo.bottom})`)
  expect(geo.scroll > geo.list, 'the list scrolls inside on 768 px')
  // Walk to the bottom: the picked row stays in view.
  for (let k = 0; k < 30; k++) await press('ArrowDown', 30)
  const inView = await p.evaluate((g) => { const d = document.querySelector(g); const l = d.querySelector('[role="listbox"]'); const pk = l.querySelector('[data-picked]'); if (!pk) return null; const a = pk.getBoundingClientRect(), b = l.getBoundingClientRect(); return a.top >= b.top - 1 && a.bottom <= b.bottom + 1 }, G)
  expect(inView, 'the picked row is scrolled into view')
  await shot('07-768-scroll')
  await press('Escape', 300)
  await p.setViewport({ width: 1568, height: 980, deviceScaleFactor: 2 })
}

const okN = results.filter((r) => r.ok).length
log(`SUMMARY ${role} ${theme}: ${okN} / ${results.length} lessons replayed ok; placeholders: ${results.flatMap((r) => (r.shown ?? []).filter((s) => s.includes('placeholder'))).length}; fails ${fails.length}`)
for (const f of fails) log('  -', f)
await b.close()
process.exit(fails.length ? 1 : 0)
