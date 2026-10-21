// Light Markdown (the chat's, D-089; paragraphs and sticky notes, D-156, D-158): a blank line starts a new paragraph, a
// line starting `- ` or `* ` is a bullet, `1. ` a numbered one; inside a line `**bold**`, `*italic*` or `_italic_`,
// `` `code` `` and `[text](url)`, shown as the text, underlined.
import { Fragment, type ReactNode } from 'react'
import styles from './LightMarkdown.module.css'

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g

function inline(line: string): ReactNode[] {
  const out: ReactNode[] = []
  let at = 0
  for (const m of line.matchAll(INLINE)) {
    if (m.index! > at) out.push(line.slice(at, m.index))
    const t = m[0]
    const k = m.index!
    if (t.startsWith('**')) out.push(<strong key={k}>{t.slice(2, -2)}</strong>)
    else if (t.startsWith('`')) out.push(<code key={k}>{t.slice(1, -1)}</code>)
    else if (t.startsWith('[')) out.push(<span key={k} className={styles.link}>{t.slice(1, t.indexOf(']('))}</span>)
    else out.push(<em key={k}>{t.slice(1, -1)}</em>)
    at = k + t.length
  }
  if (at < line.length) out.push(line.slice(at))
  return out
}

// `mark`: what a bullet line hangs in the margin (text on the canvas uses the old board's `•`).
export function LightMarkdown({ text, mark = '–' }: { text: string; mark?: string }) {
  return (
    <div className={styles.md}>
      {text.split('\n').map((raw, i) => {
        const line = raw.trimEnd()
        if (!line.trim()) return <div key={i} className={styles.gap} />
        const bullet = /^\s*[-*•]\s+(.*)$/.exec(line)
        if (bullet) return <p key={i} className={styles.item} data-mark={mark}>{inline(bullet[1])}</p>
        const num = /^\s*(\d{1,3})[.)]\s+(.*)$/.exec(line)
        if (num) return <p key={i} className={styles.item} data-mark={`${num[1]}.`}>{inline(num[2])}</p>
        return <Fragment key={i}><p className={styles.p}>{inline(line)}</p></Fragment>
      })}
    </div>
  )
}
