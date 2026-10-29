// Go to's places (D-196, D-200), without their glyphs or the camera (R8): the places in a space in reading order (top to
// bottom, then left to right). On the canvas its planes, each followed by the headings and sections inside it, the
// project title, its headings (H1, H2) and named sections; in a plane its own headings and sections. Paragraphs, sticky
// notes and H3s aren't places (D-116). The workspace view's goTo.ts gives each its glyph and glides there.
import type { Piece, PieceKind } from '../data/model'
import type { WithId } from '../data/hooks'
import { CANVAS, kindOf, type Label } from '../data/labels'
import { kindOfPiece } from '../data/pieces'
import { labelBox } from './labelBox'

export type Box = { x: number; y: number; w: number; h: number }

// What it is, for its glyph: a piece's kind or a kind of text.
export type PlaceMark = { piece: PieceKind } | { text: 'title' | 'section' | 'heading' }

// `space`: where it is, the canvas or a plane's id; `inside`: a plane's, listed under it on the canvas; `whole`: framed
// whole (a plane, a section, the title), else landed near the top at 100% (a heading).
export type PlaceAt = { id: string; space: string; label: string; mark: PlaceMark; box: Box; whole: boolean; inside?: boolean }

// What the list shows: a plane's places only while it's open.
export const shownPlaces = <P extends { space: string; inside?: boolean }>(places: P[], open: string[]) => places.filter((p) => !p.inside || open.includes(p.space))

const readingOrder = (a: PlaceAt, b: PlaceAt) => a.box.y - b.box.y || a.box.x - b.box.x

// The text places written in one space.
function textIn(space: string, labels: Label[], workspaceName: string): PlaceAt[] {
  return labels
    .filter((l) => l.pieceId === space)
    .flatMap((l): PlaceAt[] => {
      const k = kindOf(l)
      const name = l.text.trim()
      const at = { id: l.id, space, box: labelBox(l) }
      if (k === 'title') return [{ ...at, label: workspaceName || 'project title', mark: { text: 'title' }, whole: true }]
      if (k === 'section' && name) return [{ ...at, label: name, mark: { text: 'section' }, whole: true }]
      if (k === 'heading' && name && l.size !== 'minor') return [{ ...at, label: name, mark: { text: 'heading' }, whole: false }]
      return []
    })
    .sort(readingOrder)
}

export function placesIn(space: string, pieces: WithId<Piece>[], labels: Label[], workspaceName: string): PlaceAt[] {
  if (space !== CANVAS) return textIn(space, labels, workspaceName)
  const ids = new Set(pieces.map((p) => p.id))
  const planes: PlaceAt[] = pieces.map((p) => {
    const kind = kindOfPiece(p)
    return { id: p.id, space: CANVAS, label: p.name || kind, mark: { piece: kind }, box: p, whole: true }
  })
  return [...planes, ...textIn(CANVAS, labels, workspaceName)]
    .sort(readingOrder)
    .flatMap((p) => (ids.has(p.id) ? [p, ...textIn(p.id, labels, workspaceName).map((q) => ({ ...q, inside: true }))] : [p]))
}
