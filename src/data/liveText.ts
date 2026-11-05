// Writing together (D-374, docs/specs/live-writing.md): a text several people type at once. Yjs (a library, no server)
// holds it while it's written and merges everyone's changes to the same result in any order; the packets travel through
// a transport (liveTransport.ts: Firestore today, RTDB once Blaze is on), so nothing here knows where they go.
//
// Open: the folded state and every packet since, applied to a fresh Y.Doc, then whatever comes. A text with no state yet
// (written before D-374, or new) is seeded from its Markdown in a transaction, so two people opening at once never both
// seed (the text would be there twice). Local changes go out as one packet every LIVE_SEND_MS; past LIVE_FOLD_PACKETS or
// LIVE_FOLD_BYTES the writer who sees it folds them into the state (merged with the state there, never over it) and
// deletes the packets it has applied. Generic: a document's text today; paragraphs, sticky notes and notes later.
//
// Lazy: only the editor's chunk imports this (Yjs stays out of the app's first load).
import * as Y from 'yjs'
import { LIVE_FOLD_BYTES, LIVE_FOLD_PACKETS, LIVE_PACKET_MAX } from '../model/limits'
import { LIVE_SEND_MS } from '../ui/foundation/feel'

export type LivePacket = { id: string; u: Uint8Array }
export type LiveState = { s: Uint8Array; v: number }

// Where the packets go. Firestore's is liveTransport.ts; tests and the gallery use liveMemory.ts.
export interface LiveTransport {
  // The folded state, live: what's there now (null: none yet), then again after every compaction.
  listenState(on: (s: LiveState | null) => void, onError: (e: unknown) => void): () => void
  // The packets, live: those there now first, then each one added; with how many there are and their bytes.
  listen(on: (added: LivePacket[], there: { count: number; bytes: number }) => void, onError: (e: unknown) => void): () => void
  // Queues a packet (offline it waits and goes on reconnecting); its id at once, so its echo is known.
  send(u: Uint8Array): { id: string; done: Promise<void> }
  // Creates the state only if there's none (a transaction); the state there afterwards, ours or someone else's.
  seed(s: Uint8Array): Promise<LiveState>
  // In a transaction: the state becomes `fold(what's there)`, its count up by one; then these packets are deleted.
  compact(fold: (old: Uint8Array | null) => Uint8Array, drop: string[]): Promise<void>
}

// What applying from outside is marked with: never sent again.
export const REMOTE = 'remote'

export type LiveText = {
  doc: Y.Doc
  // Open or seeded: the editor waits for it (typing into an empty doc first would be merged in front of the text).
  ready: Promise<void>
  // Sends what's waiting now (done, a hidden tab, closing).
  flush: () => void
  close: () => void
  // Whether a change of this tab's is still unsent.
  pending: () => boolean
}

type Options = {
  // The text as Markdown, made into the Y.Doc's update when there's no state (the editor's schema does it).
  seed: () => Uint8Array
  onError?: (e: unknown) => void
  sendEvery?: number
  fold?: { packets: number; bytes: number }
  // Waits before folding, so two writers who see the count at once rarely both fold (harmless, only work).
  foldJitter?: () => number
}

export function openLiveText(t: LiveTransport, opts: Options): LiveText {
  const doc = new Y.Doc()
  const fold = opts.fold ?? { packets: LIVE_FOLD_PACKETS, bytes: LIVE_FOLD_BYTES }
  const sendEvery = opts.sendEvery ?? LIVE_SEND_MS
  const onError = opts.onError ?? (() => {})
  // Packets applied (theirs, as they came) or sent (ours): a compaction may delete only these.
  const applied = new Set<string>()
  const own = new Set<string>()
  let queue: Uint8Array[] = []
  let timer: ReturnType<typeof setTimeout> | undefined
  let closed = false
  let folding = false
  // A change too big for a packet waits here until a fold takes it (offline, the fold fails and is tried again).
  let mustFold = false
  let there = { count: 0, bytes: 0 }

  const apply = (u: Uint8Array) => Y.applyUpdate(doc, u, REMOTE)

  const onUpdate = (u: Uint8Array, origin: unknown) => {
    if (origin === REMOTE || closed) return
    queue.push(u)
    if (timer === undefined) timer = setTimeout(flush, sendEvery)
  }
  doc.on('update', onUpdate)

  function flush() {
    clearTimeout(timer)
    timer = undefined
    if (!queue.length && !mustFold) return
    const u = queue.length ? Y.mergeUpdates(queue) : null
    queue = []
    if (u && u.length > LIVE_PACKET_MAX) mustFold = true
    else if (u) {
      const { id, done } = t.send(u)
      own.add(id)
      applied.add(id)
      done.catch(onError)
    }
    if (mustFold) void compact()
    else maybeFold()
  }

  function maybeFold() {
    if (folding || closed || (there.count < fold.packets && there.bytes < fold.bytes)) return
    const wait = opts.foldJitter?.() ?? Math.random() * 1500
    setTimeout(() => {
      if (!closed && (there.count >= fold.packets || there.bytes >= fold.bytes)) void compact()
    }, wait)
  }

  async function compact() {
    if (folding) return
    folding = true
    // Everything this doc holds is in the fold, so the packets it has applied (and its own sent) can go.
    const drop = [...applied]
    try {
      await t.compact((old) => (old ? Y.mergeUpdates([old, Y.encodeStateAsUpdate(doc)]) : Y.encodeStateAsUpdate(doc)), drop)
      mustFold = false
      for (const id of drop) applied.delete(id)
    } catch (e) {
      onError(e)
      // Tried again with the next change (a big one) or the next fold's count.
    } finally {
      folding = false
    }
  }

  let stateSeen = false
  let packetsSeen = false
  let resolveReady!: () => void
  let failReady!: (e: unknown) => void
  const ready = new Promise<void>((res, rej) => ((resolveReady = res), (failReady = rej)))
  let state: LiveState | null = null
  const fail = (e: unknown) => (onError(e), failReady(e))

  const settle = async () => {
    if (!stateSeen || !packetsSeen) return
    try {
      if (!state) {
        // None yet: seed it from the Markdown, unless someone else has meanwhile (then theirs is the one).
        const theirs = await t.seed(opts.seed())
        if (!closed) apply(theirs.s)
      }
      resolveReady()
    } catch (e) {
      fail(e)
    }
  }

  const offState = t.listenState((s) => {
    // Every new state is applied: a compaction may have deleted packets this tab hadn't read yet (merging is harmless).
    if (s) apply(s.s)
    state = s
    if (!stateSeen) ((stateSeen = true), void settle())
  }, fail)
  const offPackets = t.listen((added, now) => {
    there = now
    for (const p of added) {
      if (own.has(p.id)) continue
      apply(p.u)
      applied.add(p.id)
    }
    if (!packetsSeen) ((packetsSeen = true), void settle())
    else maybeFold()
  }, fail)

  return {
    doc,
    ready,
    flush,
    pending: () => queue.length > 0 || mustFold,
    close() {
      if (closed) return
      flush()
      closed = true
      offState()
      offPackets()
      doc.off('update', onUpdate)
      doc.destroy()
    },
  }
}

// ---- Carets (presence's `doc`: base64 Yjs relative positions, so a caret stays on its letter as others type)

export function toBase64(u: Uint8Array) {
  let s = ''
  for (const b of u) s += String.fromCharCode(b)
  return btoa(s)
}
export function fromBase64(s: string) {
  const bin = atob(s)
  const u = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i)
  return u
}

// A relative position as it travels (the caret plugin keeps them as JSON-ish objects) and back.
export const encodePosition = (rp: unknown) => toBase64(Y.encodeRelativePosition(Y.createRelativePositionFromJSON(rp)))
export const decodePosition = (s: string) => Y.relativePositionToJSON(Y.decodeRelativePosition(fromBase64(s)))
