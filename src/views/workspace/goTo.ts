// Go to (D-196, the board's jump list D-050 back for every space): the places in the space you're in, in reading order
// (top to bottom, then left to right). On the canvas its planes, each followed by the headings and sections inside it,
// the project title, its headings (H1, H2) and named sections; in a focused plane its own headings and sections.
// Paragraphs, sticky notes and H3s aren't places (D-116). Picked from the side nav's go-to (search inside; no keys,
// D-201): the view glides there; a place inside a plane, from the canvas, first takes the plane into focus (the ink), then glides.
// A plane, a section or the title is framed whole (never past 100%); a heading lands near the top at 100%, so what's
// under it is in sight.
import type { WithId } from '../../data/hooks'
import type { Piece } from '../../data/model'
import { CANVAS, kindOf, type Label } from '../../data/labels'
import { camOf, fitInto, glide, setCam, useCanvasView, type Bounds } from '../../state/canvasView'
import { create } from 'zustand'
import { labelBox } from './TextItems'
import { kindOfPiece } from '../../data/pieces'
import { PIECE_GLYPH, TEXT_GLYPH } from './glyphs'

// `space`: where it is, the canvas or a plane's id; `inside`: a plane's, listed under it on the canvas.
export type Place = { id: string; space: string; label: string; glyph: string; box: Bounds; whole: boolean; inside?: boolean }

// A place picked in the side nav, for the canvas to go to; one waiting for its plane to come into focus; and the planes
// whose places are shown under them in the list (D-200: folded until opened, for the tab's life).
export const useGoTo = create<{ asked: Place | null; pending: Place | null; open: string[] }>(() => ({ asked: null, pending: null, open: [] }))

export const toggleOpen = (plane: string) => useGoTo.setState((s) => ({ open: s.open.includes(plane) ? s.open.filter((x) => x !== plane) : [...s.open, plane] }))

// What the list shows: a plane's places only while it's open.
export const shownPlaces = (places: Place[], open: string[]) => places.filter((p) => !p.inside || open.includes(p.space))

// Where a heading's top lands, as a share of the screen's height.
const HEADING_TOP = 0.28
const PAD = 96

const readingOrder = (a: Place, b: Place) => a.box.y - b.box.y || a.box.x - b.box.x

// The text places written in one space.
function textIn(space: string, labels: Label[], workspaceName: string): Place[] {
  return labels
    .filter((l) => l.pieceId === space)
    .flatMap((l): Place[] => {
      const k = kindOf(l)
      const name = l.text.trim()
      const at = { id: l.id, space, box: labelBox(l) }
      if (k === 'title') return [{ ...at, label: workspaceName || 'project title', glyph: TEXT_GLYPH.title, whole: true }]
      if (k === 'section' && name) return [{ ...at, label: name, glyph: TEXT_GLYPH.section, whole: true }]
      if (k === 'heading' && name && l.size !== 'minor') return [{ ...at, label: name, glyph: TEXT_GLYPH.heading, whole: false }]
      return []
    })
    .sort(readingOrder)
}

export function placesIn(space: string, pieces: WithId<Piece>[], labels: Label[], workspaceName: string): Place[] {
  if (space !== CANVAS) return textIn(space, labels, workspaceName)
  const ids = new Set(pieces.map((p) => p.id))
  const planes: Place[] = pieces.map((p) => {
    const kind = kindOfPiece(p)
    return { id: p.id, space: CANVAS, label: p.name || kind, glyph: PIECE_GLYPH[kind], box: p, whole: true }
  })
  return [...planes, ...textIn(CANVAS, labels, workspaceName)]
    .sort(readingOrder)
    .flatMap((p) => (ids.has(p.id) ? [p, ...textIn(p.id, labels, workspaceName).map((q) => ({ ...q, inside: true }))] : [p]))
}

// The zoom, and which point of the space goes where on screen (the finder's preview shows the same, D-236).
export function aim(place: Place) {
  const { size } = useCanvasView.getState()
  const b = place.box
  const { zoom, cx, cy } = fitInto(b, size.w, size.h, PAD)
  if (place.whole) return { zoom, at: [cx, cy], to: [size.w / 2, size.h / 2] }
  // A heading lands at 100%, to be read (smaller only if it's wider than the screen).
  return { zoom, at: [cx, b.y], to: [size.w / 2, size.h * HEADING_TOP] }
}

// On the canvas, or in the focused plane's own view (`inPlane`).
export function goToPlace(wid: string, place: Place, inPlane: boolean) {
  if (inPlane) {
    const c = useCanvasView.getState().planeCam
    if (!c) return
    const { zoom, at, to } = aim(place)
    return glide(c, { zoom, ox: to[0] - at[0] * zoom, oy: to[1] - at[1] * zoom }, 420, (v) => useCanvasView.setState({ planeCam: v }))
  }
  const c = camOf(wid)
  const { size } = useCanvasView.getState()
  const { zoom, at, to } = aim(place)
  glide(c, { zoom, x: to[0] - size.w / 2 - at[0] * zoom, y: to[1] - size.h / 2 - at[1] * zoom }, 420, (v) => setCam(wid, v))
}
