// A kanban's filters in its dock (D-256), the plane's way (D-233): the `filter` tab (`filter N` while narrowing) opens
// its drawer as the dock's upper floor (D-347): GIVEN TO, DUE, FOR, LABEL, each its own menu, then `[reset]`. Escape
// closes it. In the kanban's focus and in its pane beside a plane; a timeline's too (D-262), over its kanbans' tasks
// (`pool`). The filter lasts while one of these is open (D-308).
import { AnimatePresence } from 'motion/react'
import type { WithId } from '../../../data/hooks'
import type { Piece } from '../../../data/model'
import { useAuth } from '../../../data/auth'
import { useMembers } from '../../../data/workspaces'
import type { Task } from '../../../data/tasks'
import { Appear } from '../../../ui/primitives/Appear'
import { Menu } from '../../../ui/patterns/Menu'
import type { PromptEntry } from '../../../ui/foundation/promptModel'
import { useWs } from '../canvas/context'
import { ConsoleFloor, ConsoleTab, FloorTitle, useDrawer } from '../../../ui/patterns/Console'
import { NO_FILTER, narrowing, setKanbanFilter, useHoldKanbanFilter, useKanbanFilter, type DueKey, type KanbanFilter } from './kanbanFilter'
import { CARD_TONE } from '../../../ui/foundation/cardTone'
import { learn } from '../../../onboarding/learn'
import styles from '../canvas/FilterDock.module.css'
import { Button } from '../../../ui/primitives/Button'
import { cardName } from '../../../model/cardName'


const DUE: { key: DueKey; label: string }[] = [
  { key: 'past', label: 'past its day' },
  { key: 'today', label: 'today' },
  { key: 'week', label: 'this week' },
  { key: 'none', label: 'no day' },
]
const TYPES = ['customer', 'problem', 'competitor', 'idea', 'feature', 'package'] as const

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
  const members = useMembers(wid, 100).data.filter((m) => workspace.memberIds.includes(m.id) && m.id !== user?.id)
  const mine = pool ?? tasks.filter((t) => t.pieceId === piece.id)
  const set = (patch: Partial<KanbanFilter>) => setKanbanFilter(piece.id, { ...f, ...patch })
  const flip = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const count = (keep: (t: (typeof mine)[number]) => boolean) => `${mine.filter(keep).length}`
  const named = (list: string[], name: (v: string) => string) => (list.length === 0 ? 'any' : list.length === 1 ? name(list[0]) : `${list.length}`)

  const who: PromptEntry[] = [
    { key: 'any', label: 'anyone', checked: !f.who.length, onSelect: () => set({ who: [] }) },
    { key: 'me', label: 'me', checked: f.who.includes('me'), hint: count((t) => t.assignee === user?.id), onSelect: () => set({ who: flip(f.who, 'me') }) },
    { key: 'nobody', label: 'nobody', checked: f.who.includes('nobody'), hint: count((t) => !t.assignee), onSelect: () => set({ who: flip(f.who, 'nobody') }) },
    ...members.map((m) => ({ key: m.id, label: m.name, checked: f.who.includes(m.id), hint: count((t) => t.assignee === m.id), onSelect: () => set({ who: flip(f.who, m.id) }) })),
  ]
  const whoName = (v: string) => (v === 'me' || v === 'nobody' ? v : (members.find((m) => m.id === v)?.name ?? 'someone'))

  const due: PromptEntry[] = [
    { key: 'any', label: 'any day', checked: !f.due.length, onSelect: () => set({ due: [] }) },
    ...DUE.map((d) => ({ key: d.key, label: d.label, checked: f.due.includes(d.key), tone: d.key === 'past' ? 'var(--accent-magenta)' : undefined, onSelect: () => set({ due: flip(f.due, d.key) as DueKey[] }) })),
  ]

  // The card types and cards its tasks are for.
  const forCards = [...new Set(mine.flatMap((t) => (t.cardId ? [t.cardId] : [])))].flatMap((id) => cards.filter((c) => c.id === id))
  const types = TYPES.filter((ty) => forCards.some((c) => c.type === ty))
  const forItems: PromptEntry[] = [
    { key: 'any', label: 'anything', checked: !f.for.length, onSelect: () => set({ for: [] }) },
    { key: 'none', label: 'no card', checked: f.for.includes('none'), hint: count((t) => !t.cardId), onSelect: () => set({ for: flip(f.for, 'none') }) },
    ...(types.length ? [{ key: 'h-types', heading: 'types' }] : []),
    ...types.map((ty) => ({ key: `type:${ty}`, label: `${ty}s`, checked: f.for.includes(`type:${ty}`), tone: CARD_TONE[ty], onSelect: () => set({ for: flip(f.for, `type:${ty}`) }) })),
    ...(forCards.length ? [{ key: 'h-cards', heading: 'cards' }] : []),
    ...forCards.map((c) => ({ key: c.id, label: cardName(c), checked: f.for.includes(c.id), tone: CARD_TONE[c.type], hint: count((t) => t.cardId === c.id), onSelect: () => set({ for: flip(f.for, c.id) }) })),
  ]
  const forName = (v: string) => (v === 'none' ? 'no card' : v.startsWith('type:') ? `${v.slice(5)}s` : (cards.find((c) => c.id === v)?.title ?? 'a card'))

  const labelCount = new Map<string, number>()
  for (const t of mine) for (const l of t.labels ?? []) labelCount.set(l, (labelCount.get(l) ?? 0) + 1)
  const labels = [...labelCount.keys()].sort()
  const labelItems: PromptEntry[] = [
    { key: 'any', label: 'any label', checked: !f.labels.length, onSelect: () => set({ labels: [] }) },
    ...labels.map((l) => ({ key: l, label: `#${l}`, checked: f.labels.includes(l), hint: `${labelCount.get(l)}`, onSelect: () => set({ labels: flip(f.labels, l) }) })),
  ]

  return (
    <Appear className={styles.panel} role="group" aria-label="Filters" data-learn="filter-strip">
      <FloorTitle summary={narrowing(f) ? `${narrowing(f)} narrowing its tasks` : 'every task'}>filter</FloorTitle>
      <Menu label="given to" up summary={named(f.who, whoName)} active={f.who.length > 0} items={who} ariaLabel="Only tasks given to" />
      <Menu label="due" up summary={named(f.due, (d) => DUE.find((x) => x.key === d)!.label)} active={f.due.length > 0} items={due} ariaLabel="Only tasks due" />
      <Menu label="for" up summary={named(f.for, forName)} active={f.for.length > 0} items={forItems} ariaLabel="Only tasks for" />
      <Menu label="label" up summary={named(f.labels, (l) => `#${l}`)} active={f.labels.length > 0} items={labels.length ? labelItems : []} ariaLabel="Only tasks with these labels" empty="No labels on its tasks" />
      <Button className={styles.reset} onClick={() => setKanbanFilter(piece.id, NO_FILTER)} title="show every task">
        reset
      </Button>
    </Appear>
  )
}
