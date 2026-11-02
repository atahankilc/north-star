// Who a task is given to (D-251, D-358): a square with their initials (D-169's squares), on a task's sheet and a deck's
// lane by person. `initials` already made (a lane's own: `ME`) or a name to make them from.
import { initials as initialsOf } from '../../../model/tasks'
import styles from './parts.module.css'

export function Assignee({ name, initials, className }: { name?: string; initials?: string; className?: string }) {
  return (
    <span className={[styles.who, className].filter(Boolean).join(' ')} title={name}>
      {initials ?? initialsOf(name)}
    </span>
  )
}
