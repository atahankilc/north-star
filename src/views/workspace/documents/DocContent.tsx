// What a document reads as (D-232), wherever it's shown: on its own piece, beside the documents list, in focus. A head
// (its kind's mark, who and when, its length; its title) and its content: a .md's Markdown, a report's answer and
// sections (the old report reader, D-089), an image at its own shape, a PDF's pages (D-425; until Storage is live, what
// it is). Laid out at a width given in its own px; the frame round it and how it moves are the caller's.
import { create } from 'zustand'
import { keepLocal, readLocal } from '../../../state/local'
import { Button } from '../../../ui/primitives/Button'
import { memo, useEffect, useRef, useState, type ReactNode } from 'react'
import type { WithId } from '../../../data/hooks'
import { filesAvailable, readFile, useFileUrl, type Doc, type DocBody, type DocKind } from '../../../data/documents'
import { ago } from '../../../ui/foundation/ago'
import { Markdown } from '../../../ui/primitives/Markdown'
import styles from './DocContent.module.css'
import { numText } from '../../../ui/primitives/Rule'
import { plural } from '../../../model/words'

// Each kind's mark (D-232): a square in its colour and a short name.
const KIND_SHORT: Record<DocKind, string> = { markdown: 'md', image: 'img', pdf: 'pdf', report: 'rep' }

export function KindMark({ kind }: { kind: DocKind }) {
  return (
    <span className={styles.kind} data-kind={kind}>
      {KIND_SHORT[kind]}
    </span>
  )
}


function formatSize(bytes: number) {
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
  // Its content couldn't be read: said, never an empty page.
  failed?: boolean
  // Who's looking: "you" for their own.
  me?: string
  // Followed links (in focus and beside the list; on the canvas they're only shown).
  links?: boolean
  // Written in the app (D-373): the title's field and the page's editor in place of its title and Markdown.
  title?: ReactNode
  editor?: ReactNode
  // Who's writing in it now (D-374), at the end of its head line.
  people?: ReactNode
}

export const DocContent = memo(function DocContent({ d, body, loading = false, failed = false, me, links = false, title, editor, people }: Props) {
  const by = d.uid === me ? 'you' : d.name
  return (
    <article className={styles.doc}>
      <p className={styles.eyebrow} data-find-skip>
        <KindMark kind={d.kind} />
        <span>
          {by} · {ago(d.createdAt)} · {lengthWords(d)}
        </span>
        {!d.shared && (
          <span className={styles.private} title="only you see this until you share it">
            ◐ only you
          </span>
        )}
        {people}
      </p>
      {title ?? (
        <h1 className={styles.title} data-heading="title">
          {d.title}
        </h1>
      )}
      {loading && !body ? (
        <p className={styles.note}>loading…</p>
      ) : failed && !body ? (
        <p className={styles.note}>This document&apos;s text couldn&apos;t be read. Reload the page to try again.</p>
      ) : editor ? (
        editor
      ) : d.kind === 'markdown' ? (
        <Markdown text={splitTitle(body?.text ?? '', d.title).rest} links={links} />
      ) : d.kind === 'report' ? (
        <Report body={body ?? {}} research={d.reportKind === 'research'} links={links} />
      ) : !filesAvailable ? (
        <p className={styles.note}>Images and PDFs show here once files are stored (Storage, the paid plan).</p>
      ) : d.kind === 'image' ? (
        <FileImage d={d} />
      ) : (
        <PdfPages d={d} />
      )}
    </article>
  )
})

// An image document (D-425): at its own shape, never wider than the page; its place kept while it loads.
function FileImage({ d }: { d: WithId<Doc> }) {
  const url = useFileUrl(d.path)
  if (url === false) return <p className={styles.note}>This file couldn&apos;t be read.</p>
  return url ? (
    <img className={styles.image} src={url} alt={d.title} width={d.width} height={d.height} />
  ) : (
    <div className={styles.image} data-loading style={d.width && d.height ? { aspectRatio: `${d.width} / ${d.height}` } : undefined} />
  )
}

// A PDF document (D-425): its pages one after another at the page's width (pdf.js, loaded the first time), each drawn
// only as it comes near the screen, so a long one opens at once (a page's place is kept by its shape, read first);
// up to PDF_PAGES, past that, download it.
const PDF_PAGES = 500 // tokens-ok: how many of a PDF's pages the reader lays out
const PDF_AHEAD = '1200px' // tokens-ok: how far off the screen a page is drawn before it's reached
// The nearest box that scrolls it, else the page.
const scrollerOf = (el: HTMLElement): HTMLElement | null => {
  for (let n = el.parentElement; n; n = n.parentElement) if (/(auto|scroll)/.test(getComputedStyle(n).overflowY)) return n
  return null
}
// A PDF's pages read dark (the reader's own switch over its pages): their colours turned, white paper black, its hues
// kept; kept in this browser for every PDF.
const PDF_DARK = 'northstar.pdf.dark'
const usePdfDark = create<{ on: boolean }>(() => ({ on: readLocal(PDF_DARK) === '1' }))
const setPdfDark = (on: boolean) => (usePdfDark.setState({ on }), keepLocal(PDF_DARK, on ? '1' : '0'))

function PdfPages({ d }: { d: WithId<Doc> }) {
  const box = useRef<HTMLDivElement>(null)
  const dark = usePdfDark((s) => s.on)
  const [state, setState] = useState<'loading' | 'failed' | 'shown'>('loading')
  useEffect(() => {
    const el = box.current
    if (!el || !d.path) return void setState('failed')
    let gone = false
    let done: (() => void) | null = null
    let seen: IntersectionObserver | null = null
    setState('loading')
    void (async () => {
      try {
        const [{ openPdf, drawPage, pageRatio }, blob] = await Promise.all([import('./pdf'), readFile(d.path!)])
        const pdf = await openPdf(await blob.arrayBuffer())
        done = () => void pdf.loadingTask.destroy()
        if (gone) return
        const count = Math.min(pdf.numPages, PDF_PAGES)
        // Each page's place, its shape from its own size (the first's until it's read, which is almost always it).
        const first = await pageRatio(pdf, 1)
        const slots = Array.from({ length: count }, (_, i) => {
          const slot = document.createElement('div')
          slot.className = styles.pdfPage
          slot.style.aspectRatio = `1 / ${first}`
          slot.setAttribute('aria-label', `page ${i + 1}`)
          slot.dataset.page = String(i + 1)
          el.append(slot)
          return slot
        })
        setState('shown')
        const drawing = new Set<number>()
        seen = new IntersectionObserver(
          (entries) => {
            for (const e of entries) {
              const n = Number((e.target as HTMLElement).dataset.page)
              if (!e.isIntersecting || drawing.has(n)) continue
              drawing.add(n)
              seen?.unobserve(e.target)
              void drawPage(pdf, n, el.clientWidth || el.getBoundingClientRect().width).then(({ canvas, ratio }) => {
                if (gone) return
                const slot = slots[n - 1]
                slot.style.aspectRatio = `1 / ${ratio}`
                canvas.setAttribute('aria-hidden', 'true')
                slot.append(canvas)
              }, () => {})
            }
          },
          // Measured against what scrolls it (the reader's column), so a page ahead of the screen is drawn before it's reached.
          { root: scrollerOf(el), rootMargin: `${PDF_AHEAD} 0px` },
        )
        for (const slot of slots) seen.observe(slot)
      } catch {
        if (!gone) setState('failed')
      }
    })()
    return () => {
      gone = true
      seen?.disconnect()
      done?.()
      el.replaceChildren()
    }
  }, [d.path])
  return (
    <>
      {state === 'loading' && <p className={styles.note}>loading…</p>}
      {state === 'failed' && <p className={styles.note}>This file couldn&apos;t be read.</p>}
      {state === 'shown' && (
        <div className={styles.pdfTools}>
          <Button pressed={dark} title={dark ? 'the pages as they are' : 'the pages dark: their colours turned'} onClick={() => setPdfDark(!dark)}>
            dark pages
          </Button>
        </div>
      )}
      <div ref={box} className={styles.pdf} data-dark={dark || undefined} />
      {state === 'shown' && (d.pages ?? 0) > PDF_PAGES && <p className={styles.note}>{plural((d.pages ?? 0) - PDF_PAGES, 'more page')}: download it to read them.</p>}
    </>
  )
}

// A .md's first heading is its title (mdTitle), shown in the head already: not twice. Writing it (D-373) edits the
// rest and puts the heading back in front.
export function splitTitle(text: string, title: string) {
  const m = /^\s*#{1,6}\s+(.+?)\s*#*\s*(\n|$)/.exec(text)
  return m && m[1].trim() === title.trim() ? { head: m[0].replace(/\n?$/, '\n\n'), rest: text.slice(m[0].length).replace(/^\n+/, '') } : { head: '', rest: text }
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
            <span className={styles.num}>{numText(i + 1)}</span>
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
          <h2 className={styles.blockLabel} data-heading="block">What it means for us</h2>
          <ul className={styles.points}>
            {body.implications.map((x, i) => (
              <li key={i}>{x.text}</li>
            ))}
          </ul>
        </section>
      )}
      {!!body.openQuestions?.length && (
        <section className={styles.block}>
          <h2 className={styles.blockLabel} data-heading="block">Open questions</h2>
          <ul className={styles.points}>
            {body.openQuestions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </section>
      )}
      {sources.length > 0 && (
        <section className={styles.block}>
          <h2 className={styles.blockLabel} data-heading="block">Sources</h2>
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
