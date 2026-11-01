// Round 3: how buttons look together, and the controls (checkbox, choice, select, tabs, dropdown, filter) on the same
// cell. A preview, not app code.
const G = [
  { id: 'g1', tab: 'seam', title: 'G1 · Seam (built now)', what: 'Each button keeps its own cell; the cells touch with a 1 px seam. What the app has now.', plus: ['Every button is its own visible target.', 'Nothing new: the cell is the only shape.'], minus: ['Five cells in a row still read as five things; the seams flicker a little.'] },
  { id: 'g2', tab: 'plate', title: 'G2 · Plate', what: 'The group is one plate (a faint shade with a hairline edge); the buttons on it are bare words until pointed at. A switch that\'s on and the go button keep their colour. Like a segmented control.', plus: ['Reads as one control: "these belong together".', 'Calm: one shade per group, not one per button.'], minus: ['2 px of padding round the plate: a little wider than G1.', 'A bare word on the plate is less obviously its own target until pointed at.'] },
  { id: 'g3', tab: 'one cell', title: 'G3 · One cell (my pick)', what: 'The whole group is a single cell; hairlines split it into parts, a hover lights one part. No gaps, no padding: the narrowest, and the calmest.', plus: ['Takes exactly the room of its words and the hairlines.', 'One shape on screen per group: a dock or a console reads as one bar.', 'Each part still lights as its own target on hover.'], minus: ['At rest you see where the parts split only by the hairlines.'] },
  { id: 'g4', tab: 'framed', title: 'G4 · Framed', what: 'A thin frame round the group, hairlines inside, no shade at rest; hover shades a part.', plus: ['Very light; matches the app\'s framed windows.'], minus: ['A frame inside a frame (a dock, a panel) adds lines; a lone button with no frame looks different from one in a group.'] },
  { id: 'g5', tab: 'sections', title: 'G5 · Sections', what: 'G1\'s seam inside a kind of action, and a wider cut between kinds: looking (filter, linked, view) · switches (setup) · leaving (unfocus).', plus: ['Groups inside a group: you see the dock\'s structure.'], minus: ['Someone has to decide the sections for each place.', 'A bit wider than G1.'] },
]
const F = [
  { id: 'f1', tab: 'all cells', title: 'F1 · All cells (my pick)', what: 'Every control is the cell. A checkbox\'s box is a small cell that fills cyan with a ✓; tabs are segments (cells, the current one lit like a pressed button); a choice is the same segments in magenta; Select and every dropdown trigger are one trigger cell (`FOR all ▾`), lit cyan while it narrows what you see; a filter is a strip of trigger cells.', plus: ['Truly one family: if it takes a click, it\'s a cell.', 'Tabs, Choice and Tabs-segments become one component (Segments); Select and Menu share one trigger.', 'Bigger targets everywhere (the old `[x]` was a 3-character glyph).'], minus: ['Setups (many tabs, checkboxes, choices) get busier: a lot of cells at once.'] },
  { id: 'f2', tab: 'ink chooses', title: 'F2 · Cells act, ink chooses', what: 'Only actions are cells. What sets a value is ink: a checkbox is a small outlined box that fills cyan, tabs are words with a magenta line under the current one (today\'s), a choice is words with the picked one lit, Select an underlined field. Each takes a faint cell only while pointed at.', plus: ['Quieter setups and panels; actions stand out because only they are cells.', 'Tabs keep their navigation look.'], minus: ['Two families instead of one: not what you asked for ("same design").'] },
  { id: 'f3', tab: 'toggle cells', title: 'F3 · Toggle cells', what: 'A checkbox stops being a box: the whole label is a cell you switch on (cyan, ✓ before the word). A filter\'s values are a strip of those toggles; tabs are segments as wide as their row; Select and dropdowns are trigger cells as in F1.', plus: ['The most compact: no separate box, no label beside it.', 'Filters become one strip of toggles you can read at once.'], minus: ['A checkbox with a long hint (a setup option) has nowhere to put the hint.', 'A row of toggles and a row of buttons look the same; only the ✓ and the colour tell them apart.'] },
]

const b = (label, v = '', o = {}) => `<button class="b" ${v ? `data-v="${v}"` : ''} ${o.on ? 'aria-pressed="true"' : ''}>${label}</button>`
const cut = '<i class="cut"></i>'
const grp = (...xs) => `<span class="grp">${xs.join('')}</span>`
const ck = (label, on, hint) => `<label class="ck" ${on ? 'data-on' : ''}><span class="box"></span><span class="lab">${label}${hint ? `<small>${hint}</small>` : ''}</span></label>`
const trig = (lbl, val, o = {}) => `<button class="trig ${o.sel ? 'sel' : ''}" ${o.active ? 'data-active' : ''}>${lbl ? `<span class="lbl">${lbl}</span>` : ''}<span class="val">${val}</span><span class="car">▾</span></button>`
const tabs = (items, cur) => `<span class="tabs2" role="tablist">${items.map(([n, t, c], i) => `<button class="tb" aria-selected="${i === cur}">${n ? `<b>${n}</b>` : ''}${t}${c ? `<i>${c}</i>` : ''}</button>`).join('')}</span>`
const scene = (n, name, where, body, o = {}) => `
  <section class="scene${o.wide ? ' wide' : ''}">
    <div class="sceneHead"><span class="caps"><b>${n}</b>${name}</span><span class="where">${where}</span></div>
    <div class="sceneBody ${o.canvas ? 'canvas' : ''}">${body}</div>
  </section>`

function page() {
  return `
  <p class="lede"><b>Groups</b> (top tabs G1–G5) change how buttons that stand together look. <b>Controls</b> (F1–F3) put the checkbox, choice, select, tabs, dropdown and filter on the same cell as the buttons. The two pick independently; every scene shows both. <b>duplicates</b> lists where each control is drawn more than once today.</p>
  <div class="grid">
  ${scene('G·1', 'Focus dock', 'filter · linked · view · setup (on) · unfocus', `<div style="height:70px;position:relative"><div style="position:absolute;left:50%;bottom:-22px;transform:translateX(-50%)"><div class="tab0">${grp(b('filter'), b('linked · 2'), trig('', 'view'), cut, b('setup', '', { on: 1 }), cut, b('unfocus', 'main'))}</div></div></div>`, { canvas: true })}
  ${scene('G·2', 'Console in edit mode', 'a plane\'s console: status, then its actions', `<div class="lineRow"><span class="status">EDIT 960 × 600</span>${grp(b('move to…'), b('also on…'), cut, b('delete', 'danger'), cut, b('done', 'primary'))}</div><div class="lineRow" style="margin-top:14px">${grp(b('focus'), b('edit'))}</div>`)}
  ${scene('G·3', 'Panel foot and top', 'a card\'s panel: full + ×; open plane, duplicate … delete', `<div class="lineRow">${grp(b('full'), b('×', 'icon'))}</div><div class="lineRow" style="margin-top:14px;justify-content:space-between">${grp(b('open plane'), b('duplicate'), b('comment'))}${b('delete', 'danger')}</div>`)}
  ${scene('G·4', 'Wizard foot, zoom, pager, column tools', 'small groups across the app', `<div class="lineRow">${grp(b('cancel'), b('next', 'main'), b('make the matrix', 'primary'))}</div><div class="lineRow" style="margin-top:14px">${grp(b('−', 'icon'), b('100%', 'icon'), b('+', 'icon'))}${grp(b('‹', 'icon'), '<span class="b" style="cursor:default">2 / 5</span>', b('›', 'icon'))}${grp(b('≤', 'icon'), b('‹', 'icon'), b('›', 'icon'), b('✓', 'icon', { on: 1 }), b('×', 'icon'))}</div>`)}

  ${scene('F·1', 'A setup', 'a table\'s setup: tabs, a choice, options, a select', `
    <div class="stack" style="gap:14px">
      ${tabs([['01', 'rows', '4'], ['02', 'columns', '6'], ['03', 'look', '']], 1)}
      <div class="lineRow"><span class="lbl2">PRIORITY</span>${grp(b('P1', 'choice', { on: 1 }), b('P2', 'choice'), b('P3', 'choice'))}</div>
      <div class="lineRow"><span class="lbl2">SORT BY</span>${trig('', 'impact × confidence', { sel: 1 })}</div>
      <div class="stack opts">${ck('how sure', true, 'each cell says documented, inferred or a guess')}${ck('totals', false, 'a sum at the end of each row')}${ck('show empty rows', true)}</div>
    </div>`)}
  ${scene('F·2', 'A filter strip', 'a focused plane\'s filters, LINKS open', `
    <div class="stack" style="gap:14px">
      <div class="lineRow">${grp(trig('SHOW', 'all'), trig('FOR', 'Office workers', { active: 1 }), trig('TAG', 'any'), trig('REGION', 'any'), trig('LINKS', '2 of 5', { active: 1 }))}${b('reset')}</div>
      <div class="lineRow"><span class="lbl2">LINKS</span><span class="stack opts" style="flex-direction:row;gap:14px">${ck('solves', true)}${ck('relates', false)}${ck('competes', false)}${ck('for', true)}${ck('rests on', false)}</span></div>
    </div>`)}
  ${scene('F·3', 'A menu with checked rows', 'the view menu: guides, snapping, comments', `
    <div class="menuList"><div class="prompt"><b>&gt;</b>view…</div>${ck('guides', true)}${ck('snapping', true)}${ck('comments', false)}</div>`)}
  ${scene('F·4', 'A task\'s checklist, a segmented switch', 'the task panel\'s checklist; the finder\'s here | everywhere', `
    <div class="stack" style="gap:10px">
      <div class="stack opts">${ck('Call three office managers', true)}${ck('Price the pilot', false)}${ck('Write the one-pager', false)}</div>
      <div class="lineRow" style="margin-top:8px">${tabs([['', 'here', ''], ['', 'this canvas', ''], ['', 'everywhere', '']], 0)}</div>
    </div>`)}
  </div>`
}

function dups() {
  const rows = [
    ['checkbox', '5', '<code>Checkbox</code> (kit, 1 use); Menu\'s checked rows draw their own <code>[x]</code>; the agent\'s change list its own <code>[×]</code> button; a card\'s tasks (<code>CardTasks</code>) and a task\'s checklist (<code>TaskPanel</code>) each their own <code>[x]</code>', 'one <code>Checkbox</code> with a <code>row</code> look for menus and lists'],
    ['one of several', '4', '<code>Choice</code> (cells now); <code>Tabs look="segments"</code> (cyan fill, the finder\'s here | everywhere); the documents list\'s table | shelf drawn by hand as buttons with <code>aria-checked</code>; the card panel\'s <code>Pills</code> row', 'one <code>Segments</code> (Choice and Tabs-segments merged), the documents switch and Pills on it'],
    ['tabs', '3', '<code>Tabs look="tabs"</code> (setups); <code>Steps</code> (a wizard\'s numbered tabs); the threads inbox\'s views drawn as a ButtonGroup', 'Tabs and Steps share one tab cell; the inbox views on Tabs'],
    ['dropdowns', '2', '<code>Select</code> (a field, <code>value ▾</code>, its own trigger) and <code>Menu</code>\'s triggers (cells now): two triggers for "pick from a list"', 'one trigger cell used by both; Select keeps its list'],
    ['filters', '—', 'FilterDock\'s and the deck\'s filters are Menu triggers with checked rows (the Menu <code>[x]</code> above)', 'follow the dropdown and checkbox'],
    ['person square', '3 → 1', 'PeopleHere, your square (Settings), the people settings: <b>done now</b>, one <code>Avatar</code>, 30 px in the HUD like a ToolButton, 24 px in rows like a Button', '—'],
  ]
  return `<div class="dups"><h2 style="font:500 26px/1.2 var(--font-display);color:var(--fg-strong);margin:0 0 8px">Drawn more than once</h2>
  <p style="color:var(--fg-muted);max-width:820px">Each control should have one component in the kit and be used everywhere. Today:</p>
  <table><tr><th>control</th><th>copies</th><th>where</th><th>after</th></tr>${rows.map((r) => `<tr><td>${r[0]}</td><td class="n">${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join('')}</table>
  <p style="color:var(--fg-dim);margin-top:16px">Whatever family you pick, the change merges these first, so each control is drawn in one place.</p></div>`
}

const notes = document.getElementById('notes')
const stage = document.getElementById('stage')
const gTabs = document.getElementById('gTabs')
const fTabs = document.getElementById('fTabs')
const dupBtn = document.getElementById('dupBtn')
const note = (o) => `<h3><b>${o.id.toUpperCase()}</b>${o.tab}</h3><p><b style="color:var(--fg-strong);font-weight:500">${o.title}.</b> ${o.what}</p><ul>${o.plus.map((x) => `<li class="plus"><span style="color:var(--fg-muted)">${x}</span></li>`).join('')}${o.minus.map((x) => `<li class="minus"><span style="color:var(--fg-muted)">${x}</span></li>`).join('')}</ul>`

function render() {
  const g = document.body.dataset.g, f = document.body.dataset.f, dup = dupBtn.getAttribute('aria-pressed') === 'true'
  gTabs.querySelectorAll('button').forEach((t) => t.setAttribute('aria-pressed', String(t.dataset.id === g)))
  fTabs.querySelectorAll('button').forEach((t) => t.setAttribute('aria-pressed', String(t.dataset.id === f)))
  stage.innerHTML = dup ? dups() : page()
  notes.innerHTML = `<h2>Groups and controls</h2><p>Both on the cell you picked (H). Point at things for hover.</p>${note(G.find((x) => x.id === g))}${note(F.find((x) => x.id === f))}
  <h3><b>·</b>what I'd do</h3><p>G3 (one cell) for groups: the narrowest and calmest, each part still lights on hover. F1 (all cells) for controls: it's the one family you asked for; then merge the duplicates so each control lives in one kit component.</p>`
  history.replaceState(null, '', `#${g}-${f}${dup ? '-dup' : ''}`)
}
gTabs.innerHTML = G.map((o) => `<button data-id="${o.id}"><b>${o.id.toUpperCase()}</b>${o.tab}</button>`).join('')
fTabs.innerHTML = F.map((o) => `<button data-id="${o.id}"><b>${o.id.toUpperCase()}</b>${o.tab}</button>`).join('')
gTabs.addEventListener('click', (e) => { const t = e.target.closest('button'); if (t) { document.body.dataset.g = t.dataset.id; dupBtn.setAttribute('aria-pressed', 'false'); render() } })
fTabs.addEventListener('click', (e) => { const t = e.target.closest('button'); if (t) { document.body.dataset.f = t.dataset.id; dupBtn.setAttribute('aria-pressed', 'false'); render() } })
dupBtn.addEventListener('click', () => { dupBtn.setAttribute('aria-pressed', String(dupBtn.getAttribute('aria-pressed') !== 'true')); render() })
document.querySelectorAll('[data-theme-set]').forEach((btn) => btn.addEventListener('click', () => {
  document.documentElement.dataset.theme = btn.dataset.themeSet
  document.querySelectorAll('[data-theme-set]').forEach((x) => x.setAttribute('aria-pressed', String(x === btn)))
}))
const [hg, hf, hd] = location.hash.slice(1).split('-')
if (G.some((x) => x.id === hg)) document.body.dataset.g = hg
if (F.some((x) => x.id === hf)) document.body.dataset.f = hf
if (hd === 'dup') dupBtn.setAttribute('aria-pressed', 'true')
render()
