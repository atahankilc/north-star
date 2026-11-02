// A task waiting in a timeline's no-day tray (D-262, D-358): a small sheet on the card face, edged in its card's
// colour, `☐` and its title on one line; dragged onto a day it gets that day. `lifted`: the copy under the pointer.
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { Task } from '../../../data/tasks'
import { CARD_TONE } from '../../../ui/foundation/cardTone'
import { CardFace } from './CardFace'
import styles from './TrayTask.module.css'

type Props = {
  task: Task
  selected: boolean
  live: boolean
  lifted?: boolean
  style?: CSSProperties
  onPointerDown?: (e: ReactPointerEvent<HTMLDivElement>) => void
}

export function TrayTask({ task, selected, live, lifted, style, onPointerDown }: Props) {
  return (
    <CardFace
      className={styles.pill}
      tone={task.cardType ? CARD_TONE[task.cardType] : undefined}
      selected={selected}
      lifted={lifted}
      marks={live && !lifted}
      markTier="s"
      button={live && !lifted}
      hidden={lifted}
      label={task.title}
      data-task={lifted ? undefined : task.id}
      style={style}
      onPointerDown={onPointerDown}
    >
      <span className={styles.line}>☐ {task.title}</span>
    </CardFace>
  )
}
