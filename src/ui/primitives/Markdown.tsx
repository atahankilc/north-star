// Markdown as a document reads it (D-232): headings (# to ######), paragraphs, bullet and numbered lists (nested by
// indent), task boxes, block quotes, fenced code, rules and pipe tables; inside a line `**bold**`, `*italic*`,
// `~~struck~~`, `` `code` ``, links and images. Nothing is ever put in as HTML (raw tags show as text), and nothing is
// fetched: an image shows as its alt text in brackets, a link as underlined text, followed only where `links` is on
// (http, https and mailto, in a new tab). `LightMarkdown` is the canvas text's smaller set (D-156).
import { Fragment, memo, type ReactNode } from 'react'
import styles from './Markdown.module.css'

export type Heading = { level: number; text: string; index: number }

type Block =
  | { t: 'h'; level: number; text: string }
  | { t: 'p'; text: string }
  | { t: 'code'; lang: string; text: string }
  | { t: 'quote'; blocks: Block[] }
  | { t: 'list'; ordered: boolean; start: number; items: { text: string; depth: number; task?: boolean; done?: boolean }[] }
  | { t: 'table'; head: string[]; align: ('left' | 'center' | 'right' | null)[]; rows: string[][] }
  | { t: 'hr' }

const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/
const FENCE = /^\s{0,3}(```|~~~)\s*([\w+-]*)/
const ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/

const cellsOf = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())

export function parse(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  const out: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }
    const fence = FENCE.exec(line)
    if (fence) {
      const body: string[] = []
      i++
      while (i < lines.length && !lines[i].trimStart().startsWith(fence[1])) body.push(lines[i++])
      i++
      out.push({ t: 'code', lang: fence[2], text: body.join('\n') })
      continue
    }
    const h = HEADING.exec(line)
    if (h) {
      out.push({ t: 'h', level: h[1].length, text: h[2] })
      i++
      continue
    }
    if (RULE.test(line)) {
      out.push({ t: 'hr' })
      i++
      continue
    }
    if (/^\s{0,3}>/.test(line)) {
      const body: string[] = []
      while (i < lines.length && /^\s{0,3}>/.test(lines[i])) body.push(lines[i++].replace(/^\s{0,3}>\s?/, ''))
      out.push({ t: 'quote', blocks: parse(body.join('\n')) })
      continue
    }
    if (line.includes('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1])) {
      const head = cellsOf(line)
      const align = cellsOf(lines[i + 1]).map((c) => (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : c.startsWith(':') ? 'left' : null))
      const rows: string[][] = []
      i += 2
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(cellsOf(lines[i++]))
      out.push({ t: 'table', head, align, rows })
      continue
    }
    const item = ITEM.exec(line)
    if (item) {
      const ordered = /\d/.test(item[2])
      const items: { text: string; depth: number; task?: boolean; done?: boolean }[] = []
      const base = item[1].length
      while (i < lines.length) {
        const m = ITEM.exec(lines[i])
        if (m) {
          const task = /^\[([ xX])\]\s+(.*)$/.exec(m[3])
          items.push({ text: task ? task[2] : m[3], depth: Math.min(4, Math.max(0, Math.floor((m[1].length - base) / 2))), ...(task ? { task: true, done: task[1] !== ' ' } : {}) })
          i++
        } else if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length) {
          // A line carried on under an item.
          items[items.length - 1].text += ` ${lines[i++].trim()}`
        } else break
      }
      out.push({ t: 'list', ordered, start: ordered ? parseInt(item[2], 10) : 1, items })
      continue
    }
    // A paragraph: lines up to a blank one or the start of another block.
    const body: string[] = []
    while (i < lines.length && lines[i].trim() && !HEADING.test(lines[i]) && !FENCE.test(lines[i]) && !RULE.test(lines[i]) && !/^\s{0,3}>/.test(lines[i]) && !(body.length && ITEM.test(lines[i]))) body.push(lines[i++].trim())
    out.push({ t: 'p', text: body.join(' ') })
  }
  return out
}

const INLINE = /(`[^`]+`|!\[[^\]]*\]\([^)\s]*\)|\[[^\]]+\]\([^)\s]+\)|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*\s][^*]*\*|_[^_\s][^_]*_|https?:\/\/[^\s<>()]+)/g
const SAFE = /^(https?:|mailto:)/i

function inline(line: string, links: boolean, key = 0): ReactNode[] {
  const out: ReactNode[] = []
  let at = 0
  for (const m of line.matchAll(INLINE)) {
    if (m.index! > at) out.push(line.slice(at, m.index))
    const t = m[0]
    const k = `${key}-${m.index}`
    if (t.startsWith('`')) out.push(<code key={k}>{t.slice(1, -1)}</code>)
    else if (t.startsWith('![')) out.push(<span key={k} className={styles.image}>[{t.slice(2, t.indexOf('](')) || 'image'}]</span>)
    else if (t.startsWith('[') || /^https?:/.test(t)) {
      const text = t.startsWith('[') ? t.slice(1, t.indexOf('](')) : t
      const url = t.startsWith('[') ? t.slice(t.indexOf('](') + 2, -1) : t
      out.push(
        links && SAFE.test(url) ? (
          <a key={k} className={styles.link} href={url} target="_blank" rel="noreferrer noopener">
            {inline(text, false, m.index)}
          </a>
        ) : (
          <span key={k} className={styles.link} title={url}>
            {inline(text, false, m.index)}
          </span>
        ),
      )
    } else if (t.startsWith('**') || t.startsWith('__')) out.push(<strong key={k}>{inline(t.slice(2, -2), links, m.index)}</strong>)
    else if (t.startsWith('~~')) out.push(<s key={k}>{t.slice(2, -2)}</s>)
    else out.push(<em key={k}>{inline(t.slice(1, -1), links, m.index)}</em>)
    at = m.index! + t.length
  }
  if (at < line.length) out.push(line.slice(at))
  return out
}

function Blocks({ blocks, links, counter }: { blocks: Block[]; links: boolean; counter: { n: number } }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.t) {
          case 'h': {
            const n = counter.n++
            const H = `h${Math.min(b.level, 4)}` as 'h1'
            return (
              <H key={i} className={styles[`h${Math.min(b.level, 4)}`]} data-heading={n}>
                {inline(b.text, links)}
              </H>
            )
          }
          case 'p':
            return <p key={i}>{inline(b.text, links)}</p>
          case 'code':
            return (
              <pre key={i} className={styles.code} data-lang={b.lang || undefined}>
                <code>{b.text}</code>
              </pre>
            )
          case 'quote':
            return (
              <blockquote key={i} className={styles.quote}>
                <Blocks blocks={b.blocks} links={links} counter={counter} />
              </blockquote>
            )
          case 'hr':
            return <hr key={i} className={styles.rule} />
          case 'table':
            return (
              <div key={i} className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      {b.head.map((c, j) => (
                        <th key={j} style={{ textAlign: b.align[j] ?? undefined }}>
                          {inline(c, links)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j}>
                        {b.head.map((_, k) => (
                          <td key={k} style={{ textAlign: b.align[k] ?? undefined }}>
                            {inline(r[k] ?? '', links)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          case 'list': {
            let n = b.start
            return (
              <div key={i} className={styles.list}>
                {b.items.map((it, j) => (
                  <Fragment key={j}>
                    <p className={styles.item} style={{ marginLeft: `${it.depth * 1.4}em` }} data-mark={it.task ? (it.done ? '☒' : '☐') : b.ordered && it.depth === 0 ? `${n++}.` : it.depth ? '◦' : '–'} data-done={it.done || undefined}>
                      {inline(it.text, links)}
                    </p>
                  </Fragment>
                ))}
              </div>
            )
          }
        }
      })}
    </>
  )
}

// `links`: followed on click (in focus); on the canvas they're only shown.
export const Markdown = memo(function Markdown({ text, links = false }: { text: string; links?: boolean }) {
  return (
    <div className={styles.md}>
      <Blocks blocks={parse(text)} links={links} counter={{ n: 0 }} />
    </div>
  )
})
