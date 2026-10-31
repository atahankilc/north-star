// Flow: a person who ASKS TO JOIN with a code (onboarding.md §4.7, the O8 recipe): the workspaces page's code field →
// the pending row "waiting for an owner to let you in" → the join-pending lesson beside it, not over it; the empty
// state's choices step aside.
//   PUPPETEER_CORE=… node docs/specs/onboarding-shots/flows/join.mjs [dark|light]
import { launch, page, signIn, revealed, watch, collector, results, until, shootLesson, stepShot, lessonShot, wait, log, BASE } from './lib.mjs'
import { as, seedPazar } from './seed.mjs'

const theme = process.argv[2] ?? 'dark'
const R = results(`asks to join (${theme})`)
const C = collector()
setTimeout(() => { log('FLOW TIMEOUT'); R.summary(); process.exit(3) }, 300000)
const tag = Date.now().toString(36)
const owner = await as('Jowner' + tag)
const seed = await seedPazar(owner)
// A code as the app makes them (no 0/O/1/I/L), on the workspace and in inviteCodes/, in one batch.
const { doc, writeBatch } = await import('firebase/firestore')
const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const code = Array.from({ length: 8 }, () => A[Math.floor(Math.random() * A.length)]).join('')
const wb = writeBatch(owner.fs)
wb.update(doc(owner.fs, 'workspaces', seed.wid), { inviteCode: code })
wb.set(doc(owner.fs, 'inviteCodes', code), { workspaceId: seed.wid, createdBy: owner.uid })
await wb.commit()
const b = await launch()
const p = await page(b, theme)
await signIn(p, 'Dana' + tag)
await p.goto(BASE + '/workspaces'); await revealed(p); await watch(p)
await wait(800)
await p.type('#ws-code', String(code))
await p.keyboard.press('Enter')
await p.waitForSelector('[data-learn="pending-row"]', { timeout: 20000 }).catch(() => {})
const row = await p.$eval('[data-learn="pending-row"]', (e) => e.textContent).catch(() => '')
R.expect(/waiting for an owner to let you in/.test(row), `the pending row (${row})`)
const l = await until(p, 'join-pending', 15000)
R.expect(!!l, 'join-pending shows')
if (l) await shootLesson(p, R, 'join-pending', lessonShot('join-pending'))
R.expect(!(await p.$('[data-learn="workspaces-empty"] [data-coach]')), 'the empty state’s choices step aside')
await stepShot(p, 'O16-join-01-pending')
await C.take(p, 'dana')
R.expect(C.all.twos.length === 0, `never two coach surfaces at once (${JSON.stringify(C.all.twos)})`)
R.expect(C.all.covers.length === 0, `no lesson covered its anchor (${JSON.stringify(C.all.covers)})`)
const bad = R.summary()
await b.close()
process.exit(bad ? 1 : 0)
