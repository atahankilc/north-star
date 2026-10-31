// The five nudges (onboarding.md §4.5), each on a page load of its own (at most one a load), fired as the queue fires
// them: `idle` with the counts it would carry (the real idle needs ≥ 3 min in the workspace; the O13 flow saw one come
// by itself). Each: shown, beside its anchor, not over it; cropped for the gallery. Also the empty timeline's line.
//   PUPPETEER_CORE=… node docs/specs/onboarding-shots/flows/nudges.mjs [dark|light]
import { launch, page, signIn, revealed, results, settle, cropShot, lessonShot, box, plus, fit, editDone, focusPiece, waitFor, wait, log, BASE } from './lib.mjs'
import { as, seedPazar, seenDoc, writeSeen } from './seed.mjs'

const theme = process.argv[2] ?? 'dark'
const R = results(`nudges (${theme})`)
setTimeout(() => { log('FLOW TIMEOUT'); R.summary(); process.exit(3) }, Number(process.env.LIMIT ?? 600000))
const tag = Date.now().toString(36)
const me = await as('Nudge' + tag)
const peer = await as('Peer' + tag)
const seed = await seedPazar(me, [{ user: peer, role: 'editor' }])
await writeSeen(me, seenDoc({ seen: { 'side-nav': 1, 'people-here': 1, 'piece-console': 1 } }))
const b = await launch()
const NUDGES = [
  ['nudge-focus', { pieces: 3, cards: 4, seen: 2, decks: 0, peerFor: 0 }, 'sidenav'],
  ['nudge-finder', { pieces: 0, cards: 20, seen: 2, decks: 0, peerFor: 0 }, 'finder'],
  ['nudge-help', { pieces: 0, cards: 4, seen: 6, decks: 0, peerFor: 0 }, 'sidenav'],
  ['nudge-side', { pieces: 0, cards: 4, seen: 2, decks: 1, peerFor: 0 }, 'tasks'],
  ['nudge-follow', { pieces: 0, cards: 4, seen: 2, decks: 0, peerFor: 90000 }, 'people'],
]
const ix = { 'nudge-focus': 1, 'nudge-finder': 2, 'nudge-help': 3, 'nudge-side': 4, 'nudge-follow': 5 }
const P = await page(b, theme)
await signIn(P, peer.name)
await P.goto(`${BASE}/workspaces/${seed.wid}`); await revealed(P)
for (const k of [0, 1, 2, 3, 4, 5]) { await P.keyboard.press('Escape'); await wait(300); void k }
const p = await page(b, theme)
await signIn(p, me.name)
const seenTexts = new Set()
for (const [id, payload, anchor] of NUDGES) {
  await p.goto(`${BASE}/workspaces/${seed.wid}`); await revealed(p)
  await settle(p, 3000)
  await p.mouse.move(780, 600)
  await p.evaluate(async (pl) => (await window.__mod('/src/onboarding/learn.ts')).learn('idle', pl), payload)
  const up = await waitFor(() => p.evaluate(() => !!document.querySelector('[data-coach][role="status"]')), 25000)
  R.expect(up, `${id} shows`)
  if (!up) continue
  await wait(900)
  const g = await p.evaluate((anchor) => {
    const n = [...document.querySelectorAll('[data-coach][role="status"]')].at(-1)
    const r = n.getBoundingClientRect()
    const a = [...document.querySelectorAll(`[data-learn="${anchor}"]`)].filter((e) => e.getBoundingClientRect().width > 0 && !e.closest('[data-coach]')).at(-1)?.getBoundingClientRect()
    const ov = a ? Math.max(0, Math.min(r.right, a.right) - Math.max(r.left, a.left)) * Math.max(0, Math.min(r.bottom, a.bottom) - Math.max(r.top, a.top)) : -1
    const R2 = (q) => q && { x: q.left, y: q.top, w: q.width, h: q.height }
    return { text: n.textContent.trim(), n: R2(r), a: R2(a), over: Math.round(ov) }
  }, anchor)
  log(`    ${id}: "${g.text}"`)
  // Each its own words (no other nudge answering the same idle).
  R.expect(!seenTexts.has(g.text), `${id}: its own words`)
  seenTexts.add(g.text)
  R.expect(g.over <= 0, `${id}: beside its anchor ${anchor}, not over it (over ${g.over})`)
  await cropShot(p, `O13-${String(10 + ix[id]).padStart(2, '0')}-${id}`, [g.n, g.a], { minW: 560, minH: 320 })
}
// The empty timeline's line (format empty): a timeline focused with no tasks to show, on a workspace with no deck.
{
  const { doc, collection, setDoc } = await import('firebase/firestore')
  const w = doc(collection(me.fs, 'workspaces'))
  await setDoc(w, { name: 'Empty days', ownerId: me.uid, memberIds: [me.uid], roles: { [me.uid]: 'owner' }, inviteCode: 'ZZEMPTY' + Math.floor(Math.random() * 9 + 2), createdAt: Date.now() })
  await p.goto(`${BASE}/workspaces/${w.id}`); await revealed(p); await settle(p, 2500)
  await plus(p, 'timeline'); await settle(p, 2500); await editDone(p); await settle(p, 1500)
  await focusPiece(p, 'timeline'); await wait(1500); await settle(p, 2500)
  const hint = await p.evaluate(() => { const e = [...document.querySelectorAll('[data-coach][role="note"]')].find((x) => x.getBoundingClientRect().width > 0); const r = e?.getBoundingClientRect(); return e ? { text: e.textContent.trim(), r: { x: r.left, y: r.top, w: r.width, h: r.height } } : null })
  R.expect(!!hint, `the empty timeline's line shows (${hint?.text ?? 'none'})`)
  if (hint) await cropShot(p, lessonShot('empty-timeline'), [hint.r], { minW: 640, minH: 400 })
}
void fit; void box
const bad = R.summary()
await b.close()
process.exit(bad ? 1 : 0)
