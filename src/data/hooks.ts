// Live Firestore subscriptions as React state.
import { collection, doc, onSnapshot, query, type Query, type QueryConstraint } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from './firebase'

export type WithId<T> = T & { id: string }

export type Live<T> = { data: T; isLoading: boolean; error: Error | null }

function useSnapshot<T>(subscribe: ((set: (v: T) => void, fail: (e: Error) => void) => () => void) | null, initial: T, deps: unknown[]): Live<T> {
  const [state, setState] = useState<Live<T>>({ data: initial, isLoading: Boolean(subscribe), error: null })

  useEffect(() => {
    if (!subscribe) {
      setState({ data: initial, isLoading: false, error: null })
      return
    }
    setState((s) => ({ ...s, isLoading: true }))
    return subscribe(
      (data) => setState({ data, isLoading: false, error: null }),
      (error) => setState({ data: initial, isLoading: false, error }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return state
}

export function useQuery<T>(q: Query | null, key: string): Live<WithId<T>[]> {
  return useSnapshot<WithId<T>[]>(
    q &&
      ((set, fail) =>
        onSnapshot(
          q,
          (snap) => set(snap.docs.map((d) => ({ ...(d.data() as T), id: d.id }))),
          fail,
        )),
    [],
    [key],
  )
}

export function useDoc<T>(path: string | null): Live<WithId<T> | null> {
  return useSnapshot<WithId<T> | null>(
    !path
      ? null
      : (set, fail) =>
        onSnapshot(
          doc(db(), path),
          (snap) => set(snap.exists() ? { ...(snap.data() as T), id: snap.id } : null),
          fail,
        ),
    null,
    [path],
  )
}

// A whole subcollection of a workspace, e.g. useWorkspaceCollection<Idea>(wid, 'ideas').
export function useWorkspaceCollection<T>(wid: string, name: string, ...constraints: QueryConstraint[]) {
  return useQuery<T>(query(collection(db(), 'workspaces', wid, name), ...constraints), `${wid}/${name}`)
}
