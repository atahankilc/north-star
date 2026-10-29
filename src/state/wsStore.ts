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
export type Store = { get: () => WorkspaceCtx; subscribe: (on: () => void) => () => void; set: (v: WorkspaceCtx) => void; tell: () => void }

export function makeStore(first: WorkspaceCtx): Store {
  let value = first
  const subs = new Set<() => void>()
  return {
    get: () => value,
    subscribe: (on) => (subs.add(on), () => void subs.delete(on)),
    set: (v) => void (value = v),
    tell: () => subs.forEach((on) => on()),
  }
}

// The registered stores as a stack: the top one is current. Registering pushes; unregistering takes that store out
// wherever it sits, and the top is current again (null only when none is left). Dev mounts twice: the second store
// sits on top, and the first one's unmount leaves it current.
//
// Seam for later (S15's preview, onboarding demos): `useWs()` reads its store from React context, not from here, so a
// preview showing other values should put them into the same store (`store.set(v)` + `store.tell()`, keeping the real
// value to put back), or a demo (its own iframe or tree) provides its own store through WorkspaceContext and registers
// it. Either way getWs() follows.
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

// The workspace shown, as it is now; null outside a workspace route.
export const getWs = (): WorkspaceCtx | null => current?.get() ?? null

// Called on every change to the workspace shown, and when it starts or stops being there.
export function subscribeWs(on: () => void): () => void {
  watchers.add(on)
  return () => void watchers.delete(on)
}
