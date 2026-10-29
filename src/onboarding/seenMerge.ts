// The onboarding's seen-state (D-315, docs/specs/onboarding.md §5.3): its shape and how two copies of it merge (this
// browser's localStorage and the person's Firestore doc). No Firebase here, so the merge is tested in vitest; read and
// written only through src/data/onboarding.ts. Mirrors firestore.rules' `validOnboarding`: change both together.

export type Audience = 'new' | 'invited'
export type WelcomeEnd = 'done' | 'skipped'

// The fields whose newest setting wins; each setter stamps its field in `at`.
export type Stamped = 'tipsOff' | 'welcome' | 'lastRelease'

export type SeenState = {
  v: 1
  // Recorded once, the first time the doc is written (§5.2).
  audience: Audience
  startedAt: number
  // Lesson id → the highest version seen.
  seen: Record<string, number>
  // Lessons waiting to show (armed by a release, or triggered at a busy moment, §5.4), as `id@v`: the lesson's version
  // when armed. A bare `id` counts as `id@1`.
  armed: string[]
  tipsOff: boolean
  // The newest release this person was shown or given (§7); '' only before the coach first sets it.
  lastRelease: string
  welcome?: WelcomeEnd
  nudges?: { last?: number }
  // When each of `Stamped` was last set (ms). Not in the plan's shape: without it a copy changed for any other reason
  // (a lesson seen) would look newer and carry an old `tipsOff` over a newer one set on another device.
  at?: Partial<Record<Stamped, number>>
  updatedAt: number
}

// Bounds, the same as the rules'.
export const MAX_SEEN = 300
export const MAX_ARMED = 200
export const MAX_ID = 80
export const MAX_RELEASE = 40

export const armKey = (id: string, v: number) => `${id}@${v}`

export function parseArmed(entry: string): { id: string; v: number } {
  const at = entry.lastIndexOf('@')
  const v = at > 0 ? Number(entry.slice(at + 1)) : NaN
  return Number.isInteger(v) && v >= 1 ? { id: entry.slice(0, at), v } : { id: entry, v: 1 }
}

// Armed and not yet seen at that version: what the coach may still show as `NEW`.
export function isArmed(s: Pick<SeenState, 'armed' | 'seen'>, id: string): boolean {
  return s.armed.some((e) => {
    const a = parseArmed(e)
    return a.id === id && (s.seen[id] ?? 0) < a.v
  })
}

// A state as begin() records it. No `at` stamps: only a real setter stamps, so a fresh copy never beats a setting made
// elsewhere (a stamp here would make the defaults look newer than a tipsOff set on another device).
export function freshState(audience: Audience, lastRelease: string, now: number): SeenState {
  return {
    v: 1,
    audience,
    startedAt: now,
    seen: {},
    armed: [],
    tipsOff: false,
    lastRelease,
    updatedAt: now,
  }
}

// `seen` from both copies, each id at its highest version, in id order; past MAX_SEEN ids the first ones by id stay
// (by id, not by copy, so merge(a, b) equals merge(b, a)).
function mergeSeen(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const all: Record<string, number> = { ...a }
  for (const [id, v] of Object.entries(b)) all[id] = Math.max(all[id] ?? 0, v)
  const out: Record<string, number> = {}
  for (const id of Object.keys(all).sort().slice(0, MAX_SEEN)) out[id] = all[id]
  return out
}

// `armed`: the union of both copies, one entry per lesson at its highest armed version, minus every lesson already seen
// at (or past) that version, sorted by id (so the order never depends on which copy came first). Nothing is ever
// un-armed except by being seen (retire-on-done marks seen too, §5.4), so a union can't bring back something one
// device let go of; and a lesson armed again at v2 after being seen at v1 stays.
export function cleanArmed(armed: string[], seen: Record<string, number>): string[] {
  const top = new Map<string, number>()
  for (const e of armed) {
    const { id, v } = parseArmed(e)
    if (id) top.set(id, Math.max(top.get(id) ?? 0, v))
  }
  const out: string[] = []
  for (const id of [...top.keys()].sort()) {
    const v = top.get(id)!
    if ((seen[id] ?? 0) < v) out.push(armKey(id, v))
  }
  return out.slice(0, MAX_ARMED)
}

// A total order on a field's values, for ties: none < false < true < any string, strings by their order.
function rank(v: string | boolean | undefined): string {
  return v === undefined ? '0' : v === false ? '1' : v === true ? '2' : `3${v}`
}

function stamp(s: SeenState, f: Stamped): number {
  return s.at?.[f] ?? 0
}

// Two copies of one person's seen-state into one. The rule, field by field:
// - seen: union, the max version per lesson (seeing is never undone);
// - armed: union minus what's seen (cleanArmed);
// - tipsOff, welcome, lastRelease: the copy that set the field last (`at`) wins; a tie (both unstamped too) goes by
//   the value: true over false, a welcome over none, then the larger string;
// - audience, startedAt: the copy started first (they're recorded once and never change); a tie: invited over new
//   (a state made before begin() is always 'new', so begin()'s own answer must win the tie);
// - nudges.last: the later; updatedAt: the later.
// So an older copy wins nothing it didn't set later, and merge(a, b) deep-equals merge(b, a): two tabs pushing their
// merges at each other settle after one round.
export function mergeSeenState(local: SeenState, remote: SeenState): SeenState {
  const first =
    remote.startedAt !== local.startedAt
      ? remote.startedAt < local.startedAt ? remote : local
      : remote.audience === 'invited' ? remote : local
  const pick = <F extends Stamped>(f: F) => {
    const a = stamp(local, f)
    const b = stamp(remote, f)
    if (a !== b) return b > a ? remote : local
    return rank(remote[f]) > rank(local[f]) ? remote : local
  }
  const tips = pick('tipsOff')
  const welc = pick('welcome')
  const rel = pick('lastRelease')
  const seen = mergeSeen(local.seen, remote.seen)
  const last = Math.max(local.nudges?.last ?? 0, remote.nudges?.last ?? 0)
  const at: Partial<Record<Stamped, number>> = {}
  for (const [f, from] of [['tipsOff', tips], ['welcome', welc], ['lastRelease', rel]] as const) {
    const t = stamp(from, f)
    if (t) at[f] = t
  }
  return {
    v: 1,
    audience: first.audience,
    startedAt: first.startedAt,
    seen,
    armed: cleanArmed([...local.armed, ...remote.armed], seen),
    tipsOff: tips.tipsOff,
    lastRelease: rel.lastRelease,
    ...(welc.welcome && { welcome: welc.welcome }),
    ...(last > 0 && { nudges: { last } }),
    ...(Object.keys(at).length > 0 && { at }),
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
  }
}

// What came out of storage (either side), made safe to use: wrong types dropped, sizes kept to the rules' bounds. Null
// when it isn't a seen-state at all.
export function cleanSeenState(x: unknown): SeenState | null {
  if (!x || typeof x !== 'object') return null
  const d = x as Record<string, unknown>
  if (d.v !== 1 || (d.audience !== 'new' && d.audience !== 'invited') || typeof d.startedAt !== 'number') return null
  const seen: Record<string, number> = {}
  if (d.seen && typeof d.seen === 'object') {
    for (const [id, v] of Object.entries(d.seen as Record<string, unknown>)) {
      if (Object.keys(seen).length >= MAX_SEEN) break
      if (id.length <= MAX_ID && typeof v === 'number' && Number.isInteger(v) && v >= 1) seen[id] = v
    }
  }
  const armed = Array.isArray(d.armed) ? d.armed.filter((e): e is string => typeof e === 'string' && e.length <= MAX_ID + 6) : []
  const at: Partial<Record<Stamped, number>> = {}
  if (d.at && typeof d.at === 'object') {
    for (const f of ['tipsOff', 'welcome', 'lastRelease'] as const) {
      const t = (d.at as Record<string, unknown>)[f]
      if (typeof t === 'number') at[f] = t
    }
  }
  const last = (d.nudges as { last?: unknown } | undefined)?.last
  return {
    v: 1,
    audience: d.audience,
    startedAt: d.startedAt,
    seen,
    armed: cleanArmed(armed, seen),
    tipsOff: d.tipsOff === true,
    lastRelease: typeof d.lastRelease === 'string' ? d.lastRelease.slice(0, MAX_RELEASE) : '',
    ...((d.welcome === 'done' || d.welcome === 'skipped') && { welcome: d.welcome }),
    ...(typeof last === 'number' && { nudges: { last } }),
    ...(Object.keys(at).length > 0 && { at }),
    updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : d.startedAt,
  }
}

// Same content (ignoring updatedAt): whether a merged copy needs writing back.
export function sameSeenState(a: SeenState, b: SeenState): boolean {
  const { updatedAt: _a, ...ra } = a
  const { updatedAt: _b, ...rb } = b
  return stable(ra) === stable(rb)
}

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as object).sort().map((k) => `${k}:${stable((v as Record<string, unknown>)[k])}`).join(',')}}`
  }
  return JSON.stringify(v)
}
