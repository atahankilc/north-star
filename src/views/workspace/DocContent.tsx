// What a document reads as (D-232), wherever it's shown: on its own piece, beside the documents list, in focus. A head
// (its kind's mark, who and when, its length; its title) and its content: a .md's Markdown, a report's answer and
// sections (the old report reader, D-089), or for a file what it is until Storage is live. Laid out at a width given in
// its own px; the frame round it and how it moves are the caller's.
import { memo } from 'react'
import type { WithId } from '../../data/hooks'
import { filesAvailable, type Doc, type DocBody, type DocKind } from '../../data/documents'
import { ago } from '../../ui/ago'
import { Markdown } from '../../ui/Markdown'
import styles from './DocContent.module.css'

// Each kind's mark (D-232): a square in its colour and a short name.
export const KIND_SHORT: Record<DocKind, string> = { markdown: 'md', image: 'img', pdf: 'pdf', report: 'rep' }

export function KindMark({ kind }: { kind: DocKind }) {
  return (
    <span className={styles.kind} data-kind={kind}>
      {KIND_SHORT[kind]}
    </span>
  )
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// How long it is, short: words, sections, pages, size.
export function lengthOf(d: Doc) {
  if (d.kind === 'markdown') return d.words !== undefined ? (d.words >= 1000 ? `${(d.words / 1000).toFixed(1)}k w` : `${d.words} w`) : formatSize(d.size)
  if (d.kind === 'report') return `${d.sections ?? 0} §`
  if (d.kind === 'pdf' && d.pages) return `${d.pages} p`
  return formatSize(d.size)
}

// The same, in words, for the head.
function lengthWords(d: Doc) {
  if (d.kind === 'markdown') return d.words !== undefined ? plural(d.words, 'word') : formatSize(d.size)
  if (d.kind === 'report') return [plural(d.sections ?? 0, 'section'), d.sources ? plural(d.sources, 'source') : ''].filter(Boolean).join(' · ')
  if (d.kind === 'pdf' && d.pages) return plural(d.pages, 'page')
  return [d.width && d.height ? `${d.width} × ${d.height}` : '', formatSize(d.size)].filter(Boolean).join(' · ')
}

type Props = {
  d: WithId<Doc>
  body: DocBody | null
  loading?: boolean
  // Who's looking: "you" for their own.
  me?: string
  // Followed links (in focus and beside the list; on the canvas they're only shown).
  links?: boolean
}

export const DocContent = memo(function DocContent({ d, body, loading = false, me, links = false }: Props) {
  const by = d.uid === me ? 'you' : d.name
  return (
    <article className={styles.doc}>
      <p className={styles.eyebrow}>
        <KindMark kind={d.kind} />
        <span>
          {by} · {ago(d.createdAt)} · {lengthWords(d)}
        </span>
        {!d.shared && (
          <span className={styles.private} title="only you see this until you share it">
            ◐ only you
          </span>
        )}
      </p>
      <h1 className={styles.title} data-heading="title">
        {d.title}
      </h1>
      {loading && !body ? (
        <p className={styles.note}>loading…</p>
      ) : d.kind === 'markdown' ? (
        <Markdown text={withoutTitle(body?.text ?? '', d.title)} links={links} />
      ) : d.kind === 'report' ? (
        <Report body={body ?? {}} research={d.reportKind === 'research'} links={links} />
      ) : (
        <p className={styles.note}>{filesAvailable ? 'The file shows here soon.' : 'Images and PDFs show here once files are stored (Storage, the paid plan).'}</p>
      )}
    </article>
  )
})

// A .md's first heading is its title (mdTitle), shown in the head already: not twice.
function withoutTitle(text: string, title: string) {
  const m = /^\s*#{1,6}\s+(.+?)\s*#*\s*(\n|$)/.exec(text)
  return m && m[1].trim() === title.trim() ? text.slice(m[0].length) : text
}

// A research report or a chat's write-up (D-089, D-090): its answer, a section per question with its points and their
// numbered sources, what it means for us, open questions, the sources.
function Report({ body, research, links }: { body: DocBody; research: boolean; links: boolean }) {
  const sources = body.sources ?? []
  const cite = (n: number) => {
    const s = sources[n - 1]
    if (!s) return null
    return links ? (
      <a key={n} className={styles.cite} href={s.url} target="_blank" rel="noreferrer noopener" title={s.title}>
        {n}
      </a>
    ) : (
      <span key={n} className={styles.cite} title={s.title}>
        {n}
      </span>
    )
  }
  return (
    <div className={styles.report}>
      {body.answer && <p className={styles.answer}>{body.answer}</p>}
      {(body.sections ?? []).map((s, i) => (
        <section key={i} className={styles.section}>
          <h2 className={styles.question} data-heading={i}>
            <span className={styles.num}>{String(i + 1).padStart(2, '0')}</span>
            {s.question}
          </h2>
          <ul className={styles.points}>
            {s.points.map((p, j) => (
              <li key={j} data-inferred={research && !p.sources.length ? true : undefined}>
                {p.text}
                {p.sources.length > 0 ? <span className={styles.cites}>{p.sources.map(cite)}</span> : research && <span className={styles.inferred}>inference</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {!!body.implications?.length && (
        <section className={styles.block}>
          <h2 className={styles.blockLabel}>What it means for us</h2>
          <ul className={styles.points}>
            {body.implications.map((x, i) => (
              <li key={i}>{x.text}</li>
            ))}
          </ul>
        </section>
      )}
      {!!body.openQuestions?.length && (
        <section className={styles.block}>
          <h2 className={styles.blockLabel}>Open questions</h2>
          <ul className={styles.points}>
            {body.openQuestions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </section>
      )}
      {sources.length > 0 && (
        <section className={styles.block}>
          <h2 className={styles.blockLabel}>Sources</h2>
          <ol className={styles.sources}>
            {sources.map((s, i) => (
              <li key={i}>
                <span className={styles.num}>{i + 1}</span>
                {links ? (
                  <a href={s.url} target="_blank" rel="noreferrer noopener">
                    {s.title}
                  </a>
                ) : (
                  <span>{s.title}</span>
                )}
                <span className={styles.domain}>{s.url.replace(/^https?:\/\/(www\.)?/, '').replace(/[/?#].*$/, '')}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
