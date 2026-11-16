// A setup panel's shell (D-212, D-268, D-392): a tabbed panel over the bottom middle of its space (the screen in
// focus, a pane beside a plane, the tasks side view), above the dock: the kind's tabs with their counts, `start over
// from ▾` when the kind has templates, `done`, and the open tab's editor. A matrix's, a table's and a deck's setup are
// this shell round their own editors; whose is open and on which tab is setupStore.ts'.
import type { ReactNode } from 'react'
import { Menu } from '../../../ui/patterns/Menu'
import type { PromptEntry } from '../../../ui/foundation/promptModel'
import { Tabs } from '../../../ui/primitives/Tabs'
import { Button } from '../../../ui/primitives/Button'
import { useSetupOnDock } from './FocusDock'
import { closeSetup, setSetupTab, useSetupTab } from './setupStore'
import styles from './SetupShell.module.css'

type Props<T extends string> = {
  // Read out: `Set up the matrix`.
  label: string
  tabs: readonly T[]
  names: Record<T, string>
  // How many a tab holds, beside its name.
  count?: Partial<Record<T, number | undefined>>
  // The kind's templates: `what` says what one replaces (`rows, columns and cells`).
  startOver?: { what: string; items: PromptEntry[] }
  // The open tab's editor.
  children: (tab: T) => ReactNode
}

export function SetupShell<T extends string>({ label, tabs, names, count, startOver, children }: Props<T>) {
  useSetupOnDock()
  const tab = useSetupTab(tabs)
  const close = () => closeSetup()
  return (
    <section className={styles.setup} data-learn="setup" aria-label={label} onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), close())}>
      <header className={styles.head}>
        <Tabs<T> label="Setup" value={tab} onChange={setSetupTab} options={tabs.map((t) => ({ value: t, label: names[t], count: count?.[t] }))} />
        <span className={styles.end}>
          {startOver && (
            <Menu label="start over from" up quiet prompt="a template…" ariaLabel="Start over from a template (⌘Z brings back what it replaces)" items={[{ key: 'h', heading: `replaces ${startOver.what}` }, ...startOver.items]} />
          )}
          <Button title="close (Esc)" onClick={close}>
            done
          </Button>
        </span>
      </header>
      <div className={styles.body} role="tabpanel">
        {children(tab)}
      </div>
    </section>
  )
}

// One row of a setup: what it sets (its hint on hover), then its value.
export function SetupRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <span className={styles.label} title={hint}>
        {label}
      </span>
      <div className={styles.value}>{children}</div>
    </div>
  )
}
