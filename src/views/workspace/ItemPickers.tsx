// Side-panel row for the customers an item is for (D-044), as a multi-select dropdown so it stays one line (D-057).
import { useMemo } from 'react'
import { createEdge, deleteEdge } from '../../data/edges'
import { FOR, type BoardType } from '../../data/model'
import choice from '../../ui/Choice.module.css'
import { Menu } from '../../ui/Menu'
import { useWs } from './context'

type Item = { id: string; type: BoardType }

export function ForPicker({ item }: { item: Item }) {
  const { wid, customers, edges } = useWs()
  const sorted = useMemo(() => [...customers].sort((a, b) => a.createdAt - b.createdAt), [customers])
  const tags = edges.filter((e) => e.kind === FOR && e.fromId === item.id && e.toType === 'customer')
  const chosen = sorted.filter((c) => tags.some((e) => e.toId === c.id))

  const toggle = (customerId: string) => {
    const edge = tags.find((e) => e.toId === customerId)
    if (edge) void deleteEdge(wid, edge.id)
    else void createEdge(wid, { id: item.id, type: item.type }, { id: customerId, type: 'customer' }, FOR)
  }

  const summary = chosen.length === 0 ? 'nobody yet' : chosen.length === 1 ? chosen[0].title || 'Untitled' : `${chosen.length} customers`

  return (
    <div className={choice.row}>
      <span className={choice.label}>for</span>
      <Menu
        label=""
        summary={summary}
        // The panel's right edge would clip a menu opening rightwards.
        alignEnd
        ariaLabel="Customers this is for"
        empty="No customers yet: create one with + on the board"
        items={sorted.map((c) => ({
          key: c.id,
          label: c.title || 'Untitled',
          checked: tags.some((e) => e.toId === c.id),
          tone: 'var(--accent-green)',
          onSelect: () => toggle(c.id),
        }))}
      />
    </div>
  )
}
