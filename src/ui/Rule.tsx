// The rule (D-266, D-277; D-326's kit): `01 NAME ──── count  + add`, as a panel's sections, a deck's columns and the
// agent's views start. `n` a number (two digits, magenta) or a string as it is; `count` after the name, or at the end
// (`countAt="end"`, a deck column's `──── 5`); `aside` after the line (faint words); `add` a `+ label` Button at the
// right end; `line={false}` for a numbered label with no line. `--rule-line` set on it (or above) colours the line. `Num` is the magenta number alone (a tab, a choice).
import type { ReactNode } from 'react'
import { Button } from './Button'
import styles from './Rule.module.css'

export const numText = (n: number | string) => (typeof n === 'number' ? String(n).padStart(2, '0') : n)

export function Num({ n, className }: { n: number | string; className?: string }) {
  return <span className={[styles.n, className].filter(Boolean).join(' ')}>{numText(n)}</span>
}

type Props = {
  n?: number | string
  name: ReactNode
  count?: ReactNode
  countAt?: 'name' | 'end'
  aside?: ReactNode
  add?: { label: string; onClick: () => void }
  line?: boolean
  as?: 'h2' | 'h3' | 'h4' | 'div'
  className?: string
}

export function Rule({ n, name, count, countAt = 'name', aside, add, line = true, as: Tag = 'h3', className }: Props) {
  const countEl = count !== undefined && <span className={styles.count}>{count}</span>
  return (
    <Tag className={[styles.rule, className].filter(Boolean).join(' ')}>
      {n !== undefined && <Num n={n} />}
      {name}
      {countAt === 'name' && countEl}
      {line && <span className={styles.line} data-lead={n !== undefined || undefined} aria-hidden />}
      {countAt === 'end' && countEl}
      {aside !== undefined && <span className={styles.aside}>{aside}</span>}
      {add && (
        <Button icon className={styles.add} onClick={add.onClick}>
          <span className={styles.plus}>+ </span>
          {add.label}
        </Button>
      )}
    </Tag>
  )
}
