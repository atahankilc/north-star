// A kanban's filters in its dock (D-256), the plane's way (D-233): `[filter]` (`[filter · N]` while narrowing) opens a
// strip over the dock in the console's look: GIVEN TO, DUE, FOR, LABEL, each its own menu, then `[reset]`. Escape
// closes it. In the kanban's focus and in its pane beside a plane; a timeline's too (D-262), over its kanbans' tasks
// (`pool`).
import { AnimatePresence } from 'motion/react'
import { useEffect } from 'react'
import { create } from 'zustand'
import type { WithId } from '../../data/hooks'
import type { Piece } from '../../data/model'
import { useAuth } from '../../data/auth'
import { useMembers } from '../../data/workspaces'
import type { Task } from '../../data/tasks'
import { Appear } from '../../ui/Appear'
import { Menu, type MenuEntry } from '../../ui/Menu'
import { useCanvasView } from '../../state/canvasView'
import { useWs } from './context'
import { DockAction } from './FocusDock'
import { NO_FILTER, narrowing, setKanbanFilter, useKanbanFilter, type DueKey, type KanbanFilter } from './kanbanFilter'
import { TYPE_ACCENT } from './PlaneCards'
import styles from './FilterDock.module.css'

// The kanban whose strip is open.
const useOpen = create<{ piece: string | null }>(() => ({ piece: null }))

const DUE: { key: DueKey; label: string }[] = [
  { key: 'past', label: 'past its day' },
  { key: 'today', label: 'today' },
  { key: 'week', label: 'this week' },
  { key: 'none', label: 'no day' },
]
const TYPES = ['customer', 'problem', 'competitor', 'idea', 'feature', 'package'] as const

export function KanbanFilterDock({ piece, pool }: { piece: WithId<Piece>; pool?: Task[] }) {
  const open = useOpen((s) => s.piece === piece.id)
  const f = useKanbanFilter(piece.id)
  const n = narrowing(f)
  const room = useCanvasView((s) => s.size.w) - 2 * 72
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || (e.target as HTMLElement | null)?.closest('input, textarea, [role=menu], [role=listbox]')) return
      e.stopImmediatePropagation()
      useOpen.setState({ piece: null })
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])
  useEffect(() => () => useOpen.setState((s) => (s.piece === piece.id ? { piece: null } : s)), [piece.id])
  return (
    <>
      <DockAction label={n ? `filter · ${n}` : 'filter'} pressed={open || n > 0} title={open ? 'close the filters' : 'which tasks it shows'} onClick={() => useOpen.setState({ piece: open ? null : piece.id })} />
      <div className={styles.shelf} style={{ maxWidth: room }}>
        <AnimatePresence>{open && <Strip key="filter" piece={piece} f={f} pool={pool} />}</AnimatePresence>
      </div>
    </>
  )
}

function Strip({ piece, f, pool }: { piece: WithId<Piece>; f: KanbanFilter; pool?: Task[] }) {
  const { wid, workspace, tasks, cards } = useWs()
  const { user } = useAuth()
  const members = useMembers(wid, 100).data.filter((m) => workspace.memberIds.includes(m.id) && m.id !== user?.id)
  const mine = pool ?? tasks.filter((t) => t.pieceId === piece.id)
  const set = (patch: Partial<KanbanFilter>) => setKanbanFilter(piece.id, { ...f, ...patch })
  const flip = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const count = (keep: (t: (typeof mine)[number]) => boolean) => `${mine.filter(keep).length}`
  const named = (list: string[], name: (v: string) => string) => (list.length === 0 ? 'any' : list.length === 1 ? name(list[0]) : `${list.length}`)

  const who: MenuEntry[] = [
    { key: 'any', label: 'anyone', checked: !f.who.length, onSelect: () => set({ who: [] }) },
    { key: 'me', label: 'me', checked: f.who.includes('me'), hint: count((t) => t.assignee === user?.id), onSelect: () => set({ who: flip(f.who, 'me') }) },
    { key: 'nobody', label: 'nobody', checked: f.who.includes('nobody'), hint: count((t) => !t.assignee), onSelect: () => set({ who: flip(f.who, 'nobody') }) },
    ...members.map((m) => ({ key: m.id, label: m.name, checked: f.who.includes(m.id), hint: count((t) => t.assignee === m.id), onSelect: () => set({ who: flip(f.who, m.id) }) })),
  ]
  const whoName = (v: string) => (v === 'me' || v === 'nobody' ? v : (members.find((m) => m.id === v)?.name ?? 'someone'))

  const due: MenuEntry[] = [
    { key: 'any', label: 'any day', checked: !f.due.length, onSelect: () => set({ due: [] }) },
    ...DUE.map((d) => ({ key: d.key, label: d.label, checked: f.due.includes(d.key), tone: d.key === 'past' ? 'var(--accent-magenta)' : undefined, onSelect: () => set({ due: flip(f.due, d.key) as DueKey[] }) })),
  ]

  // The card types and cards its tasks are for.
  const forCards = [...new Set(mine.flatMap((t) => (t.cardId ? [t.cardId] : [])))].flatMap((id) => cards.filter((c) => c.id === id))
  const types = TYPES.filter((ty) => forCards.some((c) => c.type === ty))
  const forItems: MenuEntry[] = [
    { key: 'any', label: 'anything', checked: !f.for.length, onSelect: () => set({ for: [] }) },
    { key: 'none', label: 'no card', checked: f.for.includes('none'), hint: count((t) => !t.cardId), onSelect: () => set({ for: flip(f.for, 'none') }) },
    ...(types.length ? [{ key: 'h-types', heading: 'types' }] : []),
    ...types.map((ty) => ({ key: `type:${ty}`, label: `${ty}s`, checked: f.for.includes(`type:${ty}`), tone: TYPE_ACCENT[ty], onSelect: () => set({ for: flip(f.for, `type:${ty}`) }) })),
    ...(forCards.length ? [{ key: 'h-cards', heading: 'cards' }] : []),
    ...forCards.map((c) => ({ key: c.id, label: c.title || 'untitled', checked: f.for.includes(c.id), tone: TYPE_ACCENT[c.type], hint: count((t) => t.cardId === c.id), onSelect: () => set({ for: flip(f.for, c.id) }) })),
  ]
  const forName = (v: string) => (v === 'none' ? 'no card' : v.startsWith('type:') ? `${v.slice(5)}s` : (cards.find((c) => c.id === v)?.title ?? 'a card'))

  const labelCount = new Map<string, number>()
  for (const t of mine) for (const l of t.labels ?? []) labelCount.set(l, (labelCount.get(l) ?? 0) + 1)
  const labels = [...labelCount.keys()].sort()
  const labelItems: MenuEntry[] = [
    { key: 'any', label: 'any label', checked: !f.labels.length, onSelect: () => set({ labels: [] }) },
    ...labels.map((l) => ({ key: l, label: `#${l}`, checked: f.labels.includes(l), hint: `${labelCount.get(l)}`, onSelect: () => set({ labels: flip(f.labels, l) }) })),
  ]

  return (
    <Appear className={styles.panel} role="group" aria-label="Filters">
      <Menu label="given to" up summary={named(f.who, whoName)} active={f.who.length > 0} items={who} ariaLabel="Only tasks given to" noun="people" />
      <Menu label="due" up summary={named(f.due, (d) => DUE.find((x) => x.key === d)!.label)} active={f.due.length > 0} items={due} ariaLabel="Only tasks due" noun="days" />
      <Menu label="for" up summary={named(f.for, forName)} active={f.for.length > 0} items={forItems} ariaLabel="Only tasks for" noun="cards" />
      <Menu label="label" up summary={named(f.labels, (l) => `#${l}`)} active={f.labels.length > 0} items={labels.length ? labelItems : []} ariaLabel="Only tasks with these labels" empty="No labels on its tasks" noun="labels" />
      <button className={styles.reset} onClick={() => setKanbanFilter(piece.id, NO_FILTER)} title="show every task">
        reset
      </button>
    </Appear>
  )
}
