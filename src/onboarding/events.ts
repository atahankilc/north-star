// The onboarding's events (D-315, docs/specs/onboarding.md §5.5): `learn(event, payload)`, the one-line hook a view
// calls where no store knows what happened (O6), and the watchers that turn the app's own stores, this tab's tracked
// writes and the address into events, without touching any view. Each fires once per real occurrence: a watcher compares
// the store's previous state with the next, a write step is read once (a merged step only for what it changed since),
// and the same event with the same payload within DEDUPE_MS is dropped (React's double mounts, a store set twice).
//
// The watchers get their stores passed in (`Sources`), so vitest drives them with fakes; `startEvents()` with nothing
// passed loads the real ones from busy.ts. Payload keys are lessons.ts' PAYLOADS, "what kind of thing" always `kind`.
//
// Writes: history.ts' `onTracked` (S3) says this tab recorded a step (it never hears other people's writes); what the
// step made, changed or deleted is read from the step itself (its before/after snapshots, `meta.created` when the write
// passes it), so nothing waits for the workspace store. The agent's steps (`actor: 'agent'`) never teach. Undo from the
// history store (its last step moving to `future`).
import { canvasOf } from '../model/canvases'
import type { LessonEvent } from './lessons'
import type { LearnEvent, Payload } from './queue'
import { DEDUPE_MS, learn, setLearnClock } from './learn'

export { DEDUPE_MS }
// Idle (§4.5): this long in the workspace, this long without input.
export const IDLE_AFTER_MS = 3 * 60_000
export const IDLE_QUIET_MS = 10_000
// The ids the hazard confirm asked about are remembered this long after it closed (its delete is written just after).
const CONFIRM_MS = 10_000
// How often the address, the DOM (Settings, menus) and idle are looked at.
export const POLL_MS = 250

// The events emitted (check:lessons' ratchet reads this list): by this file's watchers, then (the last lines) by the
// one-line `learn()` hooks in views (O6), the workspaces page and the coach itself.
export const EMITS = [
  'canvas-open', 'canvas-switch', 'focus-in', 'focus-out', 'beside-open', 'edit-on', 'edit-off', 'card-selected',
  'cards-multi', 'link-selected', 'linking', 'drawing-section', 'packing', 'bringing', 'to-canvas', 'confirming',
  'cell-picked', 'task-moved', 'piece-made', 'card-made', 'text-made', 'link-made', 'task-made', 'package-made', 'stuck', 'unstuck',
  'unframed', 'framed', 'brought', 'canvas-made', 'moved-canvas', 'evidence-added', 'status-set', 'doc-uploaded',
  'undo', 'deleted', 'task-for-card', 'piece-moved', 'card-moved', 'wizard', 'setup-open', 'finder-open',
  'threads-open', 'thread-open', 'side-view', 'following', 'filter-open', 'filter-set', 'doc-reader', 'settings-open',
  'menu-open', 'task-given', 'peer-joined', 'edit-refused', 'idle',
  // From views: the `+` menu (WorkspaceLayout), right-click (CanvasView), the crumb (CanvasSwitch), a piece's console
  // (CanvasView), a feature axis unfolded (Matrix), a folded parts tree (PlaneCards); the workspaces page; the coach.
  'plus-open', 'context-menu', 'crumb-open', 'console-shown', 'axis-unfold', 'parts-folded',
  'workspaces-open', 'ws-made', 'join-requested', 'sidenav-rest', 'guide-open',
] as const satisfies readonly LessonEvent[]

// Events emitted for some kinds only: check:lessons wants each other kind a lesson listens for listed in
// lessons-pending.json as `event:kind`. A plane's `filter-open` is watched here; a deck's strip keeps its open state in
// its view, so KanbanFilterDock says `filter-open {kind: 'kanban'}` itself as it opens.
export const EMITS_PARTLY: Record<string, readonly string[]> = { 'filter-open': ['plane', 'kanban'] }

// The emitter is learn.ts (`learn`, `onLearn`), re-exported here.
export { learn, onLearn } from './learn'

// ── What the watchers read ────────────────────────────────────────────────────────────────────────────────────────────

export type StoreLike<T> = { getState(): T; subscribe(fn: (s: T, prev: T) => void): () => void }

type Id = { id: string }
export type PieceLike = Id & { kind: string; stuckTo?: string; open?: boolean; canvasId?: string; canvases?: string[]; kanban?: { holds?: string; cols?: { id: string; done?: boolean }[] } }
export type WsLike = {
  wid: string
  canvas: string
  pieces: PieceLike[]
  cards: (Id & { type: string; pieceId: string; planes?: string[] })[]
  labels: (Id & { pieceId: string; kind?: string; size?: string })[]
  edges: (Id & { kind: string })[]
  tasks: (Id & { pieceId: string; assignee?: string; givenAt?: number; givenBy?: string })[]
  threads: (Id & { on: string })[]
}

export type CanvasViewLike = {
  editing: string[]
  confirming: string | null
  deleting: { ids: string[] } | null
  bringing: unknown | null
  toCanvas: { share?: boolean } | null
  cardSelected: string | null
  cardMulti: string[]
  linkSelected: string | null
  linking: unknown | null
  drawing: string | null
  packing: string | null
}

type Doc = Record<string, unknown>
export type SnapLike = { ref: { path: string }; data: Doc | null }[]
export type StepLike = { label: string; before: SnapLike; after: SnapLike }
export type HistoryLike = { past: StepLike[]; future: StepLike[]; notice: { text: string; at: number } | null }
export type TrackedMetaLike = { created?: string[]; actor?: 'person' | 'agent' }

type FilterLike = Record<string, string[]>

export type Sources = {
  canvasView: StoreLike<CanvasViewLike>
  curtain: StoreLike<{ revealed: boolean }>
  ws: { get(): WsLike | null; subscribe(fn: () => void): () => void }
  history: StoreLike<HistoryLike>
  onTracked(fn: (label: string, meta?: TrackedMetaLike) => void): () => void
  side: StoreLike<{ open: boolean }>
  presence: StoreLike<{ peers: { uid: string }[]; following: string | null }>
  find: StoreLike<{ open: boolean }>
  threads: StoreLike<{ inbox: boolean; openId: string | null; draft: { on: string } | null }>
  planeFilter: StoreLike<{ byPlane: Record<string, FilterLike> }>
  shelf: StoreLike<{ filter: boolean }>
  matrixUi: StoreLike<{ wizard: boolean; setup: unknown }>
  tableUi: StoreLike<{ wizard: boolean; setup: string | null }>
  kanbanUi: StoreLike<{ wizard: boolean; setup: string | null }>
  docUi: StoreLike<{ readers: string[] }>
  // The address's query (`?focus=`, `?beside=`), and a way to hear back/forward.
  search(): string
  onPopState(fn: () => void): () => void
  // Read from the page each poll: the Settings dialog's page when open, whether a prompt (a menu) is open.
  settingsPage(): string | null
  menuOpen(): boolean
  // Pointer or key input (for idle).
  onInput(fn: () => void): () => void
  uid(): string
  // How many lessons this person has seen; whether this is their first canvas (no welcome yet).
  seenCount(): number
  firstCanvas(): boolean
  // The seen-state has loaded (progress.ts' `loaded`): canvas-open waits for it, as for the curtain.
  progressLoaded(): boolean
  // The decks a timeline reads (data/tasks.ts' timelineKanbans).
  timelineDecks(t: PieceLike, pieces: PieceLike[]): string[]
  now(): number
  every(ms: number, fn: () => void): () => void
}

// ── Helpers ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const CARD_COLLECTIONS: Record<string, string> = {
  customers: 'customer', problems: 'problem', competitors: 'competitor', ideas: 'idea', features: 'feature', packages: 'package',
}
// The filters' fields as the dock names them (SHOW FOR TAG REGION LINKS).
const FILTER_KINDS: Record<string, string> = { hide: 'show', for: 'for', tags: 'tag', regions: 'region', links: 'links' }

export const textKind = (d: { kind?: unknown; size?: unknown }) => (typeof d.kind === 'string' ? d.kind : d.size === 'note' ? 'paragraph' : 'heading')

// On the canvas shown: its own, or shown there too (a shared piece, D-307).
const onCanvas = (w: WsLike) => w.pieces.filter((p) => canvasOf(p) === w.canvas || !!p.canvases?.includes(w.canvas))

const pieceOf = (ws: WsLike | null, id: string | null | undefined) => (id ? ws?.pieces.find((p) => p.id === id) : undefined)

function params(search: string) {
  const p = new URLSearchParams(search)
  return { focus: p.get('focus'), beside: (p.get('beside') ?? '').split(',').filter(Boolean) }
}

// Whether a focused piece holds nothing yet (empty states): a plane's cards, a deck's tasks, a timeline's decks' tasks.
function isEmpty(ws: WsLike, p: PieceLike, s: Sources): boolean {
  if (p.kind === 'plane') return !ws.cards.some((c) => c.pieceId === p.id || c.planes?.includes(p.id))
  if (p.kind === 'kanban') return !ws.tasks.some((t) => t.pieceId === p.id)
  if (p.kind === 'timeline') {
    const decks = new Set(s.timelineDecks(p, ws.pieces))
    return !ws.tasks.some((t) => decks.has(t.pieceId))
  }
  return false
}

// What one recorded step did, as events: `base` is what the docs were before it (its `before`, or for a step merged
// into the last one, that one's `after`), so a merge tells only what it added.
export type StepCtx = {
  created?: string[]
  editing: string[]
  focus: boolean
  // What the hazard confirm was last asked about (pieces' or cards' ids), and whether that was a shared one.
  hazard: { ids: readonly string[]; shared: boolean }
  // Whether a deck's column is its finished one.
  doneCol?: (deck: string, col: string) => boolean
}
// `seen` with every doc of `before` it doesn't hold: the base of a merged step whose `before` grew.
export function withMissing(seen: SnapLike, before: SnapLike): SnapLike {
  const has = new Set(seen.map((s) => s.ref.path))
  return [...seen, ...before.filter((b) => !has.has(b.ref.path))]
}

export function stepEvents(base: SnapLike, after: SnapLike, ctx: StepCtx): LearnEvent[] {
  const out: LearnEvent[] = []
  const seen = new Set<string>()
  const add = (event: LessonEvent, payload?: Payload, target?: string) => {
    const key = `${event} ${payload ? JSON.stringify(payload) : ''}`
    if (seen.has(key)) return
    seen.add(key)
    out.push({ event, ...(payload ? { payload } : {}), ...(target ? { target } : {}) })
  }
  const was = new Map(base.map((b) => [b.ref.path, b.data]))
  const made = new Set(ctx.created ?? [])
  let deletedAny = false
  let confirmed = false
  for (const { ref, data } of after) {
    const parts = ref.path.split('/')
    const col = parts[parts.length - 2]
    const id = parts[parts.length - 1]
    const before = was.get(ref.path) ?? null
    const created = !!data && (!before || made.has(id))
    if (!data) {
      if (before) {
        deletedAny = true
        if (ctx.hazard.ids.includes(id)) confirmed = true
      }
      continue
    }
    const changed = (k: string) => !created && !!before && JSON.stringify(before[k]) !== JSON.stringify(data[k])
    const type = CARD_COLLECTIONS[col]
    if (col === 'pieces') {
      const kind = String(data.kind)
      if (created) {
        add('piece-made', { kind, holds: kind === 'kanban' ? ((data.kanban as { holds?: string } | undefined)?.holds ?? 'tasks') : 'none' }, `plane:${id}`)
        continue
      }
      if (changed('stuckTo')) add(data.stuckTo ? 'stuck' : 'unstuck', { kind }, `plane:${id}`)
      if (changed('open')) add(data.open ? 'unframed' : 'framed', { kind }, `plane:${id}`)
      if (changed('canvasId')) add('moved-canvas', { share: false })
      else if (changed('x') || changed('y')) add('piece-moved', { kind, editing: ctx.editing.includes(id) }, `plane:${id}`)
    } else if (type) {
      if (created) add(type === 'package' ? 'package-made' : 'card-made', type === 'package' ? undefined : { kind: type }, `card:${id}`)
      else {
        if (changed('validation') || changed('status')) add('status-set')
        if (changed('x') || changed('y')) add('card-moved', { focus: ctx.focus })
      }
    } else if (col === 'labels') {
      if (created) add('text-made', { kind: textKind(data) }, `label:${id}`)
    } else if (col === 'edges') {
      if (created) add('link-made', { kind: String(data.kind) }, `link:${id}`)
    } else if (col === 'tasks') {
      if (created) add('task-made')
      else if (changed('col')) add('task-moved', { done: !!ctx.doneCol?.(String(data.pieceId), String(data.col)) })
      if (data.cardId && (created || !before?.cardId)) add('task-for-card')
    } else if (col === 'places') {
      if (created) add('brought', undefined, typeof data.cardId === 'string' ? `card:${data.cardId}` : undefined)
      else if (changed('x') || changed('y')) add('card-moved', { focus: ctx.focus })
    } else if (col === 'pieceSpots') {
      if (created) add('moved-canvas', { share: true })
    } else if (col === 'canvases') {
      if (created) add('canvas-made')
    } else if (col === 'evidence') {
      if (created) add('evidence-added')
    } else if (col === 'documents') {
      if (created) add('doc-uploaded')
    }
  }
  if (deletedAny) add('deleted', { confirmed, shared: confirmed && ctx.hazard.shared })
  return out
}

// ── The watchers ─────────────────────────────────────────────────────────────────────────────────────────────────────

let running: { count: number; stop: () => void } | null = null
let stopping: ReturnType<typeof setTimeout> | null = null

// Attach every watcher (once: a second start, React's double mount, only counts). Without sources, the real stores.
// `sources` may also be a loader (tests use one to stop while it loads).
export async function startEvents(sources?: Sources | (() => Promise<Sources>)): Promise<void> {
  if (stopping) {
    clearTimeout(stopping)
    stopping = null
  }
  if (running) {
    running.count++
    return
  }
  const me = { count: 1, stop: () => {} }
  running = me
  const s = typeof sources === 'function' ? await sources() : (sources ?? (await import('./busy')).realSources())
  // Stopped (or stopped and started again) while the stores loaded: this start is over.
  if (running !== me) return
  me.stop = attach(s)
}

// Let go (after a moment, so an unmount followed by a mount keeps the watchers and their memory).
export function stopEvents(now = false): void {
  if (!running) return
  if (--running.count > 0) return
  const end = () => {
    stopping = null
    running?.stop()
    running = null
  }
  if (now) end()
  else stopping = setTimeout(end, 100)
}

// The watchers on these sources; returns the function that takes them all off. Exported for tests.
export function attach(s: Sources): () => void {
  setLearnClock(() => s.now())
  const offs: Array<() => void> = []
  const ws = () => s.ws.get()

  // Workspace open (+ the curtain), the canvas switched, idle's clock, tasks given, peers.
  let openedWid: string | null = null
  let openedAt = 0
  let shownCanvas: string | null = null
  let lastInput = s.now()
  let idleSent = false
  let lastTasks = new Map<string, number>()
  const peersSeen = new Set<string>()
  const peerSince = new Map<string, number>()

  const taskGivens = (w: WsLike) => {
    const me = s.uid()
    const m = new Map<string, number>()
    for (const t of w.tasks) if (me && t.assignee === me && t.givenAt) m.set(t.id, t.givenAt)
    return m
  }

  const checkOpen = () => {
    const w = ws()
    if (!w) {
      openedWid = null
      shownCanvas = null
      return
    }
    if (openedWid !== w.wid) {
      if (!s.curtain.getState().revealed || !s.progressLoaded()) return
      openedWid = w.wid
      openedAt = s.now()
      shownCanvas = w.canvas
      idleSent = false
      lastTasks = taskGivens(w)
      peersSeen.clear()
      peerSince.clear()
      const on = onCanvas(w)
      learn('canvas-open', { first: s.firstCanvas(), empty: on.length === 0 })
      checkUrl()
      return
    }
    if (shownCanvas !== w.canvas) {
      shownCanvas = w.canvas
      learn('canvas-switch')
    }
    // A task newly given to you (D-261): its `givenAt` moved on.
    const now = taskGivens(w)
    const me = s.uid()
    for (const [id, at] of now) {
      const was = lastTasks.get(id)
      if (was !== undefined && at <= was) continue
      if (was === undefined && at < openedAt) continue
      const t = w.tasks.find((x) => x.id === id)
      learn('task-given', { byOther: !!t?.givenBy && t.givenBy !== me })
    }
    lastTasks = now
  }
  offs.push(s.ws.subscribe(checkOpen), s.curtain.subscribe(checkOpen))

  // The address: focus in and out, beside.
  let url: { focus: string | null; beside: string[] } = { focus: null, beside: [] }
  const checkUrl = () => {
    const w = ws()
    const next = params(s.search())
    // Only once the workspace has opened (canvas-open first); arriving with a focus (a reload, a link) is a focus-in.
    if (!w || openedWid !== w.wid) {
      url = { focus: null, beside: [] }
      return
    }
    if (next.focus !== url.focus) {
      const inn = pieceOf(w, next.focus)
      // A piece not there yet (still loading): looked at again next time.
      if (next.focus && !inn) return
      if (url.focus) learn('focus-out', { kind: pieceOf(w, url.focus)?.kind ?? 'plane' })
      if (inn) learn('focus-in', { kind: inn.kind, empty: isEmpty(w, inn, s) }, `plane:${inn.id}`)
    }
    for (const b of next.beside) if (!url.beside.includes(b)) learn('beside-open', { kind: pieceOf(w, b)?.kind ?? 'table' })
    url = next
  }
  offs.push(s.onPopState(checkUrl), s.ws.subscribe(checkUrl))

  // useCanvasView: what's selected, edited, drawn, asked.
  // What the hazard confirm asked about: its ids, until CONFIRM_MS after it closed (a cancel deletes none of them).
  let hazard: { ids: string[]; shared: boolean; until: number } = { ids: [], shared: false, until: -Infinity }
  offs.push(
    s.canvasView.subscribe((n, p) => {
      checkUrl()
      const w = ws()
      for (const id of n.editing) if (!p.editing.includes(id)) learn('edit-on', { kind: pieceOf(w, id)?.kind ?? 'plane' }, `plane:${id}`)
      for (const id of p.editing) if (!n.editing.includes(id)) learn('edit-off', { kind: pieceOf(w, id)?.kind ?? 'plane' })
      if (n.cardSelected && n.cardSelected !== p.cardSelected) {
        const sel = n.cardSelected
        if (sel.startsWith('cell|') || sel.startsWith('tcell|')) {
          const kind = sel.startsWith('cell|') ? 'matrix' : 'table'
          const piece = pieceOf(w, sel.split('|')[1])
          learn('cell-picked', { kind, framed: !piece?.open })
        } else {
          const card = w?.cards.find((c) => c.id === sel)
          if (card) learn('card-selected', { kind: card.type }, `card:${card.id}`)
        }
      }
      if (n.cardMulti.length > 1 && p.cardMulti.length < 2) learn('cards-multi', { count: n.cardMulti.length })
      if (n.linkSelected && n.linkSelected !== p.linkSelected) learn('link-selected', { kind: w?.edges.find((e) => e.id === n.linkSelected)?.kind ?? 'relates' })
      if (n.linking && !p.linking) learn('linking')
      if (n.drawing && !p.drawing) learn('drawing-section')
      if (n.packing && !p.packing) learn('packing')
      if (n.bringing && !p.bringing) learn('bringing')
      if (n.toCanvas && !p.toCanvas) learn('to-canvas', { share: !!n.toCanvas.share })
      if (n.confirming && n.confirming !== p.confirming) {
        const piece = pieceOf(w, n.confirming)
        learn('confirming', { kind: piece?.kind ?? 'plane', shared: (piece?.canvases?.length ?? 0) > 1 })
      }
      if (n.deleting && !p.deleting) learn('confirming', { kind: 'card', shared: true })
      if ((n.confirming && n.confirming !== p.confirming) || (n.deleting && n.deleting !== p.deleting)) {
        hazard = n.deleting
          ? { ids: [...n.deleting.ids], shared: true, until: Infinity }
          : { ids: [n.confirming!], shared: (pieceOf(w, n.confirming)?.canvases?.length ?? 0) > 1, until: Infinity }
      } else if (!n.confirming && !n.deleting && (p.confirming || p.deleting)) hazard = { ...hazard, until: s.now() + CONFIRM_MS }
    }),
  )

  // This tab's writes.
  // Each step's `after` as last seen, by its `before` (a merged step keeps its `before`): a merge tells only what it added.
  const afterOf = new WeakMap<SnapLike, SnapLike>()
  offs.push(
    s.onTracked((_label, meta) => {
      const past = s.history.getState().past
      const step = past[past.length - 1]
      if (!step) return
      const seenAfter = afterOf.get(step.before)
      if (seenAfter === step.after) return
      const merged = !!seenAfter
      // A merge that touches docs its step didn't hold yet adds them to `before` in place (agent S13): their state
      // before comes from there, so an updated doc isn't taken for a new one.
      const base = seenAfter ? withMissing(seenAfter, step.before) : step.before
      afterOf.set(step.before, step.after)
      if (meta?.actor === 'agent') return
      const cv = s.canvasView.getState()
      const w = ws()
      const live = s.now() <= hazard.until
      const evs = stepEvents(base, step.after, {
        created: merged ? undefined : meta?.created,
        editing: cv.editing,
        focus: !!params(s.search()).focus,
        hazard: { ids: live ? hazard.ids : [], shared: hazard.shared },
        doneCol: (deck, col) => !!pieceOf(w, deck)?.kanban?.cols?.find((c) => c.id === col)?.done,
      })
      for (const e of evs) learn(e.event, e.payload, e.target)
      if (evs.some((e) => e.event === 'deleted' && e.payload?.confirmed)) hazard = { ids: [], shared: false, until: -Infinity }
    }),
    s.history.subscribe((n, p) => {
      const top = p.past[p.past.length - 1]
      if (top && n.future[0] === top && n.past.length === p.past.length - 1) learn('undo')
      if (n.notice && n.notice !== p.notice && n.notice.text.startsWith("You're a viewer")) learn('edit-refused')
    }),
  )

  // Other stores.
  offs.push(
    s.side.subscribe((n, p) => void (n.open && !p.open && learn('side-view'))),
    s.presence.subscribe((n, p) => {
      if (n.following && n.following !== p.following) learn('following')
      const now = s.now()
      const here = new Set(n.peers.map((x) => x.uid))
      for (const uid of here) {
        if (!peerSince.has(uid)) peerSince.set(uid, now)
        if (!peersSeen.has(uid) && openedWid) {
          peersSeen.add(uid)
          learn('peer-joined')
        }
      }
      for (const uid of [...peerSince.keys()]) if (!here.has(uid)) peerSince.delete(uid)
    }),
    s.find.subscribe((n, p) => {
      if (!n.open || p.open) return
      const w = ws()
      learn('finder-open', { headings: !!w?.labels.some((l) => !l.kind && l.size !== 'note') })
    }),
    s.threads.subscribe((n, p) => {
      if (n.inbox && !p.inbox) learn('threads-open')
      if (n.openId && n.openId !== p.openId) learn('thread-open', { kind: ws()?.threads.find((t) => t.id === n.openId)?.on ?? 'plane' })
      else if (n.draft && n.draft !== p.draft && !p.draft) learn('thread-open', { kind: n.draft.on })
    }),
    s.shelf.subscribe((n, p) => void (n.filter && !p.filter && learn('filter-open', { kind: 'plane' }))),
    s.planeFilter.subscribe((n, p) => {
      for (const [plane, f] of Object.entries(n.byPlane)) {
        const was = p.byPlane[plane]
        if (!was || f === was) continue
        for (const [field, kind] of Object.entries(FILTER_KINDS)) {
          const a = f[field] ?? []
          const b = was[field] ?? []
          // A value picked (links: one shown again, i.e. taken off the hidden list, counts too).
          if (field === 'links' ? b.some((x) => !a.includes(x)) : a.some((x) => !b.includes(x))) learn('filter-set', { kind })
        }
      }
    }),
    s.matrixUi.subscribe((n, p) => {
      if (n.wizard && !p.wizard) learn('wizard', { kind: 'matrix' })
      if (n.setup && !p.setup) learn('setup-open', { kind: 'matrix' })
    }),
    s.tableUi.subscribe((n, p) => {
      if (n.wizard && !p.wizard) learn('wizard', { kind: 'table' })
      if (n.setup && !p.setup) learn('setup-open', { kind: 'table' })
    }),
    s.kanbanUi.subscribe((n, p) => {
      if (n.wizard && !p.wizard) learn('wizard', { kind: 'kanban' })
      if (n.setup && !p.setup) learn('setup-open', { kind: 'kanban' })
    }),
    s.docUi.subscribe((n, p) => void (n.readers.length > p.readers.length && learn('doc-reader'))),
  )

  // Polled: the address (a navigate that no store saw), Settings and menus (local state in their views), idle.
  let settings: string | null = s.settingsPage()
  let menu = s.menuOpen()
  offs.push(
    s.onInput(() => {
      lastInput = s.now()
      idleSent = false
    }),
    s.every(POLL_MS, () => {
      checkOpen()
      checkUrl()
      const page = s.settingsPage()
      if (page && page !== settings) learn('settings-open', { page })
      settings = page
      const m = s.menuOpen()
      if (m && !menu) learn('menu-open')
      menu = m
      const w = ws()
      const now = s.now()
      if (w && openedWid === w.wid && !idleSent && now - openedAt >= IDLE_AFTER_MS && now - lastInput >= IDLE_QUIET_MS) {
        idleSent = true
        const since = [...peerSince.values()]
        learn('idle', {
          pieces: onCanvas(w).length,
          cards: w.cards.length,
          seen: s.seenCount(),
          decks: w.pieces.filter((p) => p.kind === 'kanban').length,
          peerFor: since.length ? now - Math.min(...since) : 0,
        })
      }
    }),
  )

  checkOpen()
  checkUrl()
  return () => {
    for (const off of offs) off()
    setLearnClock(() => Date.now())
  }
}
