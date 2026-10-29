import { createContext, useContext, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { WithId } from '../../data/hooks'
import type { Workspace } from '../../data/model'
import type { WorkspaceData } from '../../data/workspaceData'

export type WorkspaceCtx = WorkspaceData & {
  wid: string
  workspace: WithId<Workspace>
  // The canvas shown (D-302): `main` or a canvas's id.
  canvas: string
}

// The workspace's data in a store rather than a context value, so a change draws only what reads the part that
// changed: `useWs()` notes the fields a component reads, and it draws again when one of those changes (one card's title
// draws that card and what lists cards, not every component under the workspace, D-279's *Not yet*).
type Store = { get: () => WorkspaceCtx; subscribe: (on: () => void) => () => void; set: (v: WorkspaceCtx) => void; tell: () => void }

function makeStore(first: WorkspaceCtx): Store {
  let value = first
  const subs = new Set<() => void>()
  return {
    get: () => value,
    subscribe: (on) => (subs.add(on), () => void subs.delete(on)),
    set: (v) => void (value = v),
    tell: () => subs.forEach((on) => on()),
  }
}

export const WorkspaceContext = createContext<Store | null>(null)

// Set while rendering: the new value is there at once for what draws in the same pass; the others hear of it after.
export function useWorkspaceStore(value: WorkspaceCtx): Store {
  const [store] = useState(() => makeStore(value))
  if (store.get() !== value) store.set(value)
  useLayoutEffect(() => store.tell(), [store, value])
  return store
}

export function useWs(): WorkspaceCtx {
  const store = useContext(WorkspaceContext)
  if (!store) throw new Error('useWs() outside a workspace route')
  const now = store.get()
  // What this component read, and the value it drew with.
  const read = useRef(new Set<keyof WorkspaceCtx>())
  const drawn = useRef(now)
  drawn.current = now
  const [, redraw] = useReducer((n: number) => n + 1, 0)
  useLayoutEffect(
    () =>
      store.subscribe(() => {
        const v = store.get()
        for (const k of read.current) if (v[k] !== drawn.current[k]) return redraw()
      }),
    [store],
  )
  // A field read later (in a handler or an effect) is the current one, and from then on it's listened to too.
  return useMemo(
    () =>
      new Proxy(now, {
        get: (_, k) => {
          read.current.add(k as keyof WorkspaceCtx)
          return store.get()[k as keyof WorkspaceCtx]
        },
      }),
    [store, now],
  )
}

// The workspace as it is when called, for handlers: reading it doesn't draw the component again on changes.
export function useWsNow(): () => WorkspaceCtx {
  const store = useContext(WorkspaceContext)
  if (!store) throw new Error('useWsNow() outside a workspace route')
  return store.get
}
