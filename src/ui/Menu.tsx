// A dropdown menu (D-053) in the prompt look (D-222): `[ show ▾ ]` opens a list with a `>` line on top. Typing narrows the
// list (matches in magenta) and Enter picks the first; an item's letter (`[p]`) puts it first, so `+` then `p` Enter makes
// a plane. Checkbox items toggle and keep it open; action items run and close it. Arrow keys move, Home/End jump, Escape
// closes and returns focus, a click outside closes. `MenuPanel` is the list alone, for the right-click menu too.
import { AnimatePresence } from 'motion/react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Appear } from './Appear'
import styles from './Menu.module.css'

export type MenuEntry =
  | {
      key: string
      label: ReactNode
      // Picked by a click or Enter, with whether shift or alt was held; `'keep'` keeps the menu open (D-281: ⇧↵ brings a
      // card and goes on picking).
      onSelect: (how: { shift: boolean; alt: boolean }) => unknown
      // A checkbox item: shows [x] / [ ] and keeps the menu open.
      checked?: boolean
      // Colour of the check or the glyph.
      tone?: string
      // Shown faint on the right (a shortcut, a count).
      hint?: string
      // Shown before the label (an action's mark).
      glyph?: ReactNode
      // Its key in the prompt: typed alone, it puts the item first (D-222).
      letter?: string
      // Shown in red: something that can't be taken lightly.
      danger?: boolean
      // Set in under the item before it (go to's places inside a plane, D-196).
      indent?: boolean
      // What it holds folded under it: `[▸ N inside]` on its right opens it (so does → on the item, ← shuts it), `[▾ …]`
      // shuts it (D-201).
      fold?: { open: boolean; count: number; onToggle: () => void }
      // Folded away under the item before it: shown only while searching (D-200).
      folded?: boolean
      // More words it's found by besides its label (a card's tags, its planes).
      words?: string
    }
  | { key: string; heading: string }

type Item = Exclude<MenuEntry, { heading: string }>

type Props = {
  // What the trigger says, e.g. "show" or "+".
  label: ReactNode
  // Faint text after the label, e.g. "5/5" or "any".
  summary?: ReactNode
  items: MenuEntry[]
  // Open above the trigger (for the bottom toolbar).
  up?: boolean
  // Open to the right of the trigger, its top level with it (the side nav, D-176).
  right?: boolean
  // Right-align the panel with the trigger.
  alignEnd?: boolean
  // A filled, prominent trigger (the create button).
  primary?: boolean
  // An unframed icon trigger like the settings gear, its glyph magenta (the side nav's `+`, D-178).
  icon?: boolean
  // That icon grey like the side nav's fit, not magenta (go to, D-196).
  quiet?: boolean
  // A filter that's narrowing what you see: the trigger stays lit.
  active?: boolean
  ariaLabel: string
  empty?: string
  // What the `>` line says before anything is typed.
  prompt?: string
  // What the foot counts: "8 things", "5 places".
  noun?: string
}

const text = (n: ReactNode): string => (typeof n === 'string' || typeof n === 'number' ? String(n) : '')

// The typed text lit in magenta inside a label (only a plain-text label).
function Lit({ label, q }: { label: ReactNode; q: string }) {
  const s = text(label)
  const at = q ? s.toLowerCase().indexOf(q) : -1
  if (at < 0) return <>{label}</>
  return (
    <>
      {s.slice(0, at)}
      <mark className={styles.match}>{s.slice(at, at + q.length)}</mark>
      {s.slice(at + q.length)}
    </>
  )
}

// What a query shows: the items whose label holds it, those whose letter it is first; no headings.
function find(items: MenuEntry[], q: string): Item[] {
  const all = items.filter((i): i is Item => !('heading' in i))
  const keyed = q.length === 1 ? all.filter((i) => i.letter === q) : []
  return [...keyed, ...all.filter((i) => !keyed.includes(i) && `${text(i.label)} ${i.words ?? ''}`.toLowerCase().includes(q))]
}

type PanelProps = {
  items: MenuEntry[]
  ariaLabel: string
  empty?: string
  prompt?: string
  noun?: string
  // Closes the menu; `refocus` = give focus back to what opened it.
  onClose: (refocus?: boolean) => void
  id?: string
  // What the keys do, in the foot after the count (the default: `↵ picks the first` while searching).
  keys?: string
}

// The list with its `>` line and foot (D-222): a dropdown's panel, or the right-click menu's.
export function MenuPanel({ items, ariaLabel, empty, prompt = 'type to find…', noun = 'things', onClose, id, keys }: PanelProps) {
  const [query, setQuery] = useState('')
  const field = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const q = query.trim().toLowerCase()
  const shown: MenuEntry[] = q ? find(items, q) : items.filter((i) => !('folded' in i && i.folded))
  const count = shown.filter((i) => !('heading' in i)).length
  // A column for `[k]` only when some item has a letter.
  const keyed = items.some((i) => 'letter' in i && i.letter)

  useEffect(() => {
    requestAnimationFrame(() => (field.current ?? list.current?.querySelector<HTMLElement>('[role^=menuitem]'))?.focus())
  }, [])

  const pick = (item: Item | undefined, e: { shiftKey: boolean; altKey: boolean }) => {
    if (!item) return
    const kept = item.onSelect({ shift: e.shiftKey, alt: e.altKey }) === 'keep'
    if (item.checked === undefined && !kept) onClose()
  }
  const firstItem = () => shown.find((i): i is Item => !('heading' in i))
  const itemOf = (el: Element | null) => shown.find((i): i is Item => !('heading' in i) && i.key === (el as HTMLElement | null)?.dataset.key)

  const onKeyDown = (e: React.KeyboardEvent) => {
    const all = [...(list.current?.querySelectorAll<HTMLElement>('[role^=menuitem]') ?? [])]
    const at = all.indexOf(document.activeElement as HTMLElement)
    const go = (i: number) => all[(i + all.length) % all.length]?.focus()
    const inField = document.activeElement === field.current
    // Keys stay in the menu: the canvas's own shortcuts (Delete, 0, ⌘Z) don't fire.
    e.stopPropagation()
    // Up from the first item goes back to the field.
    if (e.key === 'ArrowUp' && at === 0 && field.current) (e.preventDefault(), field.current.focus())
    else if (e.key === 'ArrowDown') (e.preventDefault(), go(inField ? 0 : at + 1))
    else if (e.key === 'ArrowUp') (e.preventDefault(), go(at - 1))
    else if (e.key === 'Enter' && inField) (e.preventDefault(), pick(firstItem(), e))
    // Enter on an item, heard here rather than as its click: the click wouldn't say whether shift or alt was held.
    else if (e.key === 'Enter' && at >= 0) (e.preventDefault(), pick(itemOf(all[at]), e))
    else if (e.key === 'Home' && !inField) (e.preventDefault(), go(0))
    else if (e.key === 'End' && !inField) (e.preventDefault(), go(all.length - 1))
    else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !inField) {
      const item = shown.find((x) => x.key === (document.activeElement as HTMLElement | null)?.dataset.key)
      if (item && 'fold' in item && item.fold && item.fold.open === (e.key === 'ArrowLeft')) (e.preventDefault(), item.fold.onToggle())
    } else if (e.key === 'Escape') (e.preventDefault(), onClose())
    else if (e.key === 'Tab') onClose(false)
    // A letter typed on the list goes to the field.
    else if (!inField && e.key.length === 1 && !e.metaKey && !e.ctrlKey && field.current) field.current.focus()
  }

  return (
    <div className={styles.prompt} onKeyDown={onKeyDown}>
      {items.length > 0 && (
        <label className={styles.line}>
          <span className={styles.caretSign} aria-hidden>
            &gt;
          </span>
          <input
            ref={field}
            className={styles.field}
            type="text"
            value={query}
            placeholder={prompt}
            aria-label={`${ariaLabel}: type to find`}
            aria-controls={id}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      )}
      <div ref={list} id={id} className={styles.list} role="menu" aria-label={ariaLabel}>
        {items.length === 0 && <p className={styles.empty}>{empty ?? 'Nothing here yet'}</p>}
        {items.length > 0 && count === 0 && <p className={styles.empty}>no match · esc closes</p>}
        {shown.map((item, i) =>
          'heading' in item ? (
            <div key={item.key} className={styles.heading} role="presentation">
              {item.heading}
            </div>
          ) : (
            <button
              key={item.key}
              className={styles.item}
              role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
              aria-checked={item.checked}
              data-indent={item.indent || undefined}
              data-danger={item.danger || undefined}
              data-first={(q && i === 0) || undefined}
              data-key={item.key}
              data-open={item.fold?.open || undefined}
              aria-expanded={item.fold?.open}
              tabIndex={-1}
              style={item.tone ? { ['--tone' as string]: item.tone } : undefined}
              onClick={(e) => pick(item, e)}
            >
              <span className={styles.cursor} aria-hidden>
                ›
              </span>
              {item.checked !== undefined ? (
                <span className={styles.check} data-on={item.checked} aria-hidden>
                  {item.checked ? '[x]' : '[ ]'}
                </span>
              ) : (
                keyed && (
                  <span className={styles.letter} aria-hidden>
                    {item.letter ? (
                      <>
                        [<b>{item.letter}</b>]
                      </>
                    ) : null}
                  </span>
                )
              )}
              {item.glyph && (
                <span className={styles.glyph} aria-hidden>
                  {item.glyph}
                </span>
              )}
              <span className={styles.itemLabel}>
                <Lit label={item.label} q={q} />
              </span>
              {item.fold && !q && (
                // Inside the item's button: its click opens or shuts the fold and doesn't pick the item.
                <span
                  className={styles.fold}
                  aria-hidden
                  title={item.fold.open ? 'hide what is inside (←)' : 'show what is inside (→)'}
                  onClick={(e) => {
                    e.stopPropagation()
                    item.fold!.onToggle()
                  }}
                >
                  <span className={styles.foldCaret}>{item.fold.open ? '▾' : '▸'}</span> {item.fold.count} inside
                </span>
              )}
              {item.hint && <span className={styles.hint}>{item.hint}</span>}
            </button>
          ),
        )}
      </div>
      {items.length > 0 && (
        <div className={styles.foot} aria-hidden>
          {q
            ? count
              ? `${count} found · ${keys ?? '↵ picks the first'}`
              : ''
            : `${count} ${count === 1 ? noun.replace(/s$/, '') : noun} · ${keys ?? `type to find${keyed ? ' · a letter goes first' : ''}`}`}
        </div>
      )}
    </div>
  )
}

export function Menu({ label, summary, items, up, right, alignEnd, primary, icon, quiet, active, ariaLabel, empty, prompt, noun }: Props) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()

  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) trigger.current?.focus()
  }

  // Close on a click outside: heard on the way down, since the canvas and planes stop their presses from bubbling.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) close(false)
    }
    window.addEventListener('pointerdown', onDown, true)
    return () => window.removeEventListener('pointerdown', onDown, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <div ref={root} className={styles.root}>
      <button
        ref={trigger}
        className={icon ? styles.icon : primary ? styles.primary : styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        data-active={active || undefined}
        data-quiet={quiet || undefined}
        aria-controls={open ? id : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) (e.preventDefault(), setOpen(true))
        }}
      >
        <span className={styles.label}>{label}</span>
        {summary !== undefined && <span className={styles.summary}>{summary}</span>}
        {!primary && !icon && (
          <span className={styles.caret} aria-hidden>
            ▾
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <Appear key="menu" className={styles.panel} data-up={up} data-right={right} data-end={alignEnd}>
            <MenuPanel id={id} items={items} ariaLabel={ariaLabel} empty={empty} prompt={prompt} noun={noun} onClose={close} />
          </Appear>
        )}
      </AnimatePresence>
    </div>
  )
}
