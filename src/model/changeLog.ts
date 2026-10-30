// The change log (S16, D-312; docs/specs/agent.md §4.9 layer 6): who changed what, when, with NO text. One entry per
// recorded write: `workspaces/{wid}/changes/{id}` = { by, at, kinds, ids, op?, actor }. Pure: no Firebase.
//
// No free text by accident: `kinds` are collection names from a fixed list, `ids` are document ids (letters, digits,
// `_ : . -`) joined with commas into one string (so firestore.rules can check every character: no spaces), `op` is op
// names (`create_card,link`), only the ops registry's (the writer passes them). firestore.rules refuses anything else.
// (A determined writer could still spell words in an id or an op-shaped string; the rules keep it to that.) The read layer's `whats_new` reads it (by name
// through the members list) and falls back to the items' own times where there is no log.

// What a change touched may be any of these (firestore.rules lists the same).
export const CHANGE_KINDS = [
  'canvases', 'pieceSpots', 'pieces', 'customers', 'problems', 'competitors', 'ideas', 'features', 'packages', 'labels', 'cells',
  'evidence', 'competitorFeatures', 'comparisons', 'edges', 'tasks', 'places', 'documents', 'workspace',
] as const
export type ChangeKind = (typeof CHANGE_KINDS)[number]

export const CHANGE_IDS_MAX = 100
export const CHANGE_KINDS_MAX = 20
const ID = /^[A-Za-z0-9_:.-]{1,64}$/
const OP = /^[a-z_,]{0,200}$/

export type ChangeEntry = { id?: string; by: string; at: number; kinds: ChangeKind[]; ids: string[]; op?: string; actor: 'person' | 'agent' }

// As stored: ids joined.
export type ChangeDoc = { by: string; at: number; kinds: ChangeKind[]; ids: string; op?: string; actor: 'person' | 'agent' }

const KNOWN = new Set<string>(CHANGE_KINDS)

// One entry from the docs a write touched (collection + id each) and what it said of itself. Anything that isn't a
// known collection or a plain id is left out (so no text can get in); null when nothing is left.
export function changeEntry(o: { by: string; at: number; touched: { coll: string; id: string }[]; op?: string; actor?: 'person' | 'agent'; knownOps?: ReadonlySet<string> }): ChangeEntry | null {
  const kinds: ChangeKind[] = []
  const ids: string[] = []
  for (const t of o.touched) {
    // A document's body lives under its document: logged as the document.
    const coll = t.coll === 'docBodies' ? 'documents' : t.coll
    if (!KNOWN.has(coll) || !ID.test(t.id)) continue
    if (!kinds.includes(coll as ChangeKind)) kinds.push(coll as ChangeKind)
    if (!ids.includes(t.id) && ids.length < CHANGE_IDS_MAX) ids.push(t.id)
  }
  if (!kinds.length) return null
  // Only op names the registry knows (when the writer passes them); an unknown one is left out.
  const ops = o.op ? o.op.split(',').filter((x) => x && (!o.knownOps || o.knownOps.has(x))) : []
  const op = ops.length && OP.test(ops.join(',')) ? [...new Set(ops)].join(',') : undefined
  return { by: o.by, at: Math.round(o.at), kinds: kinds.slice(0, CHANGE_KINDS_MAX), ids, ...(op ? { op } : {}), actor: o.actor === 'agent' ? 'agent' : 'person' }
}

// Two entries for the same burst (typing in one field, one drag): one entry, the later time.
export function mergeEntries(a: ChangeEntry, b: ChangeEntry): ChangeEntry {
  const kinds = [...new Set([...a.kinds, ...b.kinds])].slice(0, CHANGE_KINDS_MAX)
  const ids = [...new Set([...a.ids, ...b.ids])].slice(0, CHANGE_IDS_MAX)
  const ops = [...new Set([...(a.op ? a.op.split(',') : []), ...(b.op ? b.op.split(',') : [])])].join(',')
  return { by: a.by, at: Math.max(a.at, b.at), kinds, ids, ...(ops && OP.test(ops) ? { op: ops } : {}), actor: a.actor === 'agent' || b.actor === 'agent' ? 'agent' : 'person' }
}

export const toChangeDoc = (e: ChangeEntry): ChangeDoc => ({ by: e.by, at: e.at, kinds: e.kinds, ids: e.ids.join(','), ...(e.op ? { op: e.op } : {}), actor: e.actor })

// A stored doc back to an entry; null when it isn't one (an old or broken doc is skipped, never guessed).
export function fromChangeDoc(id: string, d: Record<string, unknown>): ChangeEntry | null {
  if (typeof d.by !== 'string' || typeof d.at !== 'number' || !Array.isArray(d.kinds) || typeof d.ids !== 'string') return null
  const kinds = d.kinds.filter((k): k is ChangeKind => typeof k === 'string' && KNOWN.has(k))
  const ids = d.ids ? d.ids.split(',').filter((x) => ID.test(x)) : []
  return { id, by: d.by, at: d.at, kinds, ids, ...(typeof d.op === 'string' && d.op ? { op: d.op } : {}), actor: d.actor === 'agent' ? 'agent' : 'person' }
}
