// Workspaces page: four options on made-up data. A preview, not app code.
'use strict'

// ── Made-up data ─────────────────────────────────────────────────────────────
// People colours by join order (D-067): cyan, magenta, yellow, green, blue.
const C = ['--accent-cyan', '--accent-magenta', '--accent-yellow', '--accent-green', '--accent-blue']
const P = (n, i, away = false) => ({ n, c: C[i % C.length], away })
const BASE = [
  { id: 'pazar', name: 'Pazar', about: 'A marketplace for neighbourhood bazaars: stalls book a spot, buyers pre-order.', role: 'owner',
    people: [P('Y', 0), P('A', 1), P('M', 2)], here: ['A'], opened: 2 * 60, mine: 2, asking: 2, seed: 3,
    since: [['A', 1, 'moved 4 cards on 01 Lunch', '40m'], ['M', 2, 'commented on “Pre-order window”', '1h'], ['A', 1, 'gave you 2 tasks on 05 Launch', '1h']] },
  { id: 'lunch', name: 'Office lunch subscriptions', about: 'Weekly lunch plans for teams of 10–50.', role: 'editor',
    people: [P('D', 3), P('Y', 0), P('K', 4), P('S', 1), P('E', 2)], here: [], opened: 26 * 60, mine: 1, asking: 0, seed: 7,
    since: [['D', 3, 'added a deck “Pilot week”', '5h']] },
  { id: 'pets', name: 'Pet-sitting marketplace', about: 'Trusted sitters within a 10-minute walk.', role: 'owner',
    people: [P('Y', 0), P('B', 1)], here: [], opened: 6 * 1440, mine: 0, asking: 0, seed: 11, since: [] },
  { id: 'audit', name: 'Rival audit, Q4', about: '', role: 'viewer',
    people: [P('K', 4), P('Y', 0), P('L', 2), P('T', 3)], here: ['L'], opened: 21 * 1440, mine: 0, asking: 0, seed: 19, since: [['L', 2, 'filled 12 matrix cells', '2d']] },
  { id: 'climb', name: 'Second-hand climbing gear', about: 'Checked gear, resold with a safety log.', role: 'owner',
    people: [P('Y', 0)], here: [], opened: 64 * 1440, mine: 0, asking: 0, seed: 23, since: [] },
]
const EXTRA = ['Clinic booking for small towns', 'Tutors on demand', 'Farm boxes', 'Repair cafés', 'Kitchen robots for cafés', 'Used textbooks', 'Coworking for parents'].map((name, i) => ({
  id: 'x' + i, name, about: '', role: ['editor', 'owner', 'viewer'][i % 3], people: [P('Y', 0), P('R', i + 1)], here: [], opened: (90 + i * 30) * 1440, mine: 0, asking: 0, seed: 31 + i * 5, since: [],
}))
const INVITE = { name: 'Kitchen robots', by: 'Deniz', members: 4 }
const REQUEST = { code: 'QRST-UVWX' }

let state = 'normal'
let wide = false // the full-width layout was tried and dropped (the user: centre reads better)
let option = 'B'
const ONE = [{ ...BASE[2], opened: 5, since: [] }]
const list = () => (state === 'first' ? [] : state === 'one' ? ONE : state === 'many' ? [...BASE, ...EXTRA] : BASE)
const pending = () => state === 'normal'

const ago = (m) => (m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : m < 1440 * 14 ? `${Math.round(m / 1440)}d` : m < 1440 * 60 ? `${Math.round(m / 10080)}w` : `${Math.round(m / 43200)}mo`)
const pad = (n) => String(n).padStart(2, '0')
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim()
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches

const squares = (w, max = 4) =>
  `<span class="squares">${w.people.slice(0, max).map((p) => `<span class="sq${w.here.includes(p.n) || p.n === 'Y' ? '' : ' away'}" style="background:var(${p.c})" title="${p.n}">${p.n}</span>`).join('')}${w.people.length > max ? `<span class="more">+${w.people.length - max}</span>` : ''}</span>`
const hereNow = (w) => (w.here.length ? `<span class="here">${w.here.length} here now</span>` : '')
const facts = (w) =>
  [hereNow(w), w.mine ? `<span class="mine">☐ ${w.mine} for you</span>` : '', w.asking ? `<span class="asking">${w.asking} asking to join</span>` : ''].filter(Boolean).join('')

// ── The canvas picture: a small drawing of a workspace's canvas, as a plane's fitted picture is drawn ────────────
function rng(seed) { let s = seed * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280) }
function drawPicture(cv, w) {
  const dpr = devicePixelRatio || 1
  const W = cv.clientWidth, H = cv.clientHeight
  if (!W || !H) return
  cv.width = W * dpr; cv.height = H * dpr
  const g = cv.getContext('2d'); g.scale(dpr, dpr)
  const r = rng(w.seed)
  g.fillStyle = css('--bg'); g.fillRect(0, 0, W, H)
  const types = ['--type-customer', '--type-problem', '--type-competitor', '--type-idea', '--type-feature'].map(css)
  const kinds = ['--accent-magenta', '--accent-cyan', '--accent-yellow', '--accent-blue'].map(css)
  const n = 3 + Math.floor(r() * 4)
  const cols = n > 4 ? 3 : 2
  const cw = (W - 16 - (cols - 1) * 8) / cols
  const rows = Math.ceil(n / cols)
  const ch = (H - 16 - (rows - 1) * 8) / rows
  for (let i = 0; i < n; i++) {
    const x = 8 + (i % cols) * (cw + 8), y = 8 + Math.floor(i / cols) * (ch + 8)
    const pw = cw * (0.75 + r() * 0.25), ph = ch * (0.7 + r() * 0.3)
    g.fillStyle = css('--piece'); g.fillRect(x, y, pw, ph)
    g.strokeStyle = css('--piece-edge'); g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, pw - 1, ph - 1)
    const kind = r()
    g.fillStyle = kinds[Math.floor(kind * kinds.length)]; g.fillRect(x, y, pw, 2)
    if (kind < 0.5) {
      // a plane: its grid's dots (only planes have them), then cards in type colours
      g.fillStyle = css('--grid-mark'); g.globalAlpha = 0.7
      for (let gx = x + 4; gx < x + pw - 2; gx += 6) for (let gy = y + 6; gy < y + ph - 2; gy += 6) g.fillRect(gx, gy, 1, 1)
      g.globalAlpha = 1
      const cs = Math.max(8, pw / 7)
      for (let cx = x + 5; cx + cs < x + pw - 4; cx += cs + 3)
        for (let cy = y + 7; cy + cs * 0.5 < y + ph - 4; cy += cs * 0.5 + 3) {
          if (r() < 0.25) continue
          const c = types[Math.floor(r() * types.length)]
          g.globalAlpha = 0.28; g.fillStyle = c; g.fillRect(cx, cy, cs, cs * 0.5)
          g.globalAlpha = 1; g.fillRect(cx, cy, 1.5, cs * 0.5)
        }
      g.globalAlpha = 0.5; g.strokeStyle = css('--fg-faint'); g.beginPath()
      for (let k = 0; k < 3; k++) { g.moveTo(x + r() * pw, y + 8 + r() * (ph - 12)); g.lineTo(x + r() * pw, y + 8 + r() * (ph - 12)) }
      g.stroke(); g.globalAlpha = 1
    } else if (kind < 0.75) {
      // a deck: columns of task sheets
      const k = 3 + Math.floor(r() * 2), colW = (pw - 8) / k
      for (let c = 0; c < k; c++) {
        g.fillStyle = css('--fg-faint'); g.fillRect(x + 4 + c * colW, y + 8, colW - 6, 1)
        const m = 1 + Math.floor(r() * 4)
        for (let t = 0; t < m && y + 13 + t * 9 + 6 < y + ph; t++) {
          const sx = x + 4 + c * colW, sy = y + 12 + t * 9
          g.fillStyle = css('--piece-mark'); g.fillRect(sx, sy, colW - 6, 6)
          g.fillStyle = types[Math.floor(r() * types.length)]; g.fillRect(sx, sy, 1.5, 6)
        }
      }
    } else {
      // a table or matrix: rows of cells
      for (let yy = y + 8; yy < y + ph - 5; yy += 6) for (let xx = x + 5; xx < x + pw - 6; xx += 8) {
        g.fillStyle = r() < 0.3 ? css('--accent-cyan') : css('--piece-mark'); g.globalAlpha = r() < 0.3 ? 0.6 : 1; g.fillRect(xx, yy, 5, 3)
      }
      g.globalAlpha = 1
    }
  }
}
const pictures = () => document.querySelectorAll('canvas.pic').forEach((cv) => drawPicture(cv, list().find((w) => w.id === cv.dataset.ws) ?? BASE[0]))

// ── One entrance everywhere: cell by cell, random order, 320 ms (D-034) ──────────────────────────────────────────
function reveal(root) {
  if (reduced()) return
  const els = root.querySelectorAll('[data-appear]')
  els.forEach((el) => {
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) return
    const cv = document.createElement('canvas')
    const pad = 12
    cv.style.cssText = `position:absolute;left:${-pad}px;top:${-pad}px;width:${r.width + 2 * pad}px;height:${r.height + 2 * pad}px;pointer-events:none;z-index:20`
    const dpr = devicePixelRatio || 1
    cv.width = (r.width + 2 * pad) * dpr; cv.height = (r.height + 2 * pad) * dpr
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative'
    el.appendChild(cv)
    const g = cv.getContext('2d'); g.scale(dpr, dpr)
    const bg = css('--bg'); g.fillStyle = bg; g.fillRect(0, 0, r.width + 2 * pad, r.height + 2 * pad)
    const S = 9, cells = []
    for (let x = 0; x < r.width + 2 * pad; x += S) for (let y = 0; y < r.height + 2 * pad; y += S) cells.push([x, y])
    for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]] }
    const t0 = performance.now(), dur = 320
    let done = 0
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur)
      const upto = Math.floor(cells.length * k)
      for (; done < upto; done++) g.clearRect(cells[done][0], cells[done][1], S, S)
      if (k < 1) requestAnimationFrame(tick); else cv.remove()
    }
    requestAnimationFrame(tick)
  })
}

const toast = (msg) => {
  document.querySelector('.toast')?.remove()
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t)
  setTimeout(() => t.remove(), 1800)
}
const L = '<i class="L tl"></i><i class="L tr"></i><i class="L bl"></i><i class="L br"></i>'

// ── Shared: the new-workspace window and the ⋯ menu ──────────────────────────────────────────────────────────────
function newWindow(name = '') {
  closeAll()
  const s = document.createElement('div'); s.className = 'scrim'
  s.innerHTML = `<div class="window" data-appear>
    <header><span class="caps">new workspace</span><button class="verb" data-x>× <kbd>esc</kbd></button></header>
    <div class="body">
      <div class="field"><label class="caps">name <span class="count">${name.length}/80</span></label><input id="nwName" maxlength="80" placeholder="e.g. Pet-sitting marketplace" value="${esc(name)}"></div>
      <div class="field"><label class="caps">what are you building? <span class="faint">optional</span></label><textarea rows="2" placeholder="One line: who it's for and what it does. The agent reads it too."></textarea></div>
    </div>
    <footer><span class="hint">↵ create · it opens on its canvas</span><button class="verb primary" data-x>create <kbd>↵</kbd></button></footer>
  </div>`
  document.body.appendChild(s)
  s.addEventListener('click', (e) => { if (e.target === s || e.target.closest('[data-x]')) { s.remove(); if (e.target.closest('.primary')) toast('→ made, opening its canvas') } })
  reveal(s)
  setTimeout(() => s.querySelector('#nwName').focus(), 0)
}
function joinWindow() {
  closeAll()
  const s = document.createElement('div'); s.className = 'scrim'
  s.innerHTML = `<div class="window" data-appear style="--accent-magenta:var(--accent-cyan)">
    <header><span class="caps">ask to join</span><button class="verb" data-x>× <kbd>esc</kbd></button></header>
    <div class="body"><div class="field"><label class="caps">invite code</label><input class="mono" placeholder="ABCD-EFGH" style="font-family:'JetBrains Mono';letter-spacing:var(--track-label)"></div>
    <p class="dim" style="margin:0">An owner lets you in from their settings. You'll see it here under <b class="mono" style="font-weight:400">waiting</b> until then.</p></div>
    <footer><span></span><button class="verb primary" data-x>ask <kbd>↵</kbd></button></footer></div>`
  document.body.appendChild(s)
  s.addEventListener('click', (e) => { if (e.target === s || e.target.closest('[data-x]')) s.remove() })
  reveal(s)
  setTimeout(() => s.querySelector('input').focus(), 0)
}
function menuAt(x, y, w) {
  closeAll()
  const m = document.createElement('div'); m.className = 'menu'
  const owner = w.role === 'owner', edit = w.role !== 'viewer'
  m.innerHTML = `<div class="prompt" style="padding:4px 12px 8px;margin-bottom:4px"><span class="gt" style="font-size:13px">&gt;</span><input placeholder="${esc(w.name)}" style="font-size:13px"></div>
    <div class="mrow"><span class="k">o</span>open</div>
    <div class="mrow"><span class="k">t</span>open in a new tab</div>
    ${edit ? '<div class="mrow"><span class="k">r</span>rename</div>' : ''}
    ${owner ? '<div class="mrow"><span class="k">c</span>copy invite code</div><div class="mrow"><span class="k">p</span>people…</div>' : ''}
    <div class="mrow"><span class="k">e</span>export .zip</div>
    <div class="mrule"></div>
    ${owner ? '<div class="mrow danger"><span class="k">⌫</span>delete…</div>' : '<div class="mrow danger"><span class="k">l</span>leave…</div>'}
    <div class="mfoot">${w.role} · ${w.people.length} ${w.people.length === 1 ? 'person' : 'people'}</div>`
  m.style.left = Math.min(x, innerWidth - 260) + 'px'; m.style.top = Math.min(y, innerHeight - 300) + 'px'
  document.body.appendChild(m)
  m.addEventListener('click', (e) => { const r = e.target.closest('.mrow'); if (r) { m.remove(); toast('→ ' + r.textContent.slice(1).trim()) } })
  reveal(m)
}
function closeAll() { document.querySelectorAll('.menu,.scrim').forEach((e) => e.remove()) }
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll() })
addEventListener('click', (e) => { if (!e.target.closest('.menu,[data-menu]')) document.querySelectorAll('.menu').forEach((m) => m.remove()) })

// ── First visit: the same three choices in every option ──────────────────────────────────────────────────────────
function renderFirst() {
  return `<section class="first">
    <h1 data-appear>Start here</h1>
    <p class="lead" data-appear>A workspace is one startup idea: its customers, problems, rivals and plan, on a canvas you share.</p>
    <div class="three">
      <div class="piece main" data-appear><span class="cut"><span class="num">01</span>new</span>
        <span class="t">Start a workspace</span><span class="s">Name the idea. You can describe it now or later.</span>
        <div class="field"><input placeholder="e.g. Pet-sitting marketplace"></div><button class="verb primary" style="align-self:flex-end" onclick="newWindow(this.previousElementSibling.querySelector('input').value)">create <kbd>↵</kbd></button></div>
      <div class="piece join" data-appear><span class="cut"><span class="num">02</span>join</span>
        <span class="t">Join a teammate's</span><span class="s">Paste the code they gave you. An owner lets you in.</span>
        <div class="field"><input placeholder="ABCD-EFGH" style="font-family:'JetBrains Mono';letter-spacing:var(--track-label)"></div><button class="verb" style="align-self:flex-end">ask</button></div>
      <div class="piece imp" data-appear><span class="cut"><span class="num">03</span>import</span>
        <span class="t">Bring one in</span><span class="s">A .zip exported from North Star.</span>
        <div class="drop">drop a .zip here, or <button class="verb">choose file</button></div></div>
    </div></section>`
}

// ── A · Pieces ───────────────────────────────────────────────────────────────────────────────────────────────────
function renderA() {
  const ws = [...list()].sort((a, b) => a.opened - b.opened)
  return `<section class="A">
    <div class="head"><h1 data-appear>Workspaces<span class="num">${pad(ws.length)}</span></h1>
      <div class="tools" data-appear><button class="verb" onclick="newWindow()">+ new <kbd>n</kbd></button><button class="verb" onclick="joinWindow()">join with a code <kbd>j</kbd></button><button class="verb">import .zip</button></div></div>
    ${pending() ? `<div class="piece invite" data-appear><span class="cut">invited</span><span class="t">${INVITE.name}</span><span class="dim">${INVITE.by} invited you · ${INVITE.members} people</span><span class="sp"></span><button class="verb primary">join</button><button class="verb">decline</button>
      <span class="faint mono" style="font-size:11px;margin-left:12px">· you asked to join ${REQUEST.code} <button class="verb">withdraw</button></span></div>` : ''}
    <div class="grid">
      ${ws.map((w, i) => `<article class="piece ws marked" data-ws="${w.id}" data-appear style="--band:${i === 0 ? 'var(--accent-cyan)' : 'var(--piece-edge)'}">${L}
        <span class="cut"><span class="num">${pad(i + 1)}</span>${esc(w.name)} <span class="kind">· ${w.role}</span></span>
        <canvas class="pic" data-ws="${w.id}"></canvas>
        ${w.about ? `<div class="about">${esc(w.about)}</div>` : ''}
        <div class="foot">${squares(w)}${facts(w)}<span class="sp"></span><span>${ago(w.opened)} ago</span></div>
        <div class="console"><button class="verb primary">open <kbd>↵</kbd></button><button class="verb" data-menu>⋯</button></div>
      </article>`).join('')}
      <div class="newPiece" data-appear onclick="newWindow()"><div><span class="plus">+</span>new workspace</div></div>
    </div></section>`
}
function wireA(root) {
  root.querySelectorAll('.ws').forEach((el) => {
    const w = list().find((x) => x.id === el.dataset.ws)
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-menu]')) { const r = e.target.getBoundingClientRect(); menuAt(r.left, r.bottom + 6, w); return }
      if (e.target.closest('.verb')) return toast(`→ ${w.name}'s canvas`)
      root.querySelectorAll('.ws.sel').forEach((s) => s.classList.remove('sel')); el.classList.add('sel')
    })
    el.addEventListener('dblclick', () => toast(`→ ${w.name}'s canvas`))
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); menuAt(e.clientX, e.clientY, w) })
  })
}

// ── B · Ledger, one prompt, a panel ──────────────────────────────────────────────────────────────────────────────
let bSel = 0, bQuery = ''
const CODE = /^[A-Z0-9]{4}-?[A-Z0-9]{4}$/i
function bRows() {
  const q = bQuery.trim().toLowerCase()
  const ws = [...list()].sort((a, b) => a.opened - b.opened).filter((w) => !q || w.name.toLowerCase().includes(q))
  return ws
}
function renderB() {
  return `<section class="B"><div class="left">
    <h1 data-appear>Workspaces</h1>
    <div data-appear><div class="prompt"><span class="gt">&gt;</span><input id="bq" autocomplete="off" placeholder="find, start a new one, or paste an invite code…" value="${esc(bQuery)}"></div>
    <div class="hint" id="bhint"></div></div>
    <div id="brows" data-appear></div></div>
    <aside class="panel corners" id="bpanel"></aside></section>`
}
function bDraw(root) {
  const ws = bRows(), q = bQuery.trim()
  const rows = root.querySelector('#brows')
  if (option === 'E') {
    const was = rows.dataset.mode, now = q ? 'find' : 'home'
    rows.dataset.mode = now
    if (!q) {
      const none = list().length === 0
      rows.innerHTML = `<section class="D">${none ? firstBody() : dBody(false)}</section>`
      wireD(rows); pictures(); rows.querySelectorAll('canvas.blank').forEach(drawBlank)
      rows.querySelectorAll('[data-focus-prompt]').forEach((b) => b.addEventListener('click', () => root.querySelector('#bq').focus()))
      if (was && was !== now) reveal(rows)
      root.querySelector('#bhint').innerHTML = none
        ? 'type a name and <b>↵</b> to start · paste an invite code to join · drop a <b>.zip</b> anywhere to import'
        : `<b>↵</b> continue ${esc(ws[0].name)} · type to find · a new name <b>↵</b> starts one · an invite code <b>↵</b> asks to join · drop a <b>.zip</b> anywhere to import`
      root._items = none ? [] : [{ w: ws[0] }]; bSel = 0
      return
    }
    if (was !== now) requestAnimationFrame(() => reveal(rows))
  }
  const isCode = CODE.test(q)
  const extra = q && !isCode && !ws.some((w) => w.name.toLowerCase() === q.toLowerCase())
  const items = [...ws.map((w) => ({ w })), ...(isCode ? [{ code: q.toUpperCase() }] : []), ...(extra ? [{ create: q }] : [])]
  bSel = Math.min(bSel, Math.max(0, items.length - 1))
  const hl = (s) => (q && !isCode ? esc(s).replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'), '<mark>$1</mark>') : esc(s))
  let html = ''
  if (pending() && !q) html += `<div class="rule">waiting<span class="count">2</span></div>
    <div class="row" style="cursor:default"><span class="n" style="color:var(--accent-cyan)">→</span><span class="name">${INVITE.name}</span><span class="meta"><span class="dim">${INVITE.by} invited you · ${INVITE.members} people</span><button class="verb primary">join</button><button class="verb">decline</button></span><span class="sub">join to see it on this list</span></div>
    <div class="row" style="cursor:default"><span class="n faint">…</span><span class="name mono" style="font-size:15px">${REQUEST.code}</span><span class="meta"><span class="dim">waiting for an owner</span><button class="verb">withdraw</button></span><span class="sub">you asked to join with this code</span></div>`
  html += `<div class="rule">${q ? 'matches' : 'yours'}<span class="count">${pad(ws.length)}</span></div><div class="rows">`
  html += items.map((it, i) => {
    if (it.w) { const w = it.w; return `<div class="row marked${i === bSel ? ' sel' : ''}" data-i="${i}">${L}<span class="n">${pad(i + 1)}</span><span class="name">${hl(w.name)}</span>
      <span class="meta">${facts(w)}${squares(w)}<span>${w.role}</span><span style="width:34px;text-align:right">${ago(w.opened)}</span></span>
      <span class="sub">${w.since.length ? `${esc(w.since[0][0] === 'A' ? 'Ayşe' : w.since[0][0] === 'M' ? 'Mert' : w.since[0][0] === 'D' ? 'Deniz' : 'Lale')} ${esc(w.since[0][2])}${w.since.length > 1 ? ` · +${w.since.length - 1} more since you left` : ''}` : esc(w.about || 'nothing new since you left')}</span></div>` }
    if (it.code) return `<div class="row create marked${i === bSel ? ' sel' : ''}" data-i="${i}">${L}<span class="n">↵</span><span class="name">ask to join <span class="mono">${esc(it.code)}</span></span><span class="sub">an owner lets you in; it waits under “waiting”</span></div>`
    return `<div class="row create marked${i === bSel ? ' sel' : ''}" data-i="${i}">${L}<span class="n">+</span><span class="name">new workspace “${esc(it.create)}”</span><span class="sub">↵ makes it and opens its canvas · ⇥ add what you're building first</span></div>`
  }).join('')
  html += `</div>`
  if (!q) html += `<div class="hint" style="margin-top:22px">drop a <b>.zip</b> anywhere to import an exported workspace · <button class="verb">choose file</button></div>`
  root.querySelector('#brows').innerHTML = html
  root.querySelector('#bhint').innerHTML = isCode ? '<span class="live">looks like an invite code</span> · ↵ asks to join' : q ? `<b>↑↓</b> pick · <b>↵</b> open${extra ? ` · or ↵ on the last row to make “${esc(q)}”` : ''}` : '<b>↑↓</b> pick · <b>↵</b> open · <b>⌘↵</b> new tab · <b>⋯</b> or right-click for rename, leave, delete'
  root.querySelectorAll('.row[data-i]').forEach((r) => {
    r.addEventListener('mouseenter', () => { bSel = +r.dataset.i; mark(root); bPanel(root, items[bSel]) })
    r.addEventListener('click', () => go(items[+r.dataset.i]))
    r.addEventListener('contextmenu', (e) => { const it = items[+r.dataset.i]; if (it.w) { e.preventDefault(); menuAt(e.clientX, e.clientY, it.w) } })
  })
  bPanel(root, items[bSel])
  root._items = items
}
function mark(root) { root.querySelectorAll('.row[data-i]').forEach((r) => r.classList.toggle('sel', +r.dataset.i === bSel)) }
function go(it) { if (!it) return; if (it.w) toast(`→ ${it.w.name}'s canvas`); else if (it.code) toast(`asked to join ${it.code}`); else newWindow(it.create) }
function bPanel(root, it) {
  const p = root.querySelector('#bpanel'); if (!p) return
  const w = it?.w
  if (!w) { p.innerHTML = `<div class="ph"><span class="caps dim">${it?.code ? 'join' : 'new'}</span></div><h2>${it?.code ? 'Ask to join' : 'A new workspace'}</h2><p class="about">${it?.code ? 'The owner sees your name and email and lets you in from their settings.' : 'It opens on an empty canvas. The welcome walks you through the first plane.'}</p>`; return }
  const name = { A: 'Ayşe', M: 'Mert', D: 'Deniz', L: 'Lale' }
  p.innerHTML = `<div class="ph"><span class="caps dim">workspace · ${w.role}</span><span class="caps faint">${w.people.length} people</span></div>
    <h2>${esc(w.name)}</h2>${w.about ? `<p class="about">${esc(w.about)}</p>` : ''}
    <canvas class="pic" data-ws="${w.id}"></canvas>
    <div class="sec"><span class="num">01</span>SINCE YOU LEFT · ${ago(w.opened)}</div>
    <div class="ev">${w.since.length ? w.since.map((s) => `<span><span class="sq" style="background:var(${C[s[1]]});margin-right:8px">${s[0]}</span><b>${name[s[0]] ?? s[0]}</b> ${esc(s[2])} <span class="faint mono" style="font-size:11px">${s[3]}</span></span>`).join('') : '<span class="faint">nothing changed</span>'}</div>
    <div class="sec"><span class="num">02</span>PEOPLE</div>
    <div class="ev"><span>${squares(w, 6)} ${hereNow(w)}</span>${w.asking ? `<span class="asking">${w.asking} asking to join · <button class="verb">let in…</button></span>` : ''}</div>
    <div class="pfoot"><button class="verb primary">open <kbd>↵</kbd></button><button class="verb">new tab</button><span class="sp" style="flex:1"></span><button class="verb" data-menu>⋯</button></div>`
  drawPicture(p.querySelector('canvas'), w)
  p.querySelector('[data-menu]').onclick = (e) => { const r = e.target.getBoundingClientRect(); menuAt(r.left - 200, r.top - 280, w) }
}
function wireB(root) {
  const inp = root.querySelector('#bq')
  bDraw(root)
  inp.addEventListener('input', () => { bQuery = inp.value; bSel = 0; bDraw(root) })
  inp.addEventListener('keydown', (e) => {
    const n = root._items.length
    if (e.key === 'ArrowDown') { bSel = (bSel + 1) % n; mark(root); bPanel(root, root._items[bSel]); e.preventDefault() }
    if (e.key === 'ArrowUp') { bSel = (bSel - 1 + n) % n; mark(root); bPanel(root, root._items[bSel]); e.preventDefault() }
    if (e.key === 'Enter') go(root._items[bSel])
  })
  setTimeout(() => inp.focus(), 350)
}

// ── C · Sky ──────────────────────────────────────────────────────────────────────────────────────────────────────
function renderC() {
  const ws = list()
  return `<section class="C"><canvas class="sky"></canvas>
    <div class="legend" data-appear><h1>Your sky</h1>
      ${ws.map((w, i) => `<div class="li" data-ws="${w.id}"><span class="num">${pad(i + 1)}</span>${esc(w.name)}</div>`).join('')}
      <p class="hint" style="margin-top:14px">brighter = more going on · <span class="live">cyan</span> = someone's there now</p></div>
    ${pending() ? `<div class="piece invite" data-appear><span class="cut">invited</span><div style="font-size:16px;color:var(--fg-strong)">${INVITE.name}</div><div class="dim" style="margin:4px 0 10px">${INVITE.by} invited you · ${INVITE.members} people</div><button class="verb primary">join</button> <button class="verb">decline</button></div>` : ''}
    <div id="stars"></div><div id="ccard"></div>
    <div class="dock" data-appear><button class="verb" onclick="newWindow()">+ new star <kbd>n</kbd></button><button class="verb" onclick="joinWindow()">join <kbd>j</kbd></button><button class="verb">import</button><span class="faint mono" style="font-size:11px">⌘F find</span></div></section>`
}
function wireC(root) {
  const cv = root.querySelector('canvas.sky'), box = root.getBoundingClientRect()
  const W = box.width, H = box.height, dpr = devicePixelRatio || 1
  cv.width = W * dpr; cv.height = H * dpr
  const g = cv.getContext('2d'); g.scale(dpr, dpr)
  const r = rng(5), S = 9
  g.fillStyle = css('--bg'); g.fillRect(0, 0, W, H)
  for (let x = 0; x < W; x += S) for (let y = 0; y < H; y += S) { const v = r(); if (v > 0.985) { g.fillStyle = css('--fg-faint'); g.globalAlpha = (v - 0.985) * 40; g.fillRect(x + 3, y + 3, 2, 2) } }
  g.globalAlpha = 1
  const ws = list()
  // Fixed spots, spread out: a seeded try per workspace, kept away from the others (and from the legend and the invite).
  const spots = []
  ws.forEach((w) => {
    const rr = rng(w.seed * 3 + 1)
    let best = null, bestD = -1
    for (let k = 0; k < 60; k++) {
      const c = { x: 0.3 + rr() * 0.36, y: 0.14 + rr() * 0.7 }
      const d = Math.min(1, ...spots.map((s) => Math.hypot((s.x - c.x) * W, (s.y - c.y) * H) / 400))
      if (d > bestD) { bestD = d; best = c }
    }
    spots.push({ w, ...best })
  })
  // faint lines between workspaces you share people with: a constellation
  g.strokeStyle = css('--line-hover'); g.setLineDash([2, 5])
  for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) {
    const a = spots[i], b = spots[j]
    if (a.w.people.some((p) => p.n !== 'Y' && b.w.people.some((q) => q.n === p.n))) { g.beginPath(); g.moveTo(a.x * W, a.y * H); g.lineTo(b.x * W, b.y * H); g.stroke() }
  }
  const stars = root.querySelector('#stars'), card = root.querySelector('#ccard')
  stars.innerHTML = spots.map(({ w, x, y }) => {
    const heat = w.here.length ? 'warm' : w.opened > 14 * 1440 ? 'cold' : ''
    return `<div class="star ${heat}" data-ws="${w.id}" style="left:${x * 100}%;top:${y * 100}%"><div class="dot"></div><span class="lbl">${esc(w.name)}<span class="faint">${ago(w.opened)}</span></span>${w.mine || w.here.length ? `<span class="ppl mono" style="font-size:11px">${facts(w)}</span>` : ''}</div>`
  }).join('')
  const show = (id) => {
    const s = spots.find((p) => p.w.id === id); if (!s) { card.innerHTML = ''; return }
    const left = Math.min(s.x * W + 20, W - 360), top = Math.min(s.y * H + 40, H - 300)
    card.innerHTML = `<div class="piece card" style="left:${left}px;top:${top}px;--band:var(--accent-cyan)" data-appear><span class="cut">${esc(s.w.name)} <span class="kind">· ${s.w.role}</span></span><canvas class="pic" data-ws="${s.w.id}"></canvas><div class="body">${esc(s.w.about || 'No description yet.')}<div class="row">${squares(s.w)}${hereNow(s.w)}<span>${ago(s.w.opened)} ago</span></div></div></div>`
    drawPicture(card.querySelector('canvas'), s.w); reveal(card)
    root.querySelectorAll('.li').forEach((l) => l.classList.toggle('sel', l.dataset.ws === id))
  }
  root.querySelectorAll('.star, .li').forEach((el) => {
    el.addEventListener('mouseenter', () => show(el.dataset.ws))
    el.addEventListener('click', () => toast(`→ gliding into ${list().find((w) => w.id === el.dataset.ws).name}`))
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); menuAt(e.clientX, e.clientY, list().find((w) => w.id === el.dataset.ws)) })
  })
}

// ── D · Continue ─────────────────────────────────────────────────────────────────────────────────────────────────
function renderD() {
  const ws = [...list()].sort((a, b) => a.opened - b.opened)
  const [last, ...rest] = ws
  const name = { A: 'Ayşe', M: 'Mert', D: 'Deniz', L: 'Lale' }
  const hour = 'afternoon'
  return `<section class="D">
    <div class="greet" data-appear><h1>Good ${hour}. <span class="dim">Pick up where you left off.</span></h1><span class="hint">${ws.length} workspaces</span></div>
    ${dBody(true)}
  </section>`
}
// The continue piece, what needs you, the others; \`start\`: the new / join / import line (E has its prompt instead).
function dBody(start) {
  const ws = [...list()].sort((a, b) => a.opened - b.opened)
  const [last, ...rest] = ws
  const name = { A: 'Ayşe', M: 'Mert', D: 'Deniz', L: 'Lale' }
  return `<article class="piece hero marked" data-appear data-ws="${last.id}">${L}<span class="cut"><span class="num">01</span>continue <span class="kind">· ${last.role}</span></span>
      <canvas class="pic" data-ws="${last.id}"></canvas>
      <div class="side"><h2>${esc(last.name)}</h2><p class="about">${esc(last.about)}</p>
        <div class="caps dim" style="margin-bottom:10px">since you left · ${ago(last.opened)} ago</div>
        <div class="since">${last.since.length ? '' : '<span class="faint">nothing new since you left</span>'}${last.since.map((s) => `<span><span class="who" style="background:var(${C[s[1]]})">${name[s[0]]}</span>${esc(s[2])}<span class="t">${s[3]}</span></span>`).join('')}</div>
        <div class="go"><button class="big">continue ↵</button>${squares(last)}${hereNow(last)}<span style="flex:1"></span><button class="verb" data-menu>⋯</button></div></div>
    </article>
    ${last.mine || last.asking || pending() ? `<div class="attention">
      ${last.mine ? `<div class="piece att" data-appear><span class="cut">for you</span><span class="t">☐ ${last.mine + (rest[0]?.mine ?? 0)} tasks given to you</span><span class="s">2 in Pazar · 1 in Office lunch · one due tomorrow</span><div class="acts"><button class="verb">see them</button></div></div>` : ''}
      ${last.asking ? `<div class="piece att ask" data-appear><span class="cut">asking</span><span class="t">${last.asking} people asking to join Pazar</span><span class="s">Selin, Okan</span><div class="acts"><button class="verb primary">let in…</button></div></div>` : ''}
      ${pending() ? `<div class="piece att inv" data-appear><span class="cut">invited</span><span class="t">${INVITE.name}</span><span class="s">${INVITE.by} invited you · ${INVITE.members} people</span><div class="acts"><button class="verb primary">join</button><button class="verb">decline</button></div></div>` : ''}
    </div>` : ''}
    <aside class="feed"><div class="caps dim feedHead"><span class="num">·</span> across your workspaces</div>
      ${ws.flatMap((w) => w.since.map((s) => ({ w, s }))).map(({ w, s }) => `<div class="fe" data-ws="${w.id}"><span class="who" style="background:var(${C[s[1]]})">${name[s[0]]}</span><span>${esc(s[2])}</span><span class="t">${esc(w.name)} · ${s[3]}</span></div>`).join('')}
      ${ws.filter((w) => w.here.length).map((w) => `<div class="fe" data-ws="${w.id}"><span class="here">${w.here.length} here now</span><span class="t">${esc(w.name)}</span></div>`).join('')}
    </aside>
    ${rest.length ? `<div class="rule">others<span class="count">${pad(rest.length)}</span></div>` : ''}
    <div class="others">${rest.map((w, i) => `<article class="piece mini marked" data-appear data-ws="${w.id}" style="--band:var(--piece-edge)">${L}<span class="cut"><span class="num">${pad(i + 2)}</span><span class="kind">${w.role}</span></span>
      <canvas class="pic" data-ws="${w.id}"></canvas><div class="info"><span class="name">${esc(w.name)}</span><span class="row">${squares(w, 3)}${hereNow(w)}${w.mine ? `<span class="mine">☐ ${w.mine}</span>` : ''}<span style="flex:1"></span>${ago(w.opened)}</span></div></article>`).join('')}</div>
    ${ws.length <= 2 && !start ? `<div class="rule">start another</div>${startRow(true)}` : ''}
    ${start ? `<div class="start" data-appear><button class="verb" onclick="newWindow()">+ new workspace <kbd>n</kbd></button><button class="verb" onclick="joinWindow()">join with a code <kbd>j</kbd></button><button class="verb">import .zip</button><span class="hint">or drop a .zip anywhere</span></div>` : ''}`
}
// First visit, on E's skeleton: the continue piece's place holds a blank canvas and how it starts; under it, the same
// three ways in that later sit under your workspaces as "start another" (startRow).
function firstBody() {
  return `<article class="piece hero startHero" data-appear style="--band:var(--accent-magenta)"><span class="cut"><span class="num">01</span>start</span>
      <canvas class="blank"></canvas>
      <div class="side"><h2>Your first workspace</h2><p class="about">A workspace is one startup idea: its customers, problems, rivals and plan, on a canvas you share.</p>
        <div class="caps dim" style="margin-bottom:10px">how it starts</div>
        <div class="since steps"><span><span class="num">1</span>name it in the line above</span><span><span class="num">2</span>it opens on its own canvas</span><span><span class="num">3</span>the welcome shows you around, about a minute</span></div>
      </div>
    </article>
    ${startRow(false)}`
}
function startRow(small) {
  return `<div class="attention starts${small ? ' small' : ''}">
    <div class="piece att new" data-appear><span class="cut">new</span><span class="t">${small ? 'Another idea' : 'Start one'}</span><span class="s">Type its name in the line above and press ↵.</span></div>
    <div class="piece att inv" data-appear><span class="cut">join</span><span class="t">Join a teammate's</span><span class="s">Paste the code they gave you above. An owner lets you in.</span></div>
    <div class="piece att imp" data-appear><span class="cut">import</span><span class="t">Bring one in</span><span class="s">Drop a .zip exported from North Star anywhere on this page.</span><div class="acts"><button class="verb">choose file</button></div></div>
  </div>`
}
// An empty workspace's picture: what a canvas looks like, with nothing to read. A plane (its grid, card shapes), a
// deck's columns, a table's rows and a heading: shapes in the pieces' greys, only the bands in their colours.
function drawBlank(cv) {
  const dpr = devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight
  if (!W || !H) return
  cv.width = W * dpr; cv.height = H * dpr
  const g = cv.getContext('2d'); g.scale(dpr, dpr)
  g.fillStyle = css('--bg'); g.fillRect(0, 0, W, H)
  const u = Math.min(W / 100, H / 62) // the drawing on a 100 × 62 grid, centred
  const ox = (W - 100 * u) / 2, oy = (H - 62 * u) / 2
  const R = (x, y, w, h) => [ox + x * u, oy + y * u, w * u, h * u]
  const piece = (x, y, w, h, band) => {
    const [px, py, pw, ph] = R(x, y, w, h)
    g.fillStyle = css('--piece'); g.fillRect(px, py, pw, ph)
    g.strokeStyle = css('--piece-edge'); g.lineWidth = 1; g.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1)
    g.fillStyle = css(band); g.globalAlpha = 0.7; g.fillRect(px, py, pw, 2); g.globalAlpha = 1
    return [px, py, pw, ph]
  }
  const block = (x, y, w, h) => { const [a, b, c, d] = R(x, y, w, h); g.fillStyle = css('--piece-mark'); g.fillRect(a, b, c, d) }
  // a heading and its rule fading right
  block(6, 4, 22, 2.2)
  { const [a, b, c] = R(6, 8, 40, 0.3); const gr = g.createLinearGradient(a, 0, a + c, 0); gr.addColorStop(0, css('--piece-mark')); gr.addColorStop(1, 'transparent'); g.fillStyle = gr; g.fillRect(a, b, c, 1) }
  // a plane with its grid and card shapes
  const [px, py, pw, ph] = piece(6, 13, 50, 32, '--accent-magenta')
  g.fillStyle = css('--grid-mark'); g.globalAlpha = 0.6
  for (let gx = px + u * 1.5; gx < px + pw - 2; gx += u * 1.5) for (let gy = py + u * 2; gy < py + ph - 2; gy += u * 1.5) g.fillRect(gx, gy, 1, 1)
  g.globalAlpha = 1
  ;[[10, 18], [22, 18], [34, 18], [10, 26], [22, 26], [10, 34], [34, 30]].forEach(([x, y]) => block(x, y, 9, 4.5))
  // a deck: three columns of sheets
  piece(61, 13, 33, 20, '--accent-cyan')
  ;[0, 1, 2].forEach((c) => { block(63 + c * 10.3, 16, 9, 0.3); [0, 1, 2].slice(0, 3 - c).forEach((t) => block(63 + c * 10.3, 18 + t * 4, 9, 3)) })
  // a table: rows
  piece(61, 37, 33, 16, '--accent-yellow')
  for (let k = 0; k < 4; k++) { block(63, 40 + k * 3.2, 7, 1.4); block(72, 40 + k * 3.2, 19, 1.4) }
}
function wireD(root) {
  root.querySelectorAll('[data-ws]').forEach((el) => {
    if (el.tagName === 'CANVAS') return
    const w = list().find((x) => x.id === el.dataset.ws)
    el.addEventListener('click', (e) => { if (e.target.closest('[data-menu]')) { const r = e.target.getBoundingClientRect(); menuAt(r.left - 200, r.bottom + 6, w); return } toast(`→ ${w.name}'s canvas`) })
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); menuAt(e.clientX, e.clientY, w) })
  })
}

// ── Notes per option (Turkish, for the user) ─────────────────────────────────────────────────────────────────────
const NOTES = {
  A: `<h2>A · Parçalar</h2><p>Workspace'ler canvas'taki parçalar gibi: grafit yüzey, üstte 2 px bant, isim kenara kesilmiş. İçinde canvas'ın küçük resmi var.</p>
    <h3><b>01</b> ne değişti</h3><ul><li>Kartlar kalkmıyor; hover'da Marks L'leri geliyor, tıklayınca seçiliyor (cyan L'ler).</li><li><kbd>rename / leave / delete</kbd> her kartta durmuyor: <kbd>⋯</kbd> ya da sağ tık prompt'u.</li><li>Yeni / katıl / import üstte tek satır; yeni workspace bir Window'da, “ne yapıyorsun?” sorusuyla (açıklama zaten veride var, D-082).</li><li>Davet üstte cyan bantlı bir parça: görmezden gelinemez.</li><li>Sıra: en son açtığın önce (şimdi: oluşturma tarihi).</li></ul>
    <h3><b>02</b> artısı / eksisi</h3><p>Uygulamanın içiyle aynı dil, tanıması kolay. Ama 12+ workspace'te ekran çok kayar; "ne oldu" bilgisi az.</p>
    <h3><b>03</b> ne gerekiyor</h3><span class="pill free">son açılış: tarayıcıda</span><span class="pill free">presence: RTDB, var</span><span class="pill cost">resim: ya canvas'ı okumak ya da çıkarken kaydetmek</span>
    <p class="try">Dene: bir karta sağ tıkla, ⋯'ye bas, “+ new”.</p>`,
  B: `<h2>B · Defter + tek prompt</h2><p>Tek bir prompt satırı her şeyi yapıyor: yazınca workspace'leri süzüyor, eşleşme yoksa ↵ yenisini açıyor, bir davet kodu yapıştırınca “katılma isteği” oluyor. .zip'i sayfaya bırakmak import.</p>
    <h3><b>01</b> ne değişti</h3><ul><li>Liste deck'teki defter gibi: numaralı satırlar, altında “sen yokken ne oldu”.</li><li>Sağda 400 px panel (D-219): resim, son değişiklikler, kimler var, kim katılmak istiyor.</li><li>↑↓ ve ↵ ile klavyeden hiç fare kullanmadan.</li><li>Davet ve isteklerin “waiting” satırları listenin üstünde.</li></ul>
    <h3><b>02</b> artısı / eksisi</h3><p>En hızlısı, 50 workspace'te de çalışır, uygulamanın prompt diliyle aynı (D-222). Daha az “görsel”; resim sadece panelde.</p>
    <h3><b>03</b> ne gerekiyor</h3><span class="pill free">changes/ kaydı var (agent için)</span><span class="pill free">presence: RTDB</span><span class="pill cost">son açılışı members/{uid}'e yazmak (rules)</span>
    <p class="try">Dene: “pa” yaz, “Robots” yaz ↵, ya da <kbd>ABCD-EFGH</kbd> yapıştır.</p>`,
  C: `<h2>C · Gökyüzü (cesur)</h2><p>Adı North Star olan bir uygulama: her workspace backdrop'ta bir yıldız. Parlaklık = ne kadar canlı, cyan = şu an biri orada. Ortak kişisi olan workspace'ler kesik çizgiyle takımyıldızı oluyor.</p>
    <h3><b>01</b> ne değişti</h3><ul><li>Soldaki liste aynı zamanda lejant (erişilebilirlik ve 10+ workspace için şart).</li><li>Hover'da parça kartı resimle açılıyor; tıklayınca o yıldıza “uçup” canvas'a giriyor (giriş animasyonu ile aynı hücre dili).</li><li>Araçlar alttaki dock'ta (focus dock gibi).</li></ul>
    <h3><b>02</b> artısı / eksisi</h3><p>Çok akılda kalır, landing'in yıldız gecesiyle (D-072) bağlanır. Ama bulmak listeye göre yavaş; yerleri sabit ama anlamsız. Bence tek başına değil, B veya D'nin “arka planı” olarak düşünülebilir.</p>
    <h3><b>03</b> ne gerekiyor</h3><span class="pill free">veri: A ile aynı</span><span class="pill cost">yıldız animasyonu: backdrop'a eklemek</span>`,
  D: `<h2>D · Devam et (önerim)</h2><p>Sayfanın asıl işi: kaldığın yere dönmek. En son açtığın workspace büyük; yanında “sen yokken ne oldu”. Altında sana düşen işler, sonra diğerleri.</p>
    <h3><b>01</b> ne değişti</h3><ul><li><b>Continue</b> parçası: resim + kim ne yaptı + kim şu an orada + tek büyük buton.</li><li>Dikkat isteyenler ayrı ayrı: sana verilen görevler, katılmak isteyenler, davetler. Şimdi bunların hepsi ya gizli ya kartın içinde kayboluyor.</li><li>Diğerleri küçük parçalar; yeni / katıl / import en altta, çünkü en az kullanılan şey onlar.</li></ul>
    <h3><b>02</b> artısı / eksisi</h3><p>Her gün açan biri için en faydalısı. Sayfa “boş bir liste” değil, ekibin ne yaptığını gösteren bir başlangıç noktası oluyor. Eksisi: en çok veri isteyen bu.</p>
    <h3><b>03</b> ne gerekiyor</h3><span class="pill free">changes/ kaydı</span><span class="pill free">presence</span><span class="pill cost">görevler: workspace başına bir sorgu</span><span class="pill cost">son açılış: members/{uid}</span>
    <p class="try">Bence D'nin üstü + B'nin prompt'u (⌘K gibi, her an) en iyi karışım.</p>`,
}
const NAMES = { E: 'D + B + title', D: 'continue', B: 'ledger + prompt', A: 'pieces', C: 'sky' }

// ── E · D's page under the big title and B's prompt ─────────────────────────────────────────────────────────────
function renderE() {
  return `<section class="E${wide ? ' full' : ''}">
    <h1 data-appear>Workspaces<span class="num">${pad(list().length)}</span></h1>
    <div data-appear><div class="prompt"><span class="gt">&gt;</span><input id="bq" autocomplete="off" placeholder="${list().length ? 'find, start a new one, or paste an invite code…' : 'name your first workspace, or paste an invite code…'}" value="${esc(bQuery)}"></div>
    <div class="hint" id="bhint"></div></div>
    <div id="brows"></div></section>`
}
NOTES.E = `<h2>E · D + B + başlık</h2><p>D'nin sayfası, B'nin prompt'u ve bugünkü büyük <b>Workspaces</b> başlığı, sayısıyla (A'daki gibi).</p>
  <h3><b>01</b> nasıl çalışıyor</h3><ul><li>Başlık D'deki selamın yerini alıyor: sayfanın ne olduğunu söylüyor, sayı kaç tane olduğunu.</li><li>Prompt sayfanın ilk satırı. Boşken altında D: continue, sana düşenler, diğerleri. ↵ = kaldığın yere devam.</li><li>Yazınca D hücre hücre gidiyor, yerine B'nin defter satırları geliyor; silince D geri geliyor.</li><li>Yeni / katıl / import satırı yok: bir isim yazıp ↵ yeni açıyor, kod yapıştırmak katılma isteği gönderiyor, .zip bırakmak import ediyor.</li></ul>
  <h3><b>02</b> dikkat</h3><p>Başlık ~150 px yer kaplıyor, Continue biraz aşağı iniyor. 1000 px yükseklikte Continue yine tam görünüyor.</p>
  <h3><b>03</b> ne gerekiyor</h3><span class="pill free">D ile aynı</span>
  <p class="try">Dene: ↵, “pa”, “Robots” ↵, <kbd>ABCD-EFGH</kbd>, sonra hepsini sil.</p>`

// ── Mount ────────────────────────────────────────────────────────────────────────────────────────────────────────
function mount() {
  const stage = document.getElementById('stage')
  closeAll()
  if (state === 'first' && option !== 'C' && option !== 'E') stage.innerHTML = renderFirst()
  else stage.innerHTML = { A: renderA, B: renderB, C: state === 'first' ? renderFirst : renderC, D: renderD, E: renderE }[option]()
  if (state !== 'first' || option === 'E') ({ A: wireA, B: wireB, C: wireC, D: wireD, E: wireB })[option](stage.firstElementChild)
  pictures()
  reveal(stage)
  document.getElementById('notes').innerHTML = NOTES[option] + (state === 'first' && option === 'E' ? `<h3><b>·</b> ilk ziyaret</h3><p>E'nin iskeletiyle: aynı başlık (00), aynı prompt, Continue'nun yerinde boş bir canvas ve nasıl başlandığı; altında üç yol. İlk workspace'ten sonra aynı üç yol “start another” olarak altta kalıyor, 3 workspace'ten sonra kayboluyor (prompt zaten yapıyor). Coach'un Choices'ı bu üç kutuya oturur.</p>` : state === 'first' ? `<h3><b>·</b> ilk ziyaret</h3><p>Hiç workspace yokken her seçenekte aynı: üç yol, en büyüğü “başla”. Coach'un üç seçimi (Choices) buraya oturur.</p>` : '')
  document.querySelectorAll('#tabs button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.opt === option)))
  history.replaceState(null, '', `#${option}${state !== 'normal' ? '-' + state : ''}`)
}
document.getElementById('tabs').innerHTML = ['E', 'D', 'B', 'A', 'C'].map((k, i) => `<button data-opt="${k}"><b>${k}</b>${NAMES[k]}</button>`).join('')
document.getElementById('tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { option = b.dataset.opt; mount() } })
document.querySelectorAll('[data-state]').forEach((b) => b.addEventListener('click', () => {
  state = b.dataset.state; document.querySelectorAll('[data-state]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); mount()
}))
document.querySelectorAll('[data-theme-set]').forEach((b) => b.addEventListener('click', () => {
  document.documentElement.dataset.theme = b.dataset.themeSet; document.querySelectorAll('[data-theme-set]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)))
  // tokens.css eases --bg and the greys for 250 ms: draw once they've arrived.
  setTimeout(mount, 300)
}))
const nb = document.getElementById('notesBtn')
nb.addEventListener('click', () => { const on = nb.getAttribute('aria-pressed') !== 'true'; nb.setAttribute('aria-pressed', String(on)); document.getElementById('notes').hidden = !on; document.body.classList.toggle('withNotes', on); mount() })
document.body.classList.add('withNotes')
addEventListener('keydown', (e) => {
  if (e.target.closest('input,textarea')) return
  const bq = document.getElementById('bq')
  if (bq && (e.key.length === 1 || e.key === 'Enter') && !e.metaKey && !e.ctrlKey && !document.querySelector('.scrim')) { bq.focus(); if (e.key === 'Enter') bq.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); return }
  if (e.key === 'n') { e.preventDefault(); newWindow() }
  if (e.key === 'j') { e.preventDefault(); joinWindow() }
})
// Drop a .zip anywhere: the import.
const dz = document.createElement('div'); dz.className = 'dropzone'; dz.innerHTML = '<div>drop to import as a new workspace</div>'; document.body.appendChild(dz)
addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('on') })
addEventListener('dragleave', (e) => { if (!e.relatedTarget) dz.classList.remove('on') })
addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('on'); toast('→ importing ' + (e.dataTransfer.files[0]?.name ?? 'file')) })
addEventListener('resize', () => { if (option === 'C') mount(); else pictures() })
{
  const [o, s] = location.hash.slice(1).replace('~full', '').split('-')
  if (NAMES[o]) option = o
  if (s) { state = s; document.querySelectorAll('[data-state]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.state === s))) }
  else option = NAMES[o] ? o : 'E'
}
document.fonts.ready.then(mount)
