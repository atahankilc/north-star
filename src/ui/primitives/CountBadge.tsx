// A count on something (D-326, the kit): what's new since you last looked, people waiting. Three copies before (the tasks
// button, the threads button, the settings gear) with the `9+` written twice. Past `max` it says `max+`; at 0 it isn't
// there. `corner`: pinned over the top-right corner of its parent (which is `position: relative`, as a button with
// an icon is); `inline`: in the line, after a word.
import styles from './CountBadge.module.css'

type Props = {
  count: number
  max?: number
  tone?: 'magenta' | 'cyan'
  placement?: 'corner' | 'inline'
  title?: string
}

export const countText = (count: number, max = 9) => (count > max ? `${max}+` : String(count))

export function CountBadge({ count, max = 9, tone = 'magenta', placement = 'corner', title }: Props) {
  if (count <= 0) return null
  return (
    <span className={styles.badge} data-tone={tone} data-placement={placement} title={title}>
      {countText(count, max)}
    </span>
  )
}
