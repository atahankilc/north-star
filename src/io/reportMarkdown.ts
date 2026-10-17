// A report from a Markdown file (D-091): what someone wrote elsewhere, uploaded to the reports tab. Read into the same
// shape as the assistant's reports (D-089), so it shows on the report screen and a North Star `.md` download comes back
// as it was. Light on purpose: headings, paragraphs, lists, quotes and links; anything else is kept as plain text.
//   # Title                    → the title (else the file name)
//   text before the first ##   → the answer (the gist)
//   ## Heading                 → a section; its list items and paragraphs are its points
//   ## What it means for us    → implications;  ## Open questions → open questions;  ## Sources → numbered sources
//   [n] in a point             → cites source n;  [text](url) → the text, citing that URL
import type { ReportContent } from '../data/model'

export const REPORT_FILE_MAX = 512 * 1024

type Part = 'intro' | 'section' | 'implications' | 'open' | 'sources'
type Raw = { text: string; nums: number[]; links: { title: string; url: string }[] }

const LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g
const CITE = /\[(\d{1,3})\]/g
const BARE_URL = /https?:\/\/[^\s)>\]]+/

function classify(heading: string): Part {
  const h = heading.toLowerCase().replace(/[^a-z ]/g, '').trim()
  if (/^(what it means|implications|for us|next steps)/.test(h)) return 'implications'
  if (/^open questions?/.test(h)) return 'open'
  if (/^(sources|references|links)$/.test(h)) return 'sources'
  return 'section'
}

// Markdown marks that would show as noise in plain text.
const plain = (s: string) =>
  s
    .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, '$1$2')
    .replace(/(^|\s)[*_]([^*_]+)[*_](?=\s|$|[.,;:!?])/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()

// A link in parentheses on its own, `(see [page](url))`, is a citation: it goes, its URL is cited.
const CITED_LINK = /\s*\((?:[^()[\]]*\s)?\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)\)/g

function raw(text: string): Raw {
  const links: Raw['links'] = []
  const nums: number[] = []
  const link = (_: string, label: string, url: string) => {
    links.push({ title: plain(label), url })
    return ''
  }
  let t = text.replace(CITED_LINK, link).replace(LINK, (m: string, label: string, url: string) => `${label}${link(m, label, url)}`)
  t = t.replace(CITE, (_, n: string) => {
    nums.push(Number(n))
    return ''
  })
  return { text: plain(t).replace(/\s+([.,;:!?])/g, '$1'), nums, links }
}

// `itemId`: our item with this exact title, if any. An implication ending in `(Name, Name)` (how a download lists our
// items) points at them again when every name is one.
export function parseReportMarkdown(md: string, fileName: string, itemId: (title: string) => string | undefined = () => undefined): ReportContent | null {
  const lines = md.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n')
  let title = ''
  let part: Part = 'intro'
  const intro: string[] = []
  const sections: { question: string; points: Raw[] }[] = []
  const implications: Raw[] = []
  const open: Raw[] = []
  const listed: { title: string; url: string }[] = []
  let para: string[] = []
  let fence = false

  const add = (text: string) => {
    if (!text.trim()) return
    if (part === 'intro') return void intro.push(text)
    if (part === 'section') return void sections[sections.length - 1].points.push(raw(text))
    if (part === 'implications') return void implications.push(raw(text))
    if (part === 'open') return void open.push(raw(text))
    // Sources: `[title](url)`, or a bare URL with whatever text is around it as its title.
    const link = [...text.matchAll(LINK)][0]
    const url = link?.[2] ?? text.match(BARE_URL)?.[0]
    if (url) listed.push({ url, title: plain(link?.[1] ?? text.replace(url, '').replace(/^[\s:–—-]+|[\s:–—-]+$/g, '')) || url })
  }
  // A list item takes the lines that follow it (indented or not) until a blank line, like Markdown.
  let inItem = false
  const flush = () => {
    if (para.length) add(para.join(' '))
    para = []
    inItem = false
  }

  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      flush()
      fence = !fence
      continue
    }
    if (fence) {
      para.push(line.trim())
      continue
    }
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/)
    if (heading) {
      flush()
      const text = plain(heading[2].replace(LINK, '$1'))
      if (heading[1] === '#' && !title) {
        title = text
        continue
      }
      part = classify(text)
      if (part === 'section') sections.push({ question: text, points: [] })
      continue
    }
    if (!line.trim() || /^\s*([-*_]\s*){3,}$/.test(line)) {
      flush()
      continue
    }
    // A table: each row a point, cells joined by ` · `; the |---| line goes.
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flush()
      if (!/^\s*\|[\s|:-]+\|\s*$/.test(line)) add(line.trim().slice(1, -1).split('|').map((c) => c.trim()).join(' · '))
      continue
    }
    const item = line.match(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?(.*)$/)
    if (item) {
      flush()
      para = [item[1]]
      inItem = true
      continue
    }
    if (inItem) {
      para.push(line.trim())
      continue
    }
    // A line like `_Workspace · 2026-10-18_` under the title is the export's byline, not the answer.
    if (part === 'intro' && !intro.length && /^_[^_]+_$/.test(line.trim())) continue
    para.push(line.replace(/^\s*>\s?/, '').trim())
  }
  flush()

  // Sources: the listed ones keep their numbers (so `[n]` stays right), then the links in the text.
  const sources = [...listed]
  const numOf = (l: Raw['links'][number]) => {
    let i = sources.findIndex((s) => s.url === l.url)
    if (i < 0) i = sources.push({ url: l.url, title: l.title || l.url }) - 1
    return i + 1
  }
  const resolve = (r: Raw) => [...new Set([...r.nums.filter((n) => n >= 1 && n <= listed.length), ...r.links.map(numOf)])]

  // Text before the first section: its first paragraph is the gist; anything more becomes a section of its own.
  const [first = '', ...rest] = intro
  const answer = plain(first.replace(LINK, '$1').replace(CITE, ''))
  if (rest.length) sections.unshift({ question: 'Overview', points: rest.map(raw) })

  const report: ReportContent = {
    title: title || fileName.replace(/\.(md|markdown|txt)$/i, '') || 'Report',
    answer,
    sections: sections
      .map((s) => ({ question: s.question, points: s.points.filter((p) => p.text).map((p) => ({ text: p.text, sources: resolve(p) })) }))
      .filter((s) => s.points.length || s.question),
    implications: implications
      .filter((r) => r.text)
      .map((r) => {
        const named = r.text.match(/^(.*?)\s*\(([^()]+)\)$/)
        const ids = named?.[2].split(', ').map((n) => itemId(n.trim()))
        return ids?.every(Boolean) ? { text: named![1], items: ids as string[] } : { text: r.text, items: [] }
      }),
    openQuestions: open.map((r) => r.text).filter(Boolean),
    sources,
  }
  return report.answer || report.sections.some((s) => s.points.length) ? report : null
}
