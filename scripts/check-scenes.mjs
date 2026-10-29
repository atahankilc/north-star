// The onboarding's scenes check (D-315, docs/specs/onboarding.md §8, onboarding-run.md O7): every demo scene played in
// headless Chrome, in dark and light, against the rules of the demo realm. For each scene and theme:
// - it loads and says `ready`; no console errors or page errors; no request to Firebase or Google (googleapis,
//   firebaseio, firebasestorage, firebaseapp, gstatic) or to an emulator's port (8080, 9099, 9010, 9199, 5001);
// - seek 0, the poster and the end each draw; the same seek draws the same picture twice (deterministic);
// - after a press no :focus-visible rule of the page's CSS matches what has the focus, a field to type in aside (a real
//   click leaves no focus ring; the focus itself stays where the app put it);
// - every press lands on what its step meant, and what it lands on shows its hover first (data-demo-hover, demoCss.ts) (the director records the element each move aimed at and what was under
//   the cursor when it pressed);
// - a seek into the middle, then past the end, leaves a stage drawn (nothing left mid-drag to blank it);
// - after one whole loop (hold, break, rebuild) the first frame is the first frame from before (pixels, under a
//   threshold), both seeked and as the rebuild hands over, and no frame was shown while the stage was made again (the
//   seam);
// - under reduced motion it shows the poster, still (two shots a second apart, the same);
// - an 8-frame strip (seeks at 8 even times from 0 to the end of the hold) and a contact sheet of it, for the eye;
// - played as the coach shows it, inside a parent's `<iframe inert>` with the focus on the parent's button: the parent
//   keeps its focus, and what a scene types lands in its field, with no shortcut's side effect (side view, snapping).
//
// Needs a dev server or `vite preview` serving demo.html (DEMO_URL, default http://localhost:5185) and puppeteer-core,
// which is not a dependency of the app: install it anywhere (`npm i puppeteer-core@24` in a scratch folder) and point
// PUPPETEER_CORE at that folder's node_modules/puppeteer-core. CHROME is the browser (default: macOS Chrome); SHOTS where
// the strips go (default ./scene-shots); SCENES a comma list (default: every scene in src/demo/scenes/).
//   DEMO_URL=http://localhost:5185 PUPPETEER_CORE=/tmp/pp/node_modules/puppeteer-core node scripts/check-scenes.mjs
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const BASE = (process.env.DEMO_URL ?? 'http://localhost:5185').replace(/\/$/, '')
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const SHOTS = resolve(process.env.SHOTS ?? 'scene-shots')
const PREFIX = process.env.SHOT_PREFIX ?? ''
// THEMES='' plays only the in-a-frame pass.
const THEMES = (process.env.THEMES ?? 'dark,light').split(',').filter(Boolean)
const HOLD = 1000
const STRIP = 8
// Share of pixels that may differ between two pictures that should be the same (text antialiasing, the cursor's
// sub-pixel place).
const SAME = 0.004

if (!process.env.PUPPETEER_CORE) {
  console.error('check-scenes: set PUPPETEER_CORE to a puppeteer-core folder (npm i puppeteer-core@24 somewhere else; not in the repo)')
  process.exit(2)
}
const entry = existsSync(join(process.env.PUPPETEER_CORE, 'lib/esm/puppeteer/puppeteer-core.js')) ? join(process.env.PUPPETEER_CORE, 'lib/esm/puppeteer/puppeteer-core.js') : process.env.PUPPETEER_CORE
const { default: puppeteer } = await import(pathToFileURL(entry).href)

const all = readdirSync(resolve('src/demo/scenes')).filter((f) => /\.tsx?$/.test(f)).map((f) => f.replace(/\.tsx?$/, ''))
const scenes = process.env.SCENES ? process.env.SCENES.split(',') : all
mkdirSync(SHOTS, { recursive: true })

const FORBIDDEN = /googleapis|firebaseio|firebasestorage|firebaseapp|gstatic|:(8080|9099|9010|9199|5001)\b/
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', defaultViewport: { width: 960, height: 600, deviceScaleFactor: 1 } })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const failures = []
const fail = (where, what) => {
  failures.push(`${where}: ${what}`)
  console.log(`  ✗ ${what}`)
}
const ok = (what) => console.log(`  ✓ ${what}`)

// A page for comparing and laying out pictures (canvas in the browser: no image library needed).
const lab = await browser.newPage()
await lab.goto('about:blank')
async function diff(a, b) {
  return lab.evaluate(
    async (a, b) => {
      const load = async (s) => createImageBitmap(await (await fetch(`data:image/png;base64,${s}`)).blob())
      const [x, y] = await Promise.all([load(a), load(b)])
      const px = (img) => {
        const c = new OffscreenCanvas(img.width, img.height)
        const g = c.getContext('2d')
        g.drawImage(img, 0, 0)
        return g.getImageData(0, 0, img.width, img.height).data
      }
      if (x.width !== y.width || x.height !== y.height) return 1
      const p = px(x)
      const q = px(y)
      let n = 0
      for (let i = 0; i < p.length; i += 4) if (Math.abs(p[i] - q[i]) + Math.abs(p[i + 1] - q[i + 1]) + Math.abs(p[i + 2] - q[i + 2]) > 48) n++
      return n / (p.length / 4)
    },
    a,
    b,
  )
}
async function sheet(frames, labels) {
  const data = await lab.evaluate(
    async (frames, labels) => {
      const imgs = await Promise.all(frames.map(async (s) => createImageBitmap(await (await fetch(`data:image/png;base64,${s}`)).blob())))
      const w = 480
      const h = 300
      const c = new OffscreenCanvas(w * 4 + 5 * 8, (h + 22) * 2 + 3 * 8)
      const g = c.getContext('2d')
      g.fillStyle = '#222'
      g.fillRect(0, 0, c.width, c.height)
      imgs.forEach((img, i) => {
        const x = 8 + (i % 4) * (w + 8)
        const y = 8 + Math.floor(i / 4) * (h + 22 + 8)
        g.drawImage(img, x, y + 22, w, h)
        g.fillStyle = '#ddd'
        g.font = '13px monospace'
        g.fillText(labels[i], x, y + 15)
      })
      const blob = await c.convertToBlob({ type: 'image/png' })
      const bytes = new Uint8Array(await blob.arrayBuffer())
      let s = ''
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
      return btoa(s)
    },
    frames,
    labels,
  )
  return Buffer.from(data, 'base64')
}

// One scene in one theme and motion: a fresh page, watched for errors and requests, ready.
async function open(scene, theme, reduced) {
  const page = await browser.newPage()
  const errors = []
  const requests = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 300)))
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.slice(0, 300)}`))
  page.on('request', (r) => FORBIDDEN.test(r.url()) && requests.push(r.url()))
  await page.evaluateOnNewDocument(
    (theme, reduced) => {
      localStorage.setItem('north-star.theme', theme)
      localStorage.setItem('north-star.motion', reduced ? 'reduced' : 'full')
    },
    theme,
    reduced,
  )
  await page.goto(`${BASE}/demo.html#scene=${scene}`)
  // Polled from here: the page's own frames and timers are the demo's clock.
  let state = null
  for (let i = 0; i < 200; i++) {
    state = await page.evaluate(() => (window.__demo ? { ready: window.__demo.ready, error: window.__demo.error, length: window.__demo.length, poster: window.__demo.poster } : null))
    if (state?.ready || state?.error) break
    await wait(150)
  }
  // Played on its own when opened alone: held for the shots.
  await page.evaluate(() => window.__demo?.pause())
  return { page, errors, requests, state }
}
const seek = async (page, t) => {
  await page.evaluate((t) => window.__demo.seek(t), t)
  await wait(60)
  return page.screenshot({ encoding: 'base64' })
}

for (const scene of scenes) {
  for (const theme of THEMES) {
    const where = `${scene} (${theme})`
    console.log(`${where}`)
    const { page, errors, requests, state } = await open(scene, theme, false)
    if (!state?.ready) {
      fail(where, `not ready${state?.error ? `: ${state.error}` : ''}`)
      await page.close()
      continue
    }
    ok(`ready (${state.length} ms, poster ${state.poster})`)
    const end = state.length + HOLD
    const first = await seek(page, 0)
    const again = await seek(page, 0)
    const d0 = await diff(first, again)
    d0 <= SAME ? ok(`seek 0 the same twice (${(d0 * 100).toFixed(2)} %)`) : fail(where, `seek 0 differs from itself: ${(d0 * 100).toFixed(2)} %`)
    const poster = await seek(page, state.poster)
    const poster2 = await seek(page, state.poster)
    const dp = await diff(poster, poster2)
    dp <= SAME ? ok(`poster the same twice (${(dp * 100).toFixed(2)} %)`) : fail(where, `poster differs from itself: ${(dp * 100).toFixed(2)} %`)
    const last = await seek(page, end)
    // The presses of a whole run (the seek to the end ran every step).
    const { presses, rings } = await page.evaluate(() => window.__demo.record())
    rings.length ? fail(where, `a focus ring after a press: ${rings.join('; ')}`) : ok('no focus ring after a press (no :focus-visible rule draws on what has the focus, a field aside)')
    const off = presses.filter((p) => !p.ok)
    if (off.length) fail(where, `pressed the wrong thing: ${off.map((p) => `at ${p.at} meant ${p.meant}, got ${p.got}`).join('; ')}`)
    else ok(`${presses.length} press${presses.length === 1 ? '' : 'es'}, each on what it meant`)
    // Lit as a real pointer lights it (`:hover`, through the demo's `data-demo-hover`) before it's pressed.
    const dark = presses.filter((p) => !p.lit)
    if (dark.length) fail(where, `pressed without its hover showing: ${dark.map((p) => `${p.at} ms ${p.got}`).join('; ')}`)
    else if (presses.length) ok('every press lit (hover) before it went down')
    // Into the middle (mid-drag, a menu open) at a few moments, each then past the end: the stage is still drawn, the
    // same end.
    for (const k of [0.3, 0.45, 0.6, 0.75]) {
      const mid = Math.round(state.length * k)
      await seek(page, mid)
      const again2 = await seek(page, end)
      const drawn = await page.evaluate(() => ({ kids: document.querySelector('[data-scene]')?.querySelectorAll('*').length ?? 0, error: window.__demo.error ?? null }))
      const de = await diff(last, again2)
      drawn.kids > 50 && !drawn.error && de <= SAME ? ok(`seek ${mid}, then the end: drawn (${drawn.kids} elements), the same end (${(de * 100).toFixed(2)} %)`) : fail(where, `seek ${mid}, then the end: ${drawn.error ?? `${drawn.kids} elements`}, the end ${(de * 100).toFixed(2)} % off`)
    }
    const moved = await diff(first, poster)
    moved > SAME ? ok(`the poster isn't the first frame (${(moved * 100).toFixed(1)} % changed)`) : console.log(`  · the poster looks like the first frame (${(moved * 100).toFixed(2)} %)`)
    // The strip: 8 even moments from 0 to the end of the hold.
    const frames = []
    const labels = []
    for (let i = 0; i < STRIP; i++) {
      const t = Math.round((end * i) / (STRIP - 1))
      frames.push(i === 0 ? first : i === STRIP - 1 ? last : await seek(page, t))
      labels.push(`${scene} · ${theme} · t=${t}`)
    }
    for (let i = 0; i < STRIP; i++) writeFileSync(join(SHOTS, `${PREFIX}${scene}-${theme}-${i}.png`), Buffer.from(frames[i], 'base64'))
    writeFileSync(join(SHOTS, `${PREFIX}${scene}-strip-${theme}.png`), await sheet(frames, labels))
    ok(`strip: ${join(SHOTS, `${PREFIX}${scene}-strip-${theme}.png`)}`)
    // One whole loop played, then its first frame against the first from before.
    await seek(page, 0)
    const before = await page.evaluate(() => window.__demo.loops)
    await page.evaluate(() => window.__demo.play())
    let looped = false
    for (let i = 0; i < Math.ceil((end + 4000) / 100); i++) {
      await wait(100)
      if ((await page.evaluate(() => window.__demo.loops)) > before) {
        looped = true
        break
      }
    }
    if (!looped) fail(where, 'no loop came round')
    else {
      const { leaks } = await page.evaluate(() => window.__demo.record())
      leaks === 0 ? ok('the seam: no frame shown while the stage was made again') : fail(where, `the seam: ${leaks} frames shown while the stage was made again`)
      const handed = await page.screenshot({ encoding: 'base64' })
      const dh = await diff(first, handed)
      dh <= SAME * 5 ? ok(`the rebuilt first frame is the first frame (${(dh * 100).toFixed(2)} %)`) : fail(where, `the rebuilt first frame differs: ${(dh * 100).toFixed(2)} %`)
      const after = await seek(page, 0)
      const da = await diff(first, after)
      da <= SAME ? ok(`seek 0 after a loop is the same (${(da * 100).toFixed(2)} %)`) : fail(where, `seek 0 after a loop differs: ${(da * 100).toFixed(2)} %`)
    }
    if (errors.length) fail(where, `console errors: ${errors.join(' | ')}`)
    else ok('no console errors')
    if (requests.length) fail(where, `requests out: ${[...new Set(requests)].join(', ')}`)
    else ok('0 requests to Firebase, Google or an emulator')
    await page.close()

    // Reduced motion: the poster, still.
    const r = await open(scene, theme, true)
    if (!r.state?.ready) fail(where, 'reduced motion: not ready')
    else {
      const a = await r.page.screenshot({ encoding: 'base64' })
      await wait(1000)
      const b = await r.page.screenshot({ encoding: 'base64' })
      const still = await diff(a, b)
      const t = await r.page.evaluate(() => window.__demo.t)
      still <= SAME && t === state.poster ? ok(`reduced motion: the poster (t=${t}), still`) : fail(where, `reduced motion: t=${t}, ${(still * 100).toFixed(2)} % moved in a second`)
      writeFileSync(join(SHOTS, `${PREFIX}${scene}-reduced-${theme}.png`), Buffer.from(a, 'base64'))
      if (r.errors.length) fail(where, `reduced motion: console errors: ${r.errors.join(' | ')}`)
      if (r.requests.length) fail(where, `reduced motion: requests out: ${r.requests.join(', ')}`)
    }
    await r.page.close()
  }
}

// As the coach shows it (src/onboarding/Demo.tsx): inside a parent page's `<iframe inert tabindex=-1>`, the focus on a
// button of the parent, played in real time. The frame never has the focus there, so what a scene types must still land
// in its field (not in the canvas's shortcuts), and the parent keeps its focus. What each scene types, and where it lands:
const TYPED = { 'finder-go': 'permit', 'peers-comment': 'Is €14 still right?' }
const SIDE = '[data-learn="side-view"]'
for (const scene of scenes) {
  const where = `${scene} (in a frame)`
  console.log(where)
  // A browser context of its own: the reduced-motion pass above left `north-star.motion=reduced` in this origin's
  // storage (demo.html copies motion from there), which would hold the scene on its poster. Full motion, dark, here.
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.slice(0, 300)}`))
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('north-star.motion', 'full')
      localStorage.setItem('north-star.theme', 'dark')
    } catch {}
  })
  // A same-origin page that runs nothing of ours (the demo's style sheet in the build; a plain file in dev), turned into
  // the parent: the frame only talks to a parent of its own origin.
  await page.goto(`${BASE}/demo.html#scene=${scene}`)
  const plain = await page.evaluate(() => document.querySelector('link[rel="stylesheet"]')?.href ?? '/package.json')
  await page.goto(new URL(plain, BASE).href)
  await page.setContent(`<!doctype html><button id="host">next</button><iframe inert tabindex="-1" width="960" height="600" src="${BASE}/demo.html#scene=${scene}"></iframe>
    <script>
      const f = document.querySelector('iframe')
      document.getElementById('host').focus()
      addEventListener('message', (e) => {
        if (e.source === f.contentWindow && e.data?.ns === 'north-star-demo' && e.data.type === 'ready') f.contentWindow.postMessage({ ns: 'north-star-demo', type: 'play' }, location.origin)
      })
    </script>`)
  // The typing seen as it happens: a field there and empty first, then growing to what's typed (not a poster's text).
  const seen = { text: '', emptyFirst: false, grew: true, side: false, snap: null, snapAfter: null, lostFocus: false, length: 0, t: 0, motion: null }
  for (let i = 0; i < 400; i++) {
    const now = await page.evaluate((SIDE) => {
      const f = document.querySelector('iframe')
      const w = f.contentWindow
      const d = f.contentDocument
      if (!w?.__demo?.ready) return null
      const fields = [...d.querySelectorAll('input, textarea')].map((e) => e.value)
      return { t: w.__demo.t, length: w.__demo.length, loops: w.__demo.loops, reduced: w.localStorage.getItem('north-star.motion'), fields: fields.length, text: fields.sort((a, b) => b.length - a.length)[0] ?? '', side: !!d.querySelector(SIDE), snap: w.localStorage.getItem('north-star:snap'), host: document.activeElement?.id ?? document.activeElement?.tagName }
    }, SIDE)
    if (now) {
      if (seen.snap === null) seen.snap = now.snap ?? 'unset'
      if (now.fields && !now.text && !seen.text) seen.emptyFirst = true
      if (now.text.length > seen.text.length) {
        // Each new value goes on from the last one seen (typing), never jumps to something else.
        if (seen.text && !now.text.startsWith(seen.text)) seen.grew = false
        seen.text = now.text
      }
      seen.t = Math.max(seen.t, now.t)
      seen.motion = now.reduced
      seen.side ||= now.side
      seen.snapAfter = now.snap ?? 'unset'
      seen.lostFocus ||= now.host !== 'host'
      seen.length = now.length
      if (now.loops > 0 || now.t >= now.length) break
    }
    await wait(50)
  }
  if (process.env.DEBUG_FRAME) console.log('  ·', JSON.stringify(seen))
  if (!seen.length) fail(where, 'never ready in the frame')
  else {
    seen.t > 500 ? ok(`the scene played in the frame (to t=${Math.round(seen.t)}, motion ${seen.motion ?? 'unset'})`) : fail(where, `the scene didn't play in the frame (t stayed at ${Math.round(seen.t)}, motion ${seen.motion})`)
    seen.lostFocus ? fail(where, 'the parent lost its focus to the frame') : ok('the parent kept its focus')
    const want = TYPED[scene]
    if (want) {
      seen.emptyFirst && seen.grew && seen.text.startsWith(want) ? ok(`typed "${want}" landed in its field, growing from empty`) : fail(where, `typed "${want}": the field got "${seen.text}" (empty first: ${seen.emptyFirst}, grew letter by letter: ${seen.grew})`)
      seen.side ? fail(where, 'a typed letter opened the tasks side view') : ok('no side view opened by the typing')
      seen.snap === seen.snapAfter ? ok('snapping unchanged') : fail(where, `snapping changed: ${seen.snap} → ${seen.snapAfter}`)
    }
    if (errors.length) fail(where, `errors: ${errors.join(' | ')}`)
  }
  await context.close()
}

await browser.close()
console.log(failures.length ? `\ncheck-scenes: ${failures.length} failed\n${failures.map((f) => `- ${f}`).join('\n')}` : `\ncheck-scenes: ${scenes.length} scenes × ${THEMES.length} themes passed`)
process.exit(failures.length ? 1 : 0)
