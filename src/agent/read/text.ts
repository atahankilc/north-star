// Small text helpers the read layer shares: the token estimate, the content wrapper, quoting, days, pages.

// An estimate, not a tokenizer (no dependency): plain English runs about 4 characters a token, but this text is dense
// with ids, symbols (· ⧉ ☐ −), quotes and non-English names, which tokenize worse; 3 characters a token keeps the
// estimate on the safe side. Check the targets with a real tokenizer once a key is in (agent-run.md, S10).
export const CHARS_PER_TOKEN = 3
export const estimateTokens = (s: string) => Math.ceil(s.length / CHARS_PER_TOKEN)

// A tool result's ceiling (agent.md §7.2 point 4) and the map's (§4.3).
export const RESULT_TOKENS = 8000
export const MAP_TOKENS = 15000
// What the map aims for under the estimate, leaving room below the target.
export const MAP_BUDGET = 13500

// Workspace text can't open or close the wrapper the prompt names as data (agent.md §4.3): a tag-like
// `workspace_content` in it is broken up (`workspace-content`), also when it hides behind look-alike letters or
// zero-width characters (matched after NFKC and with those taken out). Everything workspace-written passes through
// here: oneLine/q (every name and title), wrap (every body), and the snapshot itself (derive.ts' clean).
const HIDDEN = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF\u00AD]/g
const TAG = /<\s*\/?\s*workspace[\s_-]*content/i
export function defang(s: string): string {
  if (!s || (!s.includes('<') && !/[^\x00-\x7f]/.test(s))) return s
  const plain = s.normalize('NFKC').replace(HIDDEN, '')
  if (!TAG.test(plain)) return s
  return plain.replace(new RegExp(TAG.source, 'gi'), (m) => m.replace(/workspace[\s_-]*content/i, 'workspace-content').replace(/</, '‹'))
}

export function wrap(author: string, body: string): string {
  const who = defang(author).replace(/["<>\n]/g, '').slice(0, 80) || 'workspace'
  return `<workspace_content author="${who}">\n${defang(body)}\n</workspace_content>`
}

// One line of text, cut at `max` characters.
export function oneLine(s: string | undefined, max = 80): string {
  const flat = defang(s ?? '').replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat
}

// A title in quotes (inner quotes escaped), cut at `max`; an empty one says so.
export const q = (s: string | undefined, max = 80) => (s && s.trim() ? `"${oneLine(s, max).replace(/"/g, '\\"')}"` : '(untitled)')

// A day as tasks write it, from ms (UTC, so a golden file reads the same everywhere).
export const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10)
export const timeOf = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ')

// `n things`.
export const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

// A page of a list, and the line that says where you are and how to get more.
export function pageOf<T>(list: T[], page = 1, limit = 30): { items: T[]; page: number; pages: number; from: number; to: number } {
  const size = Math.max(1, Math.floor(limit))
  const pages = Math.max(1, Math.ceil(list.length / size))
  const p = Math.min(Math.max(1, Math.floor(page || 1)), pages)
  const from = (p - 1) * size
  return { items: list.slice(from, from + size), page: p, pages, from: from + 1, to: Math.min(list.length, from + size) }
}

export function pageLine(total: number, pg: { page: number; pages: number; from: number; to: number }, what: string, narrow: string, param = 'page'): string | undefined {
  if (pg.pages <= 1) return undefined
  return `${what} ${pg.from}–${pg.to} of ${total} (${param} ${pg.page}/${pg.pages}).${pg.page < pg.pages ? ` Next: ${param} ${pg.page + 1}.` : ''} ${narrow}`.trim()
}

// The last guard on a result's size: lines past the ceiling are cut and the cut said.
export function fit(text: string, max = RESULT_TOKENS, hint = 'Narrow it (a smaller limit, a filter, a scope) or ask for the next page.'): { text: string; cut: boolean } {
  if (estimateTokens(text) <= max) return { text, cut: false }
  const lines = text.split('\n')
  const out: string[] = []
  let size = 0
  const room = max * CHARS_PER_TOKEN - 200
  for (const l of lines) {
    if (size + l.length + 1 > room) break
    out.push(l)
    size += l.length + 1
  }
  // A wrapper opened and cut off is closed again.
  const opened = out.filter((l) => l.startsWith('<workspace_content')).length - out.filter((l) => l === '</workspace_content>').length
  if (opened > 0) out.push('</workspace_content>')
  out.push(`… cut at about ${max} tokens. ${hint}`)
  return { text: out.join('\n'), cut: true }
}

export const norm = (s: string) => s.trim().replace(/^["'`]+|["'`]+$/g, '').replace(/\s+/g, ' ').toLowerCase()
