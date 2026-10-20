// The assistant's stage as one box (D-096, D-101): a frame around the app's box, like the chat's own boxes, with a bar
// written into its top edge: a title, then runs of text and controls with the line showing between them. The preview
// (PreviewBar) and the chat's report (ReportView) both draw their screen this way.
import type { ReactNode } from 'react'
import styles from './StageBox.module.css'

type Props = {
  title: ReactNode
  children?: ReactNode
  // Marks the bar for previewLock.ts (its controls stay live while the app is locked).
  barProps?: Record<string, unknown>
}

export function StageBox({ title, children, barProps }: Props) {
  return (
    <>
      <div className={styles.frame} aria-hidden />
      <div className={styles.bar} role="status" {...barProps}>
        <span className={styles.title}>{title}</span>
        {children}
      </div>
    </>
  )
}

// A run of the line between the bar's parts: `long` takes the spare room.
export function Rule({ long }: { long?: boolean }) {
  return <span className={long ? styles.rule : styles.ruleShort} />
}

// Any other part of the bar, on the page's black so the line breaks around it.
export function Part({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <span className={`${styles.part} ${className ?? ''}`} title={title}>
      {children}
    </span>
  )
}

// ‹ n/N ›, with n and p as keys (the screen listens for them).
export function Stepper({ step, steps, noun, onStep }: { step: number | null; steps: number; noun: string; onStep: (d: number) => void }) {
  return (
    <span className={`${styles.part} ${styles.stepper}`}>
      <button onClick={() => onStep(-1)} aria-label={`Previous ${noun} (p)`} title="previous · p">
        ‹
      </button>
      <span className={styles.step}>
        {step === null ? '–' : step + 1}/{steps}
      </span>
      <button onClick={() => onStep(1)} aria-label={`Next ${noun} (n)`} title="next · n">
        ›
      </button>
    </span>
  )
}

// A plain word button in the bar (`esc`, `share`, `download .md`); `primary` is cyan.
export function BarButton({ children, onClick, primary, label }: { children: ReactNode; onClick: () => void; primary?: boolean; label?: string }) {
  return (
    <button className={`${styles.part} ${styles.button}`} data-primary={primary || undefined} onClick={onClick} aria-label={label}>
      {children}
    </button>
  )
}

export { styles as stageBoxStyles }
