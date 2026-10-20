// A report laid out to read (D-089): the answer first, a section per question with its findings and their numbered
// sources, what it means for us (our items are links to them), open questions, and the sources. Shared by the report
// page in the reports tab and the assistant's report on its stage (ReportView); the frame around it is theirs.
import type { HTMLAttributes } from 'react'
import { reportMarkdown, type Report, type ReportPoint } from '../../ai/research'
import type { ReportKind } from '../../data/model'
import styles from './ReportDocument.module.css'

const domain = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/[/?#].*$/, '')
export const day = (t: number) => new Date(t).toLocaleDateString('en-CA')
const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

type Props = {
  report: Report
  kind?: ReportKind
  topic?: string
  // Who wrote it ("you" or a name) and when it was saved, if it was.
  who: string
  createdAt?: number
  nameOf: (item: string) => string | undefined
  onItem: (item: string) => void
  // On the stage (D-101): the section lit from the chat or the stepper, and what hovering one does.
  lit?: number | null
  sectionProps?: (i: number) => HTMLAttributes<HTMLElement>
}

export function ReportDocument({ report, kind = 'research', topic, who, createdAt, nameOf, onItem, lit, sectionProps }: Props) {
  // A chat write-up (D-090) or an uploaded file (D-091) has headings, not questions, and no inferences to mark.
  const research = kind === 'research'
  const cite = (p: ReportPoint) =>
    p.sources.map((n) => {
      const s = report.sources[n - 1]
      return (
        <a key={n} className={styles.cite} href={s.url} target="_blank" rel="noreferrer" title={`${s.title} · ${domain(s.url)}`}>
          {n}
        </a>
      )
    })

  return (
    <article className={styles.doc}>
      <h1 className={styles.title}>{report.title}</h1>
      <p className={styles.meta}>
        {research ? topic || 'research' : kind === 'upload' ? `uploaded ${topic ?? ''}` : 'from a chat'} · by {who}
        {createdAt !== undefined && ` · ${day(createdAt)}`} · {count(report.sections.length, research ? 'question' : 'section')}
        {report.sources.length > 0 && ` · ${count(report.sources.length, 'source')}`}
      </p>
      <p className={styles.answer}>{report.answer}</p>

      {report.sections.map((s, i) => (
        <details key={i} className={styles.section} open data-report-section={i} data-lit={lit === i || undefined} {...sectionProps?.(i)}>
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
        <section className={styles.block} data-report-block="implications">
          <h2 className={styles.blockLabel}>What it means for us</h2>
          <ul className={styles.points}>
            {report.implications.map((x, i) => (
              <li key={i}>
                {x.text}
                {x.items.some(nameOf) && (
                  <span className={styles.items}>
                    {x.items.filter(nameOf).map((r) => (
                      <button key={r} className={styles.item} data-nav onClick={() => onItem(r)} title="Show it on the board">
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
        <section className={styles.block} data-report-block="questions">
          <h2 className={styles.blockLabel}>Open questions</h2>
          <ul className={styles.points}>
            {report.openQuestions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </section>
      )}

      {report.sources.length > 0 && (
        <section className={styles.block} data-report-block="sources">
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
  )
}

// The same structure as Markdown, with numbered sources (D-089); uploads back identical (D-091).
export function downloadReport(report: Report, workspace: string, nameOf: (item: string) => string | undefined, createdAt?: number) {
  const blob = new Blob([reportMarkdown(report, workspace, nameOf, createdAt !== undefined ? day(createdAt) : undefined)], { type: 'text/markdown' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${report.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'report'}.md`
  a.click()
  URL.revokeObjectURL(a.href)
}
