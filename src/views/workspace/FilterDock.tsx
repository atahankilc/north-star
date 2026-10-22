// A focused plane's filters (D-233): one `[filter]` in the focus dock; pressed, the filter opens right on top of the dock
// in the console's look (the same edge, magenta marks on its top corners), pressed again it closes. Rows for SHOW (card
// types), FOR (the plane's customers), TAG (its tags), REGION (where its competitors are) and LINKS (kinds of link,
// each in its colour); `[reset]` puts it back as it starts. Builds and breaks cell by cell (D-034).
import { AnimatePresence } from 'motion/react'
import { useEffect } from 'react'
import { CARD_TYPES, type Card } from '../../data/cards'
import { Appear } from '../../ui/Appear'
import { DockAction } from './FocusDock'
import { linkTone } from './PlaneLinks'
import { LINK_GROUPS, narrowing, setFilter, START, useFilter, usePlaneFilter, type Filter } from './planeFilter'
import styles from './FilterDock.module.css'

export function FilterDock({ plane, cards }: { plane: string; cards: Card[] }) {
  const open = usePlaneFilter((s) => s.open)
  const f = useFilter(plane)
  const n = narrowing(f)
  // Escape closes it before anything else hears it.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      usePlaneFilter.setState({ open: false })
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])
  useEffect(() => () => usePlaneFilter.setState({ open: false }), [])
  return (
    <>
      <DockAction
        label={n ? `filter · ${n}` : 'filter'}
        pressed={open || n > 0}
        title={open ? 'close the filters' : 'what this plane shows'}
        onClick={() => usePlaneFilter.setState({ open: !open })}
      />
      <AnimatePresence>{open && <Panel key="filter" plane={plane} cards={cards} f={f} />}</AnimatePresence>
    </>
  )
}

function Panel({ plane, cards, f }: { plane: string; cards: Card[]; f: Filter }) {
  const set = (patch: Partial<Filter>) => setFilter(plane, { ...f, ...patch })
  const flip = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const customers = cards.filter((c) => c.type === 'customer')
  const tags = [...new Set(cards.flatMap((c) => c.tags ?? []))].sort()
  const regions = [...new Set(cards.filter((c) => c.type === 'competitor').flatMap((c) => c.regions ?? []))].sort()
  const row = (name: string, body: React.ReactNode, none?: string) => (
    <div className={styles.row}>
      <span className={styles.name}>{name}</span>
      <div className={styles.pills}>{body ?? <span className={styles.none}>{none}</span>}</div>
    </div>
  )
  const pill = (key: string, label: React.ReactNode, on: boolean, onClick: () => void, tone?: string) => (
    <button key={key} className={styles.pill} aria-pressed={on} style={tone ? { ['--tone' as string]: tone } : undefined} onClick={onClick}>
      {tone && <i className={styles.swatch} aria-hidden />}
      {label}
    </button>
  )
  return (
    <Appear className={styles.panel} role="group" aria-label="Filters">
      <div className={styles.head}>
        <span>filter</span>
        <button className={styles.reset} onClick={() => setFilter(plane, START)}>
          reset
        </button>
      </div>
      {row(
        'show',
        CARD_TYPES.map((t) => pill(t, t, !f.hide.includes(t), () => set({ hide: flip(f.hide, t) }))),
      )}
      {row('for', customers.length ? customers.map((c) => pill(c.id, c.title || 'untitled', f.for.includes(c.id), () => set({ for: flip(f.for, c.id) }))) : null, 'no customers on this plane')}
      {row('tag', tags.length ? tags.map((t) => pill(t, `#${t}`, f.tags.includes(t), () => set({ tags: flip(f.tags, t) }))) : null, 'no tags on this plane')}
      {row('region', regions.length ? regions.map((r) => pill(r, r, f.regions.includes(r), () => set({ regions: flip(f.regions, r) }))) : null, 'no regions set')}
      {row(
        'links',
        LINK_GROUPS.map((g) => pill(g.key, g.label, !f.links.includes(g.key), () => set({ links: flip(f.links, g.key) }), linkTone(g.kind))),
      )}
      <p className={styles.foot}>FOR, TAG and REGION keep only what's picked · hidden links still show on the card you point at</p>
    </Appear>
  )
}
