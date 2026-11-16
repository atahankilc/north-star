// `npm run check:scenes` (D-401): every lesson's scene (src/demo/scenes) played to its end in headless Chrome; a step
// that finds nothing (`[demo] …: nothing there`), any other error on the page or a scene that never gets ready fails
// it. A scene's steps point at the real app by selector and by words, so a change to the UI can stop a lesson's demo
// part way, saying nothing: eight had (a console's `done`, a wizard's tabs reading `02`, a chip's mark), found
// 2026-11-17. About two minutes: by hand and in CI's own job, not in the write hook.
//   npm run check:scenes -- wizard     only the scenes with `wizard` in their name
// The long check (pictures of every scene in both themes, reduced motion, in a frame; about a quarter of an hour a
// theme) is scripts/check-scenes.mjs: `npm run check:scenes:full`, which needs DEMO_URL and PUPPETEER_CORE.
import { devServer, headless } from './headless.mjs'
import { walk } from './lib.mjs'

const AT_ONCE = Number(process.env.CHECK_LIVE_AT_ONCE) || 4
const READY_MS = 60000
const only = process.argv[2]
const scenes = walk('src/demo/scenes', /\.tsx?$/)
  .map((p) => p.split('/').pop().replace(/\.tsx?$/, ''))
  .filter((s) => !only || s.includes(only))
  .sort()

const { launch } = await headless('check:scenes')
const server = await devServer()
const problems = []
const browsers = []
try {
  const one = async (browser, scene) => {
    const page = await browser.newPage()
    await page.setViewport({ width: 960, height: 600 })
    const said = []
    page.on('console', (m) => m.type() === 'error' && said.push(m.text().replace(/\s+/g, ' ').slice(0, 260)))
    page.on('pageerror', (e) => said.push(`error: ${e.message.slice(0, 260)}`))
    try {
      await page.goto(`${server.url}/demo.html#scene=${scene}`, { waitUntil: 'load', timeout: READY_MS })
      await page.waitForFunction(() => window.__demo?.ready || window.__demo?.error, { timeout: READY_MS })
      const error = await page.evaluate(() => window.__demo.error)
      if (error) said.push(`the scene didn't start: ${String(error).slice(0, 260)}`)
      else {
        // Held, then taken to its end: every step runs on the way, in the scene's own time.
        await page.evaluate(() => window.__demo.pause())
        await page.evaluate(() => window.__demo.seek(window.__demo.length))
        await new Promise((r) => setTimeout(r, 300))
      }
    } catch (e) {
      said.push(`never ready: ${e.message.slice(0, 200)}`)
    }
    for (const w of new Set(said)) problems.push(`${scene}: ${w}`)
    await page.close()
  }
  for (let i = 0; i < Math.min(AT_ONCE, scenes.length); i++) browsers.push(await launch())
  const queue = [...scenes]
  await Promise.all(
    browsers.map(async (b) => {
      for (let s = queue.shift(); s; s = queue.shift()) await one(b, s)
    }),
  )
  console.log(`check:scenes: ${scenes.length} scenes played to their end`)
} finally {
  await Promise.all(browsers.map((b) => b.close()))
  server.stop()
}

if (problems.length) {
  console.error(`check:scenes: ${problems.length} problem${problems.length === 1 ? '' : 's'}\n` + problems.map((p) => `  - ${p}`).join('\n'))
  process.exit(1)
}
console.log('scenes ok')
