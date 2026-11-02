// A task's due day (D-251, D-358): `◷ 28 oct` (`today`, `tomorrow`…), magenta once past unless finished. On a task's
// sheet and in a card's tasks.
import { dueText, overdue } from '../../../model/tasks'
import styles from './parts.module.css'

export function DueMark({ due, finished, className }: { due: string; finished: boolean; className?: string }) {
  const late = overdue({ due }, finished)
  return (
    <span className={[styles.due, className].filter(Boolean).join(' ')} data-late={late || undefined} title={late ? `was due ${due}` : `due ${due}`}>
      ◷ {dueText(due)}
    </span>
  )
}
