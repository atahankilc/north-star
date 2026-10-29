// Plans checked before anything is written (S3, docs/specs/agent.md §5 R6): who may write, each write's shape (the
// cleaners in src/model/clean.ts, which mirror firestore.rules) and every reference a written doc makes (its plane,
// piece, canvas, card, link ends…), which the rules don't check. References are checked against the workspace as it
// would be after all the plans (so a thing made in the same batch counts, a thing deleted in it doesn't). Every error
// says how to put it right, for the model as much as for people.
//
// Only what the plans bring in is refused: the app never cleans up references to deleted things (D-141: a package's
// members, a matrix's hidden cards, a plane rule, a task's card, `stuckTo`), and old docs hold fields the cleaners would
// rewrite (a deck without columns, a step without an id, an untrimmed name). So each written doc is checked as it was
// too: a reference already dangling before isn't the plan's, and a field's shape counts only when the plan changed it.
import { CARD_COLLECTION, CARD_TYPES, type AnyType } from '../model/cards'
import { CANVAS } from '../model/labels'
import { MAIN } from '../model/canvases'
import { TYPE_OF_COLLECTION, WS_COLLECTIONS, type RawDoc } from '../model/fromDocs'
import { cleanCard, cleanCell, cleanComparison, cleanCompetitorFeature, cleanEdge, cleanEvidence, cleanLabel, cleanPiece, cleanPlace, cleanTask, type Ids, type Raw } from '../model/clean'
import type { WorkspaceCtx } from '../state/wsStore'
import { docAt, toDocs, WriteError, writeTo, type DocStore } from './docs'
import { a } from './util'
import { isDelete, type Coll, type OpActor, type OpError, type Plan, type Verdict, type Write } from './types'

const COLLS = new Set<string>([...WS_COLLECTIONS, 'workspace'])

// Fields a cleaner leaves to the importer (references, who made it): checked here by type and as references instead.
const KEPT: Record<string, Record<string, 'string' | 'number' | 'strings'>> = {
  card: { pieceId: 'string', memberIds: 'strings' },
  labels: { pieceId: 'string', canvasId: 'string' },
  pieces: { canvasId: 'string' },
  edges: { fromId: 'string', fromType: 'string', toId: 'string', toType: 'string' },
  evidence: { nodeId: 'string', nodeType: 'string' },
  competitorFeatures: { competitorId: 'string' },
  comparisons: { featureId: 'string', competitorId: 'string', competitorFeatureId: 'string' },
  places: { planeId: 'string', cardId: 'string', type: 'string' },
  tasks: { pieceId: 'string', col: 'string', cardId: 'string', cardType: 'string', uid: 'string', assignee: 'string', assigneeName: 'string', start: 'string', givenAt: 'number', givenBy: 'string', learned: 'string', updatedAt: 'number' },
  cells: { matrixId: 'string', row: 'string', col: 'string' },
}

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  return ka.length === kb.length && ka.every((k) => same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}

const typeOk = (v: unknown, t: 'string' | 'number' | 'strings') =>
  t === 'string' ? typeof v === 'string' : t === 'number' ? typeof v === 'number' && Number.isFinite(v) : Array.isArray(v) && v.every((x) => typeof x === 'string')

// Where an undefined value hides (Firestore refuses them), as a dotted path; null when there's none.
function undefinedAt(v: unknown, path = ''): string | null {
  if (v === undefined) return path || '(the value)'
  if (v && typeof v === 'object' && !isDelete(v))
    for (const [k, x] of Object.entries(v)) {
      const at = undefinedAt(x, path ? `${path}.${k}` : k)
      if (at) return at
    }
  return null
}

// A piece's fields that name other things (cleanPiece asks the Ids for them).
const REF_FIELDS = new Set(['stuckTo', 'docId', 'matrix', 'table', 'kanban', 'timeline'])

const titleOf = (coll: Coll) => (coll === 'workspace' ? 'the workspace' : `${coll}/`)

export function validate(plans: Plan[], ws: WorkspaceCtx, actor: OpActor): Verdict {
  const errors: OpError[] = []
  const say = (op: string, message: string, fix: string) => errors.push({ op, message, fix })

  // Who: viewers read only (D-098). Their own documents and comments come with the ops that write them (S4+).
  if (actor.role === 'viewer') {
    for (const p of plans)
      say(p.op, 'viewers can only read this workspace', 'ask an owner to make you an editor (Settings → people); until then, only read and suggest')
    return { ok: false, errors }
  }

  // Handles: one id each across the batch.
  const handles = new Map<string, string>()
  for (const p of plans)
    for (const [h, id] of Object.entries(p.ids)) {
      const was = handles.get(h)
      if (was && was !== id) say(p.op, `the handle ${h} names two different new things`, `give each new thing its own handle ($a, $b, …)`)
      handles.set(h, id)
    }

  // Shapes, in order, on the docs as they'd be at that point.
  const start = toDocs(ws)
  const store = toDocs(ws)
  const written = new Map<string, { op: string; coll: Coll; id: string }>()
  for (const p of plans) {
    for (const w of p.writes) {
      const bad = shapeOfWrite(w, ws, store)
      if (bad) {
        say(p.op, bad.message, bad.fix)
        continue
      }
      try {
        writeTo(store, w)
      } catch (e) {
        if (!(e instanceof WriteError)) throw e
        say(p.op, `${titleOf(w.coll)}${w.coll === 'workspace' ? '' : w.id} isn't there to change`, `make it first (a set or a create op), or check the id`)
        continue
      }
      written.set(`${w.coll}/${w.id}`, { op: p.op, coll: w.coll, id: w.id })
    }
  }

  // What each written doc holds and points at, once all the plans are written.
  for (const { op, coll, id } of written.values()) {
    const d = docAt(store, coll, id)
    if (!d) continue
    const was = docAt(start, coll, id)
    const { problems, refs } = checkDoc(coll, d, store, ws)
    const before = was ? checkDoc(coll, was, start, ws) : null
    const old = new Set(before?.refs.map((m) => m.message))
    const oldShape = new Set(before?.problems.map((m) => m.message))
    // A field's shape: only when the plan changed it (every field of a new doc); the doc's as a whole, only when new.
    for (const m of problems) if (!was || (m.field ? !same(was[m.field], d[m.field]) : !oldShape.has(m.message))) say(op, `${titleOf(coll)}${id}: ${m.message}`, m.fix)
    for (const m of refs) if (!old.has(m.message)) say(op, `${titleOf(coll)}${id}: ${m.message}`, m.fix)
  }
  return errors.length ? { ok: false, errors } : { ok: true }
}

// `field`: the field it's about, when it's one field's.
type Problem = { message: string; fix: string; field?: string }

function shapeOfWrite(w: Write, ws: WorkspaceCtx, store: DocStore): Problem | null {
  if (!COLLS.has(w.coll)) return { message: `there is no collection ${String(w.coll)}`, fix: `use one of: ${[...COLLS].join(', ')}` }
  if (typeof w.id !== 'string' || !w.id || w.id.includes('/') || w.id.length > 1500)
    return { message: `${String(w.id)} isn't an id`, fix: 'use the id the op gave it (ctx.newId()), without "/"' }
  const kinds = [w.set !== undefined, w.patch !== undefined, w.del === true].filter(Boolean).length
  if (w.merge && !w.set) return { message: `${w.coll}/${w.id}: merge goes with a set`, fix: 'use set with merge, or a patch' }
  if (kinds !== 1) return { message: `${w.coll}/${w.id}: a write is one of set, patch or del`, fix: 'split it into separate writes' }
  if (w.coll === 'threads') return { message: 'comments are not written by ops yet', fix: 'leave comments out of the batch for now' }
  if (w.coll === 'workspace') {
    if (w.id !== ws.wid) return { message: `the workspace doc is ${ws.wid}, not ${w.id}`, fix: `use id ${ws.wid}` }
    if (!w.patch) return { message: 'the workspace doc is only ever patched', fix: 'patch its name or description' }
    const extra = Object.keys(w.patch).filter((k) => k !== 'name' && k !== 'description')
    if (extra.length) return { message: `only the workspace's name and description can be changed, not ${extra.join(', ')}`, fix: 'patch only name or description' }
  }
  const body = w.set ?? w.patch
  if (body) {
    if (typeof body !== 'object' || Array.isArray(body)) return { message: `${w.coll}/${w.id}: set and patch take an object`, fix: 'pass the fields as an object' }
    const at = undefinedAt(body)
    if (at) return { message: `${w.coll}/${w.id}: ${at} is undefined, which Firestore refuses`, fix: 'leave the field out; to take a field away, patch it with DELETE' }
    if (w.set && !w.merge) {
      const del = Object.entries(w.set).find(([, v]) => isDelete(v))
      if (del) return { message: `${w.coll}/${w.id}: DELETE (${del[0]}) only works in a patch or a set with merge`, fix: 'leave the field out of the set' }
    }
    if (w.set) {
      if ('id' in w.set) return { message: `${w.coll}/${w.id}: a doc doesn't hold its own id`, fix: 'take `id` out of the fields' }
    }
  }
  if (w.del && w.coll !== 'workspace' && !docAt(store, w.coll, w.id)) return { message: `${w.coll}/${w.id} isn't there to delete`, fix: 'check the id, or leave the delete out' }
  return null
}

// Kinds of the things a doc can point at, as the store holds them now.
function look(store: DocStore, ws: WorkspaceCtx) {
  const piece = (id: unknown) => (typeof id === 'string' ? docAt(store, 'pieces', id) : undefined)
  const cardType = (id: unknown): AnyType | undefined => {
    if (typeof id !== 'string') return undefined
    for (const [coll, t] of Object.entries(TYPE_OF_COLLECTION)) if (store.get(coll as Coll)?.has(id)) return t
    return undefined
  }
  const canvas = (id: unknown) => id === MAIN || (typeof id === 'string' && !!docAt(store, 'canvases', id))
  const docIds = new Set(ws.documents.map((d) => d.id))
  return { piece, cardType, canvas, doc: (id: unknown) => typeof id === 'string' && docIds.has(id) }
}

// The doc's shape (by its cleaner) and its references.
function checkDoc(coll: Coll, d: RawDoc, store: DocStore, ws: WorkspaceCtx): { problems: Problem[]; refs: Problem[] } {
  const problems: Problem[] = []
  const refs: Problem[] = []
  const has = look(store, ws)
  const ref = (message: string, fix: string) => refs.push({ message, fix })
  const raw = d as Raw
  // Ids a setup names that aren't there (cleanPiece asks through these).
  const missing: string[] = []
  const ids: Ids = {
    card: (old) => {
      if (old === undefined) return undefined
      const t = has.cardType(old)
      if (!t) missing.push(`card ${String(old)}`)
      return t ? { id: old as string, type: t } : undefined
    },
    piece: (old) => {
      if (old === undefined) return undefined
      if (has.piece(old)) return old as string
      missing.push(`piece ${String(old)}`)
      return undefined
    },
    doc: (old) => {
      if (old === undefined) return undefined
      if (has.doc(old)) return old as string
      missing.push(`document ${String(old)}`)
      return undefined
    },
  }
  const cardColl = TYPE_OF_COLLECTION[coll]
  let cleaned: Record<string, unknown> | null | undefined
  let kept: Record<string, 'string' | 'number' | 'strings'> = {}
  const now = 0
  if (cardColl) ((cleaned = cleanCard(cardColl, raw, now)), (kept = KEPT.card))
  else if (coll === 'labels') ((cleaned = cleanLabel(raw, now)), (kept = KEPT.labels))
  else if (coll === 'pieces') ((cleaned = cleanPiece(raw, now, ids)), (kept = KEPT.pieces))
  else if (coll === 'edges') ((cleaned = cleanEdge(raw)), (kept = KEPT.edges))
  else if (coll === 'evidence') ((cleaned = cleanEvidence(raw, now)), (kept = KEPT.evidence))
  else if (coll === 'competitorFeatures') ((cleaned = cleanCompetitorFeature(raw, now)), (kept = KEPT.competitorFeatures))
  else if (coll === 'comparisons') ((cleaned = cleanComparison(raw, now)), (kept = KEPT.comparisons))
  else if (coll === 'places') ((cleaned = cleanPlace(raw, now)), (kept = KEPT.places))
  else if (coll === 'tasks') ((cleaned = cleanTask(raw, now)), (kept = KEPT.tasks))
  else if (coll === 'cells') ((cleaned = cleanCell(raw, now)), (kept = KEPT.cells))
  else if (coll === 'canvases') {
    if (typeof d.name !== 'string' || !d.name.trim() || d.name.length > 60) problems.push({ field: 'name', message: 'a canvas needs a name (1–60 characters)', fix: 'give it a name' })
    if (typeof d.order !== 'number') problems.push({ field: 'order', message: 'a canvas needs an order (a number)', fix: 'put it after the others: the largest order + 1' })
  } else if (coll === 'pieceSpots') {
    for (const k of ['x', 'y'] as const) if (typeof d[k] !== 'number' || !Number.isFinite(d[k])) problems.push({ field: k, message: `${k} must be a number`, fix: 'give the spot x and y in canvas px' })
  } else if (coll === 'workspace') {
    if (typeof d.name !== 'string' || !d.name.trim() || d.name.length > 200) problems.push({ field: 'name', message: 'the workspace needs a name (1–200 characters)', fix: 'give it a name' })
    if (d.description !== undefined && (typeof d.description !== 'string' || d.description.length > 1000))
      problems.push({ field: 'description', message: 'the description is at most 1000 characters', fix: 'shorten it' })
  }

  if (cleaned === null && missing.length) {
    // What it points at is missing: that's the error (below), not its shape.
  } else if (cleaned === null) problems.push({ message: `isn't a valid ${coll === 'pieces' ? 'piece' : cardColl ?? coll.replace(/s$/, '')}`, fix: hintFor(coll, cardColl) })
  else if (cleaned) {
    for (const [k, v] of Object.entries(d)) {
      if (k === 'id') continue
      if (k in kept) {
        if (!typeOk(v, kept[k])) problems.push({ field: k, message: `${k} must be ${kept[k] === 'strings' ? 'a list of strings' : `a ${kept[k]}`}`, fix: `set ${k} to the right type` })
        continue
      }
      // A field the cleaner dropped or rewrote because what it names is missing: the reference error says it.
      if (missing.length && REF_FIELDS.has(k)) continue
      if (!(k in cleaned)) problems.push({ field: k, message: `${k} isn't a field it can have, or its value is of the wrong type or not one it allows`, fix: `leave ${k} out, or give it a value of the right kind (${hintFor(coll, cardColl)})` })
      else if (!same(v, cleaned[k])) problems.push({ field: k, message: `${k} is too long, out of range or not one of the allowed values`, fix: `use what ${coll} allows for ${k}` })
    }
  }
  for (const m of missing) ref(`points at ${m}, which isn't in the workspace`, 'make it earlier in the batch, or use an id that exists (look it up with search or get)')

  // References the cleaners leave out.
  const plane = (id: unknown, what: string) => {
    const p = has.piece(id)
    if (!p) ref(`${what} ${String(id)} isn't a piece in the workspace`, 'use the id of an existing plane (or one made earlier in the batch)')
    else if (p.kind !== 'plane') ref(`${what} ${String(id)} is ${a(String(p.kind))}, not a plane`, 'put it on a plane')
  }
  const card = (id: unknown, type: unknown, what: string, only?: AnyType[]) => {
    const t = has.cardType(id)
    if (!t) return ref(`${what} ${String(id)} isn't a card in the workspace`, 'use the id of an existing card (or one made earlier in the batch)')
    if (type !== undefined && type !== t) ref(`${what} ${String(id)} is ${a(t)}, not ${a(String(type))}`, `say ${t}`)
    if (only && !only.includes(t)) ref(`${what} ${String(id)} is ${a(t)}; it must be ${a(only.join(' or '))}`, `use ${a(only.join(' or '))}`)
  }
  if (cardColl) {
    plane(d.pieceId, 'its plane')
    if (Array.isArray(d.memberIds)) for (const m of d.memberIds) card(m, undefined, 'member')
  } else if (coll === 'labels') {
    if (d.pieceId !== CANVAS) plane(d.pieceId, 'its plane')
    if (d.canvasId !== undefined && !has.canvas(d.canvasId)) ref(`canvas ${String(d.canvasId)} isn't in the workspace`, 'use an existing canvas id (or leave canvasId out for the first)')
    if (d.canvasId !== undefined && d.pieceId !== CANVAS) ref('only text on the canvas has a canvasId (text on a plane goes with its plane)', 'leave canvasId out')
  } else if (coll === 'pieces') {
    if (d.canvasId !== undefined && !has.canvas(d.canvasId)) ref(`canvas ${String(d.canvasId)} isn't in the workspace`, 'use an existing canvas id (or leave canvasId out for the first)')
    if (d.stuckTo !== undefined) {
      const host = has.piece(d.stuckTo)
      const hosts = d.kind === 'timeline' ? ['kanban', 'plane'] : ['plane']
      if (host && !hosts.includes(String(host.kind))) ref(`${a(String(d.kind))} sticks to ${a(hosts.join(' or '))}, not ${a(String(host.kind))}`, 'stick it to a plane (a timeline to a deck or a plane)')
      if (d.stuckTo === d.id) ref("a piece can't stick to itself", 'stick it to another piece')
    }
  } else if (coll === 'pieceSpots') {
    const p = has.piece(d.pieceId)
    if (!p) ref(`piece ${String(d.pieceId)} isn't in the workspace`, 'use an existing piece id')
    if (!has.canvas(d.canvasId)) ref(`canvas ${String(d.canvasId)} isn't in the workspace`, 'use an existing canvas id')
    if (d.id !== `${String(d.canvasId)}_${String(d.pieceId)}`) ref(`a spot's id is <canvasId>_<pieceId>, not ${d.id}`, `use ${String(d.canvasId)}_${String(d.pieceId)}`)
  } else if (coll === 'edges') {
    card(d.fromId, d.fromType, 'its start')
    card(d.toId, d.toType, 'its end')
    if (d.fromId === d.toId) ref('a link joins two different cards', 'pick another card for one end')
  } else if (coll === 'evidence') card(d.nodeId, d.nodeType, 'its card', ['customer', 'problem', 'idea'])
  else if (coll === 'competitorFeatures') card(d.competitorId, 'competitor', 'its competitor')
  else if (coll === 'comparisons') {
    card(d.featureId, 'feature', 'its feature')
    card(d.competitorId, 'competitor', 'its competitor')
    if (d.competitorFeatureId !== undefined && !docAt(store, 'competitorFeatures', String(d.competitorFeatureId)))
      ref(`competitor feature ${String(d.competitorFeatureId)} isn't in the workspace`, 'use an existing competitor feature id')
  } else if (coll === 'places') {
    plane(d.planeId, 'its plane')
    card(d.cardId, d.type, 'its card')
    if (d.id !== `${String(d.planeId)}_${String(d.cardId)}`) ref(`a place's id is <planeId>_<cardId>, not ${d.id}`, `use ${String(d.planeId)}_${String(d.cardId)}`)
    const home = has.cardType(d.cardId) && docAt(store, CARD_COLLECTION[has.cardType(d.cardId)!] as Coll, String(d.cardId))
    if (home && home.pieceId === d.planeId) ref('the card is already at home on that plane', 'leave the place out')
  } else if (coll === 'tasks') {
    const p = has.piece(d.pieceId)
    if (!p) ref(`deck ${String(d.pieceId)} isn't in the workspace`, 'use an existing deck id (or one made earlier in the batch)')
    else if (p.kind !== 'kanban') ref(`${String(d.pieceId)} is ${a(String(p.kind))}, not a deck`, 'put the task on a deck')
    if (d.cardId !== undefined) card(d.cardId, d.cardType, 'its card')
  } else if (coll === 'cells') {
    const p = has.piece(d.matrixId)
    if (!p) ref(`matrix ${String(d.matrixId)} isn't in the workspace`, 'use an existing matrix or table id')
    else if (p.kind !== 'matrix' && p.kind !== 'table') ref(`${String(d.matrixId)} is ${a(String(p.kind))}, not a matrix or table`, 'use a matrix or table id')
  }
  return { problems, refs }
}

function hintFor(coll: Coll, type?: AnyType): string {
  if (type) return `a card needs x and y (numbers) and a ${type === 'competitor' ? 'name' : 'title'}; ${CARD_TYPES.join(', ')} and package each have their own fields`
  switch (coll) {
    case 'labels':
      return 'text needs x and y; a section also w and h'
    case 'pieces':
      return 'a piece needs a kind (plane, matrix, table, documents, document, kanban, timeline), x, y, w and h (sizes > 0)'
    case 'edges':
      return 'a link needs a kind'
    case 'evidence':
      return 'evidence needs text, a kind (interview, quote, data, observation, link) and a stance (supports, contradicts)'
    case 'places':
      return 'a place needs x and y'
    case 'tasks':
      return 'a task needs a title and an order (a number)'
    default:
      return 'see src/model/clean.ts for the fields it takes'
  }
}
