// What the finder (D-236) reads, without the views (R8): where a regular expression matches in a text, a long text cut
// round its first match, and a document's text as its page reads it. The workspace view's findIndex.ts builds the finder's
// groups and rows from these.
import type { Doc, DocBody } from '../data/documents'

// More than this and the rest aren't counted (a regular expression matching everything).
export const MOST = 5000

// Where `re` matches in `text`: [from, to] each; an empty match is stepped over.
export function matchesIn(text: string, re: RegExp, most = MOST): [number, number][] {
  const out: [number, number][] = []
  re.lastIndex = 0
  for (let m = re.exec(text); m && out.length < most; m = re.exec(text)) {
    if (m[0].length === 0) {
      re.lastIndex++
      continue
    }
    out.push([m.index, m.index + m[0].length])
  }
  return out
}

// A long text cut round its first match, so the row shows it.
export function snippet(text: string, re: RegExp) {
  const flat = text.replace(/\s+/g, ' ').trim()
  const m = matchesIn(flat, re, 1)[0]
  if (!m || flat.length <= 90) return flat
  const from = Math.max(0, m[0] - 32)
  return `${from ? '…' : ''}${flat.slice(from, from + 96)}${from + 96 < flat.length ? '…' : ''}`
}

// A document's text as its page reads it, in order: its title, then its Markdown without the marks (or a report's
// answer, questions, points, what it means, open questions and sources).
export function pageText(d: Doc, body: DocBody | undefined) {
  if (!body) return d.title
  if (d.kind === 'report') {
    const s = body.sections ?? []
    return [
      d.title,
      body.answer ?? '',
      ...s.flatMap((x, i) => [`${String(i + 1).padStart(2, '0')}${x.question}`, ...x.points.map((p) => p.text)]),
      ...(body.implications?.length ? ['What it means for us', ...body.implications.map((x) => x.text)] : []),
      ...(body.openQuestions?.length ? ['Open questions', ...body.openQuestions] : []),
      ...(body.sources?.length ? ['Sources', ...body.sources.map((x, i) => `${i + 1} ${x.title}`)] : []),
    ].join('\n')
  }
  let text = body.text ?? ''
  const m = /^\s*#{1,6}\s+(.+?)\s*#*\s*(\n|$)/.exec(text)
  if (m && m[1].trim() === d.title.trim()) text = text.slice(m[0].length)
  const plain = text
    .replace(/```[^\n]*\n?/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*([-*+>]|\d+[.)])\s+(\[[ xX]\]\s+)?/gm, '')
    .replace(/[*_`~|]/g, '')
  return `${d.title}\n${plain}`
}
