// One row of a panel's list of other things (D-361: written eight times in the card panel and its kinds): a link row
// (a swatch in `tone`, the kind), or a tree row (`depth` steps in, its mark), then the thing's name as a link that goes
// there, a quiet word after it, and `×` on hover while editing.
import type { ReactNode } from 'react'
import { Button } from '../../../ui/primitives/Button'
import styles from './CardPanel.module.css'

type Props = {
  // A link row: the swatch's colour and the kind's words (`solves →`, `≈ theirs`); `faint` for one under another.
  tone?: string
  kind?: ReactNode
  faint?: boolean
  // A tree row instead: how deep and its mark (`└`, `├`, `▌`), its colour when it has one.
  tree?: { depth: number; mark: string; tone?: string }
  name: ReactNode
  onGo: () => void
  goTitle?: string
  type?: ReactNode
  onRemove?: () => void
  removeTitle?: string
}

export function PanelRow({ tone, kind, faint, tree, name, onGo, goTitle, type, onRemove, removeTitle = 'Remove' }: Props) {
  return (
    <div
      className={tree ? styles.part : styles.link}
      style={tree ? { paddingLeft: `calc(${tree.depth} * var(--space-4))` } : { ['--tone' as string]: tone ?? 'var(--fg)' }}
    >
      {tree ? (
        <span className={styles.tree} style={tree.tone ? { color: tree.tone } : undefined}>
          {tree.mark}
        </span>
      ) : (
        <span className={styles.swatch} data-faint={faint || undefined} aria-hidden />
      )}
      {kind !== undefined && <span className={styles.kind}>{kind}</span>}
      <Button link className={styles.to} onClick={onGo} title={goTitle}>
        {name}
      </Button>
      {type !== undefined && type !== '' && <span className={styles.type}>{type}</span>}
      {onRemove && (
        <Button icon tone="danger" className={styles.x} title={removeTitle} onClick={onRemove}>
          ×
        </Button>
      )}
    </div>
  )
}
