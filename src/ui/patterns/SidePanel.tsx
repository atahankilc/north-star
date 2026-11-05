// The right panel (D-219): one look for every panel that opens on the right, whatever fills it. A terminal column flush
// with the right edge of the space it belongs to (EdgeColumn, D-359): a piece's own view in focus (its part of the
// screen when something is open beside it), or the screen's right edge for what's on the canvas itself. Its head
// (PanelHead: the kind in its colour, tools, `×`), the title under it, then sections under rules that carry a number and
// a name (`01 STATUS ────`), actions at the foot, joined (D-344). It builds up cell by cell as it opens and breaks apart
// as it closes (D-034): wrap it in <AnimatePresence>.
import { useRef, type ReactNode } from 'react'
import styles from './SidePanel.module.css'
import { Button } from '../primitives/Button'
import { ResizeEdge } from '../primitives/ResizeEdge'
import { Rule } from '../primitives/Rule'
import { EdgeColumn } from './EdgeColumn'
import { PanelHead } from './PanelHead'
import { dragPanelWidth, keepPanelWidth } from './panelWidth'

type Props = {
  // What it shows, in words (`problem`), and that kind's colour.
  kind: string
  tone?: string
  title: ReactNode
  label: string
  // The `×` and Escape (on the one Escape stack, D-359: a menu or a thread over it closes first).
  onClose: () => void
  // Actions at its foot (PanelAction), joined; a danger one goes to the far right.
  actions?: ReactNode
  // From the screen's right edge: the part of the screen right of the space it belongs to (what's open beside a plane).
  right?: number
  // Its width when it isn't the right panels' own (a task's inside the tasks side view, D-300: narrower, or all of it):
  // that one isn't dragged.
  width?: number
  // More along the top, before the `×`, joined with it (that side view's `full`, `‹ back`).
  tools?: ReactNode
  children?: ReactNode
}

// On the docked column (EdgeColumn, D-359): fixed right, full height, the marks, cell by cell, Escape; this is what's in it.
export function SidePanel({ kind, tone, title, label, onClose, actions, right = 0, width, tools, children }: Props) {
  // Where its right edge is on the screen, read as a drag starts (what's beside it or the agent's column can move it).
  const edge = useRef(0)
  return (
    <EdgeColumn
      // Left of the agent's column when it's open (`--ai-w`, S14).
      offset={`calc(${right}px + var(--ai-w, 0px))`}
      // Never wider than the room left of where it stands (a plane's part beside the tasks side view is narrower than
      // the panel: it went off the screen's left edge).
      width={width ?? `min(var(--panel-width, var(--panel-w)), calc(100vw - ${right}px - var(--ai-w, 0px)))`}
      label={label}
      onClose={onClose}
      data-learn="card-panel"
      style={{ ['--tone' as string]: tone ?? 'var(--accent-magenta)' }}
    >
      {width === undefined && (
        <ResizeEdge
          edge="left"
          label="The panel's width"
          onStart={(e) => (edge.current = e.currentTarget.parentElement?.getBoundingClientRect().right ?? window.innerWidth)}
          onDrag={(e) => dragPanelWidth(edge.current, e.clientX)}
          onEnd={keepPanelWidth}
        />
      )}
      <PanelHead className={tone ? styles.toned : undefined} kind={kind} tools={tools} onClose={onClose} />
      <div className={[styles.title, tone ? styles.toned : ''].filter(Boolean).join(' ')}>{title}</div>
      <div className={styles.body}>{children}</div>
      {actions && <footer className={styles.foot}>{actions}</footer>}
    </EdgeColumn>
  )
}

// A section under a rule with its number and name (and a count after it); what adds to it sits at the rule's right
// end (`+ tag`, the user's). With nothing in it, it's just its rule.
// `data-learn`: its name for the onboarding's lessons (D-315).
type SectionProps = { n: number; name: ReactNode; count?: ReactNode; add?: { label: string; onClick: () => void }; empty?: boolean; children?: ReactNode; 'data-learn'?: string }

export function PanelSection({ n, name, count, add, empty, children, 'data-learn': learnAs }: SectionProps) {
  return (
    <section className={styles.section} data-empty={empty || undefined} data-learn={learnAs}>
      <Rule className={styles.rule} n={n} name={name} count={count} add={add} />
      {!empty && children}
    </section>
  )
}

// An action at the panel's foot; `danger` turns magenta on hover and sits in the far right corner.
export function PanelAction({ label, title, danger, onClick }: { label: string; title?: string; danger?: boolean; onClick: () => void }) {
  return (
    <Button className={styles.action} tone={danger ? 'danger' : undefined} title={title} onClick={onClick}>
      {label}
    </Button>
  )
}
