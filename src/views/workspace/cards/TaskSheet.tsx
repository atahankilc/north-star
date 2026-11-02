// A task on a deck (D-251, D-358): on the card face, as tall as its title (Inter, up to three lines), edged in the colour
// of the card it's for. Under the title, only when there's something: its #labels, then the card's name, and on the
// right its due day (magenta once past, unless finished), its checklist as cells, who it's given to (a square with
// their initials). Finished: a green `✓` before the title, the title grey. Hover and selection are its marks (D-265),
// in its card's colour (cyan with none); others who have it picked, theirs in their colours.
import type { MouseEvent, ReactNode, PointerEvent as ReactPointerEvent } from 'react'
import type { Card } from '../../../data/cards'
import type { Task } from '../../../data/tasks'
import { CARD_TONE } from '../../../ui/foundation/cardTone'
import { Button } from '../../../ui/primitives/Button'
import { cardName } from '../../../model/cardName'
import { CardFace } from './CardFace'
import { PriorityChip } from './PriorityChip'
import { Assignee } from './Assignee'
import { DueMark } from './DueMark'
import { Progress } from './Progress'
import styles from './Sheet.module.css'

// What a task shows under its title (a deck guesses its height from it before it's measured).
export const hasMeta = (t: Task) => !!(t.cardId || t.due || t.checks?.length || t.assignee)

type Props = {
  task: Task
  card: Card | null
  finished: boolean
  selected: boolean
  live: boolean
  lifted?: boolean
  // Finished, for a card still being tested (D-254): its line asking what it taught.
  learn?: () => void
  // Drawn over it (D-260): its comments' chip; `talk`: it has one, so its title leaves room.
  extra?: ReactNode
  talk?: boolean
  // The deck's own class (how it sits on the deck: its shade when unframed, the hand while live).
  className?: string
  onPointerDown?: (e: ReactPointerEvent<HTMLElement>) => void
  onClick?: (e: MouseEvent) => void
}

export function TaskSheet({ task, card, finished, selected, live, lifted, learn, extra, talk, className, onPointerDown, onClick }: Props) {
  const checks = task.checks ?? []
  const ticked = checks.filter((c) => c.done).length
  return (
    <CardFace
      className={[styles.sheet, className].filter(Boolean).join(' ')}
      tone={task.cardType ? CARD_TONE[task.cardType] : undefined}
      selected={selected}
      finished={finished}
      lifted={lifted}
      marks={live && !lifted}
      peersOf={task.id}
      button={live && !lifted}
      label={task.title}
      data-task={task.id}
      data-target={`task:${task.id}`}
      data-find={`task:${task.id}`}
      data-talk={talk || undefined}
      data-card={task.cardType ? true : undefined}
      extra={extra}
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      <span className={styles.title}>
        {finished && <span className={styles.tick}>✓ </span>}
        {task.priority && (
          <>
            <PriorityChip priority={task.priority} />{' '}
          </>
        )}
        {task.title}
      </span>
      {!!task.labels?.length && <span className={styles.labels}>{task.labels.map((l) => `#${l}`).join(' ')}</span>}
      {hasMeta(task) && (
        <span className={styles.meta}>
          {task.cardId && (
            <span className={styles.for} title={card?.title ?? 'its card is gone'}>
              {card ? cardName(card) : 'its card is gone'}
            </span>
          )}
          <span className={styles.push} />
          {task.due && <DueMark due={task.due} finished={finished} />}
          {checks.length > 0 && <Progress look="cells" done={ticked} all={checks.length} title={`${ticked} of ${checks.length} steps done`} />}
          {task.assignee && <Assignee name={task.assigneeName} />}
        </span>
      )}
      {learn && (
        <Button tone="primary" className={styles.learn} title="log what it taught on its card, as evidence" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => (e.stopPropagation(), learn())}>
          + log what it taught
        </Button>
      )}
    </CardFace>
  )
}
