// What a short id names, in words a person reads (agent-bugs 2, 22): one resolver for the chat (every short id shown
// with its name, linked where it has a place) and for documents the agent writes (`create_document` turns a bare
// `c12` into `c12 "title"`). Read from the chat's ids and the workspace as it is now.
import { kindOf } from '../../model/labels'
import { derive, nameOf } from './derive'
import { oneLine, q } from './text'
import type { IdKind, Ids } from './ids'
import type { ReadWs } from './types'

// `go`: the real id to bring into view (the UI facade's goTo: a card, piece, text, task or canvas); left out when the
// thing has no place of its own to go to (a document, a comment thread, a person).
export type Named = { kind: IdKind; name: string; go?: string }

// Every short id's letters (ids.ts' PREFIX).
export const SHORT_ID = /\b[cptxkevfdmu]\d+\b/

export function namedShort(ws: ReadWs, ids: Ids, short: string): Named | undefined {
  const r = ids.real(short)
  if (!r) return undefined
  const d = derive(ws)
  const id = r.id
  switch (r.kind) {
    case 'card': {
      const c = d.cards.get(id)
      return c ? { kind: 'card', name: q(c.title, 60), go: id } : undefined
    }
    case 'piece': {
      const p = d.pieces.get(id)
      return p ? { kind: 'piece', name: q(d.pieceName(p), 60), go: id } : undefined
    }
    case 'text': {
      const l = d.labels.get(id)
      return l ? { kind: 'text', name: q(l.text.split('\n')[0] || kindOf(l), 50), go: id } : undefined
    }
    case 'task': {
      const t = d.tasks.get(id)
      return t ? { kind: 'task', name: q(t.title, 60), go: id } : undefined
    }
    case 'canvas': {
      const k = ws.canvases.find((x) => x.id === id)
      return k ? { kind: 'canvas', name: q(k.name, 40), go: id } : undefined
    }
    case 'link': {
      const e = ws.edges.find((x) => x.id === id)
      if (!e) return undefined
      const a = d.cards.get(e.fromId)
      const b = d.cards.get(e.toId)
      return { kind: 'link', name: `${q(a?.title, 30)} → ${q(b?.title, 30)}`, go: e.fromId }
    }
    case 'evidence': {
      const v = ws.evidence.find((x) => x.id === id)
      return v ? { kind: 'evidence', name: q(oneLine(v.text, 60), 60), go: v.nodeId } : undefined
    }
    case 'feature': {
      const f = ws.competitorFeatures.find((x) => x.id === id)
      return f ? { kind: 'feature', name: q(f.name, 50), go: f.competitorId } : undefined
    }
    case 'document': {
      const doc = d.docs.get(id)
      return doc ? { kind: 'document', name: q(doc.title, 60) } : undefined
    }
    case 'thread': {
      const t = ws.threads.find((x) => x.id === id)
      if (!t) return undefined
      const on = namedReal(ws, t.targetId)
      return { kind: 'thread', name: on ? `comments on ${on}` : 'comments' }
    }
    case 'person':
      return { kind: 'person', name: nameOf(d, id) }
  }
}

// A real id's name, for a thread's target (a card, text, link or plane).
function namedReal(ws: ReadWs, id: string): string | undefined {
  const d = derive(ws)
  const c = d.cards.get(id)
  if (c) return q(c.title, 40)
  const p = d.pieces.get(id)
  if (p) return q(d.pieceName(p), 40)
  const l = d.labels.get(id)
  if (l) return q(l.text.split('\n')[0], 40)
  return undefined
}

// A short id the model wrote as a Markdown link or in brackets (`[c58](c58)`, `[p6]`, `[c58 "Bread"](c58)`) as the plain
// id it is: the chat and documents name and link ids themselves (agent-bugs 2), so a link around one would show it
// twice. A real link (`[site](https://…)`) stays.
export function plainCites(text: string): string {
  const id = SHORT_ID.source.replace(/^\\b|\\b$/g, '')
  return text
    .replace(new RegExp(`\\[(${id})((?:\\s+"[^"\\n]{1,90}")?)\\]\\(\\s*\\1\\s*\\)`, 'g'), '$1$2')
    .replace(new RegExp(`\\[(${id})\\](?!\\()`, 'g'), '$1')
}

// Every bare short id in a text followed by its name (`c12` → `c12 "Bread club"`); one already followed by a quoted
// title (or a person's name after `u3`) stays; an id the chat doesn't know, or that's gone, stays as written. Code
// spans and fenced blocks are left alone.
export function withNames(text: string, ws: ReadWs, ids: Ids): string {
  const parts = plainCites(text).split(/(```[\s\S]*?```|`[^`\n]*`)/)
  return parts
    .map((part, i) =>
      i % 2
        ? part
        : part.replace(new RegExp(`${SHORT_ID.source}(?!\\s*["“])`, 'g'), (s, at: number, all: string) => {
            const n = namedShort(ws, ids, s)
            if (!n) return s
            // Its name already there (`u3 Ayşe Demir`): left as written.
            if (all.slice(at + s.length).trimStart().toLowerCase().startsWith(n.name.replace(/^"|"$/g, '').toLowerCase())) return s
            return `${s} ${n.name}`
          }),
    )
    .join('')
}
