// /workspaces/:wid/flow: the chain drawn by the app (D-045). Columns go Customers → Problems → Competitors → Ideas → Features;
// links decide the rows, and empty cells say what's missing. Nothing to drag; clicking an item opens the side panel.
import { useMemo } from 'react'
import { BOARD_TYPES, type BoardType } from '../../data/model'
import { useCanvas } from '../../state/canvasStore'
import { useWsView } from '../../state/workspaceView'
import { Appear } from '../../ui/Appear'
import { DecodeText } from '../../ui/DecodeText'
import { BOARD_KINDS, TYPE_ACCENT, useBoardItems, useVisibleItems, type BoardItem } from '../canvas/boardKinds'
import { DetailPanel } from '../canvas/DetailPanel'
import { useWs } from '../workspace/context'
import { FilterBar } from '../workspace/FilterBar'
import { useNeighbours, useSelectionScope } from '../workspace/graph'
import { MarkSign, markHoverOf, markRing, peerRings, PeerTags, usePeersOn, Was } from '../workspace/PeerMarks'
import { useMarkOf } from '../workspace/stage'
import styles from './FlowView.module.css'

type Row = { key: string; cells: Record<BoardType, BoardItem[]>; loose?: boolean }

const MISSING: Record<BoardType, string> = {
  customer: '(who has it?)',
  problem: '(no problem yet)',
  competitor: '(none researched)',
  idea: '(no idea yet)',
  feature: '(none yet)',
}

const byAge = (a: BoardItem, b: BoardItem) => a.createdAt - b.createdAt
const emptyCells = (): Record<BoardType, BoardItem[]> => ({ customer: [], problem: [], competitor: [], idea: [], feature: [] })

// One row per problem; then ideas that solve no problem yet; then customers with neither; then whatever links to nothing.
function buildRows(items: BoardItem[], neighbours: Map<string, Set<string>>): Row[] {
  const of = (type: BoardType) => items.filter((i) => i.type === type).sort(byAge)
  const near = (ids: string[], type: BoardType) => {
    const linked = new Set(ids.flatMap((id) => [...(neighbours.get(id) ?? [])]))
    return of(type).filter((i) => linked.has(i.id))
  }
  const placed = new Set<string>()
  const rows: Row[] = []
  const push = (key: string, cells: Record<BoardType, BoardItem[]>) => {
    for (const list of Object.values(cells)) for (const i of list) placed.add(i.id)
    rows.push({ key, cells })
  }

  for (const p of of('problem')) {
    const ideas = near([p.id], 'idea')
    const anchors = [p.id, ...ideas.map((i) => i.id)]
    const rivals = near(anchors, 'competitor')
    push(p.id, {
      customer: near([p.id], 'customer'),
      problem: [p],
      competitor: rivals,
      idea: ideas,
      // What we build for this problem, its ideas, or to answer these competitors.
      feature: near([...anchors, ...rivals.map((c) => c.id)], 'feature'),
    })
  }
  for (const i of of('idea')) {
    if (placed.has(i.id)) continue
    push(i.id, { ...emptyCells(), customer: near([i.id], 'customer'), competitor: near([i.id], 'competitor'), idea: [i], feature: near([i.id], 'feature') })
  }
  for (const c of of('customer')) {
    if (placed.has(c.id)) continue
    push(c.id, { ...emptyCells(), customer: [c], competitor: near([c.id], 'competitor') })
  }
  const loose = emptyCells()
  for (const type of ['competitor', 'feature'] as const) loose[type] = of(type).filter((i) => !placed.has(i.id))
  if (loose.competitor.length || loose.feature.length) rows.push({ key: 'loose', cells: loose, loose: true })
  return rows
}

export function FlowView() {
  const { edges, competitorFeatures } = useWs()
  const all = useBoardItems()
  const visible = useVisibleItems(all)
  const types = useWsView((s) => s.types)
  // A link to one of a competitor's features counts as a link to that competitor.
  const owners = useMemo(() => new Map(competitorFeatures.map((f) => [f.id, f.competitorId])), [competitorFeatures])
  const neighbours = useNeighbours(edges, owners)
  useSelectionScope()

  const columns = BOARD_TYPES.filter((t) => types.includes(t))
  // A row with nothing in the shown columns (types filtered off) is dropped.
  const rows = useMemo(
    () => buildRows(visible, neighbours).filter((r) => columns.some((t) => r.cells[t].length > 0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visible, neighbours, types],
  )

  return (
    <main className={styles.page}>
      <FilterBar />
      {rows.length === 0 ? (
        <div className={styles.empty}>
          <DecodeText text={all.length === 0 ? 'Add customers, problems and ideas on the board to see the chain' : 'Nothing here with these filters'} />
        </div>
      ) : (
        <Appear className={styles.frame}>
          <div className={styles.grid} style={{ ['--cols' as string]: columns.length }} role="table" aria-label="Flow">
            <div className={styles.row} role="row">
              {columns.map((t) => (
                <div key={t} className={styles.head} role="columnheader" style={{ ['--tone' as string]: TYPE_ACCENT[t] }}>
                  {BOARD_KINDS[t].plural}
                </div>
              ))}
            </div>
            {rows.map((row) => (
              <div key={row.key} className={styles.row} data-loose={row.loose} role="row">
                {columns.map((t, i) => {
                  const list = row.cells[t]
                  // The connector into this cell is solid when both sides have something.
                  const joined = i > 0 && list.length > 0 && row.cells[columns[i - 1]].length > 0
                  return (
                    <div key={t} className={styles.cell} data-first={i === 0} data-joined={joined} data-loose={row.loose} role="cell">
                      {list.length === 0 ? (
                        <span className={styles.missing}>{row.loose ? '' : MISSING[t]}</span>
                      ) : (
                        list.map((item) => <Chip key={item.id} item={item} />)
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </Appear>
      )}
      <DetailPanel items={all} />
    </main>
  )
}

function Chip({ item }: { item: BoardItem }) {
  const selected = useCanvas((s) => s.selectedId === item.id)
  const select = useCanvas((s) => s.select)
  const peers = usePeersOn(item.id)
  // The assistant's preview (D-096): its diff sign and ring, an edit's old title under the chip.
  const { mark, before, lit } = useMarkOf(item.id)
  const ring = [markRing(mark, lit), peerRings(peers)].filter(Boolean).join(', ') || undefined
  return (
    <span className={styles.chipRow} data-mark-id={mark ? item.id : undefined} {...markHoverOf(item.id, mark)}>
      <span className={styles.chipStack}>
        <button
          className={styles.chip}
          data-selected={selected}
          data-mark={mark}
          style={{ ['--tone' as string]: TYPE_ACCENT[item.type], boxShadow: ring }}
          onClick={() => select(selected ? null : item.id)}
          title={item.title || 'Untitled'}
        >
          {item.title || 'Untitled'}
        </button>
        <Was before={before} field={['title', 'name']} className={styles.was} />
      </span>
      {mark && <MarkSign mark={mark} lit={lit} />}
      <PeerTags peers={peers} />
    </span>
  )
}
