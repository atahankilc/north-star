// A focused plane's filters (D-233): one `[filter]` in the focus dock; pressed, a strip opens over the dock in the
// console's look (the same edge, magenta marks on its top corners), pressed again it closes. What's linked to the plane
// (D-210) has its own `[linked · N]` and strip the same way (D-235), under the filter's when both are open. On it, the old board's
// filters in a row, each its own menu (the user): SHOW (card types), FOR (the plane's customers), TAG (its tags),
// REGION (where its competitors are), LINKS (kinds of link, each in its colour), then `[reset]`. Builds and breaks cell
// by cell (D-034). The filter lasts while the focus is open (D-308).
import { AnimatePresence } from 'motion/react'
import { useEffect, type ReactNode } from 'react'
import { create } from 'zustand'
import { ALL_TYPES, type Card } from '../../data/cards'
import { Appear } from '../../ui/Appear'
import { useCanvasView } from '../../state/canvasView'
import { Menu, type MenuEntry } from '../../ui/Menu'
import menuStyles from '../../ui/Menu.module.css'
import { DockAction } from './FocusDock'
import { linkTone } from './PlaneLinks'
import { LINK_GROUPS, narrowing, setFilter, START, useFilter, useHoldFilter, type Filter } from './planeFilter'
import styles from './FilterDock.module.css'

// What opens over the focus dock (D-233, D-235): each its own strip in the console's look, stacked with a gap; Escape
// closes the top one (once no menu in it is open).
type Shelf = { filter: boolean; linked: boolean }
export const useShelf = create<Shelf>(() => ({ filter: false, linked: false }))

// The plane's dock: `[filter]` and `[linked · N]` (what's stuck to it, D-210), each opening its strip over the dock.
export function PlaneDockExtras({ plane, cards, stuck }: { plane: string; cards: Card[]; stuck?: { count: number; strip: ReactNode } }) {
  const { filter, linked } = useShelf()
  // No wider than the plane's own part of the screen (its half with something open beside it, D-211), clear of the
  // side nav on the left.
  const room = useCanvasView((s) => (s.beside ? Math.round(s.size.w * s.split) : s.size.w)) - 2 * 72
  const f = useFilter(plane)
  useHoldFilter(plane)
  const n = narrowing(f)
  useEffect(() => {
    if (!filter && !linked) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if ((e.target as HTMLElement | null)?.closest('input, textarea, [role=menu], [role=listbox], [aria-modal=true], [data-coach]')) return
      e.stopImmediatePropagation()
      useShelf.setState(filter ? { filter: false } : { linked: false })
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [filter, linked])
  useEffect(() => () => useShelf.setState({ filter: false, linked: false }), [])
  return (
    <>
      <DockAction
        label={n ? `filter · ${n}` : 'filter'}
        pressed={filter || n > 0}
        title={filter ? 'close the filters' : 'what this plane shows'}
        onClick={() => useShelf.setState({ filter: !filter })}
      />
      {stuck && stuck.count > 0 && (
        <DockAction
          label={`linked · ${stuck.count}`}
          pressed={linked}
          title={linked ? 'close what is linked' : 'what is linked to this plane: open it beside'}
          onClick={() => useShelf.setState({ linked: !linked })}
        />
      )}
      {/* Stacked upwards: what's linked nearest the dock, the filter over it. */}
      <div className={styles.shelf} style={{ maxWidth: room }}>
        <AnimatePresence>
          {linked && stuck && stuck.count > 0 && (
            <Appear key="linked" className={styles.panel} role="group" aria-label="Linked">
              {stuck.strip}
            </Appear>
          )}
          {filter && <Panel key="filter" plane={plane} cards={cards} f={f} />}
        </AnimatePresence>
      </div>
    </>
  )
}

// The old board's filter bar (D-053, D-066), one framed `LABEL value ▾` after another, each its own menu opening upwards;
// lit while it narrows what's shown.
function Panel({ plane, cards, f }: { plane: string; cards: Card[]; f: Filter }) {
  const set = (patch: Partial<Filter>) => setFilter(plane, { ...f, ...patch })
  const flip = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const customers = cards.filter((c) => c.type === 'customer')
  const tagCount = new Map<string, number>()
  for (const c of cards) for (const t of c.tags ?? []) tagCount.set(t, (tagCount.get(t) ?? 0) + 1)
  const tags = [...tagCount.keys()].sort()
  const regions = [...new Set(cards.filter((c) => c.type === 'competitor').flatMap((c) => c.regions ?? []))].sort()
  const swatches = (list: { key: string; tone: string; on: boolean }[]) =>
    list.map((s) => <span key={s.key} className={menuStyles.swatch} data-on={s.on} style={{ ['--tone' as string]: s.tone }} />)
  const named = (ids: string[], name: (id: string) => string) => (ids.length === 0 ? 'any' : ids.length === 1 ? name(ids[0]) : `${ids.length}`)
  const show: MenuEntry[] = ALL_TYPES.map((t) => ({ key: t, label: `${t}s`, checked: !f.hide.includes(t), tone: TYPE_TONE[t], onSelect: () => set({ hide: flip(f.hide, t) }) }))
  const forItems: MenuEntry[] = [
    { key: 'any', label: 'any customer', checked: f.for.length === 0, onSelect: () => set({ for: [] }) },
    ...customers.map((c) => ({ key: c.id, label: c.title || 'untitled', checked: f.for.includes(c.id), tone: 'var(--accent-green)', onSelect: () => set({ for: flip(f.for, c.id) }) })),
  ]
  const tagItems: MenuEntry[] = [
    { key: 'any', label: 'any tag', checked: f.tags.length === 0, onSelect: () => set({ tags: [] }) },
    ...tags.map((t) => ({ key: t, label: `#${t}`, checked: f.tags.includes(t), hint: `${tagCount.get(t)}`, onSelect: () => set({ tags: flip(f.tags, t) }) })),
  ]
  const regionItems: MenuEntry[] = [
    { key: 'any', label: 'anywhere', checked: f.regions.length === 0, onSelect: () => set({ regions: [] }) },
    ...regions.map((r) => ({ key: r, label: r, checked: f.regions.includes(r), onSelect: () => set({ regions: flip(f.regions, r) }) })),
  ]
  const linkItems: MenuEntry[] = [
    { key: 'all', label: 'every link', checked: f.links.length === 0, onSelect: () => set({ links: [] }) },
    ...LINK_GROUPS.map((g) => ({ key: g.key, label: g.label, checked: !f.links.includes(g.key), tone: linkTone(g.kind), glyph: '━', hint: START.links.includes(g.key) ? 'starts hidden' : undefined, onSelect: () => set({ links: flip(f.links, g.key) }) })),
  ]
  const linksNarrow = f.links.some((g) => !START.links.includes(g))
  return (
    <Appear className={styles.panel} role="group" aria-label="Filters" data-learn="filter-strip">
      <Menu label="show" up summary={swatches(ALL_TYPES.map((t) => ({ key: t, tone: TYPE_TONE[t], on: !f.hide.includes(t) })))} active={f.hide.length > 0} items={show} ariaLabel="Show card types" noun="types" />
      <Menu label="for" up summary={named(f.for, (id) => customers.find((c) => c.id === id)?.title || '1')} active={f.for.length > 0} items={customers.length ? forItems : []} ariaLabel="Only cards for these customers" empty="No customers on this plane" noun="customers" />
      <Menu label="tag" up summary={named(f.tags, (t) => `#${t}`)} active={f.tags.length > 0} items={tags.length ? tagItems : []} ariaLabel="Only cards with these tags" empty="No tags on this plane" noun="tags" />
      <Menu label="region" up summary={named(f.regions, (r) => r)} active={f.regions.length > 0} items={regions.length ? regionItems : []} ariaLabel="Competitors in these places" empty="No regions set on this plane's competitors" noun="places" />
      <Menu
        label="links"
        up
        summary={swatches(LINK_GROUPS.map((g) => ({ key: g.key, tone: linkTone(g.kind), on: !f.links.includes(g.key) })))}
        // `for`, `relates` and `competes` start hidden, so only hiding another kind counts as narrowing.
        active={linksNarrow}
        items={linkItems}
        ariaLabel="Show links by kind"
        noun="kinds"
      />
      <button className={styles.reset} onClick={() => setFilter(plane, START)} title="back to how it starts">
        reset
      </button>
    </Appear>
  )
}

// Each card type's colour (its edge), as the old SHOW's swatches.
const TYPE_TONE: Record<string, string> = {
  customer: 'var(--accent-green)',
  problem: 'var(--accent-magenta)',
  competitor: 'var(--accent-yellow)',
  idea: 'var(--fg)',
  feature: 'var(--accent-cyan)',
  package: 'var(--accent-blue)',
}
