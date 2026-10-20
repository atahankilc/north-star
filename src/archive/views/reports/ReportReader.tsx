// The reports tab's reader (D-102, D-106): the report picked in the table, on its right. A bar of the report's own
// actions on top (who can see it, share, delete, download, close; Esc closes too), the report at a readable measure, and beside it an outline ("on this page") that follows your
// scrolling and jumps to a part. Whatever is in the tab opens here: an upload (D-091), a report saved from a chat,
// someone's shared one; only a report the chat itself just wrote goes on the assistant's stage (ReportView, D-101).
// Its body loads only now (D-098).
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { workspacePath } from '../../app/paths'
import { firebase } from '../../data/firebase'
import { useHistory } from '../../data/history'
import { deleteReport, shareReport, useReport } from '../../data/reports'
import { isOwnerOf } from '../../data/workspaces'
import { useCanvas } from '../../state/canvasStore'
import { isReducedMotion } from '../../state/motion'
import { Loading } from '../../ui/Loading'
import { useWs } from '../workspace/context'
import { useNodeIndex } from '../workspace/nodeIndex'
import { UNDO_HINT } from '../workspace/useEditKeys'
import { downloadReport, ReportDocument } from './ReportDocument'
import styles from './ReportReader.module.css'

// The outline's entries: each section, then the blocks the report has.
type Part = { key: string; num?: string; label: string; selector: string }

export function ReportReader({ id, onClose }: { id: string; onClose: () => void }) {
  const ws = useWs()
  const navigate = useNavigate()
  const index = useNodeIndex()
  const { report, summary, isLoading, missing } = useReport(ws.wid, id)
  const me = firebase?.auth.currentUser?.uid
  const list = workspacePath(ws.wid, 'reports')
  const scroller = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState(0)

  const parts: Part[] = report
    ? [
        ...report.sections.map((s, i) => ({ key: `s${i}`, num: String(i + 1).padStart(2, '0'), label: s.question, selector: `[data-report-section="${i}"]` })),
        ...(report.implications.length ? [{ key: 'implications', label: 'What it means for us', selector: '[data-report-block="implications"]' }] : []),
        ...(report.openQuestions.length ? [{ key: 'questions', label: 'Open questions', selector: '[data-report-block="questions"]' }] : []),
        ...(report.sources.length ? [{ key: 'sources', label: 'Sources', selector: '[data-report-block="sources"]' }] : []),
      ]
    : []

  // Which part you're reading: the last one whose top has passed the top of the reader.
  const spy = () => {
    const box = scroller.current
    if (!box) return
    const top = box.getBoundingClientRect().top + 96
    let now = 0
    parts.forEach((p, i) => {
      const el = box.querySelector(p.selector)
      if (el && el.getBoundingClientRect().top <= top) now = i
    })
    // At the very bottom, the last part (it may be too short to reach the top).
    if (box.scrollTop + box.clientHeight >= box.scrollHeight - 4) now = parts.length - 1
    setAt(now)
  }
  // A new report starts at its top.
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 })
    setAt(0)
  }, [id])

  const jump = (p: Part) => {
    const el = scroller.current?.querySelector<HTMLElement>(p.selector)
    if (!el) return
    if (el instanceof HTMLDetailsElement) el.open = true
    el.scrollIntoView({ block: 'start', behavior: isReducedMotion() ? 'auto' : 'smooth' })
  }

  // Esc closes it, unless you're typing or a menu or dialog has the key.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, select, [contenteditable="true"], [role="menu"], dialog')) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // On phones the reader takes the whole frame, so closing reads as going back to the table.
  const back = (
    <button className={styles.back} data-nav onClick={onClose}>
      ← reports
    </button>
  )
  const close = (
    <button className={styles.close} data-nav onClick={onClose} aria-label="Close the report" title="close · esc">
      ×
    </button>
  )

  if (!report)
    return (
      <div className={styles.reader}>
        <div className={styles.bar}>
          {back}
          <span className={styles.status} />
          {close}
        </div>
        <div className={styles.waiting}>
          {isLoading ? (
            <>
              {summary && <h1 className={styles.title}>{summary.title}</h1>}
              <Loading label="loading the report…" />
            </>
          ) : (
            missing && <p className={styles.note}>! That report isn&apos;t shared with you, or it was deleted.</p>
          )}
        </div>
      </div>
    )

  const mine = report.uid === me
  const nameOf = (item: string) => index.get(item)?.title
  const onItem = (item: string) => {
    const it = index.get(item)
    if (!it) return
    useCanvas.getState().select(item)
    navigate(it.path)
  }
  const remove = () => {
    navigate(list, { replace: true })
    deleteReport(ws.wid, report.id).catch(() => useHistory.getState().say("Couldn't delete the report"))
    useHistory.getState().say(`Deleted "${report.title}" · ${UNDO_HINT} to undo`)
  }

  return (
    <div className={styles.reader}>
      <div className={styles.bar}>
        {back}
        <span className={styles.status} data-shared={report.shared || undefined}>
          {report.shared ? 'shared with the workspace' : 'only you can see it'}
        </span>
        {mine && (
          <button className={styles.action} onClick={() => void shareReport(ws.wid, report.id, !report.shared)}>
            {report.shared ? 'unshare' : 'share'}
          </button>
        )}
        {(mine || (isOwnerOf(ws.workspace, me) && report.shared)) && (
          <button className={styles.action} data-tone="danger" onClick={remove}>
            delete
          </button>
        )}
        <button className={styles.action} onClick={() => downloadReport(report, ws.workspace.name, nameOf, report.createdAt)}>
          download .md
        </button>
        {close}
      </div>
      <div className={styles.scroll} ref={scroller} onScroll={spy}>
        <div className={styles.columns}>
          <ReportDocument
            report={report}
            kind={report.kind}
            topic={report.topic}
            who={mine ? 'you' : report.name}
            createdAt={report.createdAt}
            nameOf={nameOf}
            onItem={onItem}
          />
          {parts.length > 1 && (
            <nav className={styles.outline} aria-label="On this page">
              <span className={styles.outlineLabel}>on this page</span>
              <ol>
                {parts.map((p, i) => (
                  <li key={p.key}>
                    <button data-nav data-at={i === at || undefined} onClick={() => jump(p)}>
                      {p.num && <span className={styles.num}>{p.num}</span>}
                      <span className={styles.part}>{p.label}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
          )}
        </div>
      </div>
    </div>
  )
}
