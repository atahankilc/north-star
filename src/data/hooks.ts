// Live Firestore subscriptions as React state.
import { collection, doc, limit, onSnapshot, orderBy, query, type Query, type QueryConstraint } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import { db, firebase } from './firebase'

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

// A doc that didn't change keeps its object from the snapshot before, so what's drawn from it stays memoised: one card's
// title changing makes one new object, not one per doc in its collection.
export function useQuery<T>(q: Query | null, key: string): Live<WithId<T>[]> {
  return useSnapshot<WithId<T>[]>(
    q &&
      ((set, fail) => {
        let last = new Map<string, WithId<T>>()
        return onSnapshot(
          q,
          (snap) => {
            const changed = new Set(snap.docChanges().map((c) => c.doc.id))
            const next = new Map<string, WithId<T>>()
            const list = snap.docs.map((d) => {
              const kept = last.get(d.id)
              const v = kept && !changed.has(d.id) ? kept : { ...(d.data() as T), id: d.id }
              next.set(d.id, v)
              return v
            })
            last = next
            set(list)
          },
          fail,
        )
      }),
    [],
    [key],
  )
}

// Without Firebase (the onboarding's demo realm, D-315; no config) there's no doc: null, not loading.
export function useDoc<T>(path: string | null): Live<WithId<T> | null> {
  return useSnapshot<WithId<T> | null>(
    !path || !firebase
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

export type Paged<T> = Live<WithId<T>[]> & { hasMore: boolean; more: () => void; loadingMore: boolean }

type Streams<T> = { key: string; n: number; docs: (WithId<T>[] | null)[]; fresh: boolean[]; error: Error | null }

// Live pages of one or more queries merged into one list (D-098): the reports you may see are two queries (shared, yours),
// the usage log two for an owner. Each is ordered by `field` and limited to pages × `size`; `more()` raises the limit,
// keeping what's on screen until the bigger pages arrive. Rows past the point where a full query may still hold older
// ones are held back, so the merged list never skips any.
export function usePaged<T>(queries: (Query | null)[], key: string, field: string, dir: 'asc' | 'desc', size = 20): Paged<T> {
  const [pages, setPages] = useState(1)
  const [shownKey, setShownKey] = useState(key)
  // A new set of queries starts again from one page.
  if (shownKey !== key) {
    setShownKey(key)
    setPages(1)
  }
  const n = pages * size
  const live = queries.filter((q): q is Query => !!q)
  const [streams, setStreams] = useState<Streams<T>>({ key: '', n: 0, docs: [], fresh: [], error: null })

  useEffect(() => {
    setStreams((s) => {
      // Same queries, more rows: keep the old rows until each query answers again.
      const keep = s.key === key && s.docs.length === live.length
      return { key, n, docs: keep ? [...s.docs] : live.map(() => null), fresh: live.map(() => false), error: null }
    })
    const offs = live.map((q, i) =>
      onSnapshot(
        query(q, orderBy(field, dir), limit(n)),
        (snap) =>
          setStreams((s) => {
            const docs = [...s.docs]
            const fresh = [...s.fresh]
            docs[i] = snap.docs.map((d) => ({ ...(d.data() as T), id: d.id }))
            fresh[i] = true
            return { ...s, docs, fresh }
          }),
        (error) => setStreams((s) => ({ ...s, error })),
      ),
    )
    return () => offs.forEach((off) => off())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, n])

  return useMemo(() => {
    const lists = streams.key === key ? streams.docs.filter((d): d is WithId<T>[] => !!d) : []
    const ready = streams.key === key && streams.n === n && streams.fresh.length === live.length && streams.fresh.every(Boolean)
    const value = (d: WithId<T>) => (d as Record<string, unknown>)[field] as number | string
    const before = (a: number | string, b: number | string) => (dir === 'desc' ? a > b : a < b)
    const byId = new Map<string, WithId<T>>()
    for (const l of lists) for (const d of l) byId.set(d.id, d)
    let data = [...byId.values()].sort((a, b) => (before(value(a), value(b)) ? -1 : before(value(b), value(a)) ? 1 : 0))
    // A full page may hide older rows behind its last one: show nothing past the earliest such edge.
    const limitNow = streams.n || n
    const full = lists.filter((l) => l.length >= limitNow)
    if (full.length) {
      const edge = full.map((l) => value(l[l.length - 1])).reduce((a, b) => (before(a, b) ? a : b))
      data = data.filter((d) => !before(edge, value(d)))
    }
    const waiting = !ready && !streams.error && live.length > 0
    return {
      data,
      isLoading: waiting && data.length === 0,
      loadingMore: waiting && data.length > 0,
      error: streams.error,
      hasMore: full.length > 0,
      more: () => setPages((p) => p + 1),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streams, key, n, field, dir])
}
