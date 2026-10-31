// Writes docs/specs/onboarding-shots/index.html from the shots in the folder: a heading per run step (O8 … O15, the
// flows' full screens, the scenes' posters), each shot with a one-line caption; dark and light side by side.
//   node docs/specs/onboarding-shots/flows/build-index.mjs
import { readdirSync, writeFileSync, statSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const DIR = resolve(here, '..')
const { LESSONS } = await import(pathToFileURL(resolve(here, '../../../../src/onboarding/lessons.ts')).href)
const byId = Object.fromEntries(LESSONS.map((l) => [l.id, l]))
const files = readdirSync(DIR).filter((f) => f.endsWith('.png'))
const scenes = readdirSync(join(DIR, 'scenes')).filter((f) => f.endsWith('.png'))
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const plain = (s) => String(s).replace(/`/g, '')

// Pairs: <name>-dark.png / <name>-light.png.
const pairs = {}
for (const f of files) {
  const m = f.match(/^(.*)-(dark|light)\.png$/)
  if (!m) continue
  ;(pairs[m[1]] ??= {})[m[2]] = f
}
const STEPS = {
  O8: 'O8 · the start: workspaces page, welcome, empty canvas',
  O9: 'O9 · the canvas: the `+` kind guide, pieces, consoles, sticking, beside, delete',
  O10: 'O10 · planes and cards, links',
  O11: 'O11 · text, matrix and table',
  O12: 'O12 · documents, decks and days',
  O13: 'O13 · together, finding, canvases, settings, the viewer',
  O14: "O14 · what's new after a release",
  O15: 'O15 · `?`, the guide',
  O16: 'O16 · the flows, one full screen per step',
}
// What to look at, by surface (the rest is generic).
const LOOK = {
  welcome: 'the 4 pages; the demo strip under each page; [skip] on every page; page 1 names the owner when invited; the viewer line on page 4 for viewers',
  'workspaces-empty': 'the three framed choices under NO WORKSPACES YET; 01 focuses the name field',
  'empty-canvas': 'the line and its dashed arrow to the side nav’s magenta `+`; gone at the first piece',
  'empty-plane': 'the line centred in the empty plane; it should wait for the focus lesson (see the bug list)',
  'kind-guide': 'the column glued to the `+` menu, following the picked row; its demo',
}
const NOTFINAL = 'Not final: O16a is polishing src/onboarding/* while these were taken (words, placement, sizes may still move).'
function caption(name) {
  const m = name.match(/^(O\d+)-(\d+)-(.+)$/)
  if (!m) return { title: name, line: '' }
  let id = m[3]
  let variant = ''
  for (const v of ['-new-p', '-invited-p', '-viewer-p', '-played-viewer', '-played', '-viewer', '-new']) {
    const i = id.indexOf(v)
    if (i > 0) { variant = id.slice(i + 1); id = id.slice(0, i); break }
  }
  const l = byId[id]
  if (!l) return { title: m[3].replace(/-/g, ' '), line: '' }
  const t = l.pages?.[0]?.title ?? l.line ?? (l.format === 'guide' ? 'the kind guide' : '')
  const how = variant.startsWith('played') ? 'played from `?` (in the middle; no anchored shot of it in the flows yet)' : variant.includes('-p') || /^(new|invited|viewer)-p/.test(variant) ? `page ${variant.split('-p')[1]} (${variant.split('-p')[0]})` : variant === 'viewer' ? 'as a viewer' : variant === 'new' ? 'marked NEW after a release' : `beside its anchor \`${l.anchor ?? 'none'}\``
  const trig = (l.trigger ?? []).map((x) => x.event + (x.when ? ` ${JSON.stringify(x.when)}` : '')).join(' or ')
  const look = LOOK[id] ?? (l.anchor ? `the card beside \`${l.anchor}\`, not over it; the words against what's on screen` : 'the words against what is on screen')
  return { title: `${id} — “${plain(t)}”`, line: `${l.format}, ${how}; shown on ${trig || '—'}. Look at: ${look}.` }
}
const FLOWCAP = {
  new: 'a new person, through the UI', more: 'the new person further along: pieces beyond planes', invited: 'Bob, invited by Alice', viewer: 'Carol, a viewer',
  release: "back after a release (`?release=sample`)", tipsoff: 'tips off', guide: '`?`',
}
const groups = {}
for (const name of Object.keys(pairs).sort()) {
  const step = name.match(/^(O\d+)/)?.[1] ?? 'other'
  ;(groups[step] ??= []).push(name)
}
let total = 0
for (const f of files) total += statSync(join(DIR, f)).size
for (const f of scenes) total += statSync(join(DIR, 'scenes', f)).size
const img = (f, alt) => (f ? `<a href="${esc(f)}"><img src="${esc(f)}" alt="${esc(alt)}" loading="lazy"></a>` : '<span class="missing">—</span>')
const section = (step) => {
  const names = groups[step] ?? []
  const items = names.map((n) => {
    let c = caption(n)
    if (step === 'O16') { const m = n.match(/^O16-(\w+)-(\d+)-(.+)$/); c = { title: `${m?.[1] ?? ''} ${m?.[2] ?? ''} · ${m?.[3]?.replace(/-/g, ' ') ?? n}`, line: `The ${FLOWCAP[m?.[1]] ?? ''} flow (flows/${m?.[1]}.mjs), full screen at 1×.` } }
    if (step === 'O14' && !c.line) c = { title: n.replace(/^O14-\d+-/, '').replace(/-/g, ' '), line: "What's new (sample release, dev only): pages, the dot, `?` with NEW. Look at: the tabs read whole, the modal's top stays put." }
    if (step === 'O15' && !c.line) c = { title: n.replace(/^O15-\d*-?/, '').replace(/-/g, ' '), line: 'The `?` guide.' }
    return `<figure><figcaption><b>${esc(c.title)}</b> <span>${esc(c.line)}</span></figcaption><div class="pair">${img(pairs[n].dark, n + ' dark')}${img(pairs[n].light, n + ' light')}</div></figure>`
  })
  return `<section id="${step}"><h2>${esc(STEPS[step] ?? step)}</h2>${items.join('\n')}</section>`
}
const sceneIds = [...new Set(scenes.map((f) => f.replace(/-(dark|light)\.png$/, '')))].sort()
const sceneHtml = sceneIds.map((id) => `<figure class="scene"><figcaption><b>${esc(id)}</b> <a href="/demo.html#scene=${esc(id)}">/demo.html#scene=${esc(id)}</a></figcaption><div class="pair">${img(`scenes/${id}-dark.png`, id)}${img(`scenes/${id}-light.png`, id)}</div></figure>`).join('\n')
const order = ['O8', 'O9', 'O10', 'O11', 'O12', 'O13', 'O14', 'O15', 'O16']
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>North Star · onboarding shots (O16)</title>
<link rel="stylesheet" href="../../../src/styles/tokens.css">
<style>
@font-face { font-family: 'Geist Variable'; src: url(../../../node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2) format('woff2'); font-weight: 100 900; }
@font-face { font-family: 'Geist Mono Variable'; src: url(../../../node_modules/@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2) format('woff2'); font-weight: 100 900; }
* { box-sizing: border-box; }
html, body { margin: 0; }
body { background: var(--bg); color: var(--fg); font-family: var(--font-mono); font-size: var(--text-sm); }
nav { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; gap: 16px; padding: 10px 32px; border-bottom: 1px solid var(--line); background: var(--bg); }
nav a { color: var(--fg-muted); text-decoration: none; font-size: var(--text-xs); }
nav a:hover { color: var(--fg-strong); }
main { padding: 8px 32px 120px; }
.intro { max-width: 980px; margin: 28px 0; color: var(--fg-muted); font: var(--text-md)/1.6 var(--font-display); }
.intro h1 { margin: 0 0 12px; color: var(--fg-strong); font: 500 var(--text-xl)/1.1 var(--font-display); letter-spacing: var(--track-title); }
.intro code { color: var(--fg); font: var(--text-xs) var(--font-mono); }
h2 { margin: 64px 0 16px; color: var(--fg-strong); font: 500 var(--text-xs)/1 var(--font-mono); letter-spacing: var(--track-label); text-transform: uppercase; border-bottom: 1px solid var(--line); padding-bottom: 8px; }
figure { margin: 0 0 40px; }
figcaption { margin-bottom: 10px; color: var(--fg-muted); font-size: var(--text-xs); line-height: 1.6; }
figcaption b { color: var(--fg); font-weight: 500; margin-right: 8px; }
figcaption a { color: var(--accent-cyan); }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
.pair img { display: block; width: 100%; height: auto; border: 1px solid var(--line); }
.scenes { display: grid; grid-template-columns: repeat(auto-fill, minmax(560px, 1fr)); gap: 0 32px; }
.missing { color: var(--fg-faint); }
</style>
</head>
<body>
<nav>${order.filter((s) => groups[s]).map((s) => `<a href="#${s}" title="${esc(STEPS[s] ?? s)}">step ${s.slice(1)}</a>`).join('')}<a href="#scenes">scenes</a></nav>
<main>
<div class="intro">
<h1>Onboarding: every surface and lesson, dark and light</h1>
<p>Taken ${new Date().toISOString().slice(0, 10)} by the O16 flows (<code>flows/*.mjs</code>, headless Chrome on the emulators, the onboarding driven by its real triggers through the UI) at 1568 × 980, 2×. Lessons are cropped to the card plus its anchor; the flows' full screens are at 1×. Left dark, right light; click a shot for full size. ${esc(NOTFINAL)} Missing lessons (no real trigger reached in a flow) are shown as played from <code>?</code>.</p>
<p>Scenes play live with the dev server: <code>npm run dev -- --port 5181</code>, then the links below (<code>/demo.html#scene=&lt;id&gt;</code>). Total ${(total / 1048576).toFixed(1)} MB in ${files.length + scenes.length} PNGs.</p>
</div>
${order.filter((s) => groups[s]).map(section).join('\n')}
<section id="scenes"><h2>Scenes · the poster frame of each (${sceneIds.length})</h2><div class="scenes">${sceneHtml}</div></section>
</main>
</body>
</html>
`
writeFileSync(join(DIR, 'index.html'), html)
console.log(`index.html: ${Object.keys(pairs).length} shots (pairs), ${sceneIds.length} scenes, ${(total / 1048576).toFixed(1)} MB`)
