// The workspace's data as a store, without React (R9, docs/specs/agent.md §5): the store a workspace route makes
// (`useWorkspaceStore` in views/workspace/context.ts) registers itself here, so code outside React (the ops layer, the
// agent, tests in node) reads the workspace shown with `getWs()` and hears of changes with `subscribeWs()`.
import type { WithId } from '../data/hooks'
import type { Workspace } from '../data/model'
import type { WorkspaceData } from '../data/workspaceData'

export type WorkspaceCtx = WorkspaceData & {
  wid: string
  workspace: WithId<Workspace>
  // The canvas shown (D-302): `main` or a canvas's id.
  canvas: string
}

// The workspace's data in a store rather than a context value, so a change draws only what reads the part that
// changed: `useWs()` notes the fields a component reads, and it draws again when one of those changes (one card's title
// draws that card and what lists cards, not every component under the workspace, D-279's *Not yet*).
//
// THE OVERLAY (S15, D-312; agent.md §4.5 point 3, onboarding.md §6.3): `overlay(fn)` makes `get()` return `fn(real)`
// instead of the real value, until `overlay(null)`. The real value is still the one `set()` keeps (the live listeners go
// on writing it underneath), and `real()` reads it. `fn` runs once per real value (memoised), so an item `fn` leaves alone
// keeps its object (D-287: what didn't change doesn't draw again). Turning it on or off tells the subscribers, so
// `useWs()`, `useWsNow()` and `getWs()` all see the overlaid workspace with no change in any component. Off by default:
// a store without an overlay behaves exactly as before.
// - The agent's preview: `fn` = the workspace with the pending changes played on (src/agent/preview.ts); writes are
//   refused meanwhile by its lock (browser.ts' PREVIEW_LOCK); the ops' `freshWs()` reads `real()` (getRealWs), so what
//   is applied is built on the real workspace, never on the preview.
// - Onboarding's demos: a demo provides its own store (`makeStore(fixture)` + WorkspaceContext + registerStore, no
//   Firestore listeners) and may show a "what if" state the same way: `store.overlay((ws) => ({ ...ws, cards: [...] }))`
//   and `store.overlay(null)` to go back; or simply `store.set(next)` + `store.tell()` for a scene's own steps.
export type Overlay = (real: WorkspaceCtx) => WorkspaceCtx
export type Store = {
  get: () => WorkspaceCtx
  subscribe: (on: () => void) => () => void
  set: (v: WorkspaceCtx) => void
  tell: () => void
  // The value set last, whatever the overlay shows.
  real: () => WorkspaceCtx
  // An overlay on (a function) or off (null); tells the subscribers.
  overlay: (fn: Overlay | null) => void
  overlaid: () => boolean
}

export function makeStore(first: WorkspaceCtx): Store {
  let value = first
  let over: Overlay | null = null
  // The overlaid value, for the real value it was made from.
  let made: { from: WorkspaceCtx; fn: Overlay; v: WorkspaceCtx } | null = null
  const subs = new Set<() => void>()
  const tell = () => subs.forEach((on) => on())
  const get = () => {
    if (!over) return value
    if (!made || made.from !== value || made.fn !== over) made = { from: value, fn: over, v: over(value) }
    return made.v
  }
  return {
    get,
    subscribe: (on) => (subs.add(on), () => void subs.delete(on)),
    set: (v) => void (value = v),
    tell,
    real: () => value,
    overlay: (fn) => {
      if (fn === over) return
      over = fn
      made = null
      tell()
    },
    overlaid: () => !!over,
  }
}

// The registered stores as a stack: the top one is current. Registering pushes; unregistering takes that store out
// wherever it sits, and the top is current again (null only when none is left). Dev mounts twice: the second store
// sits on top, and the first one's unmount leaves it current.
//
// `useWs()` reads its store from React context, not from here; a preview overlays that same store (`overlay`, above), and
// a demo (its own iframe or tree) provides its own store through WorkspaceContext and registers it. Either way getWs()
// follows.
const stack: Store[] = []
const watchers = new Set<() => void>()
let current: Store | null = null
let unhook: (() => void) | null = null

function settle() {
  const next = stack[stack.length - 1] ?? null
  if (next === current) return
  unhook?.()
  current = next
  // Who listens to the workspace hears the current store's changes, and that the current store itself changed.
  unhook = next ? next.subscribe(() => watchers.forEach((on) => on())) : null
  watchers.forEach((on) => on())
}

// Registers a store on top; the function returned takes that store out (once), wherever it sits.
export function registerStore(store: Store): () => void {
  stack.push(store)
  settle()
  let done = false
  return () => {
    if (done) return
    done = true
    const i = stack.lastIndexOf(store)
    if (i >= 0) stack.splice(i, 1)
    settle()
  }
}

export const activeStore = (): Store | null => current

// The workspace shown, as it is now (with an overlay on, as the overlay shows it: the agent's preview); null outside a
// workspace route.
export const getWs = (): WorkspaceCtx | null => current?.get() ?? null

// The workspace as the listeners last gave it, whatever an overlay shows: what writes are built on (ops' freshWs).
export const getRealWs = (): WorkspaceCtx | null => current?.real() ?? null

// Called on every change to the workspace shown, and when it starts or stops being there.
export function subscribeWs(on: () => void): () => void {
  watchers.add(on)
  return () => void watchers.delete(on)
}
