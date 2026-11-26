// The right panel (D-219): one look for every panel that opens on the right, whatever fills it. A terminal column flush
// with the screen's right edge (EdgeColumn, D-359); with the agent's column there it shares that column's place and
// width, by tabs (D-435). Its head
// (PanelHead: the kind in its colour, tools, `×`), the title under it, then sections under rules that carry a number and
// a name (`01 STATUS ────`), actions at the foot, joined (D-344). The main screen drawing back uncovers it as it opens and covers
// it again as it closes (D-395): wrap it in <AnimatePresence>.
import { useRef, type ReactNode } from 'react'
import styles from './SidePanel.module.css'
import { Button } from '../primitives/Button'
import { DragLine } from '../primitives/DragLine'
import { Rule } from '../primitives/Rule'
import { EdgeColumn } from './EdgeColumn'
import { PanelHead } from './PanelHead'
import { RightTabs } from './RightTabs'
import { useBehind, useRightColumn, useThingPanel } from '../foundation/rightColumn'
import { usePresence } from 'motion/react'
import { dragPanelWidth, keepPanelWidth } from './panelWidth'

type Props = {
  // What it shows, in words (`problem`), and that kind's colour.
  kind: string
  tone?: string
  title: ReactNode
  label: string
  // Which thing it is (an id): another one picked comes to the front of the right column (D-435).
  of?: string
  // The `×` and Escape (on the one Escape stack, D-359: a menu or a thread over it closes first).
  onClose: () => void
  // Actions at its foot (PanelAction), joined; a danger one goes to the far right.
  actions?: ReactNode
  // Its width when it isn't the right panels' own (a task's inside the tasks side view, D-300: narrower, or all of it):
  // that one isn't dragged.
  width?: number
  // More along the top, before the `×`, joined with it (that side view's `full`, `‹ back`).
  tools?: ReactNode
  children?: ReactNode
}

// On the docked column (EdgeColumn, D-359): fixed right, full height, under the sheet, Escape; this is what's in it.
export function SidePanel({ kind, tone, title, label, of, onClose, actions, width, tools, children }: Props) {
  // Where its right edge is on the screen, read as a drag starts (what's beside it or the agent's column can move it).
  const edge = useRef(0)
  const agent = useRightColumn((s) => s.agent)
  const [present] = usePresence()
  useThingPanel(kind, of ?? label, present)
  return (
    <EdgeColumn
      width={agent ? 'var(--agent-col-w)' : (width ?? 'min(var(--panel-width, var(--panel-w)), 100vw)')}
      behind={useBehind('thing')}
      label={label}
      onClose={onClose}
      data-learn="card-panel"
      style={{ ['--tone' as string]: tone ?? 'var(--accent-magenta)' }}
    >
      {width === undefined && !agent && (
        <DragLine
          at="left"
          label="The panel's width"
          onStart={(e) => (edge.current = e.currentTarget.parentElement?.getBoundingClientRect().right ?? window.innerWidth)}
          onDrag={(e) => dragPanelWidth(edge.current, e.clientX)}
          onEnd={keepPanelWidth}
        />
      )}
      <RightTabs />
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
