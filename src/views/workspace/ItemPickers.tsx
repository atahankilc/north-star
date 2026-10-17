// Side-panel row for the customers an item is for (D-044).
import { useMemo } from 'react'
import { createEdge, deleteEdge } from '../../data/edges'
import { FOR, type BoardType } from '../../data/model'
import choice from '../../ui/Choice.module.css'
import { useWs } from './context'

type Item = { id: string; type: BoardType }

function Toggle({ active, onClick, children, tone }: { active: boolean; onClick: () => void; children: string; tone?: string }) {
  return (
    <button
      className={choice.option}
      aria-pressed={active}
      data-active={active}
      data-tone={tone ? '' : undefined}
      style={tone ? { ['--tone' as string]: tone } : undefined}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function ForPicker({ item }: { item: Item }) {
  const { wid, customers, edges } = useWs()
  const sorted = useMemo(() => [...customers].sort((a, b) => a.createdAt - b.createdAt), [customers])
  const tags = edges.filter((e) => e.kind === FOR && e.fromId === item.id && e.toType === 'customer')

  const toggle = (customerId: string) => {
    const edge = tags.find((e) => e.toId === customerId)
    if (edge) void deleteEdge(wid, edge.id)
    else void createEdge(wid, { id: item.id, type: item.type }, { id: customerId, type: 'customer' }, FOR)
  }

  return (
    <div className={choice.row}>
      <span className={choice.label}>for</span>
      <span className={choice.options} role="group" aria-label="For customers">
        {sorted.length === 0 && <span className={choice.empty}>no customers yet: add one with + customer</span>}
        {sorted.map((c) => (
          <Toggle key={c.id} active={tags.some((e) => e.toId === c.id)} onClick={() => toggle(c.id)} tone="var(--accent-green)">
            {c.title || 'Untitled'}
          </Toggle>
        ))}
      </span>
    </div>
  )
}
