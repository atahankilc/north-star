// A task on a timeline (D-262, D-304, D-358): a bar on the card face from its first day to its due day, tinted in its
// card's colour with that colour on its left edge (no card: a grey tint and edge, so it still shows on the strip). Its
// name inside it, cut with `…` (D-354), or beside it when the bar is too short (`out`); a `✓` when finished, its
// priority as the one pill; a line along its foot filled as far as its checklist is done. Late: a magenta outline (the
// hatch to today is the timeline's). Only a due day (`point`): no sheet, a ◆ with its name beside it. Picked by an
// editor: cyan grips on its ends that move its days (`onGrip`). Where it sits and how wide is the timeline's (`style`).
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import type { Task } from '../../../data/tasks'
import { CARD_TONE } from '../../../ui/foundation/cardTone'
import { CardFace } from './CardFace'
import { PriorityChip } from './PriorityChip'
import styles from './TimelineBar.module.css'

export type GripSide = 'start' | 'due' | 'give'

type Props = {
  task: Task
  finished: boolean
  late: boolean
  point: boolean
  // Its name beside it, not inside (too short a bar, or a ◆).
  out: boolean
  selected: boolean
  pressed?: boolean
  lifted?: boolean
  live: boolean
  editor: boolean
  // `+Nd late` after the name (the hatch too short to say it).
  lateBy?: number
  // How much of its checklist is done (0–1), when it has one.
  checks?: number | null
  // Its name's box stays on screen while the bar runs off the left (the timeline moves it, D-354).
  sticky?: { left: number; w: number }
  title?: string
  className?: string
  style?: CSSProperties
  onPointerDown?: (e: ReactPointerEvent<HTMLDivElement>) => void
  onGrip?: (side: GripSide) => (e: ReactPointerEvent<HTMLSpanElement>) => void
  onKeyDown?: (e: KeyboardEvent) => void
}

export function TimelineBar({ task, finished, late, point, out, selected, pressed, lifted, live, editor, lateBy, checks, sticky, title, className, style, onPointerDown, onGrip, onKeyDown }: Props) {
  const tone = task.cardType ? CARD_TONE[task.cardType] : undefined
  return (
    <CardFace
      className={[styles.bar, className].filter(Boolean).join(' ')}
      // A ◆ has no sheet: no face colour, no edge; its tone only for the ◆.
      tone={point ? undefined : tone}
      tint
      style={point && tone ? ({ ['--tone' as string]: tone, ...style } as CSSProperties) : style}
      selected={selected}
      pressed={pressed}
      finished={finished}
      lifted={lifted}
      marks={live && !lifted}
      markTone={tone}
      button={live && !lifted}
      hidden={lifted}
      title={title}
      data-bar
      data-task={lifted ? undefined : task.id}
      data-point={point || undefined}
      data-late={late || undefined}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      {point && <span className={styles.dia} />}
      <span className={styles.label} data-out={out || undefined} {...(sticky && { 'data-sticky': sticky.left, 'data-w': sticky.w })}>
        {finished && <span className={styles.ok}>✓</span>}
        {task.priority && (
          <>
            <PriorityChip priority={task.priority} />{' '}
          </>
        )}
        {task.title}
        {!!lateBy && <span className={styles.lateBeside}> +{lateBy}d late</span>}
      </span>
      {checks != null && !finished && !point && (
        <span className={styles.checks}>
          <i style={{ width: `${checks * 100}%` }} />
        </span>
      )}
      {live && !lifted && selected && editor && !finished && onGrip && (
        <>
          <span className={styles.grip} data-side={point ? 'give' : 'start'} title={point ? 'drag left to give it a first day' : 'its first day'} onPointerDown={onGrip(point ? 'give' : 'start')} />
          {!point && <span className={styles.grip} data-side="due" title="its due day" onPointerDown={onGrip('due')} />}
        </>
      )}
    </CardFace>
  )
}
