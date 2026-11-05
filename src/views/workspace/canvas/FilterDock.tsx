// A focused plane's filters (D-233): `filter` in the focus dock, a tab of its rail (D-347); picked, its drawer opens as
// the dock's upper floor, picked again it closes. What's linked to the plane (D-210) has its own `linked N` tab and
// drawer the same way (D-235); one open at a time. On it, the filters as
// columns of tick rows side by side (D-364): SHOW (card types), FOR (the plane's customers), TAG (its tags),
// REGION (where its competitors are), LINKS (kinds of link, each in its colour), then `[reset]`. Builds and breaks cell
// by cell (D-034). The filter lasts while the focus is open (D-308).
import { AnimatePresence } from 'motion/react'
import { useEffect, type ReactNode } from 'react'
import { create } from 'zustand'
import { ALL_TYPES, type Card } from '../../../data/cards'
import { Appear } from '../../../ui/primitives/Appear'
import { FilterColumn, FilterColumns } from '../../../ui/patterns/FilterColumn'
import type { PromptEntry } from '../../../ui/foundation/promptModel'
import { ConsoleFloor, ConsoleTab, FloorTitle, useEscapeCloses } from '../../../ui/patterns/Console'
import { linkTone } from '../plane/PlaneLinks'
import { LINK_GROUPS, narrowing, setFilter, START, useFilter, useHoldFilter, type Filter } from './planeFilter'
import styles from './FilterDock.module.css'
import { CARD_TONE } from '../../../ui/foundation/cardTone'
import { Button } from '../../../ui/primitives/Button'
import { cardName } from '../../../model/cardName'
import { flip, pickRows } from './filterPick'

// What's open over the focus dock (D-233, D-235, D-347): one drawer at a time; Escape closes it (once no menu in it is
// open).
type Shelf = { filter: boolean; linked: boolean; view: boolean }
export const useShelf = create<Shelf>(() => ({ filter: false, linked: false, view: false }))
export const SHUT: Shelf = { filter: false, linked: false, view: false }

// The plane's dock: `filter` and `linked N` (what's stuck to it, D-210), each opening its drawer as the dock's floor.
export function PlaneDockExtras({ plane, cards, stuck }: { plane: string; cards: Card[]; stuck?: { count: number; strip: ReactNode } }) {
  const { filter, linked } = useShelf()
  const f = useFilter(plane)
  useHoldFilter(plane)
  const n = narrowing(f)
  const view = useShelf((s) => s.view)
  useEscapeCloses(filter || linked || view, () => useShelf.setState(SHUT))
  useEffect(() => () => useShelf.setState(SHUT), [])
  return (
    <>
      <ConsoleTab label="filter" n={n} open={filter} title={filter ? 'close the filters' : 'what this plane shows'} onClick={() => useShelf.setState({ ...SHUT, filter: !filter })} />
      {stuck && stuck.count > 0 && (
        <ConsoleTab label="linked" n={stuck.count} open={linked} title={linked ? 'close what is linked' : 'what is linked to this plane: open it beside'} onClick={() => useShelf.setState({ ...SHUT, linked: !linked })} />
      )}
      <ConsoleFloor>
        <AnimatePresence>
          {linked && stuck && stuck.count > 0 && (
            <Appear key="linked" className={styles.panel} role="group" aria-label="Linked">
              <FloorTitle summary="open one beside the plane">linked</FloorTitle>
              <div className={styles.cells}>{stuck.strip}</div>
            </Appear>
          )}
          {filter && <Panel key="filter" plane={plane} cards={cards} f={f} />}
        </AnimatePresence>
      </ConsoleFloor>
    </>
  )
}

// The filters as columns side by side (D-364), each a short list of tick rows: every value one click away; what's
// picked moves up under `any …` once the pointer leaves the column.
function Panel({ plane, cards, f }: { plane: string; cards: Card[]; f: Filter }) {
  const set = (patch: Partial<Filter>) => setFilter(plane, { ...f, ...patch })
  const customers = cards.filter((c) => c.type === 'customer')
  const tagCount = new Map<string, number>()
  for (const c of cards) for (const t of c.tags ?? []) tagCount.set(t, (tagCount.get(t) ?? 0) + 1)
  const tags = [...tagCount.keys()].sort()
  const regions = [...new Set(cards.filter((c) => c.type === 'competitor').flatMap((c) => c.regions ?? []))].sort()
  const show: PromptEntry[] = ALL_TYPES.map((t) => ({ key: t, label: `${t}s`, checked: !f.hide.includes(t), tone: TYPE_TONE[t], onSelect: () => set({ hide: flip(f.hide, t) }) }))
  const forItems = pickRows(f.for, 'any customer', customers.map((c) => ({ key: c.id, label: cardName(c), tone: CARD_TONE.customer })), (v) => set({ for: v }))
  const tagItems = pickRows(f.tags, 'any tag', tags.map((t) => ({ key: t, label: `#${t}`, hint: `${tagCount.get(t)}` })), (v) => set({ tags: v }))
  const regionItems = pickRows(f.regions, 'anywhere', regions.map((r) => ({ key: r, label: r })), (v) => set({ regions: v }))
  const linkItems: PromptEntry[] = [
    { key: 'all', label: 'every link', checked: f.links.length === 0, onSelect: () => set({ links: [] }) },
    ...LINK_GROUPS.map((g) => ({ key: g.key, label: g.label, checked: !f.links.includes(g.key), tone: linkTone(g.kind), glyph: '━', hint: START.links.includes(g.key) ? 'starts hidden' : undefined, onSelect: () => set({ links: flip(f.links, g.key) }) })),
  ]
  const linksNarrow = f.links.filter((g) => !START.links.includes(g)).length
  return (
    <Appear className={styles.panel} role="group" aria-label="Filters" data-learn="filter-strip">
      <FloorTitle summary={narrowing(f) ? `${narrowing(f)} narrowing what's shown` : "everything's shown"}>filter</FloorTitle>
      <FilterColumns>
        <FilterColumn label="show" items={show} narrowing={f.hide.length} ariaLabel="Show card types" />
        {/* A filter with nothing to pick on this plane isn't shown: the drawer keeps its room for the rest. */}
        {customers.length > 0 && <FilterColumn label="for" items={forItems} narrowing={f.for.length} rise wide ariaLabel="Only cards for these customers" />}
        {tags.length > 0 && <FilterColumn label="tag" items={tagItems} narrowing={f.tags.length} rise ariaLabel="Only cards with these tags" />}
        {regions.length > 0 && <FilterColumn label="region" items={regionItems} narrowing={f.regions.length} rise ariaLabel="Competitors in these places" />}
        {/* `for`, `relates` and `competes` start hidden, so only hiding another kind counts as narrowing. */}
        <FilterColumn label="links" items={linkItems} narrowing={linksNarrow} wide noLine ariaLabel="Show links by kind" />
        <Button className={styles.reset} onClick={() => setFilter(plane, START)} title="back to how it starts">
          reset
        </Button>
      </FilterColumns>
    </Appear>
  )
}

// Each card type's colour (its edge), as the old SHOW's swatches.
const TYPE_TONE: Record<string, string> = CARD_TONE
