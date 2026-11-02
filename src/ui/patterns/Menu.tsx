// A dropdown menu (D-053): a trigger, the one dropdown trigger (D-344), opening the prompt (PromptPanel, D-222) under it,
// above it (`up`) or beside it (`right`). Tick rows keep it open; anything else runs and closes it. Escape closes it
// and gives focus back to the trigger, a press outside closes it.
import { AnimatePresence } from 'motion/react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Appear } from '../primitives/Appear'
import { useDismiss } from '../foundation/useDismiss'
import type { PromptEntry } from '../foundation/promptModel'
import { PromptPanel } from './PromptPanel'
import styles from './Menu.module.css'

type Props = {
  // What the trigger says, e.g. "show" or "+".
  label: ReactNode
  // Faint text after the label, e.g. "5/5" or "any".
  summary?: ReactNode
  items: PromptEntry[]
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
  // That icon in the HUD: sized with the HUD's tools, which Settings → display sets (D-348).
  hud?: boolean
  // Plain text, `lanes none ▾`, no frame or fill: in a console or a dock, beside its bracketed actions and the link
  // dropdown (a Select), which it looks like (D-289).
  plain?: boolean
  // A filter that's narrowing what you see: the trigger stays lit.
  active?: boolean
  ariaLabel: string
  empty?: string
  // What the `>` line says before anything is typed.
  prompt?: string
  // The onboarding's names (D-315) for the trigger and the open panel, and what hears it open.
  'data-learn'?: string
  panelLearn?: { 'data-learn': string }
  onOpen?: () => void
}

export function Menu({ label, summary, items, up, right, alignEnd, primary, icon, quiet, hud, plain, active, ariaLabel, empty, prompt, 'data-learn': learnAs, panelLearn, onOpen }: Props) {
  const [open, setOpen] = useState(false)
  const onOpenRef = useRef(onOpen)
  onOpenRef.current = onOpen
  useEffect(() => void (open && onOpenRef.current?.()), [open])
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()

  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) trigger.current?.focus()
  }

  // Escape on the one stack (D-359): over a window or a panel it closes first, the focus back on the trigger.
  useDismiss(root, (why) => close(why === 'escape'), { on: open, escape: true })

  return (
    <div ref={root} className={styles.root}>
      <button
        ref={trigger}
        className={icon ? styles.icon : primary ? styles.primary : plain ? styles.plain : styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        data-active={active || undefined}
        data-quiet={quiet || undefined}
        data-hud={(icon && hud) || undefined}
        aria-controls={open ? id : undefined}
        aria-label={ariaLabel}
        data-learn={learnAs}
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
          <Appear key="menu" className={styles.panel} data-up={up} data-right={right} data-end={alignEnd} {...panelLearn}>
            <PromptPanel id={id} items={items} ariaLabel={ariaLabel} empty={empty} prompt={prompt} onClose={close} />
          </Appear>
        )}
      </AnimatePresence>
    </div>
  )
}
