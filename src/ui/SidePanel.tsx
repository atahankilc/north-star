// The right panel (D-219): one look for every panel that opens on the right, whatever fills it. A terminal column flush
// with the right edge of the space it belongs to, the screen's full height, over the HUD's bar (in a portal): a piece's own view in focus (its part of the screen when
// something is open beside it), or the screen's right edge for what's on the canvas itself. A thin line on its left
// with magenta marks at its corners (a plane console's), the kind in its colour and `[×] esc` along the top, the title
// under it, then sections under rules that carry a number and a name (`01 STATUS ────`), actions at the foot. It
// builds up cell by cell as it opens and breaks apart as it closes (D-034): wrap it in <AnimatePresence>.
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Appear } from './Appear'
import styles from './SidePanel.module.css'

type Props = {
  // What it shows, in words (`problem`), and that kind's colour.
  kind: string
  tone?: string
  title: ReactNode
  label: string
  onClose: () => void
  // `[verb]` actions at its foot.
  actions?: ReactNode
  // From the screen's right edge: the part of the screen right of the space it belongs to (what's open beside a plane).
  right?: number
  // Its width when not the usual 400 (a task's inside the tasks side view, D-300: narrower, or all of it).
  width?: number
  // More along the top, before `[×]` (that side view's `[full]`, `‹ back`).
  tools?: ReactNode
  children?: ReactNode
}

// How wide it is at most: what it sits in may scroll its view to keep the thing it's for clear of it.
export const SIDE_PANEL_W = 400

export function SidePanel({ kind, tone, title, label, onClose, actions, right = 0, width, tools, children }: Props) {
  return createPortal(
    <Appear
      as="aside"
      className={styles.panel}
      style={{ right, ...(width ? { width } : {}), ['--tone' as string]: tone ?? 'var(--accent-magenta)' }}
      // A dialog to the canvas: its wheel scrolls it, a press here doesn't pan, right-click is the browser's.
      role="dialog"
      aria-label={label}
      onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
      onDoubleClick={(e: React.MouseEvent) => e.stopPropagation()}
    >
      <header className={styles.top}>
        <span className={styles.kind}>{kind}</span>
        {tools && <span className={styles.tools}>{tools}</span>}
        <button className={styles.close} onClick={onClose} title="Close (Esc)">
          <span className={styles.br}>[</span>×<span className={styles.br}>]</span> esc
        </button>
      </header>
      <div className={styles.title}>{title}</div>
      <div className={styles.body}>{children}</div>
      {actions && <footer className={styles.foot}>{actions}</footer>}
    </Appear>,
    document.body,
  )
}

// A section under a rule with its number and name (and a count after it); what adds to it sits at the rule's right
// end (`+ tag`, the user's). With nothing in it, it's just its rule.
type SectionProps = { n: number; name: ReactNode; count?: ReactNode; add?: { label: string; onClick: () => void }; empty?: boolean; children?: ReactNode }

export function PanelSection({ n, name, count, add, empty, children }: SectionProps) {
  return (
    <section className={styles.section} data-empty={empty || undefined}>
      <h3 className={styles.rule}>
        <span className={styles.n}>{String(n).padStart(2, '0')}</span>
        {name}
        {count !== undefined && <span className={styles.count}>{count}</span>}
        <span className={styles.line} aria-hidden />
        {add && (
          <button className={styles.add} onClick={add.onClick}>
            {add.label}
          </button>
        )}
      </h3>
      {!empty && children}
    </section>
  )
}

// A `[verb]` at the panel's foot; `danger` turns magenta on hover.
export function PanelAction({ label, title, danger, onClick }: { label: string; title?: string; danger?: boolean; onClick: () => void }) {
  return (
    <button className={styles.action} data-tone={danger ? 'danger' : undefined} title={title} onClick={onClick}>
      {label}
    </button>
  )
}
