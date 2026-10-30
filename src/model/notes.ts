// The agent notes (S16, D-312; docs/specs/agent.md §4.7, §4.9 layer 4): one markdown document per workspace, the
// startup's words, choices and "don't do X", read by people and the agent and edited by both (people in the agent's
// column, the agent through the same preview as every change). Pure: no Firebase, React or zustand.
//
// It is an ordinary document (D-232's `documents/{id}` + `content/body`) with a fixed id and a marker: `role:
// 'agent-notes'`, always shared, always `kind: 'markdown'`. firestore.rules lets every member read it and owners and
// editors write it (any other document stays its author's). Its text is capped (it goes into every prompt).
import { DOC_LIMITS } from './shapes'

export const NOTES_ID = 'agent-notes'
export const NOTES_ROLE = 'agent-notes'
export const NOTES_TITLE = 'Agent notes'
// Characters of text (about 2.7k tokens at the read layer's estimate); firestore.rules holds the body to this too.
export const NOTES_MAX = 8000

// The summary fields the notes doc may hold (a subset of a document's, plus the marker).
export type NotesDoc = {
  kind: 'markdown'
  role: typeof NOTES_ROLE
  title: string
  excerpt?: string
  origin: 'assistant' | 'upload'
  uid: string
  name: string
  shared: true
  contentType: 'text/markdown'
  size: number
  words: number
  createdAt: number
  updatedAt: number
}

type DocLike = { id: string; role?: unknown; kind?: unknown }
type WsLike = { documents?: DocLike[]; bodies?: Record<string, { text?: string } | undefined> }

export const isNotesDoc = (d: DocLike | undefined | null): boolean => !!d && d.id === NOTES_ID && d.role === NOTES_ROLE

// The notes as a snapshot carries them: the doc (if there is one), its text (if loaded) and whether it is loaded.
// No doc: empty and loaded (there is nothing to read).
export function notesOf(ws: WsLike): { doc: DocLike | null; text: string; loaded: boolean } {
  const doc = ws.documents?.find(isNotesDoc) ?? null
  if (!doc) return { doc: null, text: '', loaded: true }
  const body = ws.bodies?.[NOTES_ID]
  return { doc, text: typeof body?.text === 'string' ? body.text : '', loaded: !!body && typeof body.text === 'string' }
}

// UTF-8 bytes, as Firestore counts them.
export function bytesOf(s: string): number {
  let n = 0
  for (const ch of s) {
    const c = ch.codePointAt(0)!
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4
  }
  return n
}

export const wordsOf = (text: string) => (text.match(/\S+/g) ?? []).length

// The first words without Markdown marks (documents.ts' mdExcerpt, kept pure here).
export function excerptOf(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .split('\n')
    .filter((l) => !/^\s{0,3}#{1,6}\s/.test(l))
    .join(' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s*([-*+>]|\d+[.)])\s+/gm, '')
    .replace(/[*_`~#>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, DOC_LIMITS.excerpt)
}

// The summary for a text: the old one's who/when kept (an update never changes its author or creation), the counts
// worked out again.
export function notesSummary(text: string, was: Partial<NotesDoc> | null | undefined, who: { uid: string; name?: string; agent?: boolean }, now: number): NotesDoc {
  const excerpt = excerptOf(text)
  return {
    kind: 'markdown',
    role: NOTES_ROLE,
    title: (typeof was?.title === 'string' && was.title.trim()) || NOTES_TITLE,
    ...(excerpt ? { excerpt } : {}),
    origin: was?.origin === 'upload' ? 'upload' : was?.origin ?? (who.agent ? 'assistant' : 'upload'),
    uid: typeof was?.uid === 'string' ? was.uid : who.uid,
    name: (typeof was?.name === 'string' ? was.name : who.name || 'someone').slice(0, 200),
    shared: true,
    contentType: 'text/markdown',
    size: bytesOf(text),
    words: wordsOf(text),
    createdAt: typeof was?.createdAt === 'number' ? was.createdAt : now,
    updatedAt: now,
  }
}

// A line-based diff (+ added, − removed, ' ' kept) for the preview: the longest common subsequence of lines.
export type DiffLine = { sign: '+' | '-' | ' '; text: string }
export function lineDiff(before: string, after: string): DiffLine[] {
  const a = before ? before.split('\n') : []
  const b = after ? after.split('\n') : []
  // Big texts: the common head and tail first, the LCS only on what's between (notes are ≤ 8000 characters).
  let head = 0
  while (head < a.length && head < b.length && a[head] === b[head]) head++
  let tail = 0
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++
  const x = a.slice(head, a.length - tail)
  const y = b.slice(head, b.length - tail)
  const L: number[][] = Array.from({ length: x.length + 1 }, () => new Array<number>(y.length + 1).fill(0))
  for (let i = x.length - 1; i >= 0; i--) for (let j = y.length - 1; j >= 0; j--) L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1])
  const mid: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < x.length && j < y.length) {
    if (x[i] === y[j]) (mid.push({ sign: ' ', text: x[i] }), i++, j++)
    else if (L[i + 1][j] >= L[i][j + 1]) mid.push({ sign: '-', text: x[i++] })
    else mid.push({ sign: '+', text: y[j++] })
  }
  while (i < x.length) mid.push({ sign: '-', text: x[i++] })
  while (j < y.length) mid.push({ sign: '+', text: y[j++] })
  return [...a.slice(0, head).map((t) => ({ sign: ' ' as const, text: t })), ...mid, ...a.slice(a.length - tail).map((t) => ({ sign: ' ' as const, text: t }))]
}

// The diff cut to what changed and `context` lines round it (`…` where kept lines were left out).
export function diffShown(lines: DiffLine[], context = 1): (DiffLine | { sign: '…'; text: string })[] {
  const keep = new Set<number>()
  lines.forEach((l, i) => {
    if (l.sign === ' ') return
    for (let k = Math.max(0, i - context); k <= Math.min(lines.length - 1, i + context); k++) keep.add(k)
  })
  const out: (DiffLine | { sign: '…'; text: string })[] = []
  let gap = false
  lines.forEach((l, i) => {
    if (keep.has(i)) {
      if (gap && out.length) out.push({ sign: '…', text: '' })
      gap = false
      out.push(l)
    } else gap = true
  })
  return out
}
