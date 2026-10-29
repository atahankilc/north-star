import { createContext, useContext, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react'
import { makeStore, registerStore, type Store, type WorkspaceCtx } from '../../state/wsStore'

// The store and its type live in state/wsStore.ts (React-free, read outside React with `getWs()`, R9).
export type { WorkspaceCtx }
export { getWs, subscribeWs } from '../../state/wsStore'

export const WorkspaceContext = createContext<Store | null>(null)

// Set while rendering: the new value is there at once for what draws in the same pass; the others hear of it after.
export function useWorkspaceStore(value: WorkspaceCtx): Store {
  const [store] = useState(() => makeStore(value))
  if (store.get() !== value) store.set(value)
  // On top of getWs()'s stack while mounted; an unmount takes this store off it, the one under it current again.
  useLayoutEffect(() => registerStore(store), [store])
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
