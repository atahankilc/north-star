// A filter as a column (D-364): its name over a rule with a count, a `>` line past seven values, then its values as
// the prompt's tick rows (PromptRow, D-222), six rows high and scrolling past that. A drawer lays several side by side
// (`FilterColumns`): a plane's SHOW FOR TAG REGION LINKS, a deck's GIVEN TO DUE FOR LABEL. Every value one click away,
// the drawer as tall on a big plane as on a small one.
// `rise`: its first row is the default (`any tag`), kept on top; what's picked sits right under it, the rest after in
// their own order. The rows move only once the pointer leaves the column (or the drawer opens again), never under it.
import { useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { PromptField } from '../primitives/PromptField'
import { PromptList } from './PromptList'
import { isHeading, narrow, pickable, type PromptEntry, type PromptItem } from '../foundation/promptModel'
import { usePromptNav } from '../foundation/usePromptNav'
import styles from './FilterColumn.module.css'

// A `>` line once a column holds more than this (the Select's rule, D-222).
const LINE_PAST = 7

type Props = {
  label: string
  items: PromptEntry[]
  // How many it narrows by (magenta); else how many values it has, faint.
  narrowing?: number
  rise?: boolean
  ariaLabel: string
  // Said when it has no values (`No tags on this plane`).
  empty?: ReactNode
  // A wider column (a deck's cards by name).
  wide?: boolean
  // No `>` line whatever its length (a plane's nine link kinds, always the same).
  noLine?: boolean
}

// What's picked, under the default, the rest after; a heading only where rows still follow it.
function risen(items: PromptEntry[], up: Set<string>): PromptEntry[] {
  const rows = pickable(items)
  const first = rows[0]
  if (!first) return items
  const top = rows.filter((r) => r !== first && up.has(r.key))
  const rest = items.filter((e) => e !== first && !(!isHeading(e) && up.has(e.key)))
  const kept = rest.filter((e, i) => !isHeading(e) || (rest[i + 1] !== undefined && !isHeading(rest[i + 1])))
  return [first, ...top, ...kept]
}

const pickedKeys = (items: PromptEntry[]) => new Set(pickable(items).slice(1).filter((r) => r.checked).map((r) => r.key))

export function FilterColumn({ label, items, narrowing = 0, rise, ariaLabel, empty, wide, noLine }: Props) {
  const [query, setQuery] = useState('')
  // Which rows sit up top: taken when it's drawn first and as the pointer leaves, so a click never moves a row.
  const [up, setUp] = useState(() => (rise ? pickedKeys(items) : new Set<string>()))
  const latest = useRef(items)
  latest.current = items
  const settle = () => rise && setUp(pickedKeys(latest.current))
  // Lit only while it's being used: five columns never light five first rows.
  const [inUse, setInUse] = useState(false)
  const listId = useId()

  const ordered = useMemo(() => (rise ? risen(items, up) : items), [items, rise, up])
  const shown = useMemo(() => narrow(ordered, query), [ordered, query])
  const values = Math.max(0, pickable(items).length - (rise ? 1 : 0))
  const line = !noLine && pickable(items).length > LINE_PAST

  const pick = (item: PromptItem) => void item.onSelect({ shift: false, alt: false })
  const nav = usePromptNav(shown, { onPick: pick, onClose: () => (document.activeElement as HTMLElement | null)?.blur() })
  const idOf = (key: string) => `${listId}-${key}`

  return (
    <div
      className={styles.col}
      data-wide={wide || undefined}
      role="group"
      aria-label={ariaLabel}
      onPointerEnter={() => setInUse(true)}
      onPointerLeave={() => (setInUse(false), settle())}
    >
      <div className={styles.head}>
        <span className={styles.name}>{label}</span>
        <span className={styles.rule} aria-hidden />
        <span className={styles.count} data-on={narrowing > 0 || undefined}>
          {narrowing > 0 ? narrowing : values}
        </span>
      </div>
      {line && (
        <PromptField
          className={styles.line}
          framed
          value={query}
          onChange={(v) => (setQuery(v), nav.setPicked(null))}
          onSubmit={() => {}}
          onKeyDown={(e) => {
            // Escape: what's typed goes first, then the drawer (Console's useEscapeCloses).
            if (e.key === 'Escape' && !query) return
            e.stopPropagation()
            if (e.key === 'Escape') return (e.preventDefault(), setQuery(''))
            nav.onKeyDown(e)
          }}
          onFocus={() => setInUse(true)}
          onBlur={() => (setInUse(false), settle())}
          label={`${ariaLabel}: type to find`}
          placeholder="type to find…"
          controls={listId}
          active={inUse && nav.picked ? idOf(nav.picked) : undefined}
        />
      )}
      <PromptList
        id={listId}
        className={styles.list}
        entries={shown}
        picked={inUse ? nav.picked : null}
        q={query.trim()}
        label={ariaLabel}
        empty={empty}
        onPick={pick}
        onPoint={nav.setPicked}
        idOf={idOf}
      />
    </div>
  )
}

// The drawer's columns side by side, wrapping where the screen runs out; on a drawer taking the whole edge they share
// its width.
export function FilterColumns({ children }: { children: ReactNode }) {
  return <div className={styles.cols}>{children}</div>
}
