// A row of small colour squares, one per kind, saying which are shown (D-233): a filter's summary on its trigger
// (`SHOW ■■■□■`, `LINKS ■□■`). A square shown is filled in its colour, one hidden an empty outline.
import type { CSSProperties } from 'react'
import styles from './Swatches.module.css'

export type Swatch = { key: string; tone: string; on: boolean }

export function Swatches({ list }: { list: Swatch[] }) {
  return (
    <span className={styles.swatches}>
      {list.map((s) => (
        <span key={s.key} className={styles.swatch} data-on={s.on} style={{ '--tone': s.tone } as CSSProperties} />
      ))}
    </span>
  )
}
