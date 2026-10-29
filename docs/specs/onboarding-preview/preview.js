// Onboarding looks (O4): builds every mock on the page from small templates, so the options share their parts.
// Nothing here is the app's code; the shapes copy the app's CSS (Menu.module.css, Finder, SidePanel, the wizards).

// ── Seeded noise, the app's cell hash (cellReveal.ts) ───────────────
const cellHash = (x, y) => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s) }
const CELL = 9
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

// A still of the backdrop: glyphs from a ramp, denser in two soft blobs (the flow, frozen).
function field(w, h, seed = 1) {
  const ramp = ' .·:-=+*'
  const cols = Math.ceil(w / 5.4), rows = Math.ceil(h / 9)
  let out = ''
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const u = c / cols, v = r / rows
      const blob = Math.max(0, 1 - Math.hypot(u - 0.72, v - 0.3) * 2.6) + Math.max(0, 1 - Math.hypot(u - 0.2, v - 0.85) * 3.2)
      const n = cellHash(c + seed * 31, r + seed * 17)
      const k = Math.floor(Math.min(0.999, blob * 0.9 + n * 0.25) * ramp.length)
      out += n < 0.18 + blob * 0.6 ? ramp[k] : ' '
    }
    out += '\n'
  }
  return `<pre class="field" aria-hidden="true">${out}</pre>`
}

const cursorSvg = (x, y) => `<svg class="cursor" style="left:${x}px;top:${y}px" viewBox="0 0 14 20"><path d="M1 1v15l4-4 3 7 2.5-1-3-6.5h5.5z"/></svg>`
const marks = (x, y, w, h, tone = 'var(--fg)', out = 4) => `<div class="marks" style="left:${x - out}px;top:${y - out}px;width:${w + 2 * out}px;height:${h + 2 * out}px;--tone:${tone}"><i></i><i></i><i></i><i></i></div>`
const card = (type, x, y, name, size = '') => {
  const label = { cust: 'customer', prob: 'problem', comp: 'competitor', idea: 'idea', feat: 'feature' }[type]
  return `<div class="mc ${type} ${size}" style="left:${x}px;top:${y}px"><span class="t">${label}</span><span class="n">${name}</span></div>`
}
const link = (x1, y1, x2, y2, tone = 'var(--link-solves)') => {
  const len = Math.hypot(x2 - x1, y2 - y1), a = Math.atan2(y2 - y1, x2 - x1)
  return `<div class="lnk" style="left:${x1}px;top:${y1}px;width:${len}px;transform:rotate(${a}rad);background:${tone}"></div>`
}
const piece = (x, y, w, h, name, kind = 'plane', inner = '', extra = '') => {
  const m = name.match(/^(\d+) (.*)$/)
  const nm = m ? `<b>${m[1]}</b>${m[2]}` : name
  const kindWord = { plane: 'plane', table: 'table', kanban: 'deck', matrix: 'matrix', timeline: 'timeline' }[kind]
  return `<div class="piece ${kind === 'plane' ? 'grid' : ''}" data-kind="${kind}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px" ${extra}><span class="pname">${nm} <i>· ${kindWord}</i></span>${inner}</div>`
}
const tableRows = (n, w, x = 10, y = 18) => {
  let s = ''
  for (let i = 0; i < n; i++) {
    const tone = ['var(--accent-yellow)', 'var(--accent-yellow)', 'var(--accent-cyan)', 'var(--accent-magenta)', 'var(--accent-green)'][i % 5]
    s += `<div style="position:absolute;left:${x}px;top:${y + i * 14}px;width:${w}px;height:11px;border-bottom:1px dashed var(--line);display:flex;gap:6px;align-items:center"><i style="width:2px;height:9px;background:${tone}"></i><i style="width:${30 + (i * 17) % 40}px;height:3px;background:var(--fg-dim)"></i><i style="margin-left:auto;width:${12 + (i * 7) % 20}px;height:3px;background:var(--fg-faint)"></i></div>`
  }
  return s
}
const deckCols = (w, h) => {
  const cw = (w - 30) / 3
  let s = ''
  ;['todo', 'doing', 'done'].forEach((c, i) => {
    s += `<div style="position:absolute;left:${10 + i * (cw + 5)}px;top:16px;width:${cw}px;font-size:6px;color:var(--fg-dim);letter-spacing:.12em;display:flex;gap:3px;align-items:center"><span class="num">0${i + 1}</span>${c.toUpperCase()}<i style="flex:1;height:1px;background:var(--line-hover)"></i>${3 - i}</div>`
    for (let k = 0; k < 3 - i; k++) {
      const tone = ['var(--accent-magenta)', 'var(--accent-cyan)', 'var(--accent-green)'][(i + k) % 3]
      s += `<div style="position:absolute;left:${10 + i * (cw + 5)}px;top:${28 + k * 22}px;width:${cw}px;height:18px;background:var(--piece-card);border-left:2px solid ${tone};box-shadow:inset 0 0 0 1px var(--piece-card-edge)"><i style="position:absolute;left:5px;top:5px;width:${cw * 0.55}px;height:3px;background:var(--fg-muted)"></i><i style="position:absolute;left:5px;top:11px;width:${cw * 0.3}px;height:2px;background:var(--fg-faint)"></i></div>`
    }
  })
  return s
}
const miniNav = (x, y, lit) => {
  const icons = [['+', 'plus'], ['⊡', 'fit'], ['◎', 'find'], ['▥', 'side']]
  return `<div style="position:absolute;left:${x}px;top:${y}px;display:flex;flex-direction:column;gap:4px">${icons.map(([g, k]) => `<span style="display:grid;place-items:center;width:20px;height:20px;font-size:12px;color:${k === 'plus' ? 'var(--accent-magenta)' : 'var(--fg-dim)'};${k === lit ? 'box-shadow:inset 0 -2px 0 var(--accent-magenta)' : ''}">${g}</span>`).join('')}</div>`
}
const grid = () => `<div style="position:absolute;inset:0;background-image:radial-gradient(circle, var(--piece-mark) 0.8px, transparent 1.2px);background-size:25px 25px"></div>`
// Cells already shown, nearest first from a point (the focus ink as a still).
function inkClip(w, h, cx, cy, p) {
  let path = ''
  const cols = Math.ceil(w / CELL), rows = Math.ceil(h / CELL), maxD = Math.hypot(w, h)
  for (let r = 0; r < rows; r++) {
    let run = -1
    for (let c = 0; c <= cols; c++) {
      let on = false
      if (c < cols) {
        const d = Math.hypot(c * CELL - cx, r * CELL - cy) / maxD
        on = d * 0.75 + cellHash(c, r) * 0.25 <= p
      }
      if (on && run < 0) run = c
      if (!on && run >= 0) { path += `M${run * CELL} ${r * CELL}H${c * CELL}V${(r + 1) * CELL}H${run * CELL}Z`; run = -1 }
    }
  }
  return `path('${path}')`
}

// ── Scenes: each a still at its authored size, scaled into its box ───
const editPlane = (x, y, w, h) => piece(x, y, w, h, 'plane', 'plane', `<div class="console" style="font-size:7px;line-height:10px;padding:3px 6px;border-color:var(--accent-cyan);color:var(--accent-cyan)"><span>EDIT 960 × 600</span><span class="b go">done</span></div>`) +
  marks(x, y, w, h, 'var(--accent-cyan)', 3) +
  [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0], [0.5, 1], [0, 0.5], [1, 0.5]].map(([u, v]) => `<i style="position:absolute;left:${x + u * w - 3}px;top:${y + v * h - 3}px;width:6px;height:6px;background:var(--accent-cyan)"></i>`).join('')
const SCENES = {
  'canvas-fit': { w: 480, h: 300, key: '0', html: () =>
    miniNav(6, 110, 'fit') +
    piece(48, 40, 210, 140, '01 pazar', 'plane', card('cust', 12, 20, 'Corner shops', 'sm') + card('prob', 84, 20, 'Stock runs out', 'sm') + card('comp', 12, 70, 'Getir', 'sm') + card('idea', 84, 70, 'Shared van', 'sm') + card('feat', 140, 96, 'Route plan', 'sm') + link(76, 36, 84, 36) + link(148, 52, 120, 70)) +
    piece(280, 40, 170, 110, '02 rivals', 'table', tableRows(6, 150)) +
    piece(280, 175, 170, 95, '03 launch', 'kanban', deckCols(170, 95)) +
    piece(48, 205, 210, 65, 'timeline', 'timeline', `<div style="position:absolute;left:14px;top:26px;width:90px;height:7px;background:var(--link-competes);opacity:.6"></div><div style="position:absolute;left:70px;top:40px;width:110px;height:7px;background:var(--accent-cyan);opacity:.5"></div>`) +
    cursorSvg(18, 128) },
  'plus-adds-plane': { w: 480, h: 300, key: '+ p ↵', html: () =>
    miniNav(6, 110, 'plus') +
    `<div style="position:absolute;left:32px;top:110px;width:112px;border:1px solid var(--line-hover);background:var(--bg);font-size:7px;color:var(--fg)">
      <div style="padding:4px 6px;border-bottom:1px solid var(--line);color:var(--fg-faint)"><span class="num">&gt;</span> add…</div>
      ${['▦ plane', '⊞ matrix…', '☰ table…', '▥ deck…', '▤ timeline'].map((r, i) => `<div style="padding:3px 6px;${i === 0 ? 'background:var(--wash-3);color:var(--fg-strong)' : ''}"><span class="num" style="visibility:${i === 0 ? 'visible' : 'hidden'}">›</span> ${r}</div>`).join('')}
    </div>` + editPlane(200, 70, 230, 150) + cursorSvg(70, 128) },
  'edit-move-resize': { w: 400, h: 250, html: () => editPlane(80, 40, 240, 160) + cursorSvg(322, 202) },
  'pieces-tour': { w: 480, h: 300, html: () =>
    piece(30, 40, 260, 220, '01 pazar', 'plane', card('cust', 14, 22, 'Corner shops') + card('prob', 14, 92, 'Stock runs out') + card('comp', 136, 22, 'Getir') + card('idea', 136, 92, 'Shared van') + card('feat', 76, 154, 'Route plan') + link(74, 82, 74, 92) + link(134, 122, 136, 122) + link(196, 152, 160, 154)) +
    piece(310, 40, 150, 120, '02 rivals', 'table', tableRows(7, 130)) },
  'peers-comment': { w: 480, h: 300, html: () =>
    piece(60, 40, 300, 200, '01 pazar', 'plane', card('prob', 30, 40, 'Stock runs out') + card('idea', 160, 110, 'Shared van') + link(150, 70, 160, 120) +
      `<div style="position:absolute;left:150px;top:98px;padding:1px 4px;font-size:7px;background:var(--accent-magenta);color:var(--on-accent)">✎ 2</div>`) +
    cursorSvg(240, 120) + `<span class="peerTag" style="left:254px;top:136px;--tone:var(--accent-yellow)">MERT</span>` +
    `<svg class="cursor" style="left:120px;top:180px" viewBox="0 0 14 20"><path d="M1 1v15l4-4 3 7 2.5-1-3-6.5h5.5z" style="fill:var(--accent-cyan)"/></svg><span class="peerTag" style="left:134px;top:196px;--tone:var(--accent-cyan)">ECE</span>` },
  'side-view': { w: 480, h: 300, key: 't', html: () =>
    piece(14, 40, 150, 230, '01 pazar', 'plane', card('cust', 10, 20, 'Corner shops', 'sm') + card('prob', 76, 20, 'Stock runs out', 'sm') + card('idea', 40, 80, 'Shared van', 'sm')) +
    `<div style="position:absolute;left:180px;top:20px;bottom:0;right:0;border-left:1px solid var(--line-hover);background:var(--bg)"></div>` +
    `<div style="position:absolute;left:190px;top:28px;font-size:7px;color:var(--fg-dim);letter-spacing:.12em">03 LAUNCH · DECK <span style="margin-left:60px;color:var(--fg-strong)">MINE</span> · ALL · DAYS</div>` +
    `<div style="position:absolute;left:186px;top:40px;width:160px;height:120px">${deckCols(160, 120)}</div>` +
    `<div style="position:absolute;left:352px;top:40px;width:120px;bottom:10px;border-left:1px dashed var(--line)">${[0, 1, 2, 3, 4].map((i) => `<div style="position:absolute;left:6px;top:${18 + i * 34}px;font-size:6px;color:var(--fg-faint)">${['MON', 'TUE', 'WED', 'THU', 'FRI'][i]}</div><div style="position:absolute;left:30px;top:${16 + i * 34}px;width:${40 + (i * 23) % 50}px;height:9px;background:${['var(--accent-magenta)', 'var(--accent-cyan)', 'var(--accent-green)'][i % 3]};opacity:.55"></div>`).join('')}</div>` },
  'focus-ink': { w: 400, h: 250, html: () =>
    `<div style="position:absolute;inset:0;background:var(--piece)"></div>` +
    `<div style="position:absolute;inset:0;background:var(--bg);background-image:radial-gradient(circle, var(--piece-mark) 0.8px, transparent 1.2px);background-size:25px 25px;clip-path:${inkClip(400, 250, 300, 220, 0.55)}">` +
      card('cust', 40, 40, 'Corner shops') + card('prob', 200, 40, 'Stock runs out') + card('idea', 200, 130, 'Shared van') + link(160, 70, 200, 70) + `</div>` +
    `<div class="console" style="right:30px;bottom:24px;font-size:8px;line-height:12px;padding:3px 7px;border-bottom:1px solid var(--piece-edge)"><span class="b hot">focus</span><span class="b">edit</span></div>` +
    cursorSvg(330, 220) },
  'plane-inside': { w: 400, h: 250, html: () =>
    grid() + card('cust', 30, 40, 'Corner shops') + card('prob', 180, 40, 'Stock runs out') + link(150, 70, 180, 70) +
    `<div style="position:absolute;left:180px;top:90px;width:150px;border:1px solid var(--line-hover);background:var(--bg);font-size:8px;color:var(--fg)">
      <div style="padding:4px 7px;border-bottom:1px solid var(--line);color:var(--fg-faint)"><span class="num">&gt;</span> add…</div>
      ${[['var(--accent-green)', 'customer'], ['var(--accent-magenta)', 'problem'], ['var(--accent-yellow)', 'competitor'], ['var(--fg)', 'idea'], ['var(--accent-cyan)', 'feature']].map(([t, r], i) => `<div style="padding:3px 7px;${i === 1 ? 'background:var(--wash-3);color:var(--fg-strong)' : ''}"><span class="num" style="visibility:${i === 1 ? 'visible' : 'hidden'}">›</span> <span style="color:${t}">▌</span> ${r}</div>`).join('')}
    </div>` +
    `<div class="dock" style="font-size:8px;line-height:11px;padding:4px 10px 5px;gap:8px"><span class="b hot">+</span><span class="b">filter</span><span class="sep"></span><span class="b">unfocus</span><span class="k">esc</span></div>` +
    cursorSvg(210, 138) },
  'kind-plane': { w: 400, h: 250, html: () =>
    piece(40, 26, 320, 200, '01 pazar', 'plane', card('cust', 20, 24, 'Corner shops') + card('prob', 170, 24, 'Stock runs out') + card('comp', 20, 110, 'Getir') + card('idea', 170, 110, 'Shared van') + link(140, 54, 170, 54) + link(230, 84, 230, 110)) },
  'kind-deck': { w: 400, h: 250, html: () => piece(30, 30, 340, 190, '03 launch', 'kanban', deckCols(340, 200)) + cursorSvg(170, 120) },
  'card-problem': { w: 400, h: 250, html: () =>
    grid() + card('prob', 110, 70, 'Stock runs out by noon', 'lg') +
    `<div style="position:absolute;left:120px;top:166px;font-size:9px;color:var(--fg-muted)">testing <span style="color:var(--accent-green)">+2</span> <span style="color:var(--accent-magenta)">−1</span></div>` +
    marks(110, 70, 180, 90, 'var(--accent-magenta)', 5) },
}

// A demo: the scene, and under it (never on it) a strip with what it is and the pause.
let sceneN = 0
function demo(name) {
  const sc = SCENES[name]
  return `<div class="dwrap"><div class="demo" data-scene="${name}" data-aw="${sc.w}">${field(sc.w * 1.4, sc.h * 1.4, ++sceneN)}<div class="scene" style="width:${sc.w}px;height:${sc.h}px">${sc.html()}</div>${sc.key ? `<span class="keycap">${sc.key}</span>` : ''}</div>` +
    `<div class="dstrip"><span><b>▸</b> live demo<span class="sn2"> · ${name}</span></span><span class="b out">❚❚</span></div></div>`
}
function fitScenes(root = document) {
  root.querySelectorAll('.demo').forEach((d) => {
    const s = d.querySelector('.scene')
    s.style.transform = `scale(${d.clientWidth / +d.dataset.aw})`
    d.parentElement.classList.toggle('narrow', d.clientWidth < 250)
  })
}
// A frame caught part-way through its cell-by-cell build (or break): `data-still="0.45"` keeps that share of cells.
function stillCells() {
  document.querySelectorAll('[data-still]').forEach((el) => {
    const p = +el.dataset.still, r = el.getBoundingClientRect()
    let path = ''
    for (let y = 0; y < Math.ceil(r.height / CELL); y++) {
      let run = -1
      const cols = Math.ceil(r.width / CELL)
      for (let c = 0; c <= cols; c++) {
        const on = c < cols && cellHash(c + 3, y + 7) <= p
        if (on && run < 0) run = c
        if (!on && run >= 0) { path += `M${run * CELL} ${y * CELL}H${c * CELL}V${(y + 1) * CELL}H${run * CELL}Z`; run = -1 }
      }
    }
    el.style.clipPath = `path('${path}')`
  })
}

// ── A canvas behind things: backdrop, pieces, HUD ────────────────────
const CRUMB = '<i>#</i> north-star <i>/</i> workspaces <i>/</i> <b>pazar</b>'
const CRUMB_FOCUS = '<i>#</i> north-star <i>/</i> workspaces <i>/</i> pazar <i>/</i> <b><span class="num">01</span> pazar</b>'
function canvas(w, h, { pieces = true, nav = true, corner = true, seed = 3 } = {}) {
  let s = field(w, h, seed)
  if (pieces) {
    s += piece(w * 0.12, h * 0.16, w * 0.36, h * 0.38, '01 pazar', 'plane', card('cust', 16, 20, 'Corner shops', 'sm') + card('prob', 96, 20, 'Stock runs out', 'sm') + card('idea', 96, 70, 'Shared van', 'sm') + link(80, 36, 96, 36))
    s += piece(w * 0.56, h * 0.16, w * 0.3, h * 0.26, '02 rivals', 'table', tableRows(5, w * 0.26))
    s += piece(w * 0.56, h * 0.5, w * 0.3, h * 0.26, '03 launch', 'kanban', deckCols(w * 0.3, h * 0.26))
  }
  s += `<div class="crumb">${CRUMB}</div>`
  if (nav) s += sidenav()
  if (corner) s += cornerHtml()
  return s
}
const cornerHtml = () => `<div class="corner"><div class="peers"><span class="sq" style="--tone:var(--accent-yellow)">M</span><span class="sq" style="--tone:var(--accent-cyan)">E</span></div><span>✎</span><span class="cornerRule"></span><span class="sq" style="--tone:var(--accent-magenta);margin:0">A</span><span>⚙</span></div>`
function sidenav(top = null, lit = null, dot = false) {
  const pos = top == null ? '' : `top:${top}px;transform:none`
  return `<div class="sidenav" style="${pos}">
    <span class="sn plus ${lit === 'plus' ? 'on' : ''}"><svg width="20" height="20" viewBox="0 0 20 20"><path d="M10 2v16M2 10h16" stroke="currentColor" stroke-width="1.5"/></svg></span>
    <span class="sn">⊡</span><span class="sn ${lit === 'find' ? 'on' : ''}">◎</span><span class="sn">▥</span><span class="sn">?${dot ? '<i class="dot"></i>' : ''}</span></div>`
}
const stage = (w, h, inner) => `<div class="stage" style="width:${w}px;height:${h}px">${inner}</div>`
const k = (s) => s.replace(/`([^`]+)`/g, '<code class="k">$1</code>')
const cap = (b, rest) => `<div class="cap"><b>${b}</b> · ${rest}</div>`

// ── 1. The welcome and what's new (the same frame) ───────────────────
const WELCOME = { kind: 'welcome', cmd: 'north-star --welcome', label: 'welcome', pages: [
  { tab: 'canvas', title: 'This is your canvas', body: 'Everything for your startup lives on this canvas. Drag to move around, scroll to zoom, `0` shows everything.', scene: 'canvas-fit' },
  { tab: 'pieces', title: 'Pieces hold the work', body: 'Planes hold cards, linked into one chain. Tables, matrices, decks and timelines read them.', scene: 'pieces-tour' },
  { tab: 'add', title: 'Add anything with +', body: 'The magenta `+` adds a piece. The first time you meet something, a short note explains it.', scene: 'plus-adds-plane' },
  { tab: 'together', title: 'Together, live', body: 'Who’s here shows bottom left. Right-click anything to comment. Press `?` to see any note again.', scene: 'peers-comment' },
] }
const NEWS = { kind: 'new', cmd: 'north-star --whats-new', label: 'what’s new', pages: [
  { tab: 'decks and days', title: 'Decks and days', body: '`t` opens plane → deck → days beside you, from anywhere.', scene: 'side-view', show: true },
  { tab: 'timeline', title: 'Timeline as a strip', body: 'Days without end: drag through time, pinch to change the scale, draw tasks.', scene: 'canvas-fit' },
  { tab: 'canvases', title: 'Several canvases', body: 'Split the work into canvases; a piece can be on more than one.', scene: 'canvas-fit', show: true },
  { tab: '+ 2 more', title: 'And 2 more', list: [['Filters that pass', 'A filter lasts while its view is open, and new things always show.'], ['Card faces', 'Cards tinted by type everywhere: on decks and in tables too.']] },
] }
const n2 = (i) => String(i + 1).padStart(2, '0')
function newsList(pg) {
  return `<div class="newsList">${pg.list.map(([t, l]) => `<div class="nl"><span class="num">›</span><div><div class="nt">${t}</div><div class="nb">${l}</div></div></div>`).join('')}
    <div class="nf">Their notes show the first time you meet them, marked <span class="newChip">NEW</span> in <code class="k">?</code>.</div></div>`
}
function footBtns(set, p, cls = 'b') {
  const last = p === set.pages.length - 1, pg = set.pages[p]
  const out = set.kind === 'new' ? 'close' : 'skip'
  const next = last ? 'done' : 'next ›'
  const showMe = pg.show ? `<span class="${cls} go">show me</span>` : ''
  return { out: `<span class="${cls} out">${out}</span>`, right: `<span class="faint">← → ↵</span><span class="${cls}" ${p === 0 ? 'style="opacity:.35"' : ''}>‹ back</span>${showMe}<span class="${cls} hot">${next}</span>` }
}
function welcomeA(set, p) {
  const pg = set.pages[p], f = footBtns(set, p)
  return `<div class="wa" data-cells role="dialog">
    <div class="steps">${set.pages.map((s, i) => `<span class="step ${i === p ? 'on' : i < p ? 'done' : ''}"><b>${n2(i)}</b>${s.tab}</span>`).join('')}</div>
    ${pg.list ? newsList(pg) : demo(pg.scene)}
    <div class="text"><div class="count">${n2(p)} <span>/ 04 · ${set.label}</span></div><h3 class="title">${pg.title}</h3>${pg.body ? `<p class="body">${k(pg.body)}</p>` : ''}</div>
    <div class="foot">${f.out}<span class="sp"></span>${f.right}</div>
  </div>`
}
function welcomeB(set, p) {
  const pg = set.pages[p]
  const last = p === set.pages.length - 1
  return `<div class="wb" data-cells role="dialog">
    <div class="demoPiece"><span class="pname"><b>${n2(p)}</b>${pg.tab} <i>· ${set.label}</i></span>${pg.list ? newsList(pg) : demo(pg.scene)}</div>
    <div class="small ink"><span class="num">${n2(p)}</span><span class="rule"></span><span>${set.label}</span><span class="faint">· 04</span></div>
    <h3 class="title h1"><span class="ink">${pg.title}</span></h3>
    <div class="h1rule"></div>
    ${pg.body ? `<p class="body"><span class="ink">${k(pg.body)}</span></p>` : ''}
    <div class="acts ink"><span class="act">${set.kind === 'new' ? 'close' : 'skip'}</span><span class="sp"></span><span class="pages">${set.pages.map((_, i) => `<span class="${i === p ? 'on' : i < p ? 'done' : ''}">${n2(i)}</span>`).join('')}</span><span class="act" style="${p === 0 ? 'opacity:.35' : ''}">‹ back</span>${pg.show ? '<span class="act show">show me</span>' : ''}<span class="act go">${last ? 'done' : 'next'}</span></div>
  </div>`
}
function welcomeC(set, p) {
  const pg = set.pages[p], f = footBtns(set, p)
  const lines = set.pages.map((s, i) => i < p ? `<div class="ln done"><em>✓</em> ${n2(i)} ${s.title.toLowerCase()}</div>` : i === p ? `<div class="ln now"><em>›</em> ${n2(i)} ${s.title.toLowerCase()}</div>` : `<div class="ln next">· ${n2(i)} ${s.title.toLowerCase()}</div>`).join('')
  return `<div class="wc" data-cells role="dialog">
    <div class="bar"><span>north-star · ${set.label}</span><span class="sp"></span><span class="num">${n2(p)}</span><span>/ 04</span></div>
    <div class="log">
      <div class="ln"><span class="num">$</span> ${set.cmd}</div>
      ${lines}
      <div class="typed"><h3 class="title">${pg.title}</h3>${pg.body ? `<p class="body">${k(pg.body)}<span class="blk"></span></p>` : '<span class="blk"></span>'}</div>
      <div class="fill"></div>
    </div>
    <div class="right">${pg.list ? newsList(pg) : demo(pg.scene)}
      <div class="foot">${f.out}<span class="sp"></span>${f.right}</div>
    </div>
  </div>`
}

// ── 2. The lesson card ───────────────────────────────────────────────
const H = 600
const L1 = { kind: 'console', title: 'Go inside with focus', body: 'Press `focus` or double-click. Inside, the piece is yours to work in; `esc` comes back.', page: '2 / 2', last: true, scene: 'focus-ink' }
const L2 = { kind: 'focus', title: 'You’re inside the plane', body: 'Drag to look around. `+` (or right-click) adds cards here. `esc` or `unfocus` goes back.', page: '1 / 2', last: false, scene: 'plane-inside' }
const L3 = { kind: 'undo', title: '⌘Z brings it back', body: 'Every change can be undone with `⌘Z`, and done again with `⇧⌘Z`.', page: '1 / 1', last: true }
const L4 = { kind: 'new piece', title: 'It’s in edit mode', body: 'Drag it to move, pull an edge to resize, type its name in the top edge.', page: '1 / 2', last: false, scene: 'edit-move-resize' }

// The console is inside the plane's bottom-right: its right edge at x 423, its bottom (the plane's) at y 360.
function consoleStage(inner) {
  const p = piece(40, 60, 400, 300, '01 pazar', 'plane',
    card('cust', 30, 40, 'Corner shops') + card('prob', 200, 40, 'Stock runs out') + card('idea', 200, 150, 'Shared van') + card('comp', 30, 150, 'Getir') + link(150, 70, 200, 70) + link(260, 100, 260, 150) +
    `<div class="console"><span class="b hot">focus</span><span class="b">edit</span><span>⇆ link ▾</span></div>`)
  const busy = piece(470, 250, 250, 210, '02 rivals', 'table', tableRows(12, 230))
  return stage(740, H, field(740, H, 7) + `<div class="crumb">${CRUMB}</div>` + p + busy + cursorSvg(276, 340) + inner)
}
function focusBg(w = 740, h = H) {
  const cards = card('cust', 60, 90, 'Corner shops') + card('prob', 220, 90, 'Stock runs out') + card('comp', 60, 230, 'Getir') + card('idea', 220, 230, 'Shared van') + card('feat', 140, 340, 'Route plan') + card('cust', 420, 120, 'Night couriers') + card('idea', 440, 300, 'Night route') + link(180, 120, 220, 120) + link(280, 150, 280, 230) + link(250, 290, 220, 340) + link(540, 150, 560, 300)
  const dock = `<div class="dock"><span class="b">+</span><span>view ▾</span><span class="b">filter</span><span class="b">linked · 2</span><span class="sep"></span><span class="b hot">unfocus</span><span class="k">esc</span></div>`
  return grid() + `<div class="crumb">${CRUMB_FOCUS}</div>` + cards + dock
}
const dockStage = (inner) => stage(740, H, focusBg() + inner)

function lessonA(l, style, extra = '') {
  return `<div class="la" data-cells style="${style}" ${extra} role="status" aria-live="polite">
    <div class="top"><span class="faint">┌</span><span>lesson</span><span class="faint">·</span><span class="k">${l.kind}</span>${l.back ? '<span class="b out back">‹ guide</span>' : ''}<span class="x b out">×</span></div>
    ${l.scene ? demo(l.scene) : ''}
    <h4 class="title">${l.title}</h4><p class="body">${k(l.body)}</p>
    <div class="foot"><span class="faint">${l.page}</span><span class="q">don’t show tips</span><span class="sp"></span><span class="b go">${l.last ? 'got it' : 'next ›'}</span></div>
  </div>`
}
function lessonB(l, style, extra = '') {
  return `<div class="lb" data-cells style="${style}" ${extra} role="status" aria-live="polite"><span class="rail"></span>
    <div class="small ink"><span class="num">${l.page.replace(' / ', '/')}</span><span class="rule"></span><span>${l.kind} · lesson</span><span class="x">×</span></div>
    ${l.scene ? demo(l.scene) : ''}
    <div class="tt"><h4 class="title"><span class="ink">${l.title}</span></h4></div>
    <p class="body"><span class="ink">${k(l.body)}</span></p>
    <div class="acts ink">${l.back ? '<span class="q" style="margin:0">‹ guide</span>' : ''}<span class="go">${l.last ? 'got it' : 'next'}</span><span class="q">don’t show tips</span></div>
  </div>`
}
function lessonC(l, style, cls = '', extra = '') {
  return `<div class="lc ${cls} ${l.scene ? '' : 'nodemo'}" data-cells style="${style}" ${extra} role="status" aria-live="polite">
    ${l.scene ? demo(l.scene) : ''}
    <div><div class="hd"><span class="num">${l.page}</span><span>${l.kind}</span><span class="x b out">×</span></div>
      <h4 class="title">${l.title}</h4><p class="body">${k(l.body)}</p>
      <div class="acts">${l.back ? '<span class="b out">‹ guide</span>' : ''}<span class="b go">${l.last ? 'got it' : 'next ›'}</span><span class="q">don’t show tips</span></div></div>
  </div>`
}
const leadH = (x1, x2, y) => `<div class="lead h" style="left:${x1}px;top:${y}px;width:${x2 - x1}px"><span class="tip" style="left:-2px;top:-2px"></span></div>`
const leadV = (x, y1, y2) => `<div class="lead v" style="left:${x}px;top:${y1}px;height:${y2 - y1}px"><span class="tip" style="left:-2px;bottom:-2px"></span></div>`

// In focus the card goes straight above the dock (the dock's middle is x 370), keeping the right of the screen free (D-211).
const LESSON = {
  a: () => [
    consoleStage(lessonA(L1, 'left:458px;top:40px') + leadH(424, 458, 347)),
    dockStage(lessonA(L2, 'left:236px;bottom:62px') + leadV(370, H - 62, H - 33)),
  ],
  b: () => [
    consoleStage(lessonB(L1, 'left:470px;top:50px') + leadH(424, 470, 347)),
    dockStage(lessonB(L2, 'left:240px;bottom:62px') + leadV(240, H - 62, H - 33)),
  ],
  c: () => [
    consoleStage(`<div style="position:absolute;z-index:9;left:250px;top:359px;width:172px;height:2px;background:var(--bg)"></div>` + lessonC(L1, 'left:20px;top:359px', 'hang')),
    dockStage(lessonC(L2, 'left:150px;bottom:32px', 'rise')),
  ],
}
const DONE = {
  a: (style = '', extra = '') => `<div class="la done" ${extra} style="${style}"><div class="top"><span class="faint">┌</span><span>lesson</span><span class="faint">·</span><span class="k">console</span><span style="margin-left:14px" class="ok">✓ done</span></div></div>`,
  b: (style = '', extra = '') => `<div class="lb done" ${extra} style="${style}"><span class="rail"></span><div class="small ink" style="margin:0"><span class="num">✓</span><span class="rule"></span><span>console · lesson</span></div><div class="tt"><span class="title ink" style="font-size:var(--text-lg)"><span class="ok">done</span> · you went inside</span></div></div>`,
  c: (style = '', extra = '') => `<div class="lc done" ${extra} style="${style}"><div class="hd"><span class="ok">✓ done</span><span class="dim">· you went inside</span></div></div>`,
}
// Toast (Toast.module.css): framed, `› ` in cyan, at the bottom middle, 40 px over the HUD's margin.
const toast = (w, h) => `<div class="toast" style="left:${w / 2}px;bottom:56px">deleted 02 rivals <span class="ok">[undo]</span></div>`
const NODEMO = {
  a: (w, h) => lessonA(L3, `left:${w / 2 - 134}px;bottom:150px`) + leadV(w / 2, h - 150, h - 92),
  b: (w, h) => lessonB(L3, `left:${w / 2 - 120}px;bottom:150px`) + leadV(w / 2 - 120, h - 150, h - 92),
  c: (w, h) => lessonC(L3, `left:${w / 2 - 160}px;bottom:91px;width:320px`, 'rise', 'data-on-toast'),
}
// Cards kept out of the toast's column, so the note above it covers none (placement shifts sideways before covering).
const nodemoBg = () => grid() + `<div class="crumb">${CRUMB_FOCUS}</div>` + card('cust', 30, 70, 'Corner shops') + card('prob', 30, 190, 'Stock runs out') + card('idea', 580, 70, 'Shared van') + card('feat', 580, 190, 'Route plan') + link(90, 130, 90, 190) + link(640, 130, 640, 190)
// Fallback: the new piece fills the screen, nothing beside it is free: the card goes to the bottom middle, no lead.
const FALLBACK = {
  a: (w, h) => lessonA(L4, `left:${w / 2 - 134}px;bottom:24px`),
  b: (w, h) => lessonB(L4, `left:${w / 2 - 125}px;bottom:24px`),
  c: (w, h) => lessonC(L4, `left:${w / 2 - 220}px;bottom:0`, 'rise'),
}
function fallbackStage(o) {
  const w = 740, h = 600
  const big = piece(-60, 70, w + 120, h + 40, 'plane', 'plane', '') + marks(-60, 70, w + 120, h + 40, 'var(--accent-cyan)', 3)
  return stage(w, h, field(w, h, 51) + `<div class="crumb">${CRUMB}</div>` + big + sidenav() + FALLBACK[o](w, h))
}
// The handover: ✓ done for 1.2 s where the card was, it breaks, 300 ms of nothing, then the next card builds.
function handover(o) {
  const w = 480, h = 600
  const bg = (inner) => stage(w, h, grid() + `<div class="crumb">${CRUMB_FOCUS}</div>` + card('cust', 40, 120, 'Corner shops') + card('prob', 200, 120, 'Stock runs out') + link(160, 150, 200, 150) +
    `<div class="dock"><span class="b">+</span><span class="b">filter</span><span class="sep"></span><span class="b hot">unfocus</span><span class="k">esc</span></div>` + inner)
  const at = 'left:180px;top:250px'
  const next = { a: lessonA(L2, 'left:106px;bottom:62px', 'data-still="0.55"') + leadV(240, h - 62, h - 33),
    b: lessonB(L2, 'left:110px;bottom:62px', 'data-still="0.55"') + leadV(110, h - 62, h - 33),
    c: lessonC(L2, 'left:20px;bottom:32px', 'rise', 'data-still="0.55"') }[o]
  return `<div>${bg(DONE[o](`position:absolute;${at}`))}${cap('0 – 1.2 s', 'focus pressed: ✓ done where the card was')}</div>
    <div>${bg(DONE[o](`position:absolute;${at}`, 'data-still="0.3"'))}${cap('1.2 – 1.5 s', 'it breaks (320 ms), then nothing')}</div>
    <div>${bg(next)}${cap('1.5 s →', 'the next lesson builds by the dock')}</div>`
}
// `?` → Enter plays a note in the middle of the screen, with a way back to the guide.
function playStage(o) {
  const w = 740, h = 560
  const l = { ...L1, back: true }
  const card = { a: lessonA(l, `left:${w / 2 - 134}px;top:70px`), b: lessonB(l, `left:${w / 2 - 125}px;top:60px`), c: lessonC(l, `left:${w / 2 - 220}px;top:${h / 2 - 90}px`, 'whole') }[o]
  return stage(w, h, canvas(w, h, { seed: 61 }) + `<div class="shade"></div>` + card)
}

// ── 3. The kind guide ────────────────────────────────────────────────
const PAGE_SVG = '<svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" style="vertical-align:-0.175em"><path d="M2 12V1h7"/><path d="M4.5 3.5h6l3 3V15h-9z M10.5 3.5v3h3 M6.5 9.5h5 M6.5 12h3.5"/></svg>'
const CANVAS_ROWS = [
  { h: 'on the canvas' },
  { k: 'plane', l: 'p', g: '▦', label: 'plane', what: 'A space for cards.', when: 'Customers, problems, competitors, ideas and features live here, linked.', scene: 'kind-plane' },
  { k: 'matrix', l: 'm', g: '⊞', label: 'matrix…', hint: 'two lists crossed' },
  { k: 'table', l: 't', g: '☰', label: 'table…', hint: 'rows by rules, any columns' },
  { k: 'documents', l: 'd', g: PAGE_SVG, label: 'documents', hint: '.md, images, pdfs' },
  { k: 'deck', l: 'k', g: '▥', label: 'deck…', hint: 'tasks or cards in columns' },
  { k: 'timeline', l: 'l', g: '▤', label: 'timeline', hint: 'tasks by due day' },
  { h: 'text' },
  { k: 'heading', l: 'h', g: 'T', label: 'heading' },
  { k: 'paragraph', l: 'a', g: '¶', label: 'paragraph' },
  { k: 'sticky', l: 'n', g: '▤', label: 'sticky note', tone: 'var(--accent-yellow)' },
  { k: 'section', l: 's', g: '⬚', label: 'section', hint: 'draw' },
  { k: 'title', l: 'i', g: '✦', label: 'project title' },
]
const PLANE_ROWS = [
  { h: 'card' },
  { k: 'customer', l: 'c', g: '▌', label: 'customer', tone: 'var(--accent-green)' },
  { k: 'problem', l: 'r', g: '▌', label: 'problem', tone: 'var(--accent-magenta)', what: 'What hurts.', when: 'Give it a status and evidence for or against it.', scene: 'card-problem' },
  { k: 'competitor', l: 'o', g: '▌', label: 'competitor', tone: 'var(--accent-yellow)' },
  { k: 'idea', l: 'i', g: '▌', label: 'idea', tone: 'var(--fg)' },
  { k: 'feature', l: 'f', g: '▌', label: 'feature', tone: 'var(--accent-cyan)' },
  { k: 'package', l: 'k', g: '▣', label: 'package', tone: 'var(--accent-blue)', hint: 'select' },
  { h: 'text' },
  { k: 'heading', l: 'h', g: 'T', label: 'heading' },
  { k: 'paragraph', l: 'a', g: '¶', label: 'paragraph' },
  { k: 'sticky', l: 'n', g: '▤', label: 'sticky note', tone: 'var(--accent-yellow)' },
  { k: 'section', l: 's', g: '⬚', label: 'section', hint: 'draw' },
  { h: '' },
  { k: 'existing', l: 'e', g: '⧉', label: 'existing card…', hint: 'from another plane' },
]
const NARROW = [{ h: 'on the canvas' }, CANVAS_ROWS[1]]
function promptMenu(rows, on, { seen = null, typed = '', total = null, floor = false } = {}) {
  const n = rows.filter((r) => r.k).length
  const label = (r) => typed && r.label.startsWith(typed) ? `<span class="match">${typed}</span>${r.label.slice(typed.length)}` : r.label
  return `<div class="prompt">
    <div class="line"><span class="s">&gt;</span>${typed ? `<span class="typed">${typed}</span><span class="caret"></span>` : '<span class="ph">add…</span>'}</div>
    <div class="list">${rows.map((r) => r.h === '' ? '<div class="rule"></div>' : r.h ? `<div class="hd">${r.h}</div>` :
      `<div class="it ${r.k === on ? 'on' : ''}"><span class="cur">›</span><span class="let">[<b>${r.l}</b>]</span><span class="gl" style="${r.tone ? `--tone:${r.tone}` : ''}">${r.g}</span><span class="lb2">${label(r)}</span>${r.hint ? `<span class="hint">${r.hint}</span>` : ''}${seen && !seen.includes(r.k) ? '<span class="unseen" title="not seen yet"></span>' : ''}</div>`).join('')}</div>
    <div class="foot">${total ? `${n} of ${total} things · esc clears` : `${n} things · type to find · a letter goes first`}</div>
  </div>`
}
function guideA(row, seenN, total) {
  return `<div class="ga"><div class="gh"><span class="gl" style="${row.tone ? `--tone:${row.tone}` : ''}">${row.g}</span><span class="n">${row.label}</span><span class="of">${seenN} / ${total} seen</span></div>
    ${demo(row.scene)}<p class="what">${row.what}</p><p class="when">${row.when}</p><span class="sp"></span>
    <div class="foot"><span>↑ ↓ shows the others</span><span class="b out">hide guide</span></div></div>`
}
function guideB(row, style) {
  return `<div class="gb" data-cells style="${style}"><div class="small ink"><span class="num">${row.l.toUpperCase()}</span><span class="rule"></span><span>${row.label.replace('…', '')} · what it is</span></div>
    ${demo(row.scene)}<div class="tt"><p class="what"><span class="ink">${row.what}</span></p></div><p class="when"><span class="ink">${row.when}</span></p><div class="hide"><span class="ink"><span class="b out">hide guide</span></span></div></div>`
}
function guideC(row, seenN, total, inPlane) {
  const name = row.label.replace('…', '').toUpperCase().replace(' ', '-')
  return `<div class="gc"><div class="mh"><span>${name}(1)</span><span class="r">NORTH STAR</span></div>
    ${demo(row.scene)}
    <dl><dt>NAME</dt><dd class="name">${row.label.replace('…', '')} — ${row.what.toLowerCase().replace(/\.$/, '')}</dd>
      <dt>USE</dt><dd>${row.when}</dd>
      <dt>KEY</dt><dd class="mono">+ ${row.l} ↵${inPlane ? '  ·  right-click → add' : ''}</dd>
      <dt>SEEN</dt><dd class="mono">${seenN} of ${total} kinds</dd></dl>
    <div class="meter" style="margin-top:6px">${Array.from({ length: total }, (_, i) => `<i class="${i < seenN ? 'on' : ''}"></i>`).join('')}</div>
    <span class="sp"></span><div class="foot"><span>• not seen yet</span><span class="b out">hide guide</span></div></div>`
}
const LEFT = 52, PW = 342, PLUS_Y = 70
function kindStage(opt, inPlane) {
  const rows = inPlane ? PLANE_ROWS : CANVAS_ROWS
  const on = inPlane ? 'problem' : 'plane'
  const row = rows.find((r) => r.k === on)
  const total = rows.filter((r) => r.k).length
  const seen = inPlane ? ['customer', 'problem', 'idea'] : ['plane', 'table', 'deck', 'heading']
  const bg = inPlane
    ? grid() + card('cust', 560, 120, 'Corner shops') + card('prob', 560, 250, 'Stock runs out') + card('idea', 430, 360, 'Shared van') + link(620, 180, 620, 250) + `<div class="crumb">${CRUMB_FOCUS}</div>` + sidenav(PLUS_Y, 'plus')
    : canvas(740, 600, { nav: false, seed: 11 }) + sidenav(PLUS_Y, 'plus')
  let menu
  if (opt === 'a') menu = `<div class="menuPanel" data-cells style="left:${LEFT}px;top:${PLUS_Y}px">${promptMenu(rows, on)}${guideA(row, seen.length, total)}</div>`
  if (opt === 'c') menu = `<div class="menuPanel" data-cells style="left:${LEFT}px;top:${PLUS_Y}px">${promptMenu(rows, on, { seen })}${guideC(row, seen.length, total, inPlane)}</div>`
  if (opt === 'b') {
    const rowY = PLUS_Y + 41 + 4 + 20 + (inPlane ? 26 : 0) + 13
    menu = `<div class="menuPanel" data-cells style="left:${LEFT}px;top:${PLUS_Y}px">${promptMenu(rows, on)}</div>` +
      `<div class="dash" style="left:${LEFT + PW}px;top:${rowY}px;width:30px"></div>` + guideB(row, `left:${LEFT + PW + 38}px;top:${rowY - 9}px`)
  }
  return stage(740, 600, bg + menu)
}
// Typed `pl`: one row left. a and c keep a 330 px floor so the guide fits; b's ink needs none.
function narrowStage(opt) {
  const row = CANVAS_ROWS[1]
  const bg = canvas(740, 560, { nav: false, seed: 13 }) + sidenav(PLUS_Y, 'plus')
  const floor = `<div class="floor" style="left:${LEFT - 4}px;top:${PLUS_Y}px;width:${(opt === 'c' ? 652 : 632) + 8}px"><span>floor</span></div>`
  let m
  if (opt === 'a') m = `<div class="menuPanel" style="left:${LEFT}px;top:${PLUS_Y}px;">${promptMenu(NARROW, 'plane', { typed: 'pl', total: 11 })}${guideA(row, 4, 11)}</div>` + floor
  if (opt === 'c') m = `<div class="menuPanel" style="left:${LEFT}px;top:${PLUS_Y}px;">${promptMenu(NARROW, 'plane', { typed: 'pl', total: 11, seen: ['plane'] })}${guideC(row, 4, 11, false)}</div>` + floor
  if (opt === 'b') m = `<div class="menuPanel" style="left:${LEFT}px;top:${PLUS_Y}px">${promptMenu(NARROW, 'plane', { typed: 'pl', total: 11 })}</div>` +
    `<div class="dash" style="left:${LEFT + PW}px;top:${PLUS_Y + 78}px;width:30px"></div>` + guideB(row, `left:${LEFT + PW + 38}px;top:${PLUS_Y + 69}px`)
  return stage(740, 560, bg + m)
}
// After `[hide guide]`: the menu alone, for good; one line under it says how to get it back.
function hiddenStage() {
  const bg = canvas(740, 560, { nav: false, seed: 17 }) + sidenav(PLUS_Y, 'plus')
  return stage(740, 560, bg + `<div class="menuPanel" style="left:${LEFT}px;top:${PLUS_Y}px">${promptMenu(CANVAS_ROWS, 'plane')}</div>` +
    `<div class="hiddenNote ink" style="left:${LEFT}px;top:${PLUS_Y + 418}px">guide hidden · <code class="k">?</code> brings it back</div>`)
}

// ── 4. The `?` guide ─────────────────────────────────────────────────
// Areas fold like the finder's planes (`[▸ N inside]`): → or Enter opens one, ← folds it; one is open here.
const AREAS = [
  ['canvas', 9, 6, false, [['✓', 'side nav', 'add, fit, find'], ['✓', 'focus', 'work inside a piece', 0, 1], ['✓', 'piece made', 'edit mode'], ['✓', 'console', 'every piece has one'], ['•', 'unframe', 'lay a piece on the canvas'], ['•', 'stick', 'link a piece to a plane', 1], ['✓', 'beside', 'side by side'], ['✓', 'undo', '⌘Z brings it back'], ['•', 'move or share', 'to another canvas']]],
  ['planes and cards', 11, 4], ['links', 3, 0], ['text', 5, 1], ['matrix and table', 7, 1], ['documents', 4, 2],
  ['decks and days', 8, 1, true], ['together', 6, 3], ['canvases', 3, 1, true], ['settings', 3, 3],
]
function qList({ compact = false } = {}) {
  const row = (st, n, w, nw, sel, ind) => `<div class="it ${sel ? 'on' : ''} ${ind ? 'ind' : ''}"><span class="cur">›</span><span class="st ${st === '✓' ? 'seen' : ''}">${st}</span><span>${n}</span>${w ? `<span class="faint">·</span><span class="what">${w}</span>` : '<span class="what"></span>'}${nw ? '<span class="new">NEW</span>' : ''}</div>`
  const list = compact ? AREAS.slice(0, 7) : AREAS
  return `<div class="hd">start</div>` + row('✓', 'welcome', 'four pages to start') + row('•', 'what’s new', '3 changes since you were here', 1) +
    `<div class="hd">areas<span class="cnt">23 / 61 seen</span></div>` +
    list.map(([n, total, seen, nw, kids]) => `<div class="it area ${kids ? 'open' : ''}"><span class="cur">›</span><span class="st">${kids ? '▾' : '▸'}</span><span>${n}</span><span class="what">${seen} / ${total} seen</span>${nw ? '<span class="new">NEW</span>' : ''}<span class="fold">${kids ? '▾' : '▸'} ${total} inside</span></div>` +
      (kids ? kids.map(([st, ln, w, nw2, sel]) => row(st, ln, w, nw2, sel, true)).join('') : '')).join('') +
    (compact ? `<div class="it area"><span class="cur">›</span><span class="st">▸</span><span class="dim">3 more areas</span><span class="what"></span></div>` : '') +
    `<div class="hd">keys</div><div class="it area"><span class="cur">›</span><span class="st">▸</span><span>every shortcut</span><span class="what"></span><span class="fold">▸ 38 keys</span></div>`
}
function qHead() {
  return `<div class="line"><span class="s">&gt;</span><span class="ph">find a note or a key…</span><span class="faint">tips</span><span class="seg2"><span class="on">on</span><span>off</span></span></div>`
}
const Q = {
  a: () => `<div class="qa" data-cells style="width:560px">${qHead()}<div class="list">${qList()}</div><div class="more">↓ the list scrolls: 6 more areas and # keys below</div><div class="foot"><span>→ or ↵ opens an area · ← folds it · ↵ on a note plays it</span><span class="sp"></span><span>61 notes · 23 seen</span></div></div>`,
  b: () => `<div class="qa qb" data-cells>${qHead()}<div class="body2"><div class="list">${qList({ compact: true })}</div>
      <div class="pv"><div class="pg"><span class="lab">focus · 2 pages</span><span class="sp" style="flex:1"></span><span class="on">01</span><span>02</span></div>${demo('focus-ink')}
      <h4 class="title">Go inside with focus</h4><p class="body">${k('Press `focus` or double-click. Inside, the piece is yours to work in; `esc` comes back.')}</p><span style="flex:1"></span><div><span class="b go">↵ play here</span></div></div></div>
      <div class="more">↓ the list scrolls: more areas and # keys below</div><div class="foot"><span>→ or ↵ opens an area · ← folds it · ↵ on a note plays it</span><span class="sp"></span><span>61 notes · 23 seen</span></div></div>`,
  c: () => {
    const MAP = [
      ['start', [['✓', 'welcome'], ['•', 'what’s new', 1]], 2, 1],
      ['canvas', [['✓', 'side nav'], ['✓', 'focus', 0, 1], ['✓', 'piece made'], ['•', 'unframe'], ['•', 'stick', 1]], 9, 6],
      ['planes and cards', [['✓', 'make a card'], ['✓', 'card panel'], ['•', 'status, evidence'], ['•', 'packages']], 11, 4],
      ['links', [['•', 'draw a link'], ['•', 'for links'], ['•', 'link kinds']], 3, 0],
      ['text', [['✓', 'headings'], ['•', 'sticky notes'], ['•', 'sections']], 5, 1],
      ['matrix and table', [['✓', 'matrix keys'], ['•', 'how sure'], ['•', 'criteria']], 7, 1],
      ['decks and days', [['✓', 'deck'], ['•', 'side view', 1], ['•', 'timeline']], 8, 1],
      ['together', [['✓', 'comments'], ['•', 'follow'], ['•', 'threads']], 6, 3],
      ['documents', [['✓', 'documents'], ['•', 'beside the list']], 4, 2],
      ['canvases', [['✓', 'canvases'], ['•', 'move or share', 1]], 3, 1],
      ['settings', [['✓', 'people'], ['✓', 'export']], 3, 3],
    ]
    return `<div class="qa qc" data-cells>${qHead()}<div class="cols">${MAP.map(([h, rows, total, seen], i) =>
      `<div class="col"><div class="ch"><span class="num">${n2(i)}</span>${h}<span class="rl"></span><span class="c">${seen}/${total}</span></div>
       <div class="bar">${Array.from({ length: total }, (_, j) => `<i class="${j < seen ? 'on' : rows.some((r) => r[2]) && j === seen ? 'new' : ''}"></i>`).join('')}</div>
       ${rows.map(([st, n, nw, sel]) => `<div class="r ${sel ? 'on' : ''}"><span class="st ${st === '✓' ? 'seen' : ''}">${st}</span>${n}${nw ? ' <span class="new">NEW</span>' : ''}</div>`).join('')}
       ${total > rows.length ? `<div class="r dim">+ ${total - rows.length} more</div>` : ''}</div>`).join('')}
      <div class="col" style="grid-column:1/-1;margin:0"><div class="ch"><span class="num">12</span>keys<span class="rl"></span><span class="c">38</span></div>
       <div class="keys">${['⌘F find', '0 fit', 't decks and days', 'esc back out', '⌘Z undo', '⇧⌘Z redo', '⌥1–⌥9 canvases', '? this guide', 'c comments', 'g snapping', '+ p ↵ a plane'].map((s) => `<span><kbd>${s.split(' ')[0]}</kbd> ${s.split(' ').slice(1).join(' ')}</span>`).join('')}<span class="dim">+ 27 more</span></div></div>
    </div><div class="more">on a 768 px laptop these are below the fold: documents · canvases · settings · keys</div><div class="foot"><span>arrows move · ↵ plays it · type to find</span><span class="sp"></span><span>61 notes · 23 seen</span></div></div>`
  },
}

// ── Build ───────────────────────────────────────────────────────────
function build() {
  const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html }
  const wStage = (fn, s, p, seed) => stage(740, 700, canvas(740, 700, { seed }) + `<div class="shade"></div>` + fn(s, p))
  for (const [o, fn] of [['a', welcomeA], ['b', welcomeB], ['c', welcomeC]]) {
    set(`welcome-${o}`, [0, 2].map((p) => `<div>${wStage(fn, WELCOME, p, 4 + p)}${cap(`page ${p + 1}`, WELCOME.pages[p].title)}</div>`).join(''))
    set(`news-${o}`, `<div>${wStage(fn, NEWS, 0, 8)}${cap('what’s new · page 1', '[show me] closes it and opens the side view')}</div><div>${wStage(fn, NEWS, 3, 9)}${cap('what’s new · the + N more page', 'the smaller changes as a list')}</div>`)
  }
  for (const o of ['a', 'b', 'c']) {
    const [s1, s2] = LESSON[o]()
    set(`lesson-${o}`, `<div>${s1}${cap('anchored to a console', 'piece-console, page 2; a busy table under it')}</div><div>${s2}${cap('anchored to the focus dock', 'focus-plane, page 1, straight above the dock')}</div>`)
    set(`nodemo-${o}`, `<div>${stage(740, 380, nodemoBg() + toast(740, 380) + NODEMO[o](740, 380))}${cap('no demo', o === 'c' ? 'hazard-undo: one column, rising out of the toast’s top edge' : 'hazard-undo, anchored to the toast')}</div>
      <div>${fallbackStage(o)}${cap('no room beside the anchor', 'piece-made: the new piece fills the screen, so the card goes to the bottom middle, no lead')}</div>`)
    set(`handover-${o}`, handover(o))
  }
  for (const o of ['a', 'b', 'c']) {
    set(`kind-${o}`, `<div>${kindStage(o, false)}${cap('on the canvas', 'plane under the keys')}</div><div>${kindStage(o, true)}${cap('in a plane’s focus', 'problem under the pointer')}</div>`)
    set(`kind2-${o}`, `<div>${narrowStage(o)}${cap('typed pl', o === 'b' ? 'the menu shrinks to one row; the ink needs no floor' : 'one row left; the panel keeps the guide’s own height as its floor')}</div><div>${hiddenStage()}${cap('after [hide guide]', 'gone for good; one line says ? brings it back, then fades with the menu')}</div>`)
  }
  const qStage = (inner, h = 760) => stage(1500, h, canvas(1500, h, { seed: 21, nav: false }) + sidenav(null, null, true) + `<div class="scrim"></div>` + inner)
  set('q-a', qStage(Q.a(), 680))
  set('q-b', qStage(Q.b(), 680))
  set('q-c', qStage(Q.c(), 680))
  set('play-row', ['a', 'b', 'c'].map((o) => `<div>${playStage(o)}${cap(`lesson:${o}`, '↵ on a note in ? plays it here, in the middle; ‹ guide goes back')}</div>`).join(''))

  // Small: the nudge, the empty-canvas hint. The side nav is in the middle of the left edge.
  const SH = 460, navTop = SH / 2 - 87
  set('small-row', `<div>${stage(740, SH, canvas(740, SH, { seed: 31, nav: false, pieces: false }) + piece(330, 70, 360, 220, '01 pazar', 'plane', card('cust', 30, 40, 'Corner shops') + card('prob', 200, 40, 'Stock runs out') + link(150, 70, 200, 70)) + sidenav(navTop) +
      `<div class="nudge" data-cells style="left:52px;top:${navTop + 76}px"><span class="lead2"></span><span class="txt ink"><code class="k">⌘F</code> finds anything</span><span class="x">· ×</span></div>`)}
      ${cap('nudge', 'nudge-finder, by the tool it points at; at most one a session')}</div>
    <div>${stage(740, SH, field(740, SH, 41) + `<div class="crumb">${CRUMB}</div>` + sidenav(navTop) + cornerHtml() +
      `<div class="arrowL" style="left:54px;top:${navTop + 15}px"><span>◂</span><span class="ln" style="width:150px"></span></div>` +
      `<div class="empty ink" style="top:${navTop + 15}px;left:220px">press <span class="plusG">+</span> to add your first piece</div>`)}
      ${cap('empty canvas', 'at the + ’s height, its arrow straight to it; gone at the first piece')}</div>`)
  fitScenes()
  // The floor: the panel never gets shorter than its guide (measured, so it holds whatever the demo's shape).
  document.querySelectorAll('.floor').forEach((f) => {
    const p = f.previousElementSibling, hgt = p.offsetHeight
    f.style.top = `${p.offsetTop + hgt}px`
    f.querySelector('span').textContent = `floor · the guide’s height, ${hgt} px`
  })
  // lesson:c on a toast: centred on it, and its open bottom edge is magenta except where the toast's own top edge runs.
  document.querySelectorAll('[data-on-toast]').forEach((d) => {
    const t = d.parentElement.querySelector('.toast')
    const cx = t.offsetLeft, tw = t.offsetWidth
    const w = Math.max(320, tw)
    d.style.width = `${w}px`
    d.style.left = `${cx - w / 2}px`
    d.style.bottom = `${d.parentElement.clientHeight - (t.offsetTop) - 1}px`
    const y = t.offsetTop
    const l = cx - w / 2, r = cx + w / 2, tl = cx - tw / 2, tr = cx + tw / 2
    d.insertAdjacentHTML('afterend', `<i class="seamSeg" style="left:${l}px;top:${y}px;width:${tl - l}px"></i><i class="seamSeg" style="left:${tr}px;top:${y}px;width:${r - tr}px"></i>`)
  })
  stillCells()
}

// ── Cell-by-cell entrance (Appear's runCells, random order, 320 ms) ──
function runCells(el, duration = 320) {
  if (reduced || el.dataset.still) return
  const start = performance.now()
  const frame = (now) => {
    const p = ((now - start) / duration) * 1.02
    const r = el.getBoundingClientRect(), w = r.width, h = r.height
    const gx0 = Math.floor(r.left / CELL), gy0 = Math.floor(r.top / CELL)
    const ox = gx0 * CELL - r.left, oy = gy0 * CELL - r.top
    const cols = Math.ceil((w - ox) / CELL), rows = Math.ceil((h - oy) / CELL)
    let path = ''
    for (let y = 0; y < rows; y++) {
      const y0 = Math.max(0, oy + y * CELL), y1 = Math.min(h, oy + (y + 1) * CELL)
      let run = -1
      for (let c = 0; c <= cols; c++) {
        const vis = c < cols && cellHash(gx0 + c, gy0 + y) <= p
        if (vis && run < 0) run = c
        if (!vis && run >= 0) { path += `M${Math.max(0, ox + run * CELL)} ${y0}H${Math.min(w, ox + c * CELL)}V${y1}H${Math.max(0, ox + run * CELL)}Z`; run = -1 }
      }
    }
    el.style.clipPath = path ? `path('${path}')` : 'polygon(0 0,0 0,0 0)'
    if (p < 1.02) requestAnimationFrame(frame)
    else el.style.clipPath = ''
  }
  requestAnimationFrame(frame)
}
function replay(root = document) { root.querySelectorAll('[data-cells]').forEach((el) => runCells(el)) }

// Each section builds when it scrolls into view, as it would when opened.
function watch() {
  if (reduced || !('IntersectionObserver' in window)) return
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { replay(e.target); io.unobserve(e.target) } }), { threshold: 0.25 })
  document.querySelectorAll('.opt').forEach((o) => io.observe(o))
}

const params = new URLSearchParams(location.search)
if (params.get('theme') === 'light') document.documentElement.dataset.theme = 'light'
build()
if (!params.has('still')) watch()
const tb = document.getElementById('theme')
const setLabel = () => { tb.textContent = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light' }
setLabel()
tb.addEventListener('click', () => {
  const r = document.documentElement
  if (r.dataset.theme === 'light') delete r.dataset.theme
  else r.dataset.theme = 'light'
  setLabel()
})
document.getElementById('replay').addEventListener('click', () => replay())
addEventListener('resize', () => { fitScenes(); stillCells() })
