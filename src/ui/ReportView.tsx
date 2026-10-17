// The report screen (D-089): a research report laid out to read, over the app like the preview (D-087), with the chat
// still beside it. The answer first, a section per question with its findings and their numbered sources, what it means
// for us (our items are links to them), open questions, and the sources. Esc or close goes back; .md downloads it.
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useChat } from '../ai/chat'
import { reportMarkdown, type ReportPoint } from '../ai/research'
import { itemPath } from '../app/paths'
import { useCanvas } from '../state/canvasStore'
import { usePreview } from '../views/workspace/preview'
import { useWs } from '../views/workspace/context'
import styles from './ReportView.module.css'

const domain = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/[/?#].*$/, '')

export function ReportView() {
  const id = useChat((s) => s.reportOpen)
  const message = useChat((s) => s.messages.find((m) => m.id === s.reportOpen))
  const report = message?.report
  const ws = useWs()
  const navigate = useNavigate()
  const [host, setHost] = useState<Element | null>(null)
  useEffect(() => setHost(document.querySelector('[data-app]')), [])
  const close = () => useChat.getState().showReport(null)

  // One screen at a time: a preview opening closes the report, and the other way round.
  useEffect(() => {
    if (id === null) return
    usePreview.getState().close()
    return usePreview.subscribe((s) => s.ws && close())
  }, [id])
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
  }, [id])

  if (!report || !host || !message) return null
  const refs = message.refs
  const nameOf = (ref: string) => refs?.get(ref)?.name
  const open = (ref: string) => {
    const it = refs?.get(ref)
    if (!it) return
    close()
    useCanvas.getState().select(it.id)
    navigate(itemPath(ws.wid, it.id))
  }
  const download = () => {
    const blob = new Blob([reportMarkdown(report, ws.workspace.name, nameOf)], { type: 'text/markdown' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${report.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'report'}.md`
    a.click()
    URL.revokeObjectURL(a.href)
  }
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
    <div className={styles.screen} role="dialog" aria-label="Research report">
      <div className={styles.bar}>
        <span className={styles.kicker}>report</span>
        <span className={styles.barTitle}>{report.title}</span>
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
          {message.research?.topic || 'research'} · {report.sections.length} questions · {report.sources.length} sources
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
                <li key={j} data-inferred={p.sources.length ? undefined : true}>
                  {p.text}
                  {p.sources.length > 0 ? <span className={styles.cites}>{cite(p)}</span> : <span className={styles.inferred}>inference</span>}
                </li>
              ))}
            </ul>
          </details>
        ))}

        {report.implications.length > 0 && (
          <section className={styles.block}>
            <h2>What it means for us</h2>
            <ul className={styles.points}>
              {report.implications.map((x, i) => (
                <li key={i}>
                  {x.text}
                  {x.refs.some(nameOf) && (
                    <span className={styles.items}>
                      {x.refs.filter(nameOf).map((r) => (
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
            <h2>Open questions</h2>
            <ul className={styles.points}>
              {report.openQuestions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </section>
        )}

        <section className={styles.block}>
          <h2>Sources</h2>
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
      </article>
    </div>,
    host,
  )
}
