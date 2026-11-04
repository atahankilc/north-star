// A kanban's filters in its dock (D-256), the plane's way (D-233): the `filter` tab (`filter N` while narrowing) opens
// its drawer as the dock's upper floor (D-347): GIVEN TO, DUE, FOR, LABEL, each a column of tick rows (D-364), then `[reset]`. Escape
// closes it. In the kanban's focus and in its pane beside a plane; a timeline's too (D-262), over its kanbans' tasks
// (`pool`). The filter lasts while one of these is open (D-308).
import { AnimatePresence } from 'motion/react'
import type { WithId } from '../../../data/hooks'
import type { Piece } from '../../../data/model'
import { useAuth } from '../../../data/auth'
import { useWorkspaceMembers } from '../../../data/workspaces'
import type { Task } from '../../../data/tasks'
import { Appear } from '../../../ui/primitives/Appear'
import { FilterColumn, FilterColumns } from '../../../ui/patterns/FilterColumn'
import type { PromptEntry } from '../../../ui/foundation/promptModel'
import { useWs } from '../canvas/context'
import { ConsoleFloor, ConsoleTab, FloorTitle, useDrawer } from '../../../ui/patterns/Console'
import { NO_FILTER, narrowing, setKanbanFilter, useHoldKanbanFilter, useKanbanFilter, type DueKey, type KanbanFilter } from './kanbanFilter'
import { CARD_TONE } from '../../../ui/foundation/cardTone'
import { learn } from '../../../onboarding/learn'
import styles from '../canvas/FilterDock.module.css'
import { Button } from '../../../ui/primitives/Button'
import { cardName } from '../../../model/cardName'
import { flip, pickRows } from '../canvas/filterPick'
import { ALL_TYPES } from '../../../model/cards'


const DUE: { key: DueKey; label: string }[] = [
  { key: 'past', label: 'past its day' },
  { key: 'today', label: 'today' },
  { key: 'week', label: 'this week' },
  { key: 'none', label: 'no day' },
]

// A kanban holding cards (D-268) has no task filter (its own filter is for later: docs/specs/priorities.md).
export function KanbanFilterDock(props: { piece: WithId<Piece>; pool?: Task[] }) {
  return props.piece.kanban?.holds === 'cards' ? null : <TaskFilterDock {...props} />
}

function TaskFilterDock({ piece, pool }: { piece: WithId<Piece>; pool?: Task[] }) {
  const [open, toggle] = useDrawer(`filter:${piece.id}`)
  const f = useKanbanFilter(piece.id)
  useHoldKanbanFilter(piece.id)
  const n = narrowing(f)
  return (
    <>
      <ConsoleTab label="filter" n={n} open={open} title={open ? 'close the filters' : 'which tasks it shows'} onClick={() => (toggle(), !open && learn('filter-open', { kind: 'kanban' }))} />
      <ConsoleFloor>
        <AnimatePresence>{open && <Strip key="filter" piece={piece} f={f} pool={pool} />}</AnimatePresence>
      </ConsoleFloor>
    </>
  )
}

function Strip({ piece, f, pool }: { piece: WithId<Piece>; f: KanbanFilter; pool?: Task[] }) {
  const { wid, workspace, tasks, cards } = useWs()
  const { user } = useAuth()
  const members = useWorkspaceMembers(wid, workspace.memberIds).filter((m) => m.id !== user?.id)
  const mine = pool ?? tasks.filter((t) => t.pieceId === piece.id)
  const set = (patch: Partial<KanbanFilter>) => setKanbanFilter(piece.id, { ...f, ...patch })
  const count = (keep: (t: (typeof mine)[number]) => boolean) => `${mine.filter(keep).length}`

  const who = pickRows(
    f.who,
    'anyone',
    [
      { key: 'me', label: 'me', hint: count((t) => t.assignee === user?.id) },
      { key: 'nobody', label: 'nobody', hint: count((t) => !t.assignee) },
      ...members.map((m) => ({ key: m.id, label: m.name, hint: count((t) => t.assignee === m.id) })),
    ],
    (v) => set({ who: v }),
  )

  const due = pickRows(f.due, 'any day', DUE.map((d) => ({ key: d.key, label: d.label, tone: d.key === 'past' ? 'var(--accent-magenta)' : undefined })), (v) => set({ due: v }))

  // The card types and cards its tasks are for.
  const forCards = [...new Set(mine.flatMap((t) => (t.cardId ? [t.cardId] : [])))].flatMap((id) => cards.filter((c) => c.id === id))
  const types = ALL_TYPES.filter((ty) => forCards.some((c) => c.type === ty))
  const forItems: PromptEntry[] = [
    { key: 'any', label: 'anything', checked: !f.for.length, onSelect: () => set({ for: [] }) },
    { key: 'none', label: 'no card', checked: f.for.includes('none'), hint: count((t) => !t.cardId), onSelect: () => set({ for: flip(f.for, 'none') }) },
    ...(types.length ? [{ key: 'h-types', heading: 'types' }] : []),
    ...types.map((ty) => ({ key: `type:${ty}`, label: `${ty}s`, checked: f.for.includes(`type:${ty}`), tone: CARD_TONE[ty], onSelect: () => set({ for: flip(f.for, `type:${ty}`) }) })),
    ...(forCards.length ? [{ key: 'h-cards', heading: 'cards' }] : []),
    ...forCards.map((c) => ({ key: c.id, label: cardName(c), checked: f.for.includes(c.id), tone: CARD_TONE[c.type], hint: count((t) => t.cardId === c.id), onSelect: () => set({ for: flip(f.for, c.id) }) })),
  ]

  const labelCount = new Map<string, number>()
  for (const t of mine) for (const l of t.labels ?? []) labelCount.set(l, (labelCount.get(l) ?? 0) + 1)
  const labels = [...labelCount.keys()].sort()
  const labelItems = pickRows(f.labels, 'any label', labels.map((l) => ({ key: l, label: `#${l}`, hint: `${labelCount.get(l)}` })), (v) => set({ labels: v }))

  return (
    <Appear className={styles.panel} role="group" aria-label="Filters" data-learn="filter-strip">
      <FloorTitle summary={narrowing(f) ? `${narrowing(f)} narrowing its tasks` : 'every task'}>filter</FloorTitle>
      <FilterColumns>
        <FilterColumn label="given to" items={who} narrowing={f.who.length} rise ariaLabel="Only tasks given to" />
        <FilterColumn label="due" items={due} narrowing={f.due.length} rise ariaLabel="Only tasks due" />
        <FilterColumn label="for" items={forItems} narrowing={f.for.length} rise wide ariaLabel="Only tasks for" />
        {labels.length > 0 && <FilterColumn label="label" items={labelItems} narrowing={f.labels.length} rise ariaLabel="Only tasks with these labels" />}
      </FilterColumns>
      <Button className={styles.reset} onClick={() => setKanbanFilter(piece.id, NO_FILTER)} title="show every task">
        reset
      </Button>
    </Appear>
  )
}
