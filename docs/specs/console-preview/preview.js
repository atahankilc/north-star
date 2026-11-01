// Consoles preview: every console and dock of the app (a piece's console, the focus dock, the panes' docks, the strips
// over them, the bars under what's selected) described once as data, the same scenes drawn by each option. The data
// is the one component's props (see "what I found"). A preview, not app code.

const OPTS = [
  { id: 'analysis', tab: 'what I found' },
  { id: 'now', tab: 'now' },
  { id: 'a', tab: 'tidy tab' },
  { id: 'b', tab: 'status line' },
  { id: 'c', tab: 'prompt' },
  { id: 'd', tab: 'rail' },
  { id: 'e', tab: 'notch' },
  { id: 'de', tab: 'rail in a notch', star: true },
]

const COMMENT = '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M1.5 2h9v6h-5l-2.5 2V8h-1.5z"/></svg>'

// ── One console's props ────────────────────────────────────────────────────────────────────────────────────────────
// at: where it hangs: 'piece' (a framed piece's bottom edge), 'open' (under an unframed one), 'screen' (a focus's or
//     a pane's bottom edge), 'under' (what's selected: text, a link, a cell).
// name: what it's the console of, when that isn't already on screen (a pane's). mode: 'edit'. info: readouts.
// items: { t label, k role, on, tone, menu (opens a list), drawer (opens a strip), n count, top (C keeps it out) }.
// Roles, always in this order: state (what it is now) · view (how it's shown) · open (what opens from it) · edit ·
// danger · go (the way out or in, last).
const I = (t, k, more = {}) => ({ t, k, ...more })

const PLANE_CONSOLE = {
  at: 'piece', kind: 'plane',
  items: [I('⧉ 2', 'state', { title: 'on 2 canvases' }), I(`${COMMENT} 3 inside`, 'state', { fresh: true }), I('focus', 'go', { top: true }), I('edit', 'go', { top: true })],
}
const TABLE_CONSOLE = {
  at: 'piece', kind: 'table',
  info: ['2 / 5'],
  items: [I('‹', 'state', { icon: true }), I('›', 'state', { icon: true }), I('⇆ 01 Pazar', 'open', { menu: true }), I('setup', 'open', { top: true }), I('focus', 'go', { top: true }), I('edit', 'go', { top: true })],
  pager: true,
}
const DECK_OPEN_CONSOLE = {
  at: 'open', kind: 'kanban',
  items: [I('setup', 'open', { top: true }), I('focus', 'go', { top: true }), I('edit', 'go', { top: true })],
}
const PLANE_EDIT = {
  at: 'piece', kind: 'plane', mode: 'edit', info: [], was: '950 × 575',
  items: [I('move to…', 'edit', { menu: true }), I('also on…', 'edit', { menu: true }), I('delete', 'danger', { tone: 'danger' }), I('done', 'go', { tone: 'primary', top: true })],
}
const TABLE_EDIT = {
  at: 'piece', kind: 'table', mode: 'edit', info: [], was: '650 × 325',
  items: [I('unframe', 'edit'), I('move to…', 'edit', { menu: true }), I('delete', 'danger', { tone: 'danger' }), I('done', 'go', { tone: 'primary', top: true })],
}
const FOCUS_PLANE = (drawer) => ({
  at: 'screen', kind: 'plane', info: ['14 cards'],
  items: [
    I('filter', 'view', { drawer: 'filter', n: '2', on: drawer === 'filter', top: true }),
    I('view', 'view', { drawer: 'view', menu: true }),
    I('linked', 'open', { drawer: 'linked', n: '2', on: drawer === 'linked' }),
    I('unfocus', 'go', { tone: 'main', top: true }),
  ],
  drawer,
})
const FOCUS_DECK = {
  at: 'screen', kind: 'kanban', info: ['18 tasks'],
  items: [
    I('☐ 3 tasks from before', 'state', { tone: 'warn' }),
    I('filter', 'view', { drawer: 'deckfilter', top: true }),
    I('lanes', 'view', { menu: true, value: 'person' }),
    I('order', 'view'),
    I('⇆ timeline · Q3', 'open'),
    I('setup', 'open', { top: true }),
    I('unfocus', 'go', { tone: 'main', top: true }),
  ],
}
const BESIDE_LEFT = {
  at: 'screen', kind: 'plane', info: ['14 cards'],
  items: [I('filter', 'view', { drawer: 'filter', top: true }), I('view', 'view', { drawer: 'view', menu: true }), I('linked', 'open', { drawer: 'linked', n: '1' }), I('⇆ table · Costs', 'open', { on: true }), I('unfocus', 'go', { tone: 'main', top: true })],
}
const BESIDE_RIGHT = {
  at: 'screen', kind: 'table', name: 'table · Costs', info: ['2 / 5'],
  items: [I('‹', 'state', { icon: true }), I('›', 'state', { icon: true }), I('setup', 'open', { top: true }), I('close', 'go', { top: true })],
  pager: true,
}
const TEXT_BAR = {
  at: 'under', kind: 'text', info: [], name: 'heading',
  items: [I('H1', 'view', { group: 'size', top: true }), I('H2', 'view', { group: 'size', on: true, top: true }), I('H3', 'view', { group: 'size', top: true }),
    I('<b>B</b>', 'view', { group: 'style', icon: true }), I('<i>I</i>', 'view', { group: 'style', icon: true }), I('AA', 'view', { group: 'style', icon: true }),
    I('⟲', 'view', { group: 'turn', icon: true }), I('⟳', 'view', { group: 'turn', icon: true }),
    I('colour', 'view', { swatch: true }),
    I('type', 'edit', { top: true }), I('delete', 'danger', { tone: 'danger' })],
}
const LINK_BAR = {
  at: 'under', kind: 'link', name: 'link',
  items: [I('solves', 'view', { menu: true, top: true, tint: 'var(--link-solves)' }), I('label', 'edit', { top: true }), I('turn round', 'edit'), I('remove', 'danger', { tone: 'danger' })],
}
const CELL_BAR = {
  at: 'under', kind: 'cell', name: 'cell',
  items: [I('0', 'view', { group: 'steps', icon: true, top: true }), I('1', 'view', { group: 'steps', icon: true, top: true }), I('2', 'view', { group: 'steps', icon: true, top: true, on: true }), I('3', 'view', { group: 'steps', icon: true, top: true }), I('4', 'view', { group: 'steps', icon: true, top: true }),
    I('—', 'view', { icon: true, title: 'doesn’t apply' }), I('~ inferred', 'view', { menu: true }), I('note', 'edit')],
}
const PANE_DECK = {
  at: 'screen', kind: 'kanban', name: 'deck · Launch', narrow: true,
  items: [I('filter', 'view', { drawer: 'deckfilter', top: true }), I('lanes', 'view', { menu: true }), I('days ›', 'open', { top: true }), I('setup', 'open'), I('full', 'go', { top: true })],
}
const SMALL_TABLE = { ...TABLE_CONSOLE, narrow: true }

// ── What opens from a console: its drawers ──────────────────────────────────────────────────────────────────────────
const chip = (t, tone, off) => `<span class="chip${off ? ' off' : ''}" style="--t:${tone}">${t}</span>`
const DRAWERS = {
  filter: {
    title: 'filter', foot: 'reset',
    rows: [
      ['show', chip('customer', 'var(--type-customer)') + chip('problem', 'var(--type-problem)') + chip('competitor', 'var(--type-competitor)', true) + chip('idea', 'var(--type-idea)') + chip('feature', 'var(--type-feature)', true)],
      ['for', '<span class="pick">every customer <span class="caret">▾</span></span>'],
      ['tag', '<span class="pick">#pricing <span class="caret">▾</span></span>'],
      ['links', chip('solves', 'var(--link-solves)') + chip('competes', 'var(--link-competes)', true) + chip('for', 'var(--link-for)', true)],
    ],
    summary: '2 types hidden · #pricing',
  },
  deckfilter: {
    title: 'filter', foot: 'reset',
    rows: [['given to', '<span class="pick">anyone <span class="caret">▾</span></span>'], ['due', '<span class="pick">this week <span class="caret">▾</span></span>'], ['label', chip('#launch', 'var(--fg)')]],
    summary: 'due this week',
  },
  linked: {
    title: 'linked', rows: [['', '<span class="b">⇆ table · Costs</span> <span class="b">⇆ deck · Launch</span>']],
  },
  view: {
    title: 'view', rows: [['arrange', '<span class="b" data-on>✓ snap to the grid</span> <span class="b">alignment guides</span>'], ['show', '<span class="b" data-on>✓ comments</span>']],
  },
}

// ── The options: each draws a console from the same props ───────────────────────────────────────────────────────────
const esc = (s) => s
const groupsOf = (items) => {
  const out = []
  for (const it of items) {
    const key = it.group ?? it.k
    if (out.length && out[out.length - 1].key === key) out[out.length - 1].items.push(it)
    else out.push({ key, items: [it] })
  }
  return out
}
const btn = (it, extra = '') => {
  if (it.swatch) return `<span class="b" data-icon title="colour"><span class="sw" style="background:var(--accent-yellow)"></span></span><span class="b" data-icon><span class="sw" style="background:var(--accent-cyan)"></span></span><span class="b" data-icon><span class="sw" style="background:var(--fg)"></span></span>`
  return `<button class="b"${it.icon ? ' data-icon' : ''}${it.tone ? ` data-tone="${it.tone}"` : ''}${it.on ? ' data-on' : ''}${it.fresh ? ' data-fresh' : ''}${it.tint ? ` style="color:${it.tint}"` : ''}${extra}>${esc(it.t)}${it.n ? ` <span class="n">${it.n}</span>` : ''}${it.value ? ` <span class="v">${it.value}</span>` : ''}${it.menu ? ' <span class="caret">▾</span>' : ''}</button>`
}
const pagerItems = (spec) => (spec.pager ? spec.items.filter((x) => x.icon && x.k === 'state') : [])
const g = (items, cls = '') => `<span class="g ${cls}${items.length && items.every((x) => x.k === 'go') ? ' go' : ''}">${items.map((x) => btn(x)).join('')}</span>`
const drawerBody = (key, cls = '') => {
  const d = DRAWERS[key]
  return `<div class="drw ${cls}">${d.rows.map(([k, v]) => `<div class="drow">${k ? `<span class="dk">${k}</span>` : ''}<span class="dv">${v}</span></div>`).join('')}${d.foot ? `<div class="dfoot"><button class="b">${d.foot}</button></div>` : ''}</div>`
}
const kindWord = { plane: 'plane', table: 'table', kanban: 'deck', text: 'heading', link: 'link', cell: 'cell' }

// now: today's. One tab, every action one ButtonGroup; edit mode a cyan status first; strips over the dock apart.
function nowCon(spec) {
  if (spec.at === 'under') return `<div class="con" data-at="under">${groupsOf(spec.items).map((gr) => g(gr.items)).join('')}</div>`
  const items = spec.items.map((x) => (spec.pager && x.t === '‹' ? { ...x } : x))
  const pager = spec.pager ? `<span class="g">${btn(items[0])}<span class="ro">${spec.info[0]}</span>${btn(items[1])}</span>` : ''
  const rest = spec.pager ? items.slice(2) : items
  const head = spec.name ? `<span class="nm">${spec.name}</span><span class="sep">|</span>` : ''
  const mode = spec.mode ? `<span class="mode">EDIT</span><span class="ro">${spec.was}</span>` : ''
  const strip = spec.drawer ? `<div class="strip">${drawerBody(spec.drawer)}</div>` : ''
  return `<div class="con" data-at="${spec.at}"${spec.mode ? ' data-editing' : ''}${spec.drawer ? ' data-keep' : ''}>${strip}${head}${mode}${pager}${g(rest.map((x) => (x.drawer === 'view' ? { ...x, drawer: null } : x)))}</div>`
}

// A · tidy tab: today's tab, but one anatomy: who (name, mode, readouts) · groups by role with a gap · go last; a strip
// opens touching the tab, centred on it; past the room, `⋯` holds the least used.
function aCon(spec) {
  const who = [spec.name && `<span class="nm">${spec.name}</span>`, ...(spec.info ?? []).filter(() => !spec.pager).map((t) => `<span class="ro dim">${t}</span>`)].filter(Boolean).join('')
  let items = spec.items
  let more = ''
  if (spec.narrow && false) {
    const keep = items.filter((x) => x.top || x.k === 'go')
    if (keep.length < items.length) more = `<button class="b" data-icon title="more">⋯</button>`
    items = keep
  }
  const groups = groupsOf(items).map((gr) => {
    if (spec.pager && gr.key === 'state') return `<span class="g">${btn(gr.items[0])}<span class="ro">${spec.info[0]}</span>${btn(gr.items[1])}</span>`
    return g(gr.items)
  })
  if (more) groups.splice(groups.length - 1, 0, `<span class="g">${more}</span>`)
  const strip = spec.drawer ? `<div class="strip">${drawerBody(spec.drawer)}</div>` : ''
  if (spec.at === 'under') return `<div class="con" data-at="under">${groups.join('')}</div>`
  return `<div class="con" data-at="${spec.at}"${spec.mode ? ' data-editing' : ''}${spec.drawer ? ' data-keep' : ''}>${strip}${who ? `<span class="who">${who}</span>` : ''}${groups.join('')}</div>`
}

// B · status line: the whole bottom edge is the console, a terminal's status line: left what it is and what's true now
// (mode, size, page, what the filter hides), right what you can do. Opens upward as a full-width sheet.
function bCon(spec) {
  const kind = spec.name ?? kindWord[spec.kind]
  const left = spec.mode ? `<span class="modeBlock">EDIT</span><span class="ro dim">${kindWord[spec.kind]}</span>`
    : `<span class="kw">${kind}</span>${(spec.info ?? []).map((t) => `<span class="ro dim">${t}</span>`).join('')}${spec.drawer ? `<span class="ro sum">${DRAWERS[spec.drawer].summary ?? ''}</span>` : (spec.at === 'screen' && spec.kind === 'plane' && !spec.name ? '<span class="ro sum">2 types hidden</span>' : '')}`
  const items = spec.pager ? spec.items.filter((x) => !(x.icon && x.k === 'state')) : spec.items
  const pager = spec.pager ? `<span class="g">${btn(spec.items[0])}${btn(spec.items[1])}</span>` : ''
  const right = pager + groupsOf(items).map((gr) => g(gr.items)).join('') 
  const sheet = spec.drawer ? `<div class="sheet">${drawerBody(spec.drawer)}</div>` : ''
  return `<div class="con" data-at="${spec.at}"${spec.mode ? ' data-editing' : ''}${spec.drawer ? ' data-keep' : ''}>${sheet}<span class="left">${left}</span><span class="sp"></span><span class="right">${right}</span></div>`
}

// C · prompt: the console is a `>` line, as every menu already is (D-222): what's used most stays as cells, the rest
// is typed or picked from the list it opens (its sections the roles); what's on (a filter) sits in the line as tags.
function cCon(spec) {
  const isPager = (x) => spec.pager && x.icon && x.k === 'state'
  const top = spec.items.filter((x) => x.top && !x.drawer)
  const hidden = spec.items.filter((x) => (!x.top || x.drawer) && !isPager(x))
  const tags = spec.drawer === 'filter' || (spec.at === 'screen' && spec.kind === 'plane' && !spec.name) ? '<span class="tag">−competitor ×</span><span class="tag">#pricing ×</span>' : ''
  const field = hidden.length ? `<span class="field"><span class="gt">&gt;</span>${tags}<span class="ph">${hidden.slice(0, 2).map((x) => x.t.replace(/<[^>]+>/g, '').replace(/^.*\d inside/, 'comments')).join(', ')}…</span></span>` : ''
  const list = spec.drawer ? promptList(spec) : ''
  if (spec.at === 'under') return `<div class="con" data-at="under">${groupsOf(top).map((gr) => g(gr.items)).join('')}${field}</div>`
  const mode = ''
  const pagerRo = spec.pager ? `<span class="g">${btn(spec.items[0])}<span class="ro">${spec.info[0]}</span>${btn(spec.items[1])}</span>` : ''
  return `<div class="con" data-at="${spec.at}"${spec.mode ? ' data-editing' : ''}${spec.drawer ? ' data-keep' : ''}>${list}${spec.name ? `<span class="nm">${spec.name}</span>` : ''}${mode}${pagerRo}${field}${g(top)}</div>`
}
function promptList(spec) {
  const rows = [
    ['# filter', ''], ['› show', 'customer · problem · idea'], ['  for', 'every customer'], ['  tag', '#pricing'], ['  links', 'solves'],
    ['# view', ''], ['  snap to the grid', '✓'], ['  alignment guides', ''], ['  comments', '✓'],
    ['# linked', ''], ['  ⇆ table · Costs', 'beside'], ['  ⇆ deck · Launch', 'side view'],
  ]
  return `<div class="plist"><div class="pin"><span class="gt">&gt;</span> fi<span class="cur"></span></div>${rows.map(([a, b]) => (a.startsWith('#') ? `<div class="psec">${a}</div>` : `<div class="prow${a.startsWith('›') ? ' at' : ''}"><span>${a.replace(/^ {2}/, '')}</span><span class="ph">${b}</span></div>`)).join('')}<div class="pfoot">12 · ↑↓</div></div>`
}

// D · rail: one frame, two floors. The rail: who (name, mode, readouts) · nouns · go. A noun (filter, view, linked) is a
// tab of the rail; picked, its drawer opens as the floor above, inside the same frame; one at a time. Menus become
// drawers too, so nothing floats loose.
function dCon(spec) {
  const who = [spec.name && `<span class="nm">${spec.name}</span>`, ...(spec.info ?? []).filter(() => !spec.pager || spec.at === 'x').map((t) => `<span class="ro${spec.mode ? '' : ' dim'}">${t}</span>`)].filter(Boolean).join('')
  let items = spec.items
  let more = ''
  if (spec.narrow && false) {
    const keep = items.filter((x) => x.top || x.k === 'go' || x.drawer)
    if (keep.length < items.length) more = `<button class="b" data-icon title="more">⋯</button>`
    items = keep
  }
  const nouns = items.filter((x) => x.drawer)
  const direct = items.filter((x) => !x.drawer && x.k !== 'go')
  const go = items.filter((x) => x.k === 'go')
  const tab = (x) => `<button class="b tabn"${x.on || spec.drawer === x.drawer ? ' data-open' : ''}>${x.t}${x.n ? ` <span class="n">${x.n}</span>` : ''} <span class="caret">${spec.drawer === x.drawer ? '▾' : '▴'}</span></button>`
  const pager = spec.pager ? `<span class="g">${btn(spec.items[0])}<span class="ro">${spec.info[0]}</span>${btn(spec.items[1])}</span>` : ''
  const directNoPager = direct.filter((x) => !(spec.pager && x.icon && x.k === 'state'))
  if (spec.at === 'under') return `<div class="con" data-at="under"><span class="who"><span class="kw">${spec.name}</span></span>${groupsOf(items.filter((x) => x.k !== 'danger')).map((gr) => g(gr.items)).join('')}${g(items.filter((x) => x.k === 'danger'))}</div>`
  const floor = spec.drawer ? `<div class="floor"><div class="ftitle">${DRAWERS[spec.drawer].title}${DRAWERS[spec.drawer].summary ? `<span>${DRAWERS[spec.drawer].summary}</span>` : ''}</div>${drawerBody(spec.drawer)}</div>` : ''
  const parts = [
    who && `<span class="who">${who}</span>`,
    pager,
    nouns.length && `<span class="g nouns">${nouns.map(tab).join('')}</span>`,
    directNoPager.length && groupsOf(directNoPager).map((gr) => g(gr.items)).join(''),
    more && `<span class="g">${more}</span>`,
    go.length && g(go, 'go'),
  ].filter(Boolean)
  return `<div class="con" data-at="${spec.at}"${spec.mode ? ' data-editing' : ''}${spec.drawer ? ' data-keep data-floor' : ''}>${floor}<div class="railrow">${parts.join('')}</div></div>`
}

// E · notch: the console is cut into the bottom edge as the name is cut into the top (D-276): half in, half out, so it
// never covers what the piece holds; the focus has the same edge, a line along the screen's foot; a selection's bar is
// cut into a line under it. Strips open above the notch.
function eCon(spec) {
  const pager = spec.pager ? `<span class="g">${btn(spec.items[0])}<span class="ro">${spec.info[0]}</span>${btn(spec.items[1])}</span>` : ''
  const items = spec.pager ? spec.items.slice(2) : spec.items
  const mode = ''
  const nm = spec.name ? `<span class="nm">${spec.name}</span>` : ''
  let list = items
  let more = ''
  if (spec.narrow && false) {
    list = items.filter((x) => x.top || x.k === 'go')
    if (list.length < items.length) more = '<span class="g"><button class="b" data-icon>⋯</button></span>'
  }
  const strip = spec.drawer ? `<div class="strip">${drawerBody(spec.drawer)}</div>` : ''
  const body = groupsOf(list).map((gr) => g(gr.items)).join('')
  return `<div class="con" data-at="${spec.at}"${spec.mode ? ' data-editing' : ''}${spec.drawer ? ' data-keep' : ''}>${strip}${nm}${mode}${pager}${body}${more}</div>`
}

const RENDER = { now: nowCon, a: aCon, b: bCon, c: cCon, d: dCon, e: eCon, de: dCon }

// ── Scenes ───────────────────────────────────────────────────────────────────────────────────────────────────────────
const cards = (list) => list.map(([x, y, t, tone, title, cls = '']) => `<div class="card ${cls}" style="left:${x}px;top:${y}px;--t:${tone}"><small>${t}</small>${title}</div>`).join('')
const C = { cu: 'var(--type-customer)', pr: 'var(--type-problem)', co: 'var(--type-competitor)', id: 'var(--type-idea)', fe: 'var(--type-feature)' }
const piece = ({ x, y, w, h, kind, n, name, inner = '', con = '', editing }) =>
  `<div class="piece" data-kind="${kind}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"${editing ? ' data-editing' : ''}><span class="pname"><em>${n}</em>${name} <span>· ${kindWord[kind]}</span></span><div class="inner ${kind === 'plane' ? 'dots' : ''}">${inner}</div>${editing ? handles(w, h) : ''}${con}</div>`
const handles = (w, h) => [[-4, -4], [w / 2 - 4, -4], [w - 4, -4], [-4, h / 2 - 4], [w - 4, h / 2 - 4], [-4, h - 4], [w / 2 - 4, h - 4], [w - 4, h - 4]].map(([x, y]) => `<i class="handle" style="left:${x}px;top:${y}px"></i>`).join('')
const tableRows = (n) => `<div class="trow head"><span>name</span><span>price</span><span>fit</span></div>` + ['Bolt', 'Kite', 'Mara', 'Nodo', 'Pila', 'Ruma', 'Sota'].slice(0, n).map((r, i) => `<div class="trow"><span>${r}</span><span>€${(i + 2) * 9}</span><span>${'■'.repeat(1 + (i % 4))}</span></div>`).join('')
const deckCols = (tall) => `<div class="cols">${[['01', 'todo', 4], ['02', 'doing', 2], ['03', 'done', 3]].map(([n, t, k]) => `<div class="col"><div class="colHead"><b>${n}</b>${t.toUpperCase()}<i></i>${k}</div>${Array.from({ length: tall ? k : Math.min(k, 2) }, (_, i) => `<div class="task" style="--t:${[C.fe, C.pr, C.cu, C.id][i % 4]}">${['Pricing page', 'Talk to 5 shops', 'Stripe test', 'Onboarding copy'][i % 4]}<small>ayşe · fri</small></div>`).join('')}</div>`).join('')}</div>`
const planeCards = (faded) => cards([
  [20, 18, 'customer', C.cu, 'Small shops'], [140, 18, 'problem', C.pr, 'No time for ads'], [260, 18, 'competitor', C.co, 'Bolt', faded ? 'faded' : ''],
  [20, 96, 'idea', C.id, 'One-tap promo'], [140, 96, 'feature', C.fe, 'Templates', faded ? 'faded' : ''], [260, 96, 'problem', C.pr, 'Hard to measure'],
])
const hudCorner = () => `<div class="corner"><span class="ppl"><i style="background:var(--accent-cyan)"></i><i style="background:var(--accent-yellow)"></i></span><span class="me"><span></span><span></span></span></div>`
const focusPlaneBody = (faded) => `<div class="crumb"># north-star / workspaces / Pazar / <b>01 Pazar</b></div><div class="sidenav"><span>+</span><span>⌖</span><span>▦</span></div>${hudCorner()}<div class="focusCards">${cards([
  [130, 70, 'customer', C.cu, 'Small shops', 'big'], [310, 70, 'problem', C.pr, 'No time for ads', 'big'], [490, 70, 'competitor', C.co, 'Bolt', `big ${faded ? 'faded' : ''}`],
  [130, 180, 'idea', C.id, 'One-tap promo', 'big'], [310, 180, 'feature', C.fe, 'Templates', `big ${faded ? 'faded' : ''}`], [490, 180, 'problem', C.pr, 'Hard to measure', 'big'],
])}</div>`

const SCENES = [
  {
    id: 'canvas', wide: true, title: 'canvas · three pieces pointed at', where: 'PlaneConsole (CanvasView.tsx:1984)', h: 'tall',
    draw: (R) => `<div class="screen tall dots">${piece({ x: 40, y: 40, w: 400, h: 230, kind: 'plane', n: '01', name: 'Pazar', inner: planeCards(), con: R(PLANE_CONSOLE) })}
      ${piece({ x: 500, y: 40, w: 380, h: 230, kind: 'table', n: '02', name: 'Costs', inner: tableRows(6), con: R(TABLE_CONSOLE) })}
      <div class="open" style="left:500px;top:300px;width:380px"><div class="oname"><em>03</em><i></i>Launch · deck</div>${deckCols(false)}${R(DECK_OPEN_CONSOLE)}</div>
      ${piece({ x: 40, y: 320, w: 400, h: 120, kind: 'plane', n: '04', name: 'Rivals', inner: cards([[20, 16, 'competitor', C.co, 'Kite'], [140, 16, 'competitor', C.co, 'Mara']]), con: R({ ...PLANE_CONSOLE, items: [I('focus', 'go', { top: true }), I('edit', 'go', { top: true })] }) })}</div>`,
  },
  {
    id: 'edit', title: 'canvas · edit mode', where: 'PlaneConsole in edit mode (no size, the user 2026-11-01)', h: 'short',
    draw: (R) => `<div class="screen short dots">${piece({ x: 30, y: 36, w: 420, h: 200, kind: 'plane', n: '01', name: 'Pazar', inner: planeCards(), con: R(PLANE_EDIT), editing: true })}</div>`,
  },
  {
    id: 'edit2', title: 'canvas · a table in edit mode', where: 'PlaneConsole with `open`', h: 'short',
    draw: (R) => `<div class="screen short dots">${piece({ x: 40, y: 36, w: 380, h: 200, kind: 'table', n: '02', name: 'Costs', inner: tableRows(5), con: R(TABLE_EDIT), editing: true })}</div>`,
  },
  {
    id: 'focus', wide: true, title: 'focus · a plane, its filter open', where: 'FocusDock + FilterDock (D-189, D-233)', h: 'tall',
    draw: (R) => `<div class="screen tall dots focusScreen">${focusPlaneBody(true)}<div class="threadsTab">threads 4</div>${R(FOCUS_PLANE('filter'))}</div>`,
  },
  {
    id: 'deck', wide: true, title: 'focus · a deck (the longest dock)', where: 'FocusDock with KanbanFilterDock, KanbanLanes, KanbanDockTools', h: '',
    draw: (R) => `<div class="screen focusScreen"><div class="crumb"># north-star / workspaces / Pazar / <b>03 Launch</b></div><div class="sidenav"><span>+</span><span>⌖</span><span>▦</span></div>${hudCorner()}<div class="threadsTab">threads 4</div><div style="position:absolute;left:120px;right:120px;top:60px">${deckCols(true)}</div>${R(FOCUS_DECK)}</div>`,
  },
  {
    id: 'beside', wide: true, title: 'focus · a table beside the plane', where: 'FocusDock + Beside.tsx (D-211): one dock per part', h: '',
    draw: (R) => `<div class="screen focusScreen"><div class="crumb"># north-star / workspaces / Pazar / <b>01 Pazar</b></div>${hudCorner()}<div class="threadsTab">threads 4</div>
      <div class="part" style="left:0;width:55%"><div class="focusCards" style="transform:scale(.8);transform-origin:0 0">${cards([[110, 90, 'customer', C.cu, 'Small shops', 'big'], [290, 90, 'competitor', C.co, 'Bolt', 'big'], [110, 200, 'idea', C.id, 'One-tap promo', 'big'], [290, 200, 'feature', C.fe, 'Templates', 'big']])}</div>${R(BESIDE_LEFT)}</div>
      <div class="split" style="left:55%"></div>
      <div class="part" style="left:55%;right:0"><div style="position:absolute;left:30px;right:30px;top:70px">${tableRows(7)}</div>${R(BESIDE_RIGHT)}</div></div>`,
  },
  {
    id: 'bars', wide: true, title: 'what’s selected: a heading, a link, a matrix cell', where: 'LabelBar (TextItems.tsx:907), PlaneLinks.tsx:260, Matrix.tsx:1010', h: 'short',
    draw: (R) => `<div class="screen short dots barsScreen">
      <div class="sel" style="left:30px;top:40px;width:250px"><div class="hd">Who we beat</div><div class="marks" style="inset:0"><i></i><i></i><i></i><i></i></div>${R(TEXT_BAR)}</div>
      <div class="sel" style="left:620px;top:40px;width:250px;height:60px">${cards([[0, 0, 'feature', C.fe, 'Templates'], [160, 0, 'problem', C.pr, 'No time for ads']])}<div class="link" style="left:92px;top:23px;width:68px"></div><div class="marks" style="left:108px;top:16px;width:36px;height:14px"><i></i><i></i><i></i><i></i></div>${R(LINK_BAR)}</div>
      <div class="sel" style="left:620px;top:190px;width:120px;height:46px"><div class="cellbox"><span></span><span></span><span class="o"></span><span class="o"></span><span class="o"></span></div><div class="marks" style="inset:0"><i></i><i></i><i></i><i></i></div>${R(CELL_BAR)}</div></div>`,
  },
  {
    id: 'narrow', wide: true, title: 'not enough room: the console takes the whole edge', where: 'a 325 px table; a deck in the side view (TasksSide.tsx)', h: '',
    draw: (R) => `<div class="screen focusScreen dots" style="background-color:var(--bg)">${piece({ x: 40, y: 60, w: 325, h: 200, kind: 'table', n: '02', name: 'Costs', inner: tableRows(5), con: R(SMALL_TABLE) })}
      <div class="part pane" style="left:auto;right:0;width:340px"><div style="position:absolute;left:18px;right:18px;top:50px">${deckCols(false)}</div>${R(PANE_DECK)}</div><div class="split" style="left:calc(100% - 340px)"></div></div>`,
  },
]

// ── Notes per option ─────────────────────────────────────────────────────────────────────────────────────────────────
const NOTES = {
  de: {
    title: 'D+E · Rail in a notch (my pick)',
    what: 'D\'s rail, placed as E says: on the canvas cut into the piece\'s bottom edge (half in, half out, a full frame), so it never covers what the piece holds; in focus and in panes the rail stands on the screen\'s foot as today\'s dock does (that edge is the screen\'s, nothing to cover). Drawers open as the rail\'s upper floor. The bars under what\'s selected are the same rail, named.',
    plus: [
      'Everything D fixes: one anatomy, short rails, one way to open, a filter\'s count when closed, edit mode the same rail in cyan.',
      'And E\'s: the piece\'s content stays readable under the console.',
      'Name top-left, console bottom-right: a piece\'s edge carries both.',
      'In focus nothing new: the dock you know, with an order and floors.',
    ],
    minus: ['The biggest refactor of the six (FilterDock, KanbanFilterDock, ViewMenu as drawers; the canvas console moves).', 'Pieces 25 px apart: a console half outside reaches the next piece\'s name (the hover shows only one at a time, so they never meet on screen).'],
  },
  now: {
    title: 'Now',
    what: 'Today\'s: a piece\'s console is a tab in its bottom-right corner, every action one ButtonGroup; the focus dock the same tab at the screen\'s bottom middle, filled by whatever the piece\'s kind adds; strips (filter, linked) float a little over it; the bars under what\'s selected are their own thing, groups with gaps.',
    plus: ['The cells (D-344) already make every button the same.', 'Hover-only on the canvas keeps the canvas quiet.'],
    minus: [
      'Five components draw the same idea: PlaneConsole, FocusDock, FilterDock\'s strip, KanbanFilterDock, LabelBar/LinkBar/CellBar.',
      'No order: the deck\'s dock is 7 cells in whatever order the code adds them; <code>unfocus</code> is the only fixed one.',
      'The same tool looks different in the console and the dock (a table\'s pages, <code>setup</code>).',
      'Edit mode turns the console into another thing (a status, other buttons).',
      'Over what the piece holds: the console covers its bottom-right content while pointed at.',
      'Nothing tells you a filter is on once its strip is closed.',
    ],
  },
  a: {
    title: 'A · Tidy tab',
    what: 'The smallest step: today\'s tab, one component, one anatomy. Left to right: who (a pane\'s name, readouts), then the groups by role, each its own ButtonGroup with a gap between: what it is now · how it\'s shown · what opens · go (last, always). A strip opens touching the tab, the same width or wider, sharing its edge. Past the room, <code>⋯</code> holds the least used, before go.',
    plus: ['Almost no relearning; the look you have, made consistent.', 'One order everywhere: your eye learns where <code>focus</code>/<code>unfocus</code> and <code>setup</code> are.', 'Cheap to build: a <code>Console</code> with <code>at</code>, <code>who</code>, <code>items</code>.'],
    minus: ['Doesn\'t fix covering the piece\'s content.', 'Menus (<code>view ▾</code>, <code>lanes ▾</code>) and strips still open two different ways.', 'A filter that\'s on is still not visible when closed.'],
  },
  b: {
    title: 'B · Status line',
    what: 'A terminal\'s status line (vim, tmux): the whole bottom edge is the console. Left: what it is and what\'s true now (<code>PLANE · 14 cards · 2 types hidden</code>, the page; in edit mode <code>EDIT</code>). Right: what you can do. On the canvas the line appears along the piece\'s bottom edge on hover; in focus it runs along the screen\'s foot from the HUD\'s corner to the right edge. A strip opens upward as a full-width sheet.',
    plus: ['Room for state, not just verbs: what a filter hides, how many cards, the page.', 'Very on brand: the app is a terminal.', 'Edit mode is just the mode word changing, like vim\'s <code>-- INSERT --</code>.', 'Width is never a problem: the line is as wide as the piece.'],
    minus: ['On the canvas it covers the piece\'s whole bottom row (more than today\'s corner).', 'In focus it meets the HUD\'s corner and the threads tab, and the right panel (D-211, D-219) cuts it.', 'Long and thin: your eye travels from the left info to the right actions.'],
  },
  c: {
    title: 'C · Prompt',
    what: 'The console is a <code>&gt;</code> line, as every menu already is (D-222). Only what\'s used most stays as cells (<code>focus</code>, <code>edit</code>, <code>unfocus</code>, a heading\'s sizes); the rest is typed or picked from the list it opens, sectioned by role (<code># filter</code>, <code># view</code>, <code># linked</code>). What\'s on (a filter) sits in the line as tags you can <code>×</code>.',
    plus: ['The narrowest: a deck\'s dock goes from 7 cells to 3.', 'One language with menus, the finder and the agent: type what you want.', 'Filters visible while on, as tags.', 'Scales to any number of tools without new buttons.'],
    minus: ['Hidden: a tool you don\'t know exists you won\'t type (onboarding has to carry it).', 'Two steps for things that are one click today (<code>setup</code>, a stuck piece).', 'Bad for direct handles (a cell\'s steps, a heading\'s B/I): those must stay cells anyway, so the bars are a mix.'],
  },
  d: {
    title: 'D · Rail',
    what: 'One frame, two floors. The rail: who (name, readouts) · nouns · direct tools · go. A noun (<code>filter 2</code>, <code>view</code>, <code>linked 2</code>) is a tab of the rail with <code>▴</code>; picked, its drawer opens as the floor above inside the same frame, one at a time, its summary in the floor\'s title. Menus that were lists of switches (<code>view ▾</code>) become drawers too, so nothing floats loose. The bars under what\'s selected are the same rail, its name first.',
    plus: [
      'Solves the long dock without hiding things: nouns hold their tools, the rail stays 4–5 cells.',
      'One way to open anything (a floor), not menus + strips + panels.',
      'A count on the noun says a filter is on (<code>filter 2</code>) when closed.',
      'Same anatomy at every size: a canvas console is a short rail, a dock a long one, a selection\'s bar a rail named after it.',
      'Edit mode is the same rail in cyan with its own tools (no size, no mode word: the cyan frame and handles say it); same place, same order.',
    ],
    minus: ['A real refactor: FilterDock, KanbanFilterDock, ViewMenu become drawers.', 'Drawers grow the console upward over the content; needs a max height and scroll.', 'Still over the piece on the canvas (as today), unless combined with E\'s notch.'],
  },
  e: {
    title: 'E · Notch',
    what: 'Placement first: the console is cut into the bottom edge the way the name is cut into the top (D-276): half in, half out, on the page\'s black. So it never covers what the piece holds, and a piece reads as name at the top-left, console at the bottom-right. In focus the screen gets the same edge, a line along its foot with the dock cut into it; a selection\'s bar is cut into a line under it. Can carry any of A–D\'s insides.',
    plus: ['Never covers content: the bottom row of a table or the last card stays readable while pointed at.', 'Strong symmetry with the name notch: the piece\'s edge carries both.', 'Combines: D\'s rail inside E\'s notch is my favourite pair.'],
    minus: ['Half outside: two pieces close together can touch consoles (25 px grid gap).', 'Unframed pieces have no edge to cut, so they hang under as today.', 'A line at the screen\'s foot in focus is new chrome.'],
  },
}

// ── The analysis page ───────────────────────────────────────────────────────────────────────────────────────────────
const ANALYSIS = `<div class="analysis">
<h2>Consoles: what there is today</h2>
<p>Every place where a strip of actions hangs off something. They grew one by one, each with its own code and its own rules.</p>
<div class="big"><div><b class="m">13</b><span>places that draw a console or dock</span></div><div><b>6</b><span>components drawing them</span></div><div><b>7</b><span>cells in a deck's dock, in no fixed order</span></div><div><b>3</b><span>ways things open from them (menu, strip, panel)</span></div></div>
<h3><b>01</b> inventory</h3>
<table class="looks"><tr><th>where</th><th>what draws it</th><th>what's on it</th></tr>
<tr><td>piece, pointed at</td><td>PlaneConsole</td><td><code>⧉ 2</code> · <code>3 inside</code> · <code>⇆ plane ▾</code> · pages · <code>setup</code> · <code>focus</code> · <code>edit</code></td></tr>
<tr><td>piece, edit mode</td><td>PlaneConsole (size set)</td><td><code>EDIT 950 × 575</code> (the size goes: not wanted) · <code>unframe</code> · <code>move to…</code> · <code>also on…</code> · <code>delete</code> · <code>done</code></td></tr>
<tr><td>piece, new comments</td><td>PlaneConsole (fresh)</td><td>a second, magenta tab</td></tr>
<tr><td>unframed piece</td><td>PlaneConsole + CSS</td><td>the same, hanging under the contents</td></tr>
<tr><td>focus</td><td>FocusDock + CanvasView</td><td>per kind: <code>setup</code>, pages, documents' tools, filter, lanes, order, <code>⇆ …</code>, <code>linked</code>, <code>view ▾</code>, <code>unfocus</code></td></tr>
<tr><td>over the dock</td><td>FilterDock, KanbanFilterDock</td><td>SHOW FOR TAG REGION LINKS · GIVEN TO DUE FOR LABEL · linked strip</td></tr>
<tr><td>beside a plane</td><td>Beside → FocusDock</td><td><code>TABLE · Costs |</code> + its tools + <code>close</code></td></tr>
<tr><td>decks and days</td><td>TasksSide → FocusDock ×3</td><td>deck, days, mine</td></tr>
<tr><td>a document</td><td>DocumentPiece → FocusDock</td><td>zoom, on this page…</td></tr>
<tr><td>documents, list hidden</td><td>DocReaders</td><td><code>unfocus</code> moves to a bar top left</td></tr>
<tr><td>setup on the canvas</td><td>CanvasSetup</td><td>a panel at the screen's bottom</td></tr>
<tr><td>text selected</td><td>LabelBar</td><td>sizes · B I AA · turn · colours · type · delete</td></tr>
<tr><td>link, cell selected</td><td>PlaneLinks, Matrix</td><td>kind · label · turn round · remove / steps · — · confidence · note</td></tr>
</table>
<h3><b>02</b> what goes wrong</h3>
<ul>
<li><b>No anatomy.</b> Nothing says what comes first. The deck's dock is in the order the code adds its parts; only <code>unfocus</code> is fixed (last).</li>
<li><b>The same tool, two looks.</b> A table's pages and <code>setup</code> sit in the console on the canvas and in the dock in focus, in other places and order.</li>
<li><b>Three ways to open.</b> <code>view ▾</code> and <code>lanes ▾</code> open a prompt menu, <code>filter</code> and <code>linked</code> open strips floating over the dock, <code>setup</code> opens a panel.</li>
<li><b>Edit mode is another console.</b> Other buttons, a status with the size (not wanted, the user 2026-11-01), cyan; the same place but not the same thing.</li>
<li><b>It covers the piece.</b> Shown inside the bottom-right corner, it hides the last row of a table or a card while you point at the piece.</li>
<li><b>State is invisible.</b> A filter that's on says nothing once its strip is closed; neither does a plane's card count or a page.</li>
<li><b>Narrow places.</b> A 325 px piece's table console runs past its left edge; a pane's dock scrolls sideways with no sign of it.</li>
</ul>
<h3><b>03</b> one component (any option)</h3>
<p>Whatever look you pick, the refactor is the same: one <code>Console</code> in <code>src/ui/patterns</code>, every place above built from it, its gallery page showing each <code>at</code>.</p>
<div class="api"><b>&lt;Console</b>
  at=<i>"piece" | "open" | "screen" | "under"</i>   <i>// where it hangs: the piece's edge, under unframed contents, a screen's foot, what's selected</i>
  name=<i>"table · Costs"</i>                    <i>// only where it isn't on screen already (a pane, a selection)</i>
  mode=<i>"edit"</i>  info=<i>{['14 cards']}</i>             <i>// who it is and what's true now</i>
  shown=<i>{pointed || editing || keys}</i>       <i>// the hover rule (D-264) lives here, once</i>
  scale=<i>{consoleScale(zoom)}</i>              <i>// on the canvas, grows to 1.4× as you zoom out</i>
  fresh=<i>{{ count: 3, mentioned }}</i>        <i>// the small magenta tab</i>
<b>&gt;</b>
  <b>&lt;Console.State&gt;</b>  pages, ⧉ 2, 3 inside          <i>// roles, always in this order</i>
  <b>&lt;Console.View&gt;</b>   filter, view, lanes, order
  <b>&lt;Console.Open&gt;</b>   ⇆ stuck pieces, setup, days ›
  <b>&lt;Console.Edit&gt;</b>   unframe, move to…, also on…
  <b>&lt;Console.Danger&gt;</b> delete
  <b>&lt;Console.Go&gt;</b>     focus · edit | unfocus | done | close
  <b>&lt;Console.Drawer</b> name=<i>"filter"</i> count=<i>{2}</i> summary=<i>"2 types hidden"</i><b>&gt;</b>…<b>&lt;/Console.Drawer&gt;</b>
<b>&lt;/Console&gt;</b></div>
<p>Rules that hold for every option: one order (state · view · open · edit · danger · go, go last); a tool looks and sits the same on the canvas and in focus; edit mode is the same console in cyan with its tools, no size and no mode word; past the room, the least used go into <code>⋯</code> before go, never off the edge; one way for things to open from it; nothing under it is unreadable.</p>
<h3><b>04</b> my recommendation</h3>
<p><b>D+E: the rail, in a notch on the canvas (its own tab).</b> D fixes the anatomy, the long dock, the three ways of opening, and shows a filter that's on, without hiding tools behind typing. E's notch fixes the one thing D leaves: covering the piece. B's idea of showing state is kept in D's <code>info</code> (14 cards, the page). C stays what it is today: the prompt for the long lists a drawer can't hold (move to…, link to a plane).</p>
<h3><b>05</b> not enough room</h3>
<p>Every option but today's follows one rule (the user, 2026-11-01): a console never shrinks or hides tools in <code>⋯</code> to fit. Once it's wider than 70 % of where it hangs (the piece, a pane), it takes that whole bottom edge, go at the right end; still too wide, it wraps onto a second row, upward. Scene 08.</p>
<h3><b>06</b> the pink L's</h3>
<p>Today a console, the focus dock and the strips over it carry magenta L's on their two top corners (the right panel has them too, D-219). <b>CORNERS</b> in the bar swaps them on every option:</p>
<ul>
<li><b>pink L</b>: today's. Magenta also means new comments, counts and danger, so on a console next to <code>3 inside</code> it says nothing of its own.</li>
<li><b>kind band</b> (my pick): a 2 px band in its piece's kind colour on top, as the piece has (D-263): a table's console sky, a deck's gold, a plane's white; cyan in edit mode. It says whose console it is, which matters when consoles of two pieces are near, and the focus dock says what's in focus. Unframed or full-width, the band stays.</li>
<li><b>cyan L</b>: the Marks' colour, "what you can do" (D-265). Ties consoles to selection, but cyan is also the pressed buttons and <code>done</code> in it.</li>
<li><b>marks</b>: four faint L's like a selection at rest, cyan while pointed at; no edge. Lightest, but a console without an edge floats.</li>
<li><b>lead</b>: a short magenta line on the top-left only, as a numbered thing starts (D-266). Quiet; one mark instead of two.</li>
<li><b>none</b>: the edge alone. The cleanest; the console then relies on its cells.</li>
</ul>
<p>If the corners change, the right panel's (D-219) should follow, so one surface language stays: I'd move it to the same band (cyan, or the kind of what it shows).</p>
<p>Tabs above each show the same eight scenes: three pieces on the canvas, edit mode (a plane, a table), a plane's focus with its filter open, a deck's focus (the longest dock), a table beside a plane, what's selected (a heading, a link, a cell), and no room (a small table, a deck in the side view). <b>CONSOLES · on hover</b> shows them as the canvas does.</p>
</div>`

// ── Drawing ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const stage = document.getElementById('stage')
const notes = document.getElementById('notes')
const tabs = document.getElementById('tabs')
let at = location.hash.slice(1) || 'analysis'

function draw() {
  tabs.innerHTML = OPTS.map((o, i) => `<button data-opt="${o.id}" aria-pressed="${o.id === at}">${i ? `<b>${o.id === 'now' ? '·' : o.id === 'de' ? 'D+E' : o.id.toUpperCase()}</b>` : ''}${o.tab}${o.star ? '<i>★</i>' : ''}</button>`).join('')
  document.body.dataset.o = at === 'de' ? 'd' : at
  document.body.dataset.notch = String(at === 'de')
  if (at === 'analysis') {
    stage.innerHTML = ANALYSIS
    notes.innerHTML = '<h2>How to read this</h2><p>Each tab redraws the same scenes with one option. The scenes are made-up data in the app\'s tokens and the kit\'s button cells (D-344); only the consoles change.</p><p>Switch theme and <b>CONSOLES</b> in the bar. Notes per option on the right.</p>'
    return
  }
  const R0 = RENDER[at]
  const R = (spec) => R0(spec).replace('<div class="con"', `<div class="con" data-kind="${spec.kind}"`)
  const n = NOTES[at]
  stage.innerHTML = `<p class="lede"><b>${n.title}.</b> ${n.what}</p><div class="grid">${SCENES.map((s, i) => `<section class="scene${s.wide ? ' wide' : ''}"><div class="sceneHead"><span class="caps"><b>${String(i + 1).padStart(2, '0')}</b>${s.title}</span><span class="where">${s.where}</span></div>${s.draw(R)}</section>`).join('')}</div>`
  if (at !== 'now') fill()
  notes.innerHTML = `<h2>${n.title}</h2><p>${n.what}</p>${n.plus.length ? `<h3>good</h3><ul>${n.plus.map((x) => `<li class="plus"><span style="color:var(--fg-muted)">${x}</span></li>`).join('')}</ul>` : ''}<h3>bad</h3><ul>${n.minus.map((x) => `<li class="minus"><span style="color:var(--fg-muted)">${x}</span></li>`).join('')}</ul>`
}

// The rule for every option but today's: a console never shrinks or hides its tools to fit. Wider than FILL of where it
// hangs (the piece, a pane), it takes that whole bottom edge; still too wide, it wraps onto another row (upward).
const FILL = 0.7
function fill() {
  for (const con of stage.querySelectorAll('.con[data-at="piece"], .con[data-at="screen"], .con[data-at="open"]')) {
    const host = con.closest('.piece, .part, .open') ?? con.closest('.screen')
    if (!host) continue
    con.removeAttribute('data-full')
    if (con.getBoundingClientRect().width > FILL * host.getBoundingClientRect().width) con.dataset.full = ''
  }
}
window.addEventListener('resize', () => at !== 'now' && at !== 'analysis' && fill())

tabs.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-opt]')
  if (!b) return
  at = b.dataset.opt
  location.hash = at
  draw()
  window.scrollTo(0, 0)
})
document.querySelectorAll('[data-theme-set]').forEach((b) => b.addEventListener('click', () => {
  document.documentElement.dataset.theme = b.dataset.themeSet
  document.querySelectorAll('[data-theme-set]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)))
}))
document.querySelectorAll('[data-show]').forEach((b) => b.addEventListener('click', () => {
  document.body.dataset.show = b.dataset.show
  document.querySelectorAll('[data-show]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)))
}))
document.getElementById('notesBtn').addEventListener('click', (e) => {
  const off = document.body.dataset.notes !== 'off'
  document.body.dataset.notes = off ? 'off' : 'on'
  notes.hidden = off
  e.currentTarget.setAttribute('aria-pressed', String(!off))
})
document.body.dataset.show = 'hover'
document.body.dataset.corner = 'marks'
document.querySelectorAll('[data-corner]').forEach((b) => b.addEventListener('click', () => {
  document.body.dataset.corner = b.dataset.corner
  document.querySelectorAll('[data-corner]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)))
}))
window.addEventListener('hashchange', () => { at = location.hash.slice(1) || 'analysis'; draw() })
draw()
