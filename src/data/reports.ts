// Saved reports (D-090). A research report is saved the moment it's written, a chat's write-up when you save it; either
// way only you see it until you share it with everyone in the workspace. Sharing and deleting are undoable (history.ts);
// saving isn't a step of its own.
import { useEffect, useMemo, useRef, useState } from 'react'
import { collection, doc, getCountFromServer, getDoc, getDocs, limit, onSnapshot, orderBy, query, updateDoc, where, writeBatch, type Query } from 'firebase/firestore'
import { db, firebase } from './firebase'
import { tracked } from './history'
import { useDoc, useQuery, type WithId } from './hooks'
import { REPORT_LIMITS, type ReportBody, type ReportContent, type ReportKind, type ReportSummary, type SavedReport } from './model'

const reportsOf = (wid: string) => collection(db(), 'workspaces', wid, 'reports')
// D-098: a report is a small summary doc (listed) and its body (fetched when it's opened).
const bodyRef = (wid: string, id: string) => doc(reportsOf(wid), id, 'content', 'body')

// A new report's id, known before it's saved, so the chat can point at it at once.
export const newReportId = (wid: string) => doc(reportsOf(wid)).id

// Firestore applies the write locally at once, so the report shows while the server confirms it.
export function saveReport(wid: string, id: string, report: ReportContent, meta: { kind: ReportKind; topic: string; model: string }) {
  const user = firebase?.auth.currentUser
  if (!user) return Promise.reject(new Error('Not signed in'))
  const { title, answer, ...body } = fit(report)
  const summary: ReportSummary = {
    title,
    answer,
    sectionCount: body.sections.length,
    sourceCount: body.sources.length,
    kind: meta.kind,
    topic: meta.topic.slice(0, 500),
    model: meta.model.slice(0, 100),
    uid: user.uid,
    name: (user.displayName || user.email || 'someone').slice(0, 200),
    shared: false,
    createdAt: Date.now(),
  }
  const batch = writeBatch(db())
  batch.set(doc(reportsOf(wid), id), summary)
  batch.set(bodyRef(wid, id), body)
  return batch.commit()
}
// A report the model wrote again (research, D-089): the old copy goes, not as an undo step since you never had it.
// The body first: its rule reads the summary.
export function discardReport(wid: string, id: string) {
  const batch = writeBatch(db())
  batch.delete(bodyRef(wid, id))
  batch.delete(doc(reportsOf(wid), id))
  return batch.commit()
}
// Within the limits the rules check, whatever the model wrote.
function fit(r: ReportContent): ReportContent {
  const L = REPORT_LIMITS
  const s = (v: string, max: number) => v.slice(0, max)
  return {
    title: s(r.title, 300),
    answer: s(r.answer, L.text),
    sections: r.sections.slice(0, L.sections).map((x) => ({
      question: s(x.question, 1000),
      points: x.points.slice(0, L.points).map((p) => ({ text: s(p.text, L.text), sources: p.sources.slice(0, 20) })),
    })),
    implications: r.implications.slice(0, L.implications).map((x) => ({ text: s(x.text, L.text), items: x.items.slice(0, 20) })),
    openQuestions: r.openQuestions.slice(0, L.openQuestions).map((q) => s(q, L.text)),
    sources: r.sources.slice(0, L.sources).map((c) => ({ title: s(c.title || c.url, 500), url: s(c.url, 2000) })),
  }
}

export function shareReport(wid: string, id: string, shared: boolean) {
  const ref = doc(reportsOf(wid), id)
  return tracked(shared ? 'share report' : 'unshare report', [ref], () => updateDoc(ref, { shared }))
}

// The body first: its rule reads the summary. Undo writes both back.
export function deleteReport(wid: string, id: string) {
  const ref = doc(reportsOf(wid), id)
  const body = bodyRef(wid, id)
  return tracked('delete report', [ref, body], async () => {
    const batch = writeBatch(db())
    batch.delete(body)
    batch.delete(ref)
    await batch.commit()
  })
}

// Counts for a list row, from either shape (D-098; older reports hold everything inline).
export const sectionCount = (r: ReportSummary) => r.sectionCount ?? r.sections?.length ?? 0
export const sourceCount = (r: ReportSummary) => r.sourceCount ?? r.sources?.length ?? 0

// The reports tab's filters (D-106): what kind, whose, and who can see it.
export type ReportFilter = { kind: ReportKind | null; mine: boolean; sharing: 'any' | 'shared' | 'private' }
export const ANY_REPORTS: ReportFilter = { kind: null, mine: false, sharing: 'any' }
export const REPORTS_PAGE = 10

// What you may see under a filter, as at most two queries the rules can prove (as with the usage log, D-079) that
// never overlap: shared reports (yours or anyone's), and your own unshared ones. Reports from before `kind` existed
// are research but have no field, so a kind filter leaves them out.
function reportQueries(wid: string, uid: string | undefined, f: ReportFilter): Query[] {
  const kind = f.kind ? [where('kind', '==', f.kind)] : []
  const out: Query[] = []
  if (f.sharing !== 'private' && (!f.mine || uid))
    out.push(query(reportsOf(wid), where('shared', '==', true), ...(f.mine ? [where('uid', '==', uid)] : []), ...kind))
  if (f.sharing !== 'shared' && uid) out.push(query(reportsOf(wid), where('uid', '==', uid), where('shared', '==', false), ...kind))
  return out
}

type PageState = { key: string; lists: (WithId<ReportSummary>[] | null)[]; error: Error | null }

// One numbered page of the tab (D-106), newest first, live. Page n reads the newest n × 10 of each query and shows
// the n-th ten of them merged (Firestore has no offset; the queries don't overlap, so that's exact). The total comes
// from a count of each, taken again whenever the lists change. Only the reports tab asks for it (D-098).
export function useReportPage(wid: string, uid: string | undefined, f: ReportFilter, page: number) {
  const fkey = `${wid}:${uid ?? ''}:${f.kind ?? ''}:${f.mine}:${f.sharing}`
  const key = `${fkey}:${page}`
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const qs = useMemo(() => reportQueries(wid, uid, f), [fkey])
  const [state, setState] = useState<PageState>({ key: '', lists: [], error: null })
  const [total, setTotal] = useState<{ fkey: string; n: number } | null>(null)
  // What was on screen, kept while the next page or filter loads, so the table doesn't empty out in between.
  const shown = useRef<WithId<ReportSummary>[]>([])

  useEffect(() => {
    setState({ key, lists: qs.map(() => null), error: null })
    const offs = qs.map((q, i) =>
      onSnapshot(
        query(q, orderBy('createdAt', 'desc'), limit(page * REPORTS_PAGE)),
        (snap) =>
          setState((s) => {
            if (s.key !== key) return s
            const lists = [...s.lists]
            lists[i] = snap.docs.map((d) => ({ ...(d.data() as ReportSummary), id: d.id }))
            return { ...s, lists }
          }),
        (error) => setState((s) => (s.key === key ? { ...s, error } : s)),
      ),
    )
    return () => offs.forEach((off) => off())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // Counted again when what's listed changes (a report added, shared or deleted).
  const ready = state.key === key && state.lists.every(Boolean)
  const sig = ready ? state.lists.map((l) => l!.map((d) => d.id + d.shared).join()).join('|') : null
  useEffect(() => {
    if (sig === null) return
    let live = true
    Promise.all(qs.map((q) => getCountFromServer(q)))
      .then((counts) => live && setTotal({ fkey, n: counts.reduce((a, c) => a + c.data().count, 0) }))
      .catch(() => live && setTotal({ fkey, n: -1 }))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, fkey])

  if (ready) {
    shown.current = state.lists
      .flat()
      .filter((d): d is WithId<ReportSummary> => !!d)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice((page - 1) * REPORTS_PAGE, page * REPORTS_PAGE)
  }
  const n = total?.fkey === fkey ? total.n : null
  return {
    data: shown.current,
    // Nothing to show yet: the first load, or a filter with no rows kept from before.
    isLoading: !ready && !state.error,
    error: state.error,
    // How many match, and pages; null while counting (or -1 if counting failed: then only "next" is offered).
    total: n,
    pages: n === null || n < 0 ? null : Math.max(1, Math.ceil(n / REPORTS_PAGE)),
  }
}

// One report's summary, live (shared or not, deleted): for the report screen and the chat's report card.
export function useReportSummary(wid: string, id: string | null) {
  return useDoc<ReportSummary>(id ? `workspaces/${wid}/reports/${id}` : null)
}

// A whole report: its summary, live, and its body, fetched once when it's opened (D-098). `report` is null while
// loading and when it can't be read (not shared with you, or deleted: `missing`).
export function useReport(wid: string, id: string | null) {
  const summary = useReportSummary(wid, id)
  const inline = summary.data?.sections !== undefined
  const body = useDoc<ReportBody>(id && summary.data && !inline ? `workspaces/${wid}/reports/${id}/content/body` : null)
  const s = summary.data
  const content = s && (inline ? (s as ReportBody) : body.data)
  const report: WithId<SavedReport> | null = s && content ? { ...s, ...bodyOf(content) } : null
  return {
    report,
    summary: s,
    isLoading: !!id && (summary.isLoading || (!!s && !inline && body.isLoading)),
    missing: !!id && !summary.isLoading && (!s || !!summary.error),
  }
}

const bodyOf = (b: Partial<ReportBody>): ReportBody => ({
  sections: b.sections ?? [],
  implications: b.implications ?? [],
  openQuestions: b.openQuestions ?? [],
  sources: b.sources ?? [],
})

// Every report you may see, whole: for export. Fetched only when asked for.
export async function fetchReports(wid: string, uid: string): Promise<WithId<SavedReport>[]> {
  const [shared, mine] = await Promise.all([
    getDocs(query(reportsOf(wid), where('shared', '==', true))),
    getDocs(query(reportsOf(wid), where('uid', '==', uid))),
  ])
  const byId = new Map([...shared.docs, ...mine.docs].map((d) => [d.id, { ...(d.data() as ReportSummary), id: d.id }]))
  const whole = await Promise.all(
    [...byId.values()].map(async (s) => {
      if (s.sections !== undefined) return { ...s, ...bodyOf(s) }
      const b = await getDoc(bodyRef(wid, s.id)).catch(() => null)
      return { ...s, ...bodyOf((b?.data() as ReportBody | undefined) ?? {}) }
    }),
  )
  return whole.sort((a, b) => b.createdAt - a.createdAt)
}

// The newest few you may see, for the assistant's brief (D-090): only while the chat is open.
export function useRecentReports(wid: string, uid: string | undefined, enabled: boolean, size = 10) {
  const shared = useQuery<ReportSummary>(
    enabled ? query(reportsOf(wid), where('shared', '==', true), orderBy('createdAt', 'desc'), limit(size)) : null,
    `${wid}/reports/recent/shared/${enabled}`,
  )
  const mine = useQuery<ReportSummary>(
    enabled && uid ? query(reportsOf(wid), where('uid', '==', uid), orderBy('createdAt', 'desc'), limit(size)) : null,
    `${wid}/reports/recent/${uid}/${enabled}`,
  )
  const byId = new Map([...shared.data, ...mine.data].map((r) => [r.id, r]))
  return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, size)
}

// One report, whole, read once (D-099): for the assistant's get_report. The summary first (the body's rule reads it);
// null when it's gone or not yours to read (a private one throws permission-denied).
export async function fetchReport(wid: string, id: string): Promise<WithId<SavedReport> | null> {
  try {
    const s = await getDoc(doc(reportsOf(wid), id))
    if (!s.exists()) return null
    const summary = { ...(s.data() as ReportSummary), id: s.id }
    if (summary.sections !== undefined) return { ...summary, ...bodyOf(summary) }
    const b = await getDoc(bodyRef(wid, id))
    return { ...summary, ...bodyOf((b.data() as ReportBody | undefined) ?? {}) }
  } catch {
    return null
  }
}
