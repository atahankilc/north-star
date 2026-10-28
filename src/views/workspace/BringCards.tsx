// Bringing cards from other planes onto this one (D-281, docs/specs/shared-cards.md): the `+`'s `existing card…` or the
// right-click's turns into this list where it was. Every card not on this plane, by type in the chain's order, each
// with the planes it's on and what comes with it; typed, it narrows by title, tags, type and plane. Enter brings the
// card (with its parts or members) to the view's middle or where the right-click was, clear of what's there, selected
// and glided to; ⇧Enter brings it and keeps the list open; ⌥Enter moves it here instead (off the plane it's at home on).
import { useEffect, useMemo } from 'react'
import { CARD_TYPES, type AnyType, type Card } from '../../data/cards'
import { bringIn, cardsOn, planesOf, withParts } from '../../data/places'
import { glide, useCanvasView } from '../../state/canvasView'
import { isReducedMotion } from '../../state/motion'
import type { MenuEntry } from '../../ui/Menu'
import { ContextMenu } from './ContextMenu'
import { useWs } from './context'
import { TYPE_ACCENT } from './PlaneCards'

const ORDER: AnyType[] = [...CARD_TYPES, 'package']
const MANY: Record<AnyType, string> = { customer: 'customers', problem: 'problems', competitor: 'competitors', idea: 'ideas', feature: 'features', package: 'packages' }

const close = () => useCanvasView.setState({ bringing: null })

// The view moves only when what came lands off screen: its middle to the view's middle.
function show(box: { x: number; y: number; w: number; h: number }) {
  const { planeCam: c, size } = useCanvasView.getState()
  if (!c) return
  const [l, t] = [c.ox + box.x * c.zoom, c.oy + box.y * c.zoom]
  const [r, b] = [l + box.w * c.zoom, t + box.h * c.zoom]
  if (l >= 0 && t >= 0 && r <= size.w && b <= size.h) return
  const to = { ...c, ox: size.w / 2 - (box.x + box.w / 2) * c.zoom, oy: size.h / 2 - (box.y + box.h / 2) * c.zoom }
  if (isReducedMotion()) useCanvasView.setState({ planeCam: to })
  else glide(c, to, 420, (v) => useCanvasView.setState({ planeCam: v }))
}

// `here`: the plane in focus; the list closes when that changes.
export function BringCards({ here, origin }: { here: string; origin: { left: number; top: number } }) {
  const open = useCanvasView((s) => s.bringing)
  const bringing = open?.plane === here ? open : null
  useEffect(() => {
    if (open && open.plane !== here) close()
  }, [open, here])
  const { wid, cards, places, edges, pieces } = useWs()
  const plane = bringing?.plane
  const items = useMemo((): MenuEntry[] => {
    if (!plane) return []
    const here = new Set(cardsOn(cards, places, plane).map((c) => c.id))
    const name = (id: string) => pieces.find((p) => p.id === id)?.name?.trim() || 'plane'
    // Only cards something comes along with need the walk: a part's parent, a package.
    const parents = new Set(edges.filter((e) => e.kind === 'part-of').map((e) => e.toId))
    const out: MenuEntry[] = []
    for (const type of ORDER) {
      const list = cards.filter((c) => c.type === type && !here.has(c.id)).sort((a, b) => (a.title || '~').localeCompare(b.title || '~'))
      if (!list.length) continue
      out.push({ key: `#${type}`, heading: MANY[type] })
      for (const c of list) {
        const on = planesOf(c, places).map(name)
        const along = parents.has(c.id) || c.memberIds?.length ? withParts([c], cards, edges).filter((x) => !here.has(x.id)).length - 1 : 0
        const where = on.length > 2 ? `${on.slice(0, 2).join(', ')} +${on.length - 2}` : on.join(', ')
        out.push({
          key: c.id,
          label: c.title || `untitled ${type}`,
          glyph: '▌',
          tone: TYPE_ACCENT[type],
          hint: `${along ? `+${along} ${type === 'package' ? 'inside' : along === 1 ? 'part' : 'parts'} · ` : ''}${where.toUpperCase()}`,
          words: [type, ...(c.tags ?? []), ...on].join(' '),
          onSelect: (how) => bring(c, how),
        })
      }
    }
    return out
    // `bring` reads the store and these lists when picked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plane, cards, places, edges, pieces])
  if (!bringing || !plane) return null

  function bring(card: Card, how: { shift: boolean; alt: boolean }) {
    const b = useCanvasView.getState().bringing
    const c = useCanvasView.getState().planeCam
    const { size } = useCanvasView.getState()
    if (!b || !c) return
    const at = b.at ?? ([(size.w / 2 - c.ox) / c.zoom, (size.h / 2 - c.oy) / c.zoom] as [number, number])
    const { ids, box } = bringIn(wid, b.plane, [card], { cards, places, edges }, at, how.alt)
    if (!ids.length || !box) return
    show(box)
    if (how.shift) return 'keep'
    useCanvasView.setState({ cardSelected: card.id, cardMulti: [], labelSelected: null })
  }

  return (
    <ContextMenu
      at={[bringing.screen[0] - origin.left, bringing.screen[1] - origin.top]}
      items={items}
      what="Cards from other planes"
      prompt="bring a card from another plane…"
      keys="↵ bring · ⇧↵ more · ⌥↵ move here"
      noun="cards"
      empty="No cards on other planes yet"
      wide
      onClose={close}
    />
  )
}
