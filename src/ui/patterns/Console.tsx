// Every console, dock and bar (D-347): a piece's console, the focus dock, a pane's dock, the bars under a selected
// heading, link or matrix cell. One rail, left to right: who (a name, readouts) · its groups by role (each a
// ButtonGroup: what it is now · how it's shown · what opens · edit · danger) · go last (`focus`, `unfocus`, `done`,
// `close`). A noun (`filter 2`, `linked 2`) is a `ConsoleTab`; picked, its drawer opens as the rail's upper floor
// (`floor`), one at a time.
// Where (`at`): `edge` cut into a piece's bottom edge, half in, half out, so it never covers what the piece holds;
// `under` hanging under what it belongs to (an unframed piece, a selection; the caller places it); `foot` standing on the screen's foot.
// No edge line: faint L's on every corner that can be seen, cyan while pointed at or in edit mode; on the screen's foot
// only the top two. Past CONSOLE_FILL of the width it hangs on, it takes the whole edge and wraps upward, go keeping
// the right end: it never shrinks or hides a tool. Its open drawer counts: one too wide takes the whole edge with it. Inside the zoomed canvas its sizes follow `--cs` (D-264).
import { useEffect, useLayoutEffect, useRef, type HTMLAttributes, type ReactNode, type Ref } from 'react'
import { create } from 'zustand'
import { CONSOLE_FILL } from '../foundation/feel'
import { Button } from '../primitives/Button'
import { Label } from '../primitives/Label'
import { Choice } from '../primitives/Choice'
import { Appear } from '../primitives/Appear'
import { AnimatePresence } from 'motion/react'
import styles from './Console.module.css'

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  at: 'edge' | 'under' | 'foot'
  children: ReactNode
  // Who it is, first: a pane's or a bar's name (`TABLE · COSTS`, `HEADING`). A piece's own console has none (its name is
  // in its edge).
  name?: ReactNode
  // Readouts after the name: `14 cards`, a page.
  info?: ReactNode
  editing?: boolean
  // The drawer open over the rail, inside the same frame (filters, what's linked).
  floor?: ReactNode
  // The width it hangs on, when it isn't its positioned parent's (a dock centred on a part of the screen).
  room?: number
  // Off for a bar that floats free under a selection: it never takes an edge.
  fill?: boolean
  ref?: Ref<HTMLDivElement>
}

export function Console({ at, children, name, info, editing, floor, room, fill = true, className, ref, role = 'toolbar', ...rest }: Props) {
  const own = useRef<HTMLDivElement | null>(null)
  // Takes the whole edge past CONSOLE_FILL: measured at its own width (the attribute off), every time it or its host
  // changes; synchronous, so it never shows the wrong one.
  useLayoutEffect(() => {
    const el = own.current
    const host = el?.offsetParent as HTMLElement | null
    if (!el || !fill) return
    const fit = () => {
      el.removeAttribute('data-full')
      const width = room ?? host?.clientWidth ?? 0
      // Its drawer counts too: one wider than the room would hang past it (D-354).
      const floor = el.querySelector<HTMLElement>(`.${CSS.escape(styles.floor)}`)
      const wide = Math.max(el.offsetWidth, floor?.offsetWidth ?? 0)
      if (width > 0 && wide > CONSOLE_FILL * width) el.setAttribute('data-full', '')
    }
    fit()
    const ro = new ResizeObserver(fit)
    if (host) ro.observe(host)
    const mo = new MutationObserver(fit)
    mo.observe(el, { childList: true, subtree: true, characterData: true })
    return () => (ro.disconnect(), mo.disconnect())
  }, [room, fill])
  return (
    <div
      {...rest}
      ref={(el) => {
        own.current = el
        if (typeof ref === 'function') ref(el)
        else if (ref) ref.current = el
      }}
      role={role}
      className={[styles.console, className].filter(Boolean).join(' ')}
      data-at={at}
      data-editing={editing || undefined}
    >
      {floor && <ConsoleFloor>{floor}</ConsoleFloor>}
      {(name || info) && (
        <span className={styles.who}>
          {name && <span className={styles.name}>{name}</span>}
          {info && <span className={styles.info}>{info}</span>}
        </span>
      )}
      {children}
    </div>
  )
}

// The upper floor: a drawer over the rail, inside the same frame, at least its width. Put anywhere inside a Console
// (a tab's own component can hold its drawer); empty, it isn't there, so an AnimatePresence can live in it.
export function ConsoleFloor({ children }: { children: ReactNode }) {
  return <div className={styles.floor}>{children}</div>
}

// A noun of the rail: a tab opening its drawer as the floor (`▴`), lit while open; `n` what's on in it (magenta when
// it narrows what's shown).
export function ConsoleTab({ label, open, n, title, learn, onClick }: { label: string; open: boolean; n?: number; title?: string; learn?: string; onClick: () => void }) {
  return (
    <Button pressed={open} title={title} aria-expanded={open} data-learn={learn} onClick={onClick}>
      {label}
      {!!n && <span className={styles.n}> {n}</span>}
      <span className={styles.caret} aria-hidden>
        {open ? '▾' : '▴'}
      </span>
    </Button>
  )
}

// A drawer's row: a faint caps name, then its cells.
export function FloorRow({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className={styles.frow}>
      <Label tone="faint" className={styles.fkey}>
        {name}
      </Label>
      {children}
    </div>
  )
}

// A floor's title: what the drawer is, a cyan caps word, and what it says now (`2 types hidden · #pricing`).
export function FloorTitle({ children, summary }: { children: ReactNode; summary?: ReactNode }) {
  return (
    <div className={styles.ftitle}>
      {children}
      {summary && <span className={styles.summary}>{summary}</span>}
    </div>
  )
}

// Escape closes an open drawer, once nothing in it holds the key (a field, a menu, a window, a lesson).
export function useEscapeCloses(open: boolean, close: () => void) {
  const shut = useRef(close)
  shut.current = close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if ((e.target as HTMLElement | null)?.closest('input, textarea, [role=menu], [role=listbox], [aria-modal=true], [data-coach]')) return
      e.stopImmediatePropagation()
      shut.current()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])
}

// Which drawer is open (D-347): one in the whole screen at a time, keyed by its owner (`lanes:<deck id>`). A drawer
// with a store of its own (a plane's, FilterDock's useShelf) needn't use it.
const useDrawerAt = create<{ at: string | null }>(() => ({ at: null }))

// A drawer's open state: `[open, toggle]`; Escape closes it, and it closes when its owner goes.
export function useDrawer(key: string): [boolean, () => void] {
  const open = useDrawerAt((s) => s.at === key)
  useEscapeCloses(open, () => useDrawerAt.setState({ at: null }))
  useEffect(() => () => useDrawerAt.setState((s) => (s.at === key ? { at: null } : s)), [key])
  return [open, () => useDrawerAt.setState((s) => ({ at: s.at === key ? null : key }))]
}

// A one-of-several setting of what's shown (a deck's lanes, a timeline's rows) as a tab of the rail: its drawer a row
// of toggle cells (Choice). The tab says what's picked when it isn't the first option.
export function DrawerPick<T extends string>({ id, label, options, value, disabled, title, onPick }: {
  id: string
  label: string
  options: readonly { value: T; label: string }[]
  value: T
  disabled?: boolean
  title?: string
  onPick: (v: T) => void
}) {
  const [open, toggle] = useDrawer(id)
  const picked = options.find((o) => o.value === value) ?? options[0]
  const byLabel = (l: string) => options.find((o) => o.label === l)!.value
  return (
    <>
      <ConsoleTab label={picked === options[0] ? label : `${label} · ${picked.label}`} open={open} title={title} onClick={toggle} />
      <ConsoleFloor>
        <AnimatePresence>
          {open && (
            <Appear key={id} role="group" aria-label={label}>
              <FloorTitle>{label}</FloorTitle>
              <Choice label={label} bare disabled={disabled} options={options.map((o) => o.label)} value={picked.label} onChange={(l) => onPick(byLabel(l))} />
            </Appear>
          )}
        </AnimatePresence>
      </ConsoleFloor>
    </>
  )
}
