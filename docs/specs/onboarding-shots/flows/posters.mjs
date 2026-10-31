// The poster frame of every demo scene (src/demo/scenes/), dark and light, into docs/specs/onboarding-shots/scenes/.
// Opened at the scene's own size (as the coach's frame and scripts/check-scenes.mjs open it), seeked to its poster with
// the director's deterministic seek (`window.__demo.seek`), shot at 1× (the coach shows them ~246 px wide).
//   PUPPETEER_CORE=… DEMO_URL=http://localhost:5244 node docs/specs/onboarding-shots/flows/posters.mjs
// SCENES=a,b limits it; THEMES=dark,light.
import { readdirSync, mkdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch, wait, log, BASE } from './lib.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const DEMO = (process.env.DEMO_URL ?? BASE).replace(/\/$/, '')
const OUT = resolve(process.env.SHOTS ?? join(here, '..'), 'scenes')
mkdirSync(OUT, { recursive: true })
const all = readdirSync(resolve(here, '../../../../src/demo/scenes')).filter((f) => /\.tsx?$/.test(f)).map((f) => f.replace(/\.tsx?$/, ''))
const scenes = process.env.SCENES ? process.env.SCENES.split(',') : all
const themes = (process.env.THEMES ?? 'dark,light').split(',')
const b = await launch()
const sizes = {}
const fails = []
const ready = async (pg) => { for (let i = 0; i < 200; i++) { const s = await pg.evaluate(() => (window.__demo ? { ready: window.__demo.ready, error: window.__demo.error, poster: window.__demo.poster, size: window.__demo.size } : null)); if (s?.ready || s?.error) return s; await wait(150) } return null }
for (const scene of scenes) {
  for (const theme of themes) {
    const pg = await b.newPage()
    try {
      await pg.evaluateOnNewDocument((t) => { localStorage.setItem('north-star.theme', t); localStorage.setItem('north-star.motion', 'full') }, theme)
      if (sizes[scene]) await pg.setViewport({ width: sizes[scene][0], height: sizes[scene][1], deviceScaleFactor: 1 })
      await pg.goto(`${DEMO}/demo.html#scene=${scene}`)
      let s = await ready(pg)
      if (s?.ready && s.size && !sizes[scene]) {
        sizes[scene] = s.size
        await pg.setViewport({ width: s.size[0], height: s.size[1], deviceScaleFactor: 1 })
        await pg.reload(); s = await ready(pg)
      }
      if (!s?.ready) { fails.push(`${scene} ${theme}: ${s?.error ?? 'not ready'}`); continue }
      await pg.evaluate(() => window.__demo.pause())
      await pg.evaluate((t) => window.__demo.seek(t), s.poster)
      await wait(120)
      await pg.screenshot({ path: join(OUT, `${scene}-${theme}.png`) })
      log(`  ${scene} ${theme} ${s.size?.join('×')} poster ${s.poster} ms`)
    } catch (e) {
      fails.push(`${scene} ${theme}: ${String(e).slice(0, 120)}`)
    } finally {
      await pg.close()
    }
  }
}
await b.close()
log(`posters: ${scenes.length} scenes × ${themes.length} themes, ${fails.length} failed`)
for (const f of fails) log('  -', f)
process.exit(fails.length ? 1 : 0)
