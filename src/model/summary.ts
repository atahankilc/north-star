// A workspace's picture for the workspaces page (D-338, docs/specs/workspaces-page.md §3): what its first canvas holds,
// as numbers and letters only, never a title. `makeSummary` turns pieces and cards into the two strings of
// `workspaces/{wid}/summary/main`; `readSummary` turns them back into boxes to draw. Pure: no Firebase, no DOM.
import { CARD, type AnyType, type Card } from './cards'
import type { Piece, PieceKind } from '../data/model'
import { SUMMARY_CARDS_CHARS, SUMMARY_CARDS_MAX, SUMMARY_PIECES_CHARS, SUMMARY_PIECES_MAX } from './limits'

export type SummaryDoc = { by: string; at: number; n: number; pieces: string; cards: string }
// Drawn: boxes in 0–1000 of the pieces' bounding box; cards from their plane's first card, in tenths of a card's width
// (a card is 10 × 5 of them).
export type SummaryPiece = { kind: PieceKind; x: number; y: number; w: number; h: number }
export type SummaryCard = { piece: number; type: AnyType; x: number; y: number }
export type Summary = { pieces: SummaryPiece[]; cards: SummaryCard[]; n: number; at: number }

const KIND: Record<PieceKind, string> = { plane: 'p', matrix: 'm', table: 't', documents: 'd', document: 'o', kanban: 'k', timeline: 'l' }
const TYPE: Record<AnyType, string> = { customer: 'c', problem: 'p', competitor: 'r', idea: 'i', feature: 'f', package: 'k' }
const KIND_OF = Object.fromEntries(Object.entries(KIND).map(([k, v]) => [v, k])) as Record<string, PieceKind>
const TYPE_OF = Object.fromEntries(Object.entries(TYPE).map(([k, v]) => [v, k])) as Record<string, AnyType>

// What the rules allow in either string (firestore.rules `validSummary`).
export const SUMMARY_CHARS = /^[a-z0-9 ;]*$/
// A card in the summary's units.
export const CARD_UNITS = { w: 10, h: 5 }

type Box = Pick<Piece, 'kind' | 'x' | 'y' | 'w' | 'h'> & { id: string }

// The first canvas's pieces (oldest first, as drawn, D-310) and the cards on its planes: each card at its home plane's
// spot (`pieceId`) or another plane's (`places`), parts inside a card left out (`on`). The picture fits a plane's cards
// into it by their own bounding box, as the plane's picture on the canvas is.
export function makeSummary(pieces: Box[], cards: Pick<Card, 'type' | 'pieceId' | 'x' | 'y' | 'on'>[], places: { planeId: string; type: AnyType; x: number; y: number }[]): Pick<SummaryDoc, 'n' | 'pieces' | 'cards'> {
  const shown = pieces.slice(0, SUMMARY_PIECES_MAX)
  if (!shown.length) return { n: 0, pieces: '', cards: '' }
  const x0 = Math.min(...shown.map((p) => p.x)), y0 = Math.min(...shown.map((p) => p.y))
  const x1 = Math.max(...shown.map((p) => p.x + p.w)), y1 = Math.max(...shown.map((p) => p.y + p.h))
  const span = Math.max(x1 - x0, y1 - y0, 1)
  const k = (v: number) => Math.max(0, Math.min(1000, Math.round((v * 1000) / span)))
  const pieceStr = shown.map((p) => `${KIND[p.kind] ?? 'p'} ${k(p.x - x0)} ${k(p.y - y0)} ${Math.max(1, k(p.w))} ${Math.max(1, k(p.h))}`).join(';')

  const index = new Map(shown.map((p, i) => [p.id, i] as const))
  const spots: { i: number; type: AnyType; x: number; y: number }[] = []
  for (const c of cards) if (!c.on && index.get(c.pieceId) !== undefined && shown[index.get(c.pieceId)!].kind === 'plane') spots.push({ i: index.get(c.pieceId)!, type: c.type, x: c.x, y: c.y })
  for (const p of places) if (index.get(p.planeId) !== undefined && shown[index.get(p.planeId)!].kind === 'plane') spots.push({ i: index.get(p.planeId)!, type: p.type, x: p.x, y: p.y })
  const n = spots.length
  const byPlane = new Map<number, typeof spots>()
  for (const s of spots) byPlane.set(s.i, [...(byPlane.get(s.i) ?? []), s])
  const out: string[] = []
  // Each plane's cards from their own top-left, in tenths of a card's width (a card is 10 × 5 of them), capped at 999.
  const unit = CARD.w / 10
  for (const [i, list] of [...byPlane].sort((a, b) => a[0] - b[0])) {
    const cx0 = Math.min(...list.map((s) => s.x)), cy0 = Math.min(...list.map((s) => s.y))
    const q = (v: number) => Math.max(0, Math.min(999, Math.round(v / unit)))
    for (const s of list) out.push(`${i} ${TYPE[s.type] ?? 'i'} ${q(s.x - cx0)} ${q(s.y - cy0)}`)
  }
  let cardStr = out.slice(0, SUMMARY_CARDS_MAX).join(';')
  while (cardStr.length > SUMMARY_CARDS_CHARS) cardStr = cardStr.slice(0, cardStr.lastIndexOf(';'))
  return { n, pieces: pieceStr.slice(0, SUMMARY_PIECES_CHARS), cards: cardStr }
}

// Back into boxes; anything that doesn't read is skipped (an old or odd doc draws less, never fails).
export function readSummary(d: Partial<SummaryDoc> | null | undefined): Summary | null {
  if (!d || typeof d.pieces !== 'string' || typeof d.cards !== 'string') return null
  const nums = (s: string) => s.split(' ').map(Number)
  const pieces: SummaryPiece[] = []
  for (const part of d.pieces.split(';')) {
    const [k, ...rest] = part.split(' ')
    const [x, y, w, h] = rest.map(Number)
    if (KIND_OF[k] && [x, y, w, h].every(Number.isFinite)) pieces.push({ kind: KIND_OF[k], x, y, w, h })
  }
  const cards: SummaryCard[] = []
  for (const part of d.cards ? d.cards.split(';') : []) {
    const [i, t, x, y] = part.split(' ')
    const [pi, px, py] = nums(`${i} ${x} ${y}`)
    if (TYPE_OF[t] && pieces[pi] && Number.isFinite(px) && Number.isFinite(py)) cards.push({ piece: pi, type: TYPE_OF[t], x: px, y: py })
  }
  return { pieces, cards, n: typeof d.n === 'number' ? d.n : cards.length, at: typeof d.at === 'number' ? d.at : 0 }
}
