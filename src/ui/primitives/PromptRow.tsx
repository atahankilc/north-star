// The prompt's parts (D-222), one of each for every list in the prompt family:
//   Hit         the typed text lit inside a label (magenta; `found`: the finder's yellow, what it lights on the canvas)
//   PromptRow   one row: `›` while picked · its glyph or tick box · label (+ dim meta) · NEW · `▸ N inside` · hint · `✓`
//               if it's the value now
//   PromptHead  `# section ──── count`, or a plain rule
// A row is never focused: the keys stay in the `>` line (usePromptNav), which points at the picked row
// (aria-activedescendant). `data-key` names a row and `data-first` marks the one Enter picks: the onboarding and the
// demos find rows by them.
import { memo, type CSSProperties, type ReactNode } from 'react'
import type { How, PromptHeading, PromptItem } from '../foundation/promptModel'
import styles from './PromptRow.module.css'

// `ranges`: where to light it, found by the caller (the finder's regular expressions, every match); else where `q` is.
export function Hit({ text, q = '', ranges, tone = 'narrow' }: { text: ReactNode; q?: string; ranges?: [number, number][]; tone?: 'narrow' | 'found' }) {
  if (typeof text !== 'string') return <>{text}</>
  const at = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1
  const lit = ranges ?? (at >= 0 ? [[at, at + q.length] as [number, number]] : [])
  if (!lit.length) return <>{text}</>
  const out: ReactNode[] = []
  let last = 0
  for (const [a, b] of lit) {
    out.push(
      text.slice(last, a),
      <mark key={a} className={styles.hit} data-tone={tone}>
        {text.slice(a, b)}
      </mark>,
    )
    last = b
  }
  out.push(text.slice(last))
  return <>{out}</>
}

type RowProps = {
  item: PromptItem
  id?: string
  picked: boolean
  // What's typed, lit in the label (folds hide while typing).
  q: string
  hitTone?: 'narrow' | 'found'
  // `option` in a Select's listbox, `menuitem` in a menu (a tick row is always a checkbox).
  role?: 'option' | 'menuitem'
  onPick: (item: PromptItem, how: How) => void
  onPoint: (key: string) => void
  // A double-click (the finder: a click shows a match, a second goes).
  onConfirm?: (item: PromptItem) => void
}

export const PromptRow = memo(function PromptRow({ item, id, picked, q, hitTone, role = 'menuitem', onPick, onPoint, onConfirm }: RowProps) {
  const tick = item.checked !== undefined
  return (
    <div
      id={id}
      className={styles.row}
      role={tick ? (role === 'option' ? 'option' : 'menuitemcheckbox') : role}
      aria-selected={role === 'option' ? (item.current ?? picked) : undefined}
      aria-checked={tick ? item.checked : undefined}
      aria-current={item.current || undefined}
      aria-expanded={item.fold?.open}
      data-key={item.key}
      data-first={picked || undefined}
      data-picked={picked || undefined}
      data-danger={item.danger || undefined}
      data-indent={item.indent || undefined}
      data-open={item.fold?.open || undefined}
      data-faint={item.faint || undefined}
      data-sub={item.sub !== undefined || undefined}
      style={item.tone ? ({ '--tone': item.tone } as CSSProperties) : undefined}
      onPointerMove={() => !picked && onPoint(item.key)}
      onClick={(e) => onPick(item, { shift: e.shiftKey, alt: e.altKey })}
      onDoubleClick={onConfirm && (() => onConfirm(item))}
    >
      <span className={styles.gutter} aria-hidden />
      {tick && (
        <span className={styles.box} data-on={item.checked || undefined} aria-hidden>
          {item.checked ? '✓' : ''}
        </span>
      )}
      {item.glyph !== undefined && (
        <span className={styles.glyph} data-part="glyph" aria-hidden>
          {item.glyph}
        </span>
      )}
      <span className={styles.label}>
        <Hit text={item.label} q={q} tone={hitTone} />
        {item.meta !== undefined && item.meta !== '' && <span className={styles.meta}>{item.meta}</span>}
        {item.sub !== undefined && <span className={styles.sub}>{item.sub}</span>}
      </span>
      {item.badge && <span className={styles.badge}>{item.badge}</span>}
      {item.fold && !q && (
        // Inside the row: its click opens or shuts the fold and doesn't pick the row (→ and ← do it from the keys).
        <span
          className={styles.fold}
          aria-hidden
          onClick={(e) => {
            e.stopPropagation()
            item.fold!.onToggle()
          }}
        >
          {item.fold.open ? '▾' : '▸'} {item.fold.count} {item.fold.noun ?? 'inside'}
        </span>
      )}
      {item.hint !== undefined && item.hint !== '' && <span className={styles.hint}>{item.hint}</span>}
      {item.current && (
        <span className={styles.now} aria-hidden>
          ✓
        </span>
      )}
    </div>
  )
})

export function PromptHead({ head }: { head: PromptHeading }) {
  if (!head.heading) return <div className={styles.rule} role="separator" />
  return (
    <div className={styles.head} role="presentation">
      <span className={styles.hash} aria-hidden>
        #
      </span>
      <span className={styles.headName}>{head.heading}</span>
      <span className={styles.headLine} aria-hidden />
      {head.count !== undefined && <span className={styles.headCount}>{head.count}</span>}
    </div>
  )
}
