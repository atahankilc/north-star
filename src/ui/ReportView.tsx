// The report screen (D-089): a report (research, or a chat's write-up, D-090) laid out to read, over the app like the
// preview (D-087), with the chat still beside it. The answer first, a section per question with its findings and their numbered sources, what it means
// for us (our items are links to them), open questions, and the sources. Esc or close goes back; .md downloads it.
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { useChat } from '../ai/chat'
import { reportMarkdown, type ReportPoint } from '../ai/research'
import { deleteReport, shareReport } from '../data/reports'
import { firebase } from '../data/firebase'
import { useHistory } from '../data/history'
import { useCanvas } from '../state/canvasStore'
import { usePreview } from '../views/workspace/preview'
import { useStage } from '../views/workspace/stage'
import { useWs } from '../views/workspace/context'
import { useNodeIndex } from '../views/workspace/nodeIndex'
import { UNDO_HINT } from '../views/workspace/useEditKeys'
import styles from './ReportView.module.css'

const domain = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/[/?#].*$/, '')
const day = (t: number) => new Date(t).toLocaleDateString('en-CA')
const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function ReportView() {
  // The report on the stage (D-094); `asked` is the one asked for, which the stage follows once the app has made way.
  const id = useStage((s) => s.reportId)
  const asked = useChat((s) => s.reportOpen)
  const ws = useWs()
  // The saved copy (D-090); until it arrives, or if saving failed, the chat's own.
  const saved = ws.reports.find((r) => r.id === id)
  const message = useChat((s) => (id ? s.messages.find((m) => m.reportId === id) : undefined))
  const report = saved ?? message?.report
  const index = useNodeIndex()
  const navigate = useNavigate()
  const location = useLocation()
  const [host, setHost] = useState<Element | null>(null)
  useEffect(() => setHost(document.querySelector('[data-app]')), [])
  // A link to a report (`?report=`) stops pointing at it once it's closed.
  const close = () => {
    useChat.getState().showReport(null)
    const params = new URLSearchParams(location.search)
    if (params.has('report')) {
      params.delete('report')
      navigate({ pathname: location.pathname, search: params.toString() }, { replace: true })
    }
  }

  // One screen at a time: a preview opening closes the report, and the other way round.
  useEffect(() => {
    if (asked === null) return
    usePreview.getState().close()
    return usePreview.subscribe((s) => s.ws && useChat.getState().showReport(null))
  }, [asked])
  useEffect(() => {
    if (id === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopImmediatePropagation()
      close()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  if (!report || !host || id === null) return null
  const me = firebase?.auth.currentUser?.uid
  const mine = !!saved && saved.uid === me
  const isOwner = ws.workspace.ownerId === me
  const nameOf = (item: string) => index.get(item)?.title
  const open = (item: string) => {
    const it = index.get(item)
    if (!it) return
    close()
    useCanvas.getState().select(item)
    navigate(it.path)
  }
  const download = () => {
    const blob = new Blob([reportMarkdown(report, ws.workspace.name, nameOf, saved && day(saved.createdAt))], { type: 'text/markdown' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${report.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'report'}.md`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const remove = () => {
    if (!saved) return
    close()
    deleteReport(ws.wid, saved.id).catch(() => useHistory.getState().say("Couldn't delete the report"))
    useHistory.getState().say(`Deleted "${report.title}" · ${UNDO_HINT} to undo`)
  }
  const topic = saved?.topic ?? message?.reportMeta?.topic
  // A chat write-up (D-090) or an uploaded file (D-091) has headings, not questions, and no inferences to mark.
  const kind = saved?.kind ?? message?.reportMeta?.kind ?? 'research'
  const research = kind === 'research'
  const unsaved = !saved && message && !message.research
  const who = saved ? (mine ? 'you' : saved.name) : 'you'
  const status = saved
    ? saved.shared
      ? 'shared with the workspace'
      : 'only you can see it'
    : message?.reportError
      ? `not saved: ${message.reportError}`
      : unsaved
        ? 'not saved yet'
        : 'saving…'
  const cite = (p: ReportPoint) =>
    p.sources.map((n) => {
      const s = report.sources[n - 1]
      return (
        <a key={n} className={styles.cite} href={s.url} target="_blank" rel="noreferrer" title={`${s.title} · ${domain(s.url)}`}>
          {n}
        </a>
      )
    })

  return createPortal(
    <div className={styles.screen} role="dialog" aria-label="Report">
      <div className={styles.bar}>
        <span className={styles.kicker}>report</span>
        <span className={styles.barTitle}>{report.title}</span>
        <span className={styles.status} data-shared={saved?.shared || undefined} data-error={(!saved && !!message?.reportError) || undefined}>
          {status}
        </span>
        {unsaved && (
          <button className={styles.action} data-tone="primary" onClick={() => useChat.getState().keepReport(message.id)}>
            save to reports
          </button>
        )}
        {mine && (
          <button className={styles.action} onClick={() => void shareReport(ws.wid, saved.id, !saved.shared)}>
            {saved.shared ? 'unshare' : 'share'}
          </button>
        )}
        {saved && (mine || (isOwner && saved.shared)) && (
          <button className={styles.action} data-tone="danger" onClick={remove}>
            delete
          </button>
        )}
        <button className={styles.action} onClick={download}>
          download .md
        </button>
        <button className={styles.action} onClick={close} aria-label="Close the report">
          close · esc
        </button>
      </div>
      <article className={styles.page}>
        <h1 className={styles.title}>{report.title}</h1>
        <p className={styles.meta}>
          {research ? topic || 'research' : kind === 'upload' ? `uploaded ${topic ?? ''}` : 'from a chat'} · by {who}
          {saved && ` · ${day(saved.createdAt)}`} · {count(report.sections.length, research ? 'question' : 'section')}
          {report.sources.length > 0 && ` · ${count(report.sources.length, 'source')}`}
        </p>
        <p className={styles.answer}>{report.answer}</p>

        {report.sections.map((s, i) => (
          <details key={i} className={styles.section} open>
            <summary>
              <span className={styles.num}>{String(i + 1).padStart(2, '0')}</span>
              {s.question}
            </summary>
            <ul className={styles.points}>
              {s.points.map((p, j) => (
                <li key={j} data-inferred={research && !p.sources.length ? true : undefined}>
                  {p.text}
                  {p.sources.length > 0 ? (
                    <span className={styles.cites}>{cite(p)}</span>
                  ) : (
                    research && <span className={styles.inferred}>inference</span>
                  )}
                </li>
              ))}
            </ul>
          </details>
        ))}

        {report.implications.length > 0 && (
          <section className={styles.block}>
            <h2 className={styles.blockLabel}>What it means for us</h2>
            <ul className={styles.points}>
              {report.implications.map((x, i) => (
                <li key={i}>
                  {x.text}
                  {x.items.some(nameOf) && (
                    <span className={styles.items}>
                      {x.items.filter(nameOf).map((r) => (
                        <button key={r} className={styles.item} onClick={() => open(r)} title="Show it on the board">
                          {nameOf(r)}
                        </button>
                      ))}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {report.openQuestions.length > 0 && (
          <section className={styles.block}>
            <h2 className={styles.blockLabel}>Open questions</h2>
            <ul className={styles.points}>
              {report.openQuestions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </section>
        )}

        {report.sources.length > 0 && (
          <section className={styles.block}>
            <h2 className={styles.blockLabel}>Sources</h2>
            <ol className={styles.sources}>
              {report.sources.map((s, i) => (
                <li key={s.url}>
                  <span className={styles.num}>{i + 1}</span>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.title}
                  </a>
                  <span className={styles.domain}>{domain(s.url)}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </article>
    </div>,
    host,
  )
}
