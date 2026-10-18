// Saved reports (D-090). A research report is saved the moment it's written, a chat's write-up when you save it; either
// way only you see it until you share it with everyone in the workspace. Sharing and deleting are undoable (history.ts);
// saving isn't a step of its own.
import { collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc, where, writeBatch } from 'firebase/firestore'
import { db, firebase } from './firebase'
import { tracked } from './history'
import { useDoc, usePaged, useQuery, type WithId } from './hooks'
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

// What you may see, newest first, a page at a time: everything shared, and your own. Two queries, since the rules
// only allow lists they can prove (as with the usage log, D-079). Only the reports tab asks for it (D-098).
export function useReportList(wid: string, uid: string | undefined, size = 20) {
  return usePaged<ReportSummary>(
    [query(reportsOf(wid), where('shared', '==', true)), uid ? query(reportsOf(wid), where('uid', '==', uid)) : null],
    `reports:${wid}:${uid ?? ''}`,
    'createdAt',
    'desc',
    size,
  )
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
