// Lints the onboarding's lessons (D-315, docs/specs/onboarding.md §8.2): src/onboarding/lessons.ts, releases.ts and
// releases.sample.ts, loaded as they are (Node's type stripping).
// - ids unique and kebab-case, versions ≥ 1, roles and areas valid, every trigger/doneWhen an event of EVENTS;
// - every `after`/`unless` names a lesson, and `after` has no cycles;
// - titles ≤ 6 words, bodies ≤ 25 (with their extra line), ≤ 4 pages for any role and audience, at least one;
// - every `when` key is in PAYLOADS for its event, every `within` in WITHIN, every `{placeholder}` in PLACEHOLDERS,
//   every D-number in `since` a `### D-xxx` of memory-bank/decisions-log.md;
// - every piece kind (PIECE_SIZE, src/model/pieces.ts or src/data/pieces.ts) but NOT_IN_PLUS and every card type
//   (CARD_TYPES) has a kind-guide row; so has every row of the `+` menu (AddToCanvas in WorkspaceLayout.tsx), with the
//   menu's label and the menu it's in (`where`); and every guide row is still in the menu;
// - release items name lessons and scenes that exist;
// - never "board" or "kanban" in words shown (D-180, D-301);
// - every scene is in src/demo/scenes/, every anchor a `data-learn="…"` in src/, every event emitted by
//   src/onboarding/events.ts (`learn('…'`, `emit('…'` or its exported EMITS list). Those still to be built are listed in scripts/lessons-pending.json: the list only shrinks
//   (one built and still listed fails too). `--write-pending` rewrites it from what's missing now.
// Run: npm run check:lessons. Exits 1 with a list of problems.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../', import.meta.url)
const at = (p) => new URL(p, root)
const read = (p) => readFileSync(at(p), 'utf8')

const { LESSONS, EVENTS, ANCHORS, ROLES, AREAS, FORMATS, PAYLOADS, WITHIN, PLACEHOLDERS, PAGE_IFS } = await import(at('src/onboarding/lessons.ts'))
const { RELEASES } = await import(at('src/onboarding/releases.ts'))
const { SAMPLE_RELEASES } = await import(at('src/onboarding/releases.sample.ts'))

const MAX = { title: 6, body: 25, pages: 4 }
// Piece kinds made elsewhere than the `+` menu: a document comes out of a documents list or a dropped file (D-232).
const NOT_IN_PLUS = ['document']
const PENDING_FILE = 'scripts/lessons-pending.json'
const problems = []
const bad = (msg) => problems.push(`lessons: ${msg}`)

// Words as a person reads them: keys and glyphs count, separators (`·`, `→`, `—`) don't.
const words = (s) => s.split(/\s+/).filter((w) => w && !/^[·→—–\-|]+$/.test(w)).length
const FORBIDDEN = /\b(boards?|kanbans?)\b/i
const shown = (where, text) => {
  const m = text.match(FORBIDDEN)
  if (m) bad(`${where} says "${m[0]}" (on screen it's "plane" or "deck")`)
}
const isKebab = (s) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)
const fills = (where, text) => {
  for (const [, name] of text.matchAll(/\{(\w+)\}/g)) if (!PLACEHOLDERS.includes(name)) bad(`${where} fills in {${name}}, which isn't in PLACEHOLDERS (${PLACEHOLDERS.join(', ')})`)
  if (/[<>]\w+[<>]|<Name>/.test(text)) bad(`${where} has a <placeholder>: write {${PLACEHOLDERS.join('|')}}`)
}
const say = (where, text) => {
  shown(where, text)
  fills(where, text)
}
const decided = new Set(read('memory-bank/decisions-log.md').match(/^### D-\d{3}/gm).map((h) => h.slice(4)))
for (const e of EVENTS) if (!Array.isArray(PAYLOADS[e])) bad(`PAYLOADS has no entry for "${e}"`)
for (const e of Object.keys(PAYLOADS)) if (!EVENTS.includes(e)) bad(`PAYLOADS has "${e}", which isn't in EVENTS`)

const events = new Set(EVENTS)
const ids = new Set()
const byId = new Map()
for (const l of LESSONS) {
  if (ids.has(l.id)) bad(`${l.id} appears twice`)
  ids.add(l.id)
  byId.set(l.id, l)
}

// What's referenced, for the ratchet: scene / anchor → where.
const scenes = new Map()
const anchors = new Map()
const refer = (map, key, where) => {
  if (!map.has(key)) map.set(key, where)
}

const checkTriggers = (l, list, name) => {
  if (list === undefined) return
  if (!Array.isArray(list) || (name === 'trigger' && !list.length)) return bad(`${l.id} needs a ${name} (a list of events)`)
  for (const t of list) {
    if (!events.has(t.event)) bad(`${l.id} ${name} "${t.event}" isn't in EVENTS`)
    else for (const k of Object.keys(t.when ?? {})) if (!PAYLOADS[t.event]?.includes(k)) bad(`${l.id} ${name} "${t.event}" matches "${k}", which isn't in its PAYLOADS (${PAYLOADS[t.event]?.join(', ') || 'none'})`)
  }
}
const checkRoles = (where, roles, within) => {
  if (!Array.isArray(roles) || !roles.length) return bad(`${where} has no roles`)
  for (const r of roles) {
    if (!ROLES.includes(r)) bad(`${where} has a bad role "${r}" (${ROLES.join(', ')})`)
    else if (within && !within.includes(r)) bad(`${where} is for "${r}", which the lesson isn't for`)
  }
}

let guideRows = []
for (const l of LESSONS) {
  if (!isKebab(l.id)) bad(`${l.id} isn't kebab-case`)
  if (!Number.isInteger(l.v) || l.v < 1) bad(`${l.id} v is ${l.v} (an integer ≥ 1)`)
  if (!FORMATS.includes(l.format)) bad(`${l.id} has a bad format "${l.format}"`)
  if (!AREAS.includes(l.area)) bad(`${l.id} has a bad area "${l.area}"`)
  if (typeof l.since !== 'string' || !/^D-\d{3}(, D-\d{3})*$/.test(l.since)) bad(`${l.id} since "${l.since}" isn't D-xxx(, D-xxx)`)
  else for (const d of l.since.split(', ')) if (!decided.has(d)) bad(`${l.id} since ${d}, which isn't a ### ${d} in decisions-log.md`)
  if (l.within !== undefined && !WITHIN.includes(l.within)) bad(`${l.id} within "${l.within}" isn't in WITHIN (${WITHIN.join(', ')})`)
  checkRoles(l.id, l.roles)
  checkTriggers(l, l.trigger, 'trigger')
  checkTriggers(l, l.doneWhen, 'doneWhen')
  for (const a of l.after ?? []) if (!ids.has(a)) bad(`${l.id} comes after "${a}", which isn't a lesson`)
  for (const a of l.unless ?? []) if (!ids.has(a)) bad(`${l.id} is unless "${a}", which isn't a lesson`)
  if (l.anchor !== undefined) {
    if (!ANCHORS.includes(l.anchor)) bad(`${l.id} anchor "${l.anchor}" isn't in ANCHORS`)
    refer(anchors, l.anchor, l.id)
  }

  if (l.format === 'welcome' || l.format === 'lesson') {
    if (!Array.isArray(l.pages) || !l.pages.length) {
      bad(`${l.id} has no pages`)
      continue
    }
    l.pages.forEach((p, i) => {
      const where = `${l.id} page ${i + 1}`
      if (typeof p.title !== 'string' || !p.title.trim()) bad(`${where} has no title`)
      else {
        const n = words(p.title)
        if (n > MAX.title) bad(`${where} title is ${n} words (max ${MAX.title})`)
        say(`${where} title`, p.title)
      }
      if (typeof p.body !== 'string' || !p.body.trim()) bad(`${where} has no body`)
      else {
        const n = words(p.body)
        if (n > MAX.body) bad(`${where} body is ${n} words (max ${MAX.body})`)
        say(`${where} body`, p.body)
      }
      if (p.roles) checkRoles(where, p.roles, l.roles)
      if (p.audience !== undefined && !['new', 'invited'].includes(p.audience)) bad(`${where} has a bad audience "${p.audience}"`)
      if (p.if !== undefined && !PAGE_IFS.includes(p.if)) bad(`${where} has a bad if "${p.if}" (${PAGE_IFS.join(', ')})`)
      if (p.kinds !== undefined && (!Array.isArray(p.kinds) || !p.kinds.length)) bad(`${where} has empty kinds`)
      if (p.extra) {
        checkRoles(`${where} extra`, p.extra.roles, p.roles ?? l.roles)
        const n = words(p.body ?? '') + words(p.extra.line ?? '')
        if (n > MAX.body) bad(`${where} body with its extra line is ${n} words (max ${MAX.body})`)
        say(`${where} extra`, p.extra.line ?? '')
      }
      if (p.scene !== undefined) refer(scenes, p.scene, where)
    })
    // What each person would page through (a page behind an `if` counted as shown), for each kind of trigger.
    const kinds = [...new Set(l.pages.flatMap((p) => p.kinds ?? [])), null]
    for (const role of l.roles) {
      for (const audience of ['new', 'invited']) {
        for (const kind of kinds) {
          const n = l.pages.filter((p) => (!p.roles || p.roles.includes(role)) && (!p.audience || p.audience === audience) && (!p.kinds || p.kinds.includes(kind))).length
          const who = `${role} (${audience}${kind ? `, ${kind}` : ''})`
          if (n > MAX.pages) bad(`${l.id} has ${n} pages for ${who} (max ${MAX.pages})`)
          if (!n) bad(`${l.id} has no page for ${who}`)
        }
      }
    }
  } else if (l.format === 'guide') {
    const keys = new Set()
    for (const r of l.rows ?? []) {
      const where = `${l.id} row "${r.key}"`
      if (keys.has(r.key)) bad(`${where} appears twice`)
      keys.add(r.key)
      if (!Number.isInteger(r.v) || r.v < 1) bad(`${where} v is ${r.v} (an integer ≥ 1)`)
      if (!['canvas', 'plane', 'both'].includes(r.where)) bad(`${where} has a bad where "${r.where}"`)
      if (!Array.isArray(r.lines) || r.lines.length !== 2) bad(`${where} needs two lines`)
      else {
        const n = words(r.lines.join(' '))
        if (n > MAX.body) bad(`${where} lines are ${n} words (max ${MAX.body})`)
        r.lines.forEach((line, i) => say(`${where} line ${i + 1}`, line))
      }
      shown(`${where} label`, r.label ?? '')
      if (!r.scene) bad(`${where} has no scene`)
      else refer(scenes, r.scene, where)
    }
    guideRows = guideRows.concat(l.rows ?? [])
  } else {
    if (!l.line && !l.choices?.length) bad(`${l.id} has neither a line nor choices`)
    if (l.line !== undefined) {
      const n = words(l.line)
      if (n > MAX.body) bad(`${l.id} line is ${n} words (max ${MAX.body})`)
      say(`${l.id} line`, l.line)
    }
    for (const c of l.choices ?? []) {
      shown(`${l.id} choice "${c.label}"`, `${c.label} ${c.line}`)
      const n = words(`${c.label} ${c.line}`)
      if (n > MAX.body) bad(`${l.id} choice "${c.label}" is ${n} words (max ${MAX.body})`)
    }
  }
}
if (LESSONS.filter((l) => l.format === 'guide').length !== 1) bad('there must be exactly one kind guide')

// `after` has no cycles.
{
  const state = new Map()
  const visit = (id, trail) => {
    if (state.get(id) === 'done') return
    if (state.get(id) === 'open') {
      bad(`"after" goes round: ${[...trail.slice(trail.indexOf(id)), id].join(' → ')}`)
      return
    }
    state.set(id, 'open')
    for (const a of byId.get(id)?.after ?? []) if (byId.has(a)) visit(a, [...trail, id])
    state.set(id, 'done')
  }
  for (const id of ids) visit(id, [])
}

// Two lessons one event can trigger together (same event, `when` values overlapping or missing) for a shared role are
// ordered by `after` or `unless`, directly or through a chain (onboarding.md §5.4); nudges have their own budget.
{
  const vals = (v) => (Array.isArray(v) ? v : v !== null && typeof v === 'object' ? null : [v])
  const overlap = (a = {}, b = {}) =>
    Object.keys(a).every((k) => {
      if (!(k in b)) return true
      const [x, y] = [vals(a[k]), vals(b[k])]
      return !x || !y || x.some((e) => y.includes(e))
    })
  const reaches = (from, to, seen = new Set()) => {
    if (from === to) return true
    if (seen.has(from)) return false
    seen.add(from)
    const l = byId.get(from)
    return [...(l?.after ?? []), ...(l?.unless ?? [])].some((n) => reaches(n, to, seen))
  }
  const paired = LESSONS.filter((l) => l.format !== 'nudge')
  for (let i = 0; i < paired.length; i++) {
    for (let j = i + 1; j < paired.length; j++) {
      const [a, b] = [paired[i], paired[j]]
      if (!a.roles.some((r) => b.roles.includes(r))) continue
      const both = a.trigger.filter((t) => b.trigger.some((u) => t.event === u.event && overlap(t.when, u.when))).map((t) => t.event)
      if (both.length && !reaches(a.id, b.id) && !reaches(b.id, a.id))
        bad(`${a.id} and ${b.id} can both show on "${[...new Set(both)].join('", "')}": order them with after (the general one first) or unless`)
    }
  }
}

// The `+` menu, the piece kinds and the card types against the kind guide.
{
  // Whichever file defines it: src/model/ (Firebase-free, D-312's S3) or, before that, src/data/.
  const defining = (symbol, files) => {
    for (const f of files) if (existsSync(at(f)) && new RegExp(`export const ${symbol}\\b`).test(read(f))) return [f, read(f)]
    bad(`can't find ${symbol} in ${files.join(' or ')}`)
    return [files[0], '']
  }
  const [piecesFile, piecesSrc] = defining('PIECE_SIZE', ['src/model/pieces.ts', 'src/data/pieces.ts'])
  const kinds = [...(piecesSrc.match(/PIECE_SIZE[^=]*=\s*\{([\s\S]*?)\n\}/)?.[1] ?? '').matchAll(/^\s*(\w+):/gm)].map((m) => m[1])
  if (piecesSrc && !kinds.length) bad(`can't read PIECE_SIZE in ${piecesFile}`)
  const [, kindNameSrc] = defining('KIND_NAME', ['src/model/pieces.ts', 'src/data/pieces.ts'])
  const kindName = Object.fromEntries([...(kindNameSrc.match(/KIND_NAME[^=]*=\s*\{([^}]*)\}/)?.[1] ?? '').matchAll(/(\w+):\s*(['"])(.*?)\2/g)].map((m) => [m[1], m[3]]))
  const [cardsFile, cardsSrc] = defining('CARD_TYPES', ['src/model/cards.ts', 'src/data/cards.ts'])
  const cardTypes = [...(cardsSrc.match(/CARD_TYPES\s*=\s*\[([^\]]*)\]/)?.[1] ?? '').matchAll(/(['"])(\w+)\1/g)].map((m) => m[2])
  if (cardsSrc && !cardTypes.length) bad(`can't read CARD_TYPES in ${cardsFile}`)
  for (const k of NOT_IN_PLUS) if (kinds.length && !kinds.includes(k)) bad(`NOT_IN_PLUS has "${k}", which isn't a piece kind`)

  const layoutFile = 'src/views/workspace/WorkspaceLayout.tsx'
  const layout = read(layoutFile)
  const start = layout.indexOf('function AddToCanvas')
  const lines = start === -1 ? [] : layout.slice(start, layout.indexOf('\n}\n', start)).split('\n')
  const lineNo = (i) => layout.slice(0, start).split('\n').length + i
  if (!lines.length) bad(`can't find AddToCanvas (the \`+\` menu) in ${layoutFile}`)
  // Its three lists: `const text = [ … ]` (in both menus), then `plane ? [ … ]` (a focused plane's) `: [ … ]` (the canvas's).
  const textStart = lines.findIndex((l) => /const text = \[/.test(l))
  const textEnd = lines.findIndex((l, i) => i > textStart && /^\s*\]\s*$/.test(l))
  const planeStart = lines.findIndex((l) => /^\s*\?\s*\[\s*$/.test(l))
  const canvasStart = lines.findIndex((l, i) => i > planeStart && /^\s*:\s*\[\s*$/.test(l))
  if (lines.length && (textStart < 0 || textEnd < 0 || planeStart < 0 || canvasStart < 0)) bad(`can't tell the \`+\` menu's lists apart in ${layoutFile} (text, plane, canvas)`)
  const spread = (from, to) => lines.slice(from, to).some((l) => l.includes('...text'))
  const textIn = [spread(planeStart, canvasStart) && 'plane', spread(canvasStart, lines.length) && 'canvas'].filter(Boolean)
  const textWhere = textIn.length === 2 ? 'both' : textIn[0]
  const whereOf = (i, line) => {
    if (i > textStart && i < textEnd) return /!plane\s*\?\s*\[\]/.test(line) ? 'plane' : /\bplane\s*\?\s*\[\]/.test(line) ? 'canvas' : textWhere
    if (i > planeStart && i < canvasStart) return 'plane'
    if (i > canvasStart) return 'canvas'
    return undefined
  }
  const menu = new Map()
  let keysSeen = 0
  let rowsRead = 0
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/\bkey\s*:\s*(?:(['"])([\w-]+)\1|(\w+))\s*,\s*(\w+)\s*:\s*([^,]*)/g)) {
      const [, , quoted, variable, prop, value] = m
      if (prop === 'heading') continue
      keysSeen++
      const where = whereOf(i, line)
      if (prop !== 'label') {
        bad(`can't read label of the \`+\` menu's row "${quoted ?? variable}" (${layoutFile}:${lineNo(i)}): no label after its key`)
        continue
      }
      const str = value.trim().match(/^(['"])(.*)\1$/)?.[2]
      if (quoted) {
        const label = str ?? (value.trim().match(/^KIND_NAME\.(\w+)$/) ? kindName[value.trim().slice(10)] : undefined)
        if (label === undefined) bad(`can't read label of the \`+\` menu's row "${quoted}": ${value.trim()}`)
        else (menu.set(quoted, { label, where }), rowsRead++)
      } else if (new RegExp(`CARD_TYPES\\.map\\(\\(?${variable}\\)?\\s*=>`).test(line) && value.trim() === variable) {
        for (const t of cardTypes) menu.set(t, { label: t, where })
        rowsRead++
      } else bad(`can't read key of the \`+\` menu's row "key: ${variable}" (${layoutFile})`)
    }
  })
  const keysInMenu = lines.join('\n').match(/\bkey\s*:/g)?.length ?? 0
  const headings = lines.join('\n').match(/\bkey\s*:[^,]*,\s*heading\s*:/g)?.length ?? 0
  if (keysInMenu - headings !== keysSeen || keysSeen !== rowsRead)
    bad(`the \`+\` menu has ${keysInMenu - headings} rows but ${rowsRead} were read (${layoutFile}): teach check-lessons.mjs its new shape`)

  const rows = new Map(guideRows.map((r) => [r.key, r]))
  for (const k of kinds) if (!NOT_IN_PLUS.includes(k) && !rows.has(k)) bad(`piece kind "${k}" has no kind-guide row (or add it to NOT_IN_PLUS)`)
  for (const k of kinds) if (!NOT_IN_PLUS.includes(k) && lines.length && !menu.has(k)) bad(`piece kind "${k}" isn't in the \`+\` menu (add it to NOT_IN_PLUS if it's made elsewhere)`)
  for (const t of cardTypes) if (!rows.has(t)) bad(`card type "${t}" has no kind-guide row`)
  for (const [key, { label, where }] of menu) {
    const r = rows.get(key)
    if (!r) bad(`the \`+\` menu's "${label}" (${key}) has no kind-guide row`)
    else {
      if (r.label !== label) bad(`kind-guide row "${key}" says "${r.label}", the \`+\` menu "${label}"`)
      if (where && r.where !== where) bad(`kind-guide row "${key}" is where "${r.where}", but the \`+\` menu has it in "${where}"`)
    }
  }
  for (const key of rows.keys()) if (lines.length && !menu.has(key)) bad(`kind-guide row "${key}" isn't in the \`+\` menu any more`)
}

// Releases (the shipped list and the test sample).
const sceneDir = at('src/demo/scenes/')
const builtScenes = new Set(
  existsSync(sceneDir) ? readdirSync(sceneDir).filter((f) => /\.(t|j)sx?$/.test(f)).map((f) => f.replace(/\.(t|j)sx?$/, '')) : [],
)
for (const [name, list] of [['releases.ts', RELEASES], ['releases.sample.ts', SAMPLE_RELEASES]]) {
  const seen = new Set()
  list.forEach((r, i) => {
    const where = `${name} "${r.id}"`
    if (seen.has(r.id)) bad(`${where} appears twice`)
    seen.add(r.id)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date ?? '')) bad(`${where} date "${r.date}" isn't YYYY-MM-DD`)
    if (i && list[i - 1].date < r.date) bad(`${where} is newer than the one before it (newest first)`)
    shown(`${where} title`, r.title ?? '')
    for (const it of r.items ?? []) {
      const w = `${where} item "${it.title}"`
      shown(`${w} title`, it.title)
      shown(`${w} line`, it.line)
      if (it.go) shown(`${w} go`, it.go.label)
      const n = words(it.line)
      if (n > MAX.body) bad(`${w} line is ${n} words (max ${MAX.body})`)
      for (const id of it.lessons ?? []) if (!ids.has(id)) bad(`${w} arms "${id}", which isn't a lesson`)
      if (it.scene !== undefined && !scenes.has(it.scene) && !builtScenes.has(it.scene)) bad(`${w} shows scene "${it.scene}", which no lesson has and src/demo/scenes/ doesn't`)
    }
  })
  if (name === 'releases.ts' && list[list.length - 1]?.id !== 'launch') bad('releases.ts must start (at its end) with "launch"')
}

// The ratchet: scenes, anchors and events still to be built.
const srcFiles = []
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.(tsx?|html)$/.test(f)) srcFiles.push(p)
  }
}
walk(at('src/').pathname)
const learnIn = new Set()
for (const p of srcFiles) for (const m of readFileSync(p, 'utf8').matchAll(/data-learn(?:=|'?\s*:\s*)\{?\s*["'`]([\w-]+)["'`]/g)) learnIn.add(m[1])
const eventsFile = at('src/onboarding/events.ts')
const eventsSrc = existsSync(eventsFile) ? readFileSync(eventsFile, 'utf8') : ''
// Emitted: `learn('e'` / `emit('e'` calls, or the strings of an exported EMITS list.
const emitsList = eventsSrc.match(/export const EMITS[^=]*=\s*\[([\s\S]*?)\]/)?.[1] ?? ''
const emitted = new Set([
  ...[...eventsSrc.matchAll(/\b(?:learn|emit)\(\s*(['"`])([\w-]+)\1/g)].map((m) => m[2]),
  ...[...emitsList.matchAll(/(['"`])([\w-]+)\1/g)].map((m) => m[2]),
])

const missing = {
  scenes: [...scenes.keys()].filter((s) => !builtScenes.has(s)).sort(),
  anchors: [...anchors.keys()].filter((a) => !learnIn.has(a)).sort(),
  events: EVENTS.filter((e) => !emitted.has(e)).sort(),
}

if (process.argv.includes('--write-pending')) {
  const note = 'Built in later onboarding steps (scenes O7+, anchors O6, events O3): check:lessons fails on anything missing that is not here, and on anything here that now exists. Only ever shrink it.'
  writeFileSync(at(PENDING_FILE), `${JSON.stringify({ _note: note, ...missing }, null, 2)}\n`)
  console.log(`check:lessons: wrote ${PENDING_FILE} (${missing.scenes.length} scenes, ${missing.anchors.length} anchors, ${missing.events.length} events)`)
}

const pending = existsSync(at(PENDING_FILE)) ? JSON.parse(read(PENDING_FILE)) : { scenes: [], anchors: [], events: [] }
const ratchet = (kind, used, have, whereOf, home) => {
  const listed = new Set(pending[kind] ?? [])
  for (const x of used) {
    if (!have(x) && !listed.has(x)) bad(`${kind.slice(0, -1)} "${x}" (${whereOf(x)}) isn't ${home} and isn't in ${PENDING_FILE}`)
    if (have(x) && listed.has(x)) bad(`${kind.slice(0, -1)} "${x}" is built now: take it out of ${PENDING_FILE}`)
  }
  for (const x of listed) if (!used.includes(x)) bad(`${kind.slice(0, -1)} "${x}" is in ${PENDING_FILE} but nothing uses it: take it out`)
}
ratchet('scenes', [...scenes.keys()], (s) => builtScenes.has(s), (s) => scenes.get(s), 'in src/demo/scenes/')
ratchet('anchors', [...anchors.keys()], (a) => learnIn.has(a), (a) => anchors.get(a), 'a data-learn in src/')
ratchet('events', [...EVENTS], (e) => emitted.has(e), () => 'EVENTS', 'emitted by src/onboarding/events.ts')

if (problems.length) {
  console.error(problems.join('\n'))
  console.error(`check:lessons: ${problems.length} problem${problems.length > 1 ? 's' : ''}`)
  process.exit(1)
}
const count = (f) => LESSONS.filter((l) => l.format === f).length
console.log(
  `check:lessons: ok · ${LESSONS.length} lessons (${FORMATS.map((f) => `${count(f)} ${f}`).join(', ')}), ${guideRows.length} guide rows, ` +
    `${RELEASES.length} release · pending: ${pending.scenes?.length ?? 0} scenes, ${pending.anchors?.length ?? 0} anchors, ${pending.events?.length ?? 0} events`,
)
