// /w/:wid/table: everything the filters let through as a spreadsheet, grouped by domain (docs/specs/domains.md §4).
// Name, domain, customers, priority and status edit inline; the type opens the side panel.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { BOARD_TYPES, FEATURE_PRIORITIES, FEATURE_STATUSES, FOR, type Feature } from '../../data/model'
import { updateNode } from '../../data/nodes'
import { useCanvas } from '../../state/canvasStore'
import { ALL, useWsView } from '../../state/workspaceView'
import { Appear } from '../../ui/Appear'
import { AutosaveField } from '../../ui/AutosaveField'
import { DecodeText } from '../../ui/DecodeText'
import { BOARD_KINDS, TYPE_ACCENT, useBoardItems, useVisibleItems, type BoardItem } from '../canvas/boardKinds'
import { DetailPanel } from '../canvas/DetailPanel'
import { useWs } from '../workspace/context'
import { FilterBar } from '../workspace/FilterBar'
import { linkSummary, useSelectionScope } from '../workspace/graph'
import { DomainPicker, ForPicker } from '../workspace/ItemPickers'
import { ViewSwitch } from '../workspace/ViewSwitch'
import styles from './TableView.module.css'

type SortKey = 'type' | 'name' | 'domain' | 'for' | 'links' | 'pri' | 'status'
const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'type', label: 'type' },
  { key: 'name', label: 'name' },
  { key: 'domain', label: 'domain' },
  { key: 'for', label: 'for' },
  { key: 'links', label: 'linked to' },
  { key: 'pri', label: 'pri' },
  { key: 'status', label: 'status' },
]
const UNSORTED = 'unsorted'

type Row = { item: BoardItem; links: string; linkCount: number; domains: string; customers: string; feature?: Feature }

export function TableView() {
  const { wid, domains, customers, features, edges, competitorFeatures } = useWs()
  const all = useBoardItems()
  const visible = useVisibleItems(all)
  const domain = useWsView((s) => s.domain)
  const selectedId = useCanvas((s) => s.selectedId)
  const select = useCanvas((s) => s.select)
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'type', dir: 1 })
  const [open, setOpen] = useState<string | null>(null)
  useSelectionScope()

  const rows = useMemo(() => {
    const byId = new Map(all.map((i) => [i.id, i]))
    const domainName = new Map(domains.map((d) => [d.id, d.name]))
    const customerName = new Map(customers.map((c) => [c.id, c.title || 'Untitled']))
    const featureById = new Map(features.map((f) => [f.id, f]))
    const theirs = new Map<string, number>()
    for (const f of competitorFeatures) theirs.set(f.competitorId, (theirs.get(f.competitorId) ?? 0) + 1)

    return visible.map<Row>((item) => {
      const n = theirs.get(item.id)
      const extra = item.type === 'competitor' && n ? `${n} feature${n === 1 ? '' : 's'}` : undefined
      return {
        item,
        links: linkSummary(item, edges, byId, extra),
        linkCount: edges.filter((e) => (e.fromId === item.id && e.kind !== FOR) || e.toId === item.id).length,
        domains: item.domainIds.map((d) => domainName.get(d)).filter(Boolean).join(', '),
        customers: item.forIds.map((c) => customerName.get(c)).filter(Boolean).join(', '),
        feature: item.type === 'feature' ? featureById.get(item.id) : undefined,
      }
    })
  }, [all, visible, domains, customers, features, edges, competitorFeatures])

  const sorted = useMemo(() => {
    const value = (r: Row): string | number => {
      switch (sort.key) {
        case 'type':
          return BOARD_TYPES.indexOf(r.item.type)
        case 'name':
          return r.item.title.toLowerCase()
        case 'domain':
          return r.domains || '￿'
        case 'for':
          return r.customers || '￿'
        case 'links':
          return -r.linkCount
        case 'pri':
          return r.feature?.priority ?? '￿'
        case 'status':
          return r.feature?.status ? FEATURE_STATUSES.indexOf(r.feature.status) : 99
      }
    }
    return [...rows].sort((a, b) => {
      const x = value(a)
      const y = value(b)
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir || a.item.createdAt - b.item.createdAt
    })
  }, [rows, sort])

  // On `all`, one group per domain (an item in two domains shows in both) and the unsorted ones last.
  const groups = useMemo(() => {
    const ordered = [...domains].sort((a, b) => a.createdAt - b.createdAt)
    const scope = domain !== ALL && ordered.some((d) => d.id === domain) ? ordered.filter((d) => d.id === domain) : ordered
    const list: { id: string; name: string; rows: Row[] }[] = scope.map((d) => ({
      id: d.id,
      name: d.name,
      rows: sorted.filter((r) => r.item.domainIds.includes(d.id)),
    }))
    if (scope.length === ordered.length) list.push({ id: UNSORTED, name: UNSORTED, rows: sorted.filter((r) => r.item.domainIds.length === 0) })
    return list.filter((g) => g.rows.length > 0)
  }, [domains, domain, sorted])

  const header = (key: SortKey, label: string) => (
    <th key={key} aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
      <button
        className={styles.sort}
        onClick={() => setSort((s) => ({ key, dir: s.key === key ? (-s.dir as 1 | -1) : 1 }))}
      >
        {label}
        <span className={styles.arrow} aria-hidden>
          {sort.key === key ? (sort.dir === 1 ? ' ↓' : ' ↑') : ''}
        </span>
      </button>
    </th>
  )

  return (
    <main className={styles.page}>
      <FilterBar />
      {groups.length === 0 ? (
        <div className={styles.empty}>
          <DecodeText text={all.length === 0 ? 'Add items on the board and they show up here' : 'Nothing here with these filters'} />
        </div>
      ) : (
        <Appear className={styles.frame}>
          <table className={styles.table}>
            <thead>
              <tr>{COLUMNS.map((c) => header(c.key, c.label))}</tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g.id}>
                <tr className={styles.groupRow}>
                  <th colSpan={COLUMNS.length} scope="rowgroup">
                    <span aria-hidden>─ </span>
                    {g.name}
                    <span className={styles.count}> · {g.rows.length}</span>
                  </th>
                </tr>
                {g.rows.map((r) => {
                  const key = `${g.id}:${r.item.id}`
                  const { item } = r
                  const setName = (v: string) =>
                    void updateNode(wid, item.type, item.id, (item.type === 'competitor' ? { name: v.trim() } : { title: v.trim() }) as never)
                  return (
                    <tr key={key} data-selected={selectedId === item.id}>
                      <td>
                        <button
                          className={styles.type}
                          style={{ ['--tone' as string]: TYPE_ACCENT[item.type] }}
                          onClick={() => select(selectedId === item.id ? null : item.id)}
                          title="Open details"
                        >
                          {BOARD_KINDS[item.type].label}
                        </button>
                      </td>
                      <td className={styles.nameCell}>
                        <AutosaveField className={styles.name} label="Name" placeholder="Untitled" value={item.title} onSave={setName} />
                      </td>
                      <td>
                        <Popover id={`${key}:domain`} open={open} setOpen={setOpen} text={r.domains}>
                          <DomainPicker item={item} />
                        </Popover>
                      </td>
                      <td>
                        {item.type === 'customer' ? (
                          <span className={styles.none}>—</span>
                        ) : (
                          <Popover id={`${key}:for`} open={open} setOpen={setOpen} text={r.customers}>
                            <ForPicker item={item} />
                          </Popover>
                        )}
                      </td>
                      <td className={styles.links} title={r.links}>
                        {r.links || <span className={styles.none}>—</span>}
                      </td>
                      <td>
                        {r.feature && (
                          <select
                            className={styles.select}
                            aria-label="Priority"
                            value={r.feature.priority ?? ''}
                            onChange={(e) => void updateNode(wid, 'feature', item.id, { priority: (e.target.value || undefined) as Feature['priority'] })}
                          >
                            <option value="">—</option>
                            {FEATURE_PRIORITIES.map((p) => (
                              <option key={p}>{p}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td>
                        {r.feature && (
                          <select
                            className={styles.select}
                            aria-label="Status"
                            value={r.feature.status ?? ''}
                            onChange={(e) => void updateNode(wid, 'feature', item.id, { status: (e.target.value || undefined) as Feature['status'] })}
                          >
                            <option value="">—</option>
                            {FEATURE_STATUSES.map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            ))}
          </table>
        </Appear>
      )}
      <ViewSwitch />
      <DetailPanel items={all} />
    </main>
  )
}

// A cell that opens a small picker under itself. One open at a time; outside click or Escape closes it.
function Popover({
  id,
  open,
  setOpen,
  text,
  children,
}: {
  id: string
  open: string | null
  setOpen: (id: string | null) => void
  text: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const isOpen = open === id
  // In a portal, fixed to the viewport: the scrolling, backdrop-filtered frame would clip or trap it.
  const [at, setAt] = useState<{ left: number; top: number } | null>(null)

  useEffect(() => {
    if (!isOpen) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node) && !pop.current?.contains(e.target as Node)) setOpen(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(null)
      }
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [isOpen, setOpen])

  return (
    <div ref={ref} className={styles.popoverCell}>
      <button
        className={styles.cellButton}
        aria-expanded={isOpen}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          setAt({ left: Math.min(r.left, window.innerWidth - 380), top: r.bottom + 4 })
          setOpen(isOpen ? null : id)
        }}
      >
        {text || <span className={styles.none}>—</span>}
      </button>
      {isOpen &&
        at &&
        createPortal(
          <div ref={pop} className={styles.popover} style={at}>
            {children}
          </div>,
          document.body,
        )}
    </div>
  )
}
