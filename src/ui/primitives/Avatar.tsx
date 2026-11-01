// A person's square (D-344): their initial (or their Google photo, with a band of their colour under it) on their
// colour. One size per neighbour so it lines up with the buttons beside it: `hud` 30 px, a ToolButton's cell (people
// here, your square), `sm` 24 px, a Button's (a row in a list). Without a colour it's the quiet framed square of
// someone not here (a workspace's people). `away` greys it (D-331). PeopleHere, Settings and the people settings drew it
// three times by hand.
import type { CSSProperties } from 'react'
import styles from './Avatar.module.css'

type Props = {
  name: string
  // Their colour as drawn (themeAccent already applied); none: the framed square.
  color?: string
  // Only from googleusercontent.com (D-317): the caller passes what it checked.
  photo?: string
  size?: 'hud' | 'sm'
  away?: boolean
  className?: string
}

export const initialOf = (name: string) => (name.trim()[0] ?? '?').toUpperCase()

export function Avatar({ name, color, photo, size = 'hud', away, className }: Props) {
  return (
    <span
      className={[styles.avatar, className].filter(Boolean).join(' ')}
      data-size={size}
      data-away={away || undefined}
      data-quiet={color ? undefined : true}
      style={color ? ({ '--peer': color } as CSSProperties) : undefined}
      aria-hidden
    >
      {photo ? <img src={photo} alt="" referrerPolicy="no-referrer" /> : initialOf(name)}
    </span>
  )
}
