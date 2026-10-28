// What the finder (D-236) looks through, built from the workspace's data: one group a space (the canvas, each plane,
// each table, matrix and documents list, each document), each match a row saying where it goes. Every page of a table
// or list counts, not only what's drawn; a document's text is read while the finder is open (FindBodies). A kanban's
// tasks (D-261) by their title, notes and checklist steps, one row a task.
import type { WithId } from '../../data/hooks'
import type { Piece, Workspace } from '../../data/model'
import { CARD, type Card } from '../../data/cards'
import type { Cell } from '../../data/matrix'
import type { Bounds } from '../../state/canvasView'
import type { Doc, DocBody } from '../../data/documents'
import { CANVAS, kindOf, type Label } from '../../data/labels'
import { kindOfPiece, KIND_NAME } from '../../data/pieces'
import { labelBox } from './TextItems'
import { matrixBounds, matrixFindItems, M } from './Matrix'
import { tableBounds, tableFindItems, type FieldText } from './Table'
import { documentsBounds, documentsFindItems, documentsOf, listed } from './Documents'
import { kanbanBounds, kanbanOf, taskBox } from './Kanban'
import { tasksIn, type Task } from '../../data/tasks'
import { landing, matchesIn, MOST, type FindItem, type FindTarget } from './find'
import type { ReactNode } from 'react'
import { PIECE_GLYPH, TEXT_GLYPH } from './glyphs'
import type { Place } from './goTo'
import { cardsOn, type Place as CardPlace } from '../../data/places'

// Where a row goes: a place on the canvas or in a plane (go to's, D-196), lit there; a match in a table, matrix or list
// (into its focus, landing on `view`); in a document on its own (its focus); in a document open beside a list.
export type Dest =
  | { kind: 'place'; place: Place; target?: FindTarget }
  | { kind: 'lens'; piece: WithId<Piece>; target: FindTarget; page?: number }
  | { kind: 'doc'; piece: WithId<Piece>; target: FindTarget }
  | { kind: 'reader'; list: WithId<Piece>; doc: WithId<Doc>; target: FindTarget }

// `fold`: a plane's own places folded under it in go to (D-200), opened or not; `indent`: one of them.
export type Row = { id: string; glyph: ReactNode; text: string; hint: string; dest: Dest; tone?: string; inside?: boolean; fold?: { open: boolean; count: number; plane: string }; indent?: boolean }
export type Group = { space: string; title: string; glyph: ReactNode; rows: Row[]; count: number }

type Data = {
  pieces: WithId<Piece>[]
  cards: Card[]
  // Cards brought to planes besides their home (D-281).
  places: CardPlace[]
  labels: Label[]
  cells: Cell[]
  tasks: Task[]
  documents: WithId<Doc>[]
  bodies: Record<string, DocBody>
  workspace: WithId<Workspace>
  me?: string
  fieldText: FieldText
  room: { w: number; h: number }
  // What a table, matrix or list holds, built once while its data stays the same (not on every key typed).
  held: Map<string, { items: FindItem[]; content: Bounds }>
}

const readingOrder = (a: { x: number; y: number }, b: { x: number; y: number }) => a.y - b.y || a.x - b.x

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

// The k-th match of `re` in a page's text, one row each, with the words round it.
function pageRows(id: string, text: string, re: RegExp, dest: (k: number) => Dest, hint: string): Row[] {
  return matchesIn(text, re, 200).map(([a, b], k) => {
    const from = Math.max(0, a - 36)
    const flat = (s: string) => s.replace(/\s+/g, ' ')
    return {
      id: `${id}:${k}`,
      glyph: '¶',
      text: `${from ? '…' : ''}${flat(text.slice(from, b + 60))}${b + 60 < text.length ? '…' : ''}`,
      hint,
      dest: dest(k),
    }
  })
}

// Every space's matches, in reading order; the one you're in (`here`) first.
export function findGroups(data: Data, re: RegExp, here: string): Group[] {
  const { pieces, cards, places, labels, cells, tasks, documents, bodies, workspace, me, fieldText, room, held } = data
  const groups: Group[] = []
  const textRows = (space: string): Row[] =>
    labels
      .filter((l) => l.pieceId === space)
      .sort((a, b) => readingOrder(labelBox(a), labelBox(b)))
      .flatMap((l): Row[] => {
        const kind = kindOf(l)
        const text = kind === 'title' ? [workspace.name, workspace.description].filter(Boolean).join('\n') : l.text
        if (!text || !matchesIn(text, re, 1).length) return []
        const box = labelBox(l)
        const place: Place = { id: l.id, space, label: text, glyph: TEXT_GLYPH[kind], box, whole: kind !== 'heading' }
        return [{ id: `label:${l.id}`, glyph: TEXT_GLYPH[kind], text: snippet(text, re), hint: kind === 'title' ? 'project title' : kind, dest: { kind: 'place', place, target: { kind: 'space', space, key: `label:${l.id}`, k: 0 } } }]
      })

  // The canvas: its text.
  const canvas = textRows(CANVAS)
  if (canvas.length) groups.push({ space: CANVAS, title: 'on the canvas', glyph: '◇', rows: canvas, count: canvas.length })

  const ordered = [...pieces].sort(readingOrder)
  for (const p of ordered) {
    const kind = kindOfPiece(p)
    const name = kind === 'document' ? (documents.find((d) => d.id === p.docId)?.title ?? 'document') : p.name || KIND_NAME[kind]
    const title = `${name} · ${KIND_NAME[kind]}`
    let rows: Row[] = []
    if (kind === 'plane') {
      // Brought from other planes too, at their spot here (D-281).
      const own = cardsOn(cards, places, p.id).sort(readingOrder)
      rows = [
        ...own.flatMap((c): Row[] => {
          if (!c.title || !matchesIn(c.title, re, 1).length) return []
          const box = { x: c.x, y: c.y, w: CARD.w, h: CARD.h }
          const place: Place = { id: c.id, space: p.id, label: c.title, glyph: '▭', box, whole: true }
          return [{ id: `card:${c.id}`, glyph: '▭', text: snippet(c.title, re), hint: c.type, tone: c.type, dest: { kind: 'place', place, target: { kind: 'space', space: p.id, key: `card:${c.id}`, k: 0 } } }]
        }),
        ...textRows(p.id),
      ]
    } else if (kind === 'table' || kind === 'matrix' || kind === 'documents') {
      let built = held.get(p.id)
      if (!built) {
        built = {
          items: kind === 'table' ? tableFindItems(p, cards, cells, fieldText) : kind === 'matrix' ? matrixFindItems(p, cards, cells) : documentsFindItems(p, documents, me, true),
          content: kind === 'table' ? tableBounds(p, cards) : kind === 'matrix' ? matrixBounds(p, cards) : documentsBounds(p, listed(documents, documentsOf(p), me).length),
        }
        held.set(p.id, built)
      }
      const { items, content } = built
      rows = items.flatMap((it): Row[] => {
        if (!it.text || !matchesIn(it.text, re, 1).length) return []
        // A matrix's cells land clear of its heads, which stay on the screen when panned past.
        const heads = kind === 'matrix' && it.box.x && it.box.y ? { top: M.top, left: M.head } : undefined
        const view = landing(content, it.box, room, heads)
        return [{ id: `${p.id}:${it.key}`, glyph: '·', text: snippet(it.text, re), hint: hintOf(kind, it), dest: { kind: 'lens', piece: p, page: it.page, target: { kind: 'lens', space: p.id, key: it.key, k: 0, view } } }]
      })
    } else if (kind === 'kanban') {
      // Its tasks column by column, in order; the first field that matches says where (its title, notes, a step).
      const content = kanbanBounds(p, tasks)
      rows = kanbanOf(p).cols.flatMap((c) =>
        tasksIn(tasks.filter((t) => t.pieceId === p.id), c.id).flatMap((t): Row[] => {
          const fields: [string, string][] = [
            ['', t.title],
            ['notes', t.notes ?? ''],
            ...(t.checks ?? []).map((x): [string, string] => ['step', x.text]),
          ]
          const hit = fields.find(([, text]) => text && matchesIn(text, re, 1).length)
          if (!hit) return []
          const view = landing(content, taskBox(p, tasks, t.id) ?? content, room)
          const hint = [c.name, hit[0] && `in ${hit[0]}`].filter(Boolean).join(' · ')
          return [{ id: `${p.id}:task:${t.id}`, glyph: '☐', text: hit[0] ? `${t.title} — ${snippet(hit[1], re)}` : snippet(t.title, re), hint, dest: { kind: 'lens', piece: p, target: { kind: 'lens', space: p.id, key: `task:${t.id}`, k: 0, view } } }]
        }),
      )
    } else if (kind === 'document') {
      const d = documents.find((x) => x.id === p.docId)
      if (d) rows = pageRows(p.id, pageText(d, bodies[d.id]), re, (k) => ({ kind: 'doc', piece: p, target: { kind: 'page', space: p.id, k } }), d.title)
    }
    if (rows.length) groups.push({ space: p.id, title, glyph: PIECE_GLYPH[kind], rows, count: rows.length })
  }

  // The documents no piece shows on its own: read beside the first list on the canvas.
  const list = ordered.find((p) => kindOfPiece(p) === 'documents')
  if (list) {
    const shown = new Set(pieces.filter((p) => kindOfPiece(p) === 'document').map((p) => p.docId))
    for (const d of listed(documents, documentsOf(list), me)) {
      if (shown.has(d.id) || !bodies[d.id]) continue
      const rows = pageRows(`doc:${d.id}`, pageText(d, bodies[d.id]), re, (k) => ({ kind: 'reader', list, doc: d, target: { kind: 'page', space: `doc:${d.id}`, k } }), `beside ${list.name || 'documents'}`)
      if (rows.length) groups.push({ space: `doc:${d.id}`, title: `${d.title} · document`, glyph: PIECE_GLYPH.document, rows, count: rows.length })
    }
  }

  // The one you're in first; each capped so one big table doesn't hide the rest.
  const at = groups.findIndex((g) => g.space === here)
  if (at > 0) groups.unshift(...groups.splice(at, 1))
  let left = MOST
  return groups.map((g) => {
    const rows = g.rows.slice(0, Math.max(0, left))
    left -= rows.length
    return { ...g, rows }
  })
}

function hintOf(kind: string, it: FindItem) {
  const page = it.page !== undefined ? ` · page ${it.page + 1}` : ''
  if (kind === 'matrix') return it.key.startsWith('cols|') ? 'column' : it.key.startsWith('rows|') ? 'row' : `cell${page}`
  if (kind === 'documents') return (it.key.startsWith('t|') ? 'title' : it.key.startsWith('e|') ? 'first words' : 'added by') + page
  return (it.key.startsWith('h|') ? 'column' : it.key.startsWith('n|') ? 'row' : 'cell') + page
}

// `here`: every other space folded to one row, `N inside`, going to its first match.
export function folded(groups: Group[], here: string): Group[] {
  return groups.map((g) =>
    g.space === here
      ? g
      : {
          ...g,
          rows: [{ id: `in:${g.space}`, glyph: g.glyph, text: g.space === CANVAS ? `${g.count} on the canvas` : `${g.count} inside`, hint: 'enter: go to the first', dest: g.rows[0].dest, inside: true }],
        },
  )
}
