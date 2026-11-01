// What the workspaces page shows of each workspace without loading it (D-338, docs/specs/workspaces-page.md §3): your
// last visit, its picture, who changed what since, tasks new for you, who's here now; and the writers that keep the
// visit and the picture up to date from inside a workspace. A few reads each, never the workspace's content.
//
// The gallery (no Firebase) reads `setDemoGlance`'s made-up values instead; the app never sets them.
import { collection, doc, documentId, getDoc, limit, onSnapshot, orderBy, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { onValue, ref } from 'firebase/database'
import { useEffect, useRef, useState } from 'react'
import { db, firebase, isDemo } from './firebase'
import { useDoc, useQuery, type Live } from './hooks'
import type { Member, Presence, ThreadReads } from './model'
import type { WorkspaceData } from './workspaceData'
import { piecesOn } from './canvases'
import { MAIN } from '../model/canvases'
import { fromChangeDoc, type ChangeEntry } from '../model/changeLog'
import { makeSummary, readSummary, type Summary, type SummaryDoc } from '../model/summary'

// ── The gallery's made-up values ──────────────────────────────────────────────────────────────────────────────────
export type DemoGlance = { visited?: number; summary?: Summary | null; since?: ChangeEntry[]; newTasks?: number; here?: string[]; names?: Record<string, string> }
let demo: Record<string, DemoGlance> = {}
export const setDemoGlance = (by: Record<string, DemoGlance>) => void (demo = by)
const live = <T,>(data: T): Live<T> => ({ data, isLoading: false, error: null })

// ── Your visits ───────────────────────────────────────────────────────────────────────────────────────────────────
// When you were last in each workspace and last looked at your tasks (`threadReads/{you}`), for the page's order.
export type Visit = { visited?: number; tasks?: number }
export function useVisits(wids: readonly string[], uid: string): Live<Record<string, Visit>> {
  const key = wids.join(' ')
  const [state, setState] = useState<Live<Record<string, Visit>>>({ data: {}, isLoading: !isDemo && wids.length > 0, error: null })
  useEffect(() => {
    if (isDemo || !firebase) return setState(live(Object.fromEntries(wids.map((w) => [w, { visited: demo[w]?.visited }]))))
    if (!wids.length) return setState(live({}))
    const got: Record<string, Visit> = {}
    let left = new Set(wids)
    const offs = wids.map((w) =>
      onSnapshot(
        doc(db(), 'workspaces', w, 'threadReads', uid),
        (snap) => {
          const d = snap.data() as ThreadReads | undefined
          got[w] = { visited: d?.visited, tasks: d?.tasks }
          left.delete(w)
          setState({ data: { ...got }, isLoading: left.size > 0, error: null })
        },
        () => {
          got[w] = {}
          left.delete(w)
          setState({ data: { ...got }, isLoading: left.size > 0, error: null })
        },
      ),
    )
    return () => {
      offs.forEach((off) => off())
      left = new Set()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, uid])
  return state
}

// You're in it now: written on open and on leaving (a hidden tab, closing it, going elsewhere), at most once a minute.
// The rules want `seen` on a new read-marks doc, so only a first write brings an empty one (as markTasksSeen does).
const VISIT_EVERY_MS = 60_000
let lastVisit: Record<string, number> = {}
export async function markVisited(wid: string, force = false) {
  const user = firebase?.auth.currentUser
  if (!user || isDemo) return
  const now = Date.now()
  if (!force && now - (lastVisit[wid] ?? 0) < VISIT_EVERY_MS) return
  lastVisit = { ...lastVisit, [wid]: now }
  const r = doc(db(), 'workspaces', wid, 'threadReads', user.uid)
  try {
    await updateDoc(r, { visited: now, updatedAt: now })
  } catch {
    // Not there yet: the rules refuse an update with no `seen` (permission-denied, not not-found), so look first; a
    // merge with `seen: {}` on one that's there would empty its threads' read marks.
    const there = await getDoc(r).then((d) => d.exists()).catch(() => true)
    if (!there) await setDoc(r, { seen: {}, visited: now, updatedAt: now }, { merge: true }).catch(() => {})
  }
}
export function useMarkVisits(wid: string) {
  useEffect(() => {
    void markVisited(wid, true)
    const leave = () => void markVisited(wid, true)
    const onHide = () => document.hidden && leave()
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', leave)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', leave)
      leave()
    }
  }, [wid])
}

// ── The picture ───────────────────────────────────────────────────────────────────────────────────────────────────
export function useSummary(wid: string): Live<Summary | null> {
  const got = useDoc<SummaryDoc>(isDemo ? null : `workspaces/${wid}/summary/main`)
  if (isDemo) return live(demo[wid]?.summary ?? null)
  return { ...got, data: readSummary(got.data) }
}

// Kept up to date by owners and editors from what their browser has loaded: when it differs from the last written,
// at most every 5 minutes, and once on leaving (a hidden tab, closing it, going elsewhere). Viewers never write it.
const SUMMARY_EVERY_MS = 5 * 60_000
const SUMMARY_CHECK_MS = 60_000
function summaryOf(data: WorkspaceData) {
  const first = data.canvases[0]?.id ?? MAIN
  const pieces = [...piecesOn(first, data.pieces, data.spots)].sort((a, b) => a.createdAt - b.createdAt)
  return makeSummary(pieces, data.cards, data.places)
}
export function useSummaryWriter(wid: string, data: WorkspaceData, loading: boolean, editor: boolean) {
  const latest = useRef(data)
  latest.current = data
  useEffect(() => {
    const user = firebase?.auth.currentUser
    if (!editor || loading || !user || isDemo) return
    let written = ''
    let writtenAt = 0
    const keyOf = (s: ReturnType<typeof summaryOf>) => `${s.pieces}|${s.cards}`
    const write = (force: boolean) => {
      const s = summaryOf(latest.current)
      const key = keyOf(s)
      if (key === written || (!force && Date.now() - writtenAt < SUMMARY_EVERY_MS)) return
      written = key
      writtenAt = Date.now()
      const d: SummaryDoc = { by: user.uid, at: Date.now(), ...s }
      setDoc(doc(db(), 'workspaces', wid, 'summary', 'main'), d).catch(() => {})
    }
    // What's there already: written now when this browser's differs (a workspace nobody pictured yet, or changed).
    getDoc(doc(db(), 'workspaces', wid, 'summary', 'main'))
      .then((snap) => {
        const was = snap.data() as SummaryDoc | undefined
        if (was) ((written = `${was.pieces}|${was.cards}`), (writtenAt = was.at))
        write(true)
      })
      .catch(() => {})
    const timer = window.setInterval(() => write(false), SUMMARY_CHECK_MS)
    const onHide = () => document.hidden && write(true)
    const leave = () => write(true)
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', leave)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', leave)
      leave()
    }
  }, [wid, editor, loading])
}

// ── Since you left ────────────────────────────────────────────────────────────────────────────────────────────────
// Others' changes after your visit, newest first: `max` of them (20 on the continue piece, 5 on the others). Never
// visited: nothing (it would all be new).
export function useSince(wid: string, uid: string, after: number | undefined, max: number): Live<ChangeEntry[]> {
  const got = useQuery<Record<string, unknown>>(
    !isDemo && after ? query(collection(db(), 'workspaces', wid, 'changes'), where('at', '>', after), orderBy('at', 'desc'), limit(max)) : null,
    `${wid}/changes/since/${after}/${max}`,
  )
  if (isDemo) return live(demo[wid]?.since ?? [])
  const list = got.data.map(({ id, ...d }) => fromChangeDoc(id, d)).filter((e): e is ChangeEntry => !!e && e.by !== uid)
  return { ...got, data: list }
}

// What one person did, for the page's lines: their entries' kinds counted (the log holds no text, D-312).
export type SinceLine = { by: string; at: number; kinds: Record<string, number> }
export function sinceLines(list: readonly ChangeEntry[]): SinceLine[] {
  const by = new Map<string, SinceLine>()
  for (const e of list) {
    const line = by.get(e.by) ?? { by: e.by, at: e.at, kinds: {} }
    line.at = Math.max(line.at, e.at)
    for (const k of e.kinds) line.kinds[k] = (line.kinds[k] ?? 0) + Math.max(1, e.ids.filter((id) => id).length || 1)
    by.set(e.by, line)
  }
  return [...by.values()].sort((a, b) => b.at - a.at)
}

// Names for those lines: the people list's entries for just these people (≤ 10 a query).
export function useNames(wid: string, uids: readonly string[]): Record<string, string> {
  const ids = [...new Set(uids)].slice(0, 10)
  const got = useQuery<Member>(!isDemo && ids.length ? query(collection(db(), 'workspaces', wid, 'members'), where(documentId(), 'in', ids)) : null, `${wid}/members/in/${ids.join(',')}`)
  if (isDemo) return demo[wid]?.names ?? {}
  return Object.fromEntries(got.data.map((m) => [m.id, m.name]))
}

// ── New for you ───────────────────────────────────────────────────────────────────────────────────────────────────
// Tasks given to you by someone else since you last looked (D-261).
export function useNewTasks(wid: string, uid: string, seen: number | undefined): number {
  const got = useQuery<{ givenAt?: number; givenBy?: string }>(!isDemo ? query(collection(db(), 'workspaces', wid, 'tasks'), where('assignee', '==', uid)) : null, `${wid}/tasks/mine/${uid}`)
  if (isDemo) return demo[wid]?.newTasks ?? 0
  return got.data.filter((t) => (t.givenAt ?? 0) > (seen ?? 0) && t.givenBy && t.givenBy !== uid).length
}

// ── Here now ──────────────────────────────────────────────────────────────────────────────────────────────────────
// Members in it now (RTDB presence, D-065): not you, not away (D-331), heard from within a minute. Their names.
const HERE_STALE_MS = 60_000
export function useHereNow(wid: string, memberIds: readonly string[], uid: string): string[] {
  const [here, setHere] = useState<string[]>([])
  const key = memberIds.join(' ')
  useEffect(() => {
    if (isDemo) return setHere(demo[wid]?.here ?? [])
    const rtdb = firebase?.rtdb
    if (!rtdb) return
    const members = new Set(key.split(' '))
    return onValue(
      ref(rtdb, `presence/${wid}`),
      (snap) => {
        const all = (snap.val() as Record<string, Presence & { away?: boolean }> | null) ?? {}
        const now = Date.now()
        setHere(Object.entries(all).filter(([id, p]) => id !== uid && members.has(id) && !p.away && now - (p.ts ?? 0) < HERE_STALE_MS).map(([, p]) => p.name))
      },
      () => setHere([]),
    )
  }, [wid, key, uid])
  return here
}
