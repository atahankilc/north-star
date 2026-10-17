// Saved reports (D-090). A research report is saved the moment it's written, a chat's write-up when you save it; either
// way only you see it until you share it with everyone in the workspace. Sharing and deleting are undoable (history.ts);
// saving isn't a step of its own.
import { collection, deleteDoc, doc, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { useMemo } from 'react'
import { db, firebase } from './firebase'
import { tracked } from './history'
import { useQuery, type WithId } from './hooks'
import { REPORT_LIMITS, type ReportContent, type ReportKind, type SavedReport } from './model'

const reportsOf = (wid: string) => collection(db(), 'workspaces', wid, 'reports')

// A new report's id, known before it's saved, so the chat can point at it at once.
export const newReportId = (wid: string) => doc(reportsOf(wid)).id

// Firestore applies the write locally at once, so the report shows while the server confirms it.
export function saveReport(wid: string, id: string, report: ReportContent, meta: { kind: ReportKind; topic: string; model: string }) {
  const user = firebase?.auth.currentUser
  if (!user) return Promise.reject(new Error('Not signed in'))
  const saved: SavedReport = {
    ...fit(report),
    kind: meta.kind,
    topic: meta.topic.slice(0, 500),
    model: meta.model.slice(0, 100),
    uid: user.uid,
    name: (user.displayName || user.email || 'someone').slice(0, 200),
    shared: false,
    createdAt: Date.now(),
  }
  return setDoc(doc(reportsOf(wid), id), saved)
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

export function deleteReport(wid: string, id: string) {
  const ref = doc(reportsOf(wid), id)
  return tracked('delete report', [ref], () => deleteDoc(ref))
}

// What you may see: everything shared, and your own. Two queries, since the rules only allow lists they can prove
// (as with the usage log, D-079). Newest first.
export function useReports(wid: string, uid: string | undefined) {
  const shared = useQuery<SavedReport>(query(reportsOf(wid), where('shared', '==', true)), `${wid}/reports/shared`)
  const mine = useQuery<SavedReport>(uid ? query(reportsOf(wid), where('uid', '==', uid)) : null, `${wid}/reports/${uid}`)
  const data = useMemo(() => {
    const byId = new Map<string, WithId<SavedReport>>()
    for (const r of [...shared.data, ...mine.data]) byId.set(r.id, r)
    return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt)
  }, [shared.data, mine.data])
  return { data, error: shared.error ?? mine.error }
}
