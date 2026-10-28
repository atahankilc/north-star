// The right-click menu inside a focused plane (D-237; the old board's D-117), after D-193's `comment`: what can be done
// with what's under the pointer, or added where it is. A card: open (its panel), fold or unfold its parts, duplicate,
// copy, delete (one also on other planes: take off this plane, or delete everywhere, D-281); one in a selection of several does it to all of them. A link: its label, turn it round, its kind (the
// current one checked), remove. Text: edit, duplicate, copy, delete. Empty plane: a card of each type or text right
// there, and paste. Editors only for the changes; anyone can open.
import { cardsOn, elsewhere, type Place } from '../../data/places'
import { addCard, copyCards, foldCard, foldPackage, type Card, type CardType, CARD_TYPES } from '../../data/cards'
import { deleteEdge, reverseEdge, updateEdge, type Edge } from '../../data/edges'
import { addLabel, deleteLabel, PARA_W, STICKY_W, type Label } from '../../data/labels'
import { snap, GRID } from '../../data/grid'
import { useCanvasView } from '../../state/canvasView'
import type { MenuEntry } from '../../ui/Menu'
import { TEXT_GLYPH } from './glyphs'
import { linkTone } from './PlaneLinks'
import { LINK_GROUPS } from './planeFilter'
import { clipboard, deleteHere, onPlane, packageThese, selectedIds, setSelection } from './selection'
import { foldsOf } from './cardInside'

const CARD_LETTER: Record<CardType, string> = { customer: 'c', problem: 'r', competitor: 'o', idea: 'i', feature: 'f' }
const TONE: Record<CardType, string> = {
  customer: 'var(--accent-green)',
  problem: 'var(--accent-magenta)',
  competitor: 'var(--accent-yellow)',
  idea: 'var(--fg)',
  feature: 'var(--accent-cyan)',
}

type Ctx = {
  wid: string
  plane: string
  editor: boolean
  cards: Card[]
  labels: Label[]
  edges: Edge[]
  // Cards on planes besides their home (D-281): Delete takes those off this plane; delete everywhere takes their places.
  places: Place[]
  // The pieces, for the planes' names a card is still on.
  pieces: { id: string; name?: string }[]
  // Who's writing (a sticky note is signed).
  me: { uid?: string; author: string }
  // Where the pointer is, in the plane's px, and on the screen (client px).
  at: [number, number]
  screen: [number, number]
  // How many parts a card has (folding).
  parts: (id: string) => number
  // Every card of the workspace (a package is named after how many there are).
  all: Card[]
}

const by2 = (): [number, number] => [2 * GRID, 2 * GRID]

// Cards also on other planes, deleted from all of them: through the hazard confirm (D-281).
const everywhere = (c: Ctx, list: Card[]): MenuEntry => ({
  key: 'everywhere',
  label: 'delete everywhere',
  glyph: '×',
  danger: true,
  onSelect: () => useCanvasView.setState({ deleting: { ids: list.map((x) => x.id), plane: c.plane } }),
})

// What's done to a selection of several when the thing right-clicked is in it.
function several(c: Ctx, n: number): MenuEntry[] {
  const ids = selectedIds()
  const picked = c.cards.filter((x) => ids.includes(x.id))
  const texts = c.labels.filter((x) => ids.includes(x.id))
  const packable = picked
  const shared = picked.filter((x) => elsewhere(x, c.places, c.plane).length)
  return [
    { key: 'sel', heading: `${n} selected` },
    { key: 'copy', label: 'copy them', glyph: '⧉', hint: '⌘C', onSelect: () => Object.assign(clipboard, { cards: picked, labels: texts, edges: c.edges, pasted: 0 }) },
    ...(c.editor
      ? [
          ...(packable.length
            ? [{ key: 'pkg', label: `package ${packable.length === picked.length ? 'these' : `the ${packable.length} cards`}`, glyph: '▣', letter: 'p', tone: 'var(--accent-blue)', onSelect: () => setSelection([packageThese(c.wid, packable, c.all)]) }]
            : []),
          { key: 'dup', label: 'duplicate them', glyph: '⊕', letter: 'd', hint: '⌘D', onSelect: () => setSelection(copyCards(c.wid, c.plane, picked, c.edges, by2(), texts)) },
          {
            key: 'del',
            label: shared.length ? (shared.length === n ? `take ${n} off this plane` : `remove ${n}`) : `delete ${n}`,
            glyph: '×',
            danger: !shared.length,
            hint: '⌫',
            onSelect: () => {
              setSelection([])
              deleteHere(c.wid, c.plane, picked, c, texts)
            },
          },
          ...(shared.length ? [everywhere(c, picked)] : []),
        ]
      : []),
  ]
}

export function cardItems(c: Ctx, id: string): MenuEntry[] {
  const card = c.cards.find((x) => x.id === id)
  if (!card) return []
  const { cardMulti } = useCanvasView.getState()
  if (cardMulti.length > 1 && cardMulti.includes(id)) return several(c, cardMulti.length)
  const parts = c.parts(id)
  return [
    { key: 'open', label: 'open', glyph: '▸', letter: 'o', hint: 'panel', onSelect: () => setSelection([id]) },
    ...(c.editor && parts && card.type === 'package'
      ? [
          {
            key: 'fold',
            label: card.folded ? `lay out its ${parts}` : `fold its ${parts} in`,
            glyph: card.folded ? '+' : '−',
            onSelect: () => {
              const box = onPlane.boxes().find((b) => b.id === id)?.box
              void foldPackage(c.wid, card, card.folded ? null : [snap(box?.x ?? card.x), snap(box?.y ?? card.y)])
            },
          },
        ]
      : c.editor && parts
      ? [{ key: 'fold', label: card.folded ? `unfold ${parts} part${parts > 1 ? 's' : ''}` : `fold ${parts} part${parts > 1 ? 's' : ''}`, glyph: card.folded ? '+' : '−', onSelect: () => void foldCard(c.wid, card, !card.folded) }]
      : []),
    { key: 'copy', label: 'copy', glyph: '⧉', hint: '⌘C', onSelect: () => Object.assign(clipboard, { cards: [card], labels: [], edges: c.edges, pasted: 0 }) },
    ...(c.editor
      ? [
          { key: 'dup', label: 'duplicate', glyph: '⊕', letter: 'd', hint: '⌘D', onSelect: () => setSelection(copyCards(c.wid, c.plane, [card], c.edges, by2())) },
          ...(elsewhere(card, c.places, c.plane).length
            ? [
                { key: 'off', label: 'take off this plane', glyph: '×', hint: '⌫', onSelect: () => deleteHere(c.wid, c.plane, [card], c) },
                everywhere(c, [card]),
              ]
            : [{ key: 'del', label: 'delete', glyph: '×', danger: true, hint: '⌫', onSelect: () => deleteHere(c.wid, c.plane, [card], c) }]),
        ]
      : []),
  ]
}

export function labelItems(c: Ctx, id: string): MenuEntry[] {
  const l = c.labels.find((x) => x.id === id)
  if (!l) return []
  const { cardMulti } = useCanvasView.getState()
  if (cardMulti.length > 1 && cardMulti.includes(id)) return several(c, cardMulti.length)
  return [
    ...(c.editor ? [{ key: 'edit', label: 'edit', glyph: '✎', letter: 'e', onSelect: () => useCanvasView.setState({ labelSelected: id, labelEditing: id, cardSelected: null, cardMulti: [] }) }] : []),
    { key: 'copy', label: 'copy', glyph: '⧉', hint: '⌘C', onSelect: () => Object.assign(clipboard, { cards: [], labels: [l], edges: [], pasted: 0 }) },
    ...(c.editor
      ? [
          { key: 'dup', label: 'duplicate', glyph: '⊕', letter: 'd', hint: '⌘D', onSelect: () => setSelection(copyCards(c.wid, c.plane, [], [], by2(), [l])) },
          { key: 'del', label: 'delete', glyph: '×', danger: true, hint: '⌫', onSelect: () => void deleteLabel(c.wid, l) },
        ]
      : []),
  ]
}

export function linkItems(c: Ctx, id: string): MenuEntry[] {
  const e = c.edges.find((x) => x.id === id)
  if (!e || !c.editor) return []
  return [
    { key: 'label', label: e.label ? 'edit its label' : 'add a label', glyph: '✎', letter: 'l', onSelect: () => useCanvasView.setState({ linkSelected: id, linkLabelling: true, cardSelected: null, labelSelected: null }) },
    ...(e.kind === 'for' ? [] : [{ key: 'rev', label: 'turn it round', glyph: '⇄', letter: 'r', onSelect: () => void reverseEdge(c.wid, e) }]),
    { key: 'kind', heading: 'kind' },
    ...LINK_GROUPS.map((g) => ({ key: `k-${g.kind}`, label: g.label, glyph: '━', tone: linkTone(g.kind), checked: e.kind === g.kind, onSelect: () => void updateEdge(c.wid, id, { kind: g.kind }) })),
    { key: 'del', label: 'remove', glyph: '×', danger: true, hint: '⌫', onSelect: () => void deleteEdge(c.wid, id) },
  ]
}

// Right-clicked on the plane itself: add something right there (its top-left a step from the pointer, on the grid), or
// paste what was copied there.
export function emptyItems(c: Ctx): MenuEntry[] {
  if (!c.editor) return []
  const [x, y] = c.at
  const others = c.cards
  const card = async (type: CardType) => {
    const id = await addCard(c.wid, c.plane, type, [x + 100, y + 50], others)
    useCanvasView.setState({ cardSelected: id, cardEditing: id, fresh: id, cardMulti: [] })
  }
  const text = async (what: 'heading' | 'paragraph' | 'sticky') => {
    const fields = what === 'heading' ? { size: 'heading' as const } : what === 'paragraph' ? { size: 'note' as const, w: PARA_W.initial } : { kind: 'sticky' as const, w: STICKY_W.initial, color: 'yellow' as const, ...c.me }
    const id = await addLabel(c.wid, { pieceId: c.plane, text: '', ...fields, x: snap(x), y: snap(y) })
    useCanvasView.setState({ labelSelected: id, labelEditing: id, fresh: id, cardSelected: null, cardMulti: [] })
  }
  const paste = clipboard.cards.length + clipboard.labels.length
  const pasteHere = () => {
    // The copies' top-left where the pointer is.
    const all = [...clipboard.cards, ...clipboard.labels]
    const [l, t] = [Math.min(...all.map((k) => k.x)), Math.min(...all.map((k) => k.y))]
    setSelection(copyCards(c.wid, c.plane, clipboard.cards, clipboard.edges, [snap(x - l), snap(y - t)], clipboard.labels))
  }
  return [
    ...(paste ? [{ key: 'paste', label: `paste ${paste > 1 ? `${paste} things` : 'it'} here`, glyph: '⧉', letter: 'v', hint: '⌘V', onSelect: pasteHere }] : []),
    { key: 'cards', heading: 'add a card here' },
    ...CARD_TYPES.map((t) => ({ key: t, label: t, glyph: '▌', letter: CARD_LETTER[t], tone: TONE[t], onSelect: () => void card(t) })),
    // One already on another plane (D-281): the menu turns into the list of them, where it was.
    { key: 'existing', label: 'existing card…', glyph: '⧉', letter: 'e', hint: 'from another plane', onSelect: () => useCanvasView.setState({ bringing: { plane: c.plane, at: c.at, screen: c.screen } }) },
    { key: 'text', heading: 'text here' },
    { key: 'heading', label: 'heading', glyph: TEXT_GLYPH.heading, letter: 'h', onSelect: () => void text('heading') },
    { key: 'paragraph', label: 'paragraph', glyph: TEXT_GLYPH.paragraph, letter: 'a', onSelect: () => void text('paragraph') },
    { key: 'sticky', label: 'sticky note', glyph: TEXT_GLYPH.sticky, letter: 'n', tone: 'var(--accent-yellow)', onSelect: () => void text('sticky') },
  ]
}

// The items for what's under the pointer in a focused plane; `comment` comes after them (D-193).
export function planeItems(on: 'card' | 'label' | 'link' | null, id: string | null, c: Ctx): MenuEntry[] {
  if (!on || !id) return emptyItems(c)
  return on === 'card' ? cardItems(c, id) : on === 'label' ? labelItems(c, id) : on === 'link' ? linkItems(c, id) : []
}

// What the plane needs from the canvas to build it.
export function planeCtx(wid: string, plane: string, editor: boolean, all: { cards: Card[]; labels: Label[]; edges: Edge[]; places: Place[]; pieces: Ctx['pieces'] }, me: Ctx['me'], at: [number, number], screen: [number, number] = [0, 0]): Ctx {
  const cards = cardsOn(all.cards, all.places, plane)
  const folds = foldsOf(cards, all.edges)
  return { wid, plane, editor, cards, labels: all.labels.filter((l) => l.pieceId === plane), edges: all.edges, places: all.places, pieces: all.pieces, me, at, screen, parts: (id) => folds.count.get(id) ?? 0, all: all.cards }
}
