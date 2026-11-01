// Button options preview: the same real spots of the app drawn with each option's button. A preview, not app code.
const OPTS = [
  { id: 'analysis', tab: 'what I found' },
  { id: 'now', tab: 'now' },
  { id: 'a', tab: 'bare' },
  { id: 'b', tab: 'corners' },
  { id: 'c', tab: 'block' },
  { id: 'd', tab: 'strip' },
  { id: 'e', tab: 'caret' },
  { id: 'f', tab: 'sans' },
  { id: 'g', tab: 'two tiers' },
  { id: 'h', tab: 'cells', round: 2, star: true },
  { id: 'i', tab: 'keycaps' },
  { id: 'j', tab: 'framed' },
  { id: 'k', tab: 'dots' },
  { id: 'l', tab: 'cut' },
]

// The HUD's icons, as hudIcons.tsx draws them.
const SVG = (inner) => `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square">${inner}</svg>`
const ICON = {
  fit: SVG('<path d="M1.75 6V1.75H6M12 1.75h4.25V6M16.25 12v4.25H12M6 16.25H1.75V12"/><rect x="6.25" y="6.25" width="5.5" height="5.5" stroke-width="1"/>'),
  compass: SVG('<circle cx="9" cy="9" r="7.25"/><path d="M9 3.5 11 9H7z" fill="currentColor" stroke="none"/><path d="M7 9h4l-2 5.5z" stroke-width="1" stroke-linejoin="round"/>'),
  guide: SVG('<path d="M5.75 6.25a3.25 3.25 0 1 1 4.9 2.8c-.95.55-1.65 1.2-1.65 2.3v.9"/><rect x="8.25" y="14.25" width="1.5" height="1.5" fill="currentColor" stroke="none"/>'),
  deck: SVG('<path d="M1.75 1.75h3.5v8.5h-3.5zM7.25 1.75h3.5v6h-3.5zM12.75 1.75h3.5v10h-3.5z"/><path d="M1.75 15.25h14.5M5 13.5v3.5M13 13.5v3.5"/>'),
  threads: SVG('<path d="M1.75 2.75h14.5v10h-8.5l-4 3.5v-3.5h-2z" stroke-linecap="butt"/><rect x="4.5" y="7" width="2" height="2" fill="currentColor" stroke="none"/><rect x="8" y="7" width="2" height="2" fill="currentColor" stroke="none"/><rect x="11.5" y="7" width="2" height="2" fill="currentColor" stroke="none"/>'),
  gear: SVG('<circle cx="9" cy="9" r="4.75"/><circle cx="9" cy="9" r="1.75"/>' + [0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<path d="M9 1.5v2.75" stroke-width="2.25" stroke-linecap="butt" transform="rotate(${a} 9 9)"/>`).join('')),
  plus: SVG('<path d="M9 2.5v13M2.5 9h13" stroke-width="2"/>'),
}

const NOTES = {
  now: {
    title: 'Now',
    what: 'Today\'s Button: <code>[verb]</code> in mono 12 px, dim, faint brackets; the page\'s <code>[ label ]</code> in Inter 14 with the accent wiping in. The key after it (<code>esc</code>, <code>↵</code>) where it has one.',
    plus: [],
    minus: [
      'Two bracket characters plus padding on every button: about 15 px of the width is not the word.',
      'The click area is only 2 px above and below the text: small to hit, yet wide.',
      'The brackets are the same grey everywhere, so <code>[delete]</code>, <code>[done]</code> and <code>[filter]</code> look alike until you read them.',
      'The page\'s <code>[ label ]</code> is a different font, size and colour logic from the small one: two buttons that don\'t look related.',
    ],
  },
  a: {
    title: 'A · Bare',
    what: 'Only the word. Mono, lowercase, dim; on hover it brightens and a 1 px line draws under it from the left. The main one of a row is brighter and medium weight; the one that goes is cyan with a faint line under it always. The page\'s big one is Inter with a thick accent line that fills the button on hover.',
    plus: ['The narrowest: every pixel is the word.', 'Closest to the terminal look: text you can press.', 'A bigger click area than today (6 px around), without taking more room.'],
    minus: ['At rest you can\'t tell a button from a label until you point at it. Fine in docks and consoles (people learn them), weaker in a panel foot.', 'The one that goes is not much stronger than the rest.'],
  },
  b: {
    title: 'B · Corners',
    what: 'The brackets turn into the Marks\' L\'s (the selection language from the canvas, D-265): at rest two faint corners, top left and bottom right; on hover or when on, all four, a little shade, and a press shrinks it like the Marks do.',
    plus: ['Says "this is a button" at rest without the bracket characters taking text room.', 'Ties buttons to the selection marks: one language for "you can act on this".', 'Tone is in the corners: cyan for the one that goes, magenta for danger on hover.'],
    minus: ['Corners are thin; in light theme and on small screens they get quiet.', 'In a long dock, many little corners can look busy.'],
  },
  c: {
    title: 'C · Block',
    what: 'Each button is a cell of faint shade, square, with no brackets. Hover inverts it (light block, dark text) like a terminal\'s selection. On: cyan text on a cyan wash with a cyan line under it. The one that goes is a cyan block. The page\'s one is a white block that turns its accent on hover.',
    plus: ['The clearest: you see every target at once, and how big it is.', 'The inverted hover is very "terminal".', 'Short and tall the same everywhere: one height, one padding.'],
    minus: ['Heavier: a dock of five reads as five boxes.', 'Inverting on hover is a strong flash; in a row you move along, it blinks.'],
  },
  d: {
    title: 'D · Strip',
    what: 'A row of buttons becomes one framed strip with hairlines between them: a toolbar. Hover shades the segment, on is cyan on a cyan wash, the one that goes a cyan segment. A button alone gets its own thin frame.',
    plus: ['Docks and consoles read as one object, not loose words.', 'Very clear edges: big, even click areas, no gaps between them.', 'Fits the app\'s "window" and console look.'],
    minus: ['Frames in panels and the hazard confirm can feel like a form.', 'A strip needs its buttons together; the wizard\'s <code>back</code> … <code>next</code> split looks odd.'],
  },
  e: {
    title: 'E · Caret',
    what: 'Plain words like A, but on hover a cyan <code>›</code> slides in before the word, the same mark the prompt menus put on the row you\'re on (D-222). On shows a <code>•</code>, as Select marks the current one. The one that goes keeps its <code>›</code>. The page\'s one is a prompt line, <code>&gt; sign in</code>, with a blinking block on hover.',
    plus: ['Makes buttons and menus one family: pointing at either shows <code>›</code>.', 'Quiet at rest, clear on hover, no extra width at rest beyond a small left pad.', 'The landing\'s button as a prompt is very on brand.'],
    minus: ['Like A, buttons don\'t look like buttons at rest.', 'The left pad is uneven (more left than right) so rows don\'t look centred.'],
  },
  f: {
    title: 'F · Sans',
    what: 'What most apps do: Inter 13 medium, a thin frame, the one that goes filled white (black text). Here as the opposite pole, to see how far from today it would feel.',
    plus: ['Everyone knows it\'s a button.', 'Inter reads better than mono at 12 px.'],
    minus: ['Loses the terminal / ASCII voice the whole app is built on (D-004, D-266: system things speak mono).', 'Frames everywhere add a lot of lines to an already lined UI.'],
  },
  g: {
    title: 'G · Two tiers (round 1\'s pick)',
    what: 'A and C together, with one rule: <b>everything is a bare word, except the one action a surface is for, which is a solid cyan cell</b>. Never two solid ones on one surface. Danger is a bare word that turns magenta; in the hazard confirm, where deleting is the point, it is the solid one (magenta). On is cyan on a faint cyan wash with a line under it. Icons sit in a 24 px square that shades on hover. The page\'s one is a white block whose accent wipes in on hover (today\'s wipe kept).',
    plus: ['Short like A: no brackets, the word fills the button.', 'You see at once what the surface wants you to do next (make, next, done, sign in).', 'Few shapes to learn: word, solid, icon square. That\'s the whole kit.', 'One height and padding for all small buttons; the 50 or so per-place tweaks go away.'],
    minus: ['Someone has to pick the one action per surface (I list them below; most are obvious).', 'Docks have no solid one (unfocus is a way out, not the point), so a dock is just words: by design.'],
  },
  h: {
    title: 'H · Cells (my pick now)',
    what: 'Round 2: <b>every button is the same cell</b>, words, glyphs, the HUD\'s icons and the page\'s one. A faint shade at rest says "you can press this"; hover is one step brighter (C\'s flash gone); a press shrinks it a little. Only the fill and the ink change between kinds: go is a cyan cell, danger turns its cell magenta on hover, on is a cyan wash with a line under it, a picked choice the same in magenta. One height: 24 px small (a glyph\'s cell 24 × 24), 30 for HUD tools, 36 for the page\'s. The one go per surface from G stays.',
    plus: ['C\'s clarity: every target and its size seen at rest, icons too.', 'Calm: a dock of five reads as a row of quiet cells, not five flashing boxes.', 'Truly one family: you can tell what kind a button is only by its colour.', 'Bigger click areas everywhere: glyph buttons go from about 12 px to 24 px.'],
    minus: ['More shapes on screen than G: dense places (a table\'s row of × buttons) get a column of cells. Those can show their cell only on the row\'s hover, keeping the shape.', 'The HUD gets squares under its icons; a small change to a look you just settled (D-343).'],
  },
  i: {
    title: 'I · Keycaps',
    what: 'H\'s cell with a 2 px darker edge at the bottom, like a key. Pressing it sinks it 1 px and the edge thins; a switch that\'s on stays pressed in. The page\'s one is a big white key.',
    plus: ['The most physical: you feel the press. Fits the "3D" in 3D ASCII.', 'On reads as "held down", which is what a switch is.'],
    minus: ['A bit playful; in long rows the edges add a line under everything.', 'The edge is easy to lose in light theme.'],
  },
  j: {
    title: 'J · Framed cells',
    what: 'The same cell drawn as a thin frame with no fill; hover fills it. Go is filled cyan.',
    plus: ['Lighter than H where many sit together, still clearly buttons.', 'Matches the app\'s framed windows.'],
    minus: ['Frames everywhere add many lines to a UI already full of rules and edges.', 'Looks closest to a usual web form.'],
  },
  k: {
    title: 'K · Dot cells',
    what: 'The cell is filled with tiny dots, the planes\' grid in miniature, an ASCII texture; hover makes it a solid shade. On is cyan dots.',
    plus: ['The boldest and most on-brand: buttons made of the canvas\'s own marks.', 'Quieter than a solid shade at rest.'],
    minus: ['The dots shimmer at small sizes and on some screens (the same issue as Q-033).', 'Text on a texture reads a bit worse.'],
  },
  l: {
    title: 'L · Cut cells',
    what: 'H\'s cell with its top-left corner cut off, the same cut on every button: a terminal tab, a sci-fi console.',
    plus: ['A shape nobody else has: a button is recognisable as North Star\'s.', 'Same calm shade as H.'],
    minus: ['The cut is only 5 px; at 24 px tall it reads more as a detail than a shape.', 'A keyboard focus ring can\'t follow the cut, so focus is drawn inside.'],
  },
}

const PLAN = `
<h3><b>·</b>What changes in code (any option but F)</h3>
<ul>
<li><code>Button.tsx/.css</code>: new look; <code>keyHint</code> prop deleted; <code>tone</code> becomes <code>quiet | main | go | danger</code>.</li>
<li>About 50 classes in 25+ files that recolour, repad or resize a Button go: the kit decides, the caller only places it.</li>
<li><code>Choice</code> (<code>[P1] P2 P3</code>), <code>Checkbox</code>'s <code>[x]</code>?, SidePanel's hand-drawn <code>[×] esc</code>, the package band's <code>[−] 3</code>: on the same look.</li>
<li>Key hints: the 17 <code>keyHint</code>s and the text ones (<code>enter adds · esc</code>, the finder's and guide's foot, <code>⌘J</code>) go; keys stay in the <code>title</code> tooltip and onboarding teaches them (already asked by you, in state.md).</li>
<li>Docs: DESIGN.md §6 and D-093's <code>[verb]</code> rule replaced by a new decision.</li>
</ul>`

// ── Building blocks ──
const b = (label, v = '', o = {}) => {
  const attrs = [
    'class="b' + (o.cls ? ' ' + o.cls : '') + '"',
    v ? `data-v="${v}"` : '',
    o.on ? 'aria-pressed="true"' : '',
    o.dis ? 'disabled' : '',
    o.nowBr ? 'data-now-br' : '',
    o.acc ? `style="--acc: var(--accent-${o.acc})"` : '',
    o.id ? `data-m="${o.id}"` : '',
    o.plus ? 'data-plus' : '',
  ].filter(Boolean).join(' ')
  return `<button ${attrs}><span class="t">${label}</span>${o.badge ? `<span class="badge">${o.badge}</span>` : ''}</button>${o.key ? `<span class="key">${o.key}</span>` : ''}`
}
const grp = (...xs) => `<span class="grp">${xs.join('')}</span>`
const scene = (n, name, where, body, o = {}) => `
  <section class="scene${o.wide ? ' wide' : ''}">
    <div class="sceneHead"><span class="caps"><b>${typeof n === 'number' ? String(n).padStart(2, '0') : n}</b>${name}</span><span class="where">${where}</span><span class="w" data-w="${o.measure || ''}"></span></div>
    <div class="sceneBody ${o.canvas ? 'canvas' : ''}" ${o.pad === false ? 'style="padding:0"' : ''}>${body}</div>
  </section>`

function scenes() {
  return `
  <p class="lede">The same spots of the app with each option's button. Point at buttons to see hover; <b>show click area</b> (top right) outlines what each one really covers, the word shaded inside it. Every option drops the key hints. Switch to light theme to check both.</p>
  <div class="grid">
  ${scene(0, 'One family', 'every kind of button side by side: word, main, go, danger, on, glyph, choice, HUD tool, page', `
    <div style="display:flex; align-items:center; gap:14px; flex-wrap:wrap">
      ${b('filter')}${b('unfocus', 'main')}${b('make matrix', 'primary')}${b('delete', 'danger')}${b('setup', '', { on: true })}${b('×', 'icon')}${b('‹', 'icon')}${grp(b('P1', 'choice', { on: true }), b('P2', 'choice'))}${b(ICON.compass, 'tool')}${b(ICON.deck, 'tool', { on: true })}${b('sign in', 'solid')}
    </div>`, { wide: true })}

  ${scene('0b', 'HUD', 'the side nav at the left edge\'s middle; the bottom-left corner (today: ToolButton)', `
    <div style="display:flex; gap:60px; align-items:flex-end; min-height:260px">
      <div style="display:flex; flex-direction:column; gap:6px; align-self:center">
        ${b(ICON.plus, 'tool', { plus: true })}${b(ICON.fit, 'tool')}${b(ICON.compass, 'tool')}${b(ICON.deck, 'tool', { on: true })}${b(ICON.guide, 'tool')}
      </div>
      <div style="display:flex; flex-direction:column; gap:8px; align-items:flex-start">
        <div style="display:flex"><span class="sq" style="background:var(--accent-cyan)"></span><span class="sq" style="background:var(--accent-yellow); margin-left:-4px"></span></div>
        ${b(ICON.threads, 'tool', { badge: 2 })}
        <span style="width:30px; height:1px; background:var(--line-hover)"></span>
        <span class="sq" style="background:var(--accent-magenta)"></span>
        ${b(ICON.gear, 'tool')}
      </div>
      <div class="where" style="color:var(--fg-faint); font-size:12px; max-width:260px">On the canvas the backdrop moves behind these; a cell under the icon keeps it readable there.</div>
    </div>`, { canvas: true })}

  ${scene(1, 'Focus dock', 'the screen\'s bottom middle while a plane is in focus', `
    <div style="height:120px; position:relative">
      <div style="position:absolute; left:50%; bottom:-22px; transform:translateX(-50%)">
        <div class="tab up" data-measure="dock">${grp(b('filter'), b('linked · 2'), b('view ▾'), b('setup', '', { on: true }), b('unfocus', 'main', { key: 'esc', id: 'unfocus' }))}</div>
      </div>
    </div>`, { canvas: true, measure: 'dock' })}

  ${scene(2, 'Plane console', 'a tab on a piece\'s bottom-right corner; then in edit mode', `
    <div class="piece" style="height:96px; margin:8px 4px 34px">
      <div class="pname"><em>01</em>PAZAR <span>· PLANE</span></div>
      <div style="position:absolute; right:0; top:100%"><div class="tab" data-measure="console">${grp(b('focus'), b('edit'))}</div></div>
    </div>
    <div class="piece" style="height:96px; margin:24px 4px 34px; border-top-color:var(--accent-cyan)">
      <div class="pname"><em>01</em>PAZAR <span>· PLANE</span></div>
      <div style="position:absolute; right:0; top:100%"><div class="tab"><span class="status">EDIT 960 × 600</span>${grp(b('move to…'), b('also on…'), b('delete', 'danger'), b('done', 'primary'))}</div></div>
    </div>`, { canvas: true, measure: 'console' })}

  ${scene(3, 'Right panel', 'a card\'s panel: top, an inline add, a remove, the foot', `
    <div class="panel">
      <div class="panelTop"><span class="kind">IDEA</span><span class="sp"></span>${b('full')}${b('×', 'icon', { key: 'esc', nowBr: true })}</div>
      <div class="panelTitle">Pay per seat, not per project</div>
      <div class="sec"><b>03</b>LINKS</div>
      <div class="row"><span class="k">solves</span><span class="grow">Teams can't share one plan</span>${b('×', 'icon')}</div>
      <div class="row"><span class="k">relates</span><span class="grow">Onboarding flow</span>${b('×', 'icon')}</div>
      <div class="row">${b('+ add link')}</div>
      <div class="sec"><b>04</b>PRIORITY</div>
      <div class="row">${grp(b('P1', 'choice', { on: true }), b('P2', 'choice'), b('P3', 'choice'))}</div>
      <div class="foot">${b('open plane')}${b('duplicate')}<span class="sp"></span>${b('delete', 'danger')}</div>
    </div>`, { pad: true })}

  ${scene(4, 'Wizard foot', 'making a matrix: back on the left, then cancel, next, make', `
    <div class="win">
      <div class="winBody">03 CELLS · a scale of 5 steps, a note, how sure</div>
      <div class="winFoot" data-measure="wizard">${b('back')}<span class="sp"></span>${b('cancel')}${b('next', 'main')}${b('make matrix', 'primary')}</div>
    </div>
    <div class="win" style="margin-top:14px">
      <div class="winBody">01 START FROM · a step that can't go on yet</div>
      <div class="winFoot"><span class="sp"></span>${b('cancel')}${b('next', 'main', { dis: true })}${b('make matrix', 'primary', { dis: true })}</div>
    </div>`, { measure: 'wizard' })}

  ${scene(5, 'Hazard confirm', 'deleting a plane: cancel is focused', `
    <div class="hazard"><div class="hazBox">
      <div class="t">Delete 01 PAZAR?</div>
      <div class="s">Its 24 cards, 31 links and 6 notes go with it. ⌘Z brings it back.</div>
      <div class="acts">${b('cancel', 'main', { cls: 's-focus' })}${b('delete plane', 'danger')}</div>
    </div></div>`, { pad: false })}

  ${scene(6, 'Settings', 'rows with a page button (today\'s md)', `
    <div class="win"><div class="winBody">
      <div class="setRow"><div class="grow"><div class="nm">Atahan Kılıç</div><div class="hint">signed in with Google</div></div>${b('sign out', 'solid', { acc: 'cyan' })}</div>
      <div class="setRow"><div class="grow"><div class="nm">Invite code <span class="mono" style="color:var(--accent-yellow)">K7Q-2MX</span></div><div class="hint">anyone with it can ask to join</div></div>${b('new code')}${b('copy', 'solid', { acc: 'cyan' })}</div>
      <div class="setRow"><div class="grow"><div class="nm">Leave this workspace</div><div class="hint">you can be invited again</div></div>${b('leave', 'danger')}</div>
    </div></div>`)}

  ${scene(7, 'Landing', 'signing in (dev shows the test users too)', `
    <div class="landing">
      <div class="name">north star</div>
      <div class="acts">${b('sign in with google', 'solid')}</div>
      <div class="acts">${b('alice', 'solid', { acc: 'green' })}${b('bob', 'solid', { acc: 'green' })}</div>
    </div>`, { pad: false })}

  ${scene(8, 'Small tools on the world', 'a package band, a document\'s zoom, a deck column\'s tools', `
    <div style="display:flex; gap:28px; align-items:center; flex-wrap:wrap">
      <span class="band">${b('−', 'icon', { nowBr: true })} 3 · ONBOARDING</span>
      <span class="zoom">${b('−', 'icon', { nowBr: true })}${b('100%', 'icon')}${b('+', 'icon', { nowBr: true })}</span>
      <span class="zoom" style="font-family:var(--font-mono); color:var(--fg)"><span style="color:var(--accent-magenta); margin-right:8px">01</span>TODO&nbsp;&nbsp;${b('‹', 'icon')}${b('›', 'icon')}${b('✓', 'icon', { on: true })}${b('×', 'icon')}</span>
    </div>`)}

  ${scene(9, 'Every state', 'rest · hover · focus (keyboard) · disabled', states(), { wide: true })}
  </div>`
}

function states() {
  const rows = [
    ['quiet', 'most buttons', '', 'filter'],
    ['main', 'the strong one of a row', 'main', 'unfocus'],
    ['go', 'the one that goes', 'primary', 'make matrix'],
    ['danger', '', 'danger', 'delete'],
    ['on', 'a switch that\'s on', '', 'setup', { on: true }],
    ['icon', 'a glyph alone', 'icon', '×'],
    ['tool', 'a HUD icon', 'tool', ICON.compass],
    ['choice', 'P1 P2 P3, picked', 'choice', 'P1', { on: true }],
    ['page', 'the big one (md)', 'solid', 'sign in'],
  ]
  return `<table class="states"><tr><th></th><th>rest</th><th>hover</th><th>focus</th><th>disabled</th></tr>${rows
    .map(([n, s, v, l, o = {}]) => `<tr><td>${n}<small>${s}</small></td><td>${b(l, v, o)}</td><td>${b(l, v, { ...o, cls: 's-hover' })}</td><td>${b(l, v, { ...o, cls: 's-focus' })}</td><td>${b(l, v, { ...o, dis: true })}</td></tr>`)
    .join('')}</table>`
}

function analysis() {
  return `<div class="analysis">
  <h2>What's there now</h2>
  <p>You're right that there's one <code>Button</code> component, but it is one in name only. Changing it alone would leave most of the mess in place. What I counted:</p>
  <div class="big">
    <div><b>210</b><span>places use Button, in 44 files</span></div>
    <div><b class="m">116</b><span>of them pass their own class that changes its colour, padding, size or opacity (about 50 different classes)</span></div>
    <div><b>63</b><span>raw buttons outside the kit (marked kit-ok), most of them rows and cells that are fine, some drawn by hand</span></div>
    <div><b class="m">30+</b><span>places show keys: 17 <code>keyHint</code>s plus text like <code>enter adds · esc</code></span></div>
  </div>

  <h3><b>01</b>The looks a person sees today</h3>
  <table class="looks">
    <tr><th>look</th><th>where</th><th class="n">uses</th></tr>
    <tr><td><code>[verb]</code> mono 12, dim</td><td>docks, consoles, panel feet, wizards, most places</td><td class="n">~150</td></tr>
    <tr><td><code>[ label ]</code> Inter 14, accent wipe</td><td>landing, settings (sign out, copy, invite), a workspace error</td><td class="n">6</td></tr>
    <tr><td>a glyph alone (<code>×</code> <code>+</code> <code>‹</code>)</td><td>removes, zoom, deck column tools; each place sets its own padding, colour, size</td><td class="n">40</td></tr>
    <tr><td>a link (no brackets)</td><td>names in a card's panel, the document outline</td><td class="n">9</td></tr>
    <tr><td>ToolButton (an icon in a 30 px square)</td><td>the HUD: side nav, threads, gear</td><td class="n">7</td></tr>
    <tr><td><code>[P1] P2 P3</code> (Choice)</td><td>priorities, small switches</td><td class="n">—</td></tr>
    <tr><td><code>[×] esc</code> drawn by hand</td><td>every right panel's top (SidePanel)</td><td class="n">1</td></tr>
    <tr><td><code>[−] 3</code> drawn by hand</td><td>a package's band on a plane</td><td class="n">1</td></tr>
    <tr><td>overrides that make new looks</td><td>hazard confirm (14 px, magenta fill), documents' <code>.act</code> (30 px square, shade), deck tools (16 px square), threads (no padding), table <code>+</code> (magenta on hover), agent head (muted)…</td><td class="n">~50</td></tr>
  </table>

  <h3><b>02</b>Why it feels wrong</h3>
  <ul>
    <li><b>The brackets eat the width.</b> In mono 12 px each bracket is 7.2 px; with today's 4 px padding, <code>[unfocus]</code> is 73 px and the word is 50 of it. A dock of five spends about 75 px on brackets alone. The <code>[×] esc</code> close is 7 characters for one glyph.</li>
    <li><b>Wide but thin.</b> Today's small button is 2 px above and below the text: about 16 px tall. Wide to look at, small to hit.</li>
    <li><b>Everything looks the same at rest</b>: the same faint brackets on <code>[delete]</code>, <code>[done]</code> and <code>[filter]</code>. What a surface wants you to do next doesn't stand out.</li>
    <li><b>Not consistent</b>, for two reasons: the small and big buttons are two different designs, and half the uses repaint the button locally, so it has a dozen looks.</li>
    <li><b>Key hints</b> add another word after the button (<code>unfocus esc</code>) and move around as Escape's target changes.</li>
  </ul>

  <h3><b>03</b>So the change is</h3>
  <ul>
    <li>A new <code>Button</code> (the look you pick), with one height and padding for every small one.</li>
    <li>The ~50 local overrides removed, so the kit really decides (positions stay, looks go).</li>
    <li><code>Choice</code>, the panel's <code>[×] esc</code>, the package band's <code>[−]</code> and the glyph buttons on the same look.</li>
    <li>Every key hint out (<code>keyHint</code> prop deleted, the text hints too); keys stay in tooltips and onboarding teaches them. This matches what you already asked on 2026-11-01 ("onboardingde olması yeterli").</li>
    <li>ToolButton (the HUD icons) is fine and stays; the checkbox's <code>[x]</code> is a box, not a button: it can stay, or follow whatever the buttons become.</li>
  </ul>
  <p>Then look through the tabs above: <b>now</b> for today, round 1 (A–G), and round 2 (H–L): one family where every button, icons too, is the same cell.</p>
  </div>`
}

// ── Notes and measuring ──
function measureAll() {
  const stage = document.getElementById('stage')
  const keep = stage.dataset.opt
  const out = {}
  for (const o of OPTS.filter((o) => o.id !== 'analysis')) {
    stage.dataset.opt = o.id
    const w = (sel) => Math.round(stage.querySelector(sel)?.getBoundingClientRect().width || 0)
    const h = (sel) => Math.round(stage.querySelector(sel)?.getBoundingClientRect().height || 0)
    out[o.id] = { dock: w('[data-measure=dock] .grp'), unfocus: w('[data-m=unfocus]'), uh: h('[data-m=unfocus]'), console: w('[data-measure=console] .grp') }
  }
  stage.dataset.opt = keep
  return out
}

function notesFor(id, m) {
  if (id === 'analysis') return `<h2>How to read this</h2><p>The first tab is what I found in the code. The others draw the same spots of the app with each option.</p><p>Every option keeps the colours (cyan = what you can do, magenta = danger and numbers), mono for system bits, lowercase actions, and drops the brackets and key hints.</p>${PLAN}`
  const n = NOTES[id]
  const rows = Object.entries(m).map(([k, v]) => {
    const t = OPTS.find((o) => o.id === k).tab
    return `<tr ${k === id ? 'data-here' : ''}><td>${t}</td><td>${v.dock}</td><td>${v.unfocus} × ${v.uh}</td><td>${v.console}</td></tr>`
  })
  return `<h2>${n.title}</h2><p>${n.what}</p>
  ${n.plus.length ? `<h3><b>+</b>good</h3><ul>${n.plus.map((x) => `<li class="plus"><span style="color:var(--fg-muted)">${x}</span></li>`).join('')}</ul>` : ''}
  <h3><b>−</b>not so good</h3><ul>${n.minus.map((x) => `<li class="minus"><span style="color:var(--fg-muted)">${x}</span></li>`).join('')}</ul>
  <h3><b>px</b>measured here (width; the unfocus button w × h)</h3>
  <table class="measure"><tr><th>option</th><th>dock</th><th>unfocus</th><th>console</th></tr>${rows.join('')}</table>
  <p style="margin-top:8px; font-size:12px; color:var(--fg-faint)">Dock: filter · linked · view · setup · unfocus. Today's includes the <code>esc</code> after unfocus. A taller button is easier to hit; a narrower one leaves room.</p>
  ${id === 'g' ? `<h3><b>·</b>the one action per surface</h3><ul>
    <li>Wizard: <code>make …</code> on the last step, else <code>next</code>.</li>
    <li>Plane console in edit mode: <code>done</code>.</li>
    <li>Hazard confirm: the delete (magenta).</li>
    <li>Agent preview: <code>apply</code>. Placing a document: <code>place</code>. Packing: <code>package N</code>.</li>
    <li>Settings invite: <code>invite</code>. Landing: sign in (the page button).</li>
    <li>Docks, consoles at rest, panel feet: none; all words.</li></ul>` : ''}
  ${PLAN}`
}

// ── Wiring ──
let current = 'g'
const stage = document.getElementById('stage')
const notes = document.getElementById('notes')
const tabs = document.getElementById('tabs')
let measured = null

function show(id) {
  current = id
  history.replaceState(null, '', '#' + id)
  tabs.querySelectorAll('button').forEach((t) => t.setAttribute('aria-pressed', String(t.dataset.opt === id)))
  if (id === 'analysis') {
    stage.dataset.opt = 'now'
    stage.innerHTML = analysis()
  } else {
    if (!stage.querySelector('.grid')) stage.innerHTML = scenes()
    stage.dataset.opt = id
    if (!measured) measured = measureAll()
  }
  notes.innerHTML = notesFor(id, measured || {})
  if (id !== 'analysis') stage.querySelectorAll('[data-w=dock]').forEach((el) => (el.textContent = measured[id].dock + ' px wide'))
  if (id !== 'analysis') stage.querySelectorAll('[data-w=console]').forEach((el) => (el.textContent = measured[id].console + ' px wide'))
}

const letter = (id) => (id === 'analysis' ? '' : id === 'now' ? '·' : id.toUpperCase())
tabs.innerHTML = OPTS.map((o) => `${o.round ? '<span class="round">ROUND 2</span>' : ''}<button data-opt="${o.id}">${letter(o.id) ? `<b>${letter(o.id)}</b>` : ''}${o.tab}${o.star ? '<i>★</i>' : ''}</button>`).join('')
tabs.addEventListener('click', (e) => {
  const t = e.target.closest('button')
  if (t) show(t.dataset.opt)
})
document.querySelectorAll('[data-theme-set]').forEach((btn) =>
  btn.addEventListener('click', () => {
    document.documentElement.dataset.theme = btn.dataset.themeSet
    document.querySelectorAll('[data-theme-set]').forEach((x) => x.setAttribute('aria-pressed', String(x === btn)))
    measured = null
    show(current)
  }),
)
document.getElementById('hitBtn').addEventListener('click', (e) => {
  const on = document.body.dataset.hit !== 'on'
  document.body.dataset.hit = on ? 'on' : 'off'
  e.currentTarget.setAttribute('aria-pressed', String(on))
})
document.getElementById('notesBtn').addEventListener('click', (e) => {
  const off = !notes.hidden
  notes.hidden = off
  document.body.dataset.notes = off ? 'off' : 'on'
  e.currentTarget.setAttribute('aria-pressed', String(!off))
})
// Measure after the fonts are in, so widths are the real ones.
document.fonts.ready.then(() => {
  const want = location.hash.slice(1)
  show(OPTS.some((o) => o.id === want) ? want : 'analysis')
})
window.addEventListener('hashchange', () => {
  const want = location.hash.slice(1)
  if (want !== current && OPTS.some((o) => o.id === want)) show(want)
})
