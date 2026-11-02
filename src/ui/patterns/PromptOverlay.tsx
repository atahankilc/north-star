// A prompt over the page, in the middle (D-359): the finder (D-236) and its twin the `?` guide (D-316). What both did
// for themselves, once, on the one Window: the scrim (the page's `--scrim`, fading in; a press on it closes), focus on
// its `>` line as it opens and back where it was after, the canvas never hearing a press through it, the prompt's frame
// (PromptFrame) fixed in the middle of the screen. Its keys are its own (Escape, Tab, the arrows: the caller's
// `onKeyDown`s), so the Window neither hears Escape nor keeps Tab inside. `layer`: the finder floats (`float`), the
// guide is a menu's (`menu`). `coach`: the onboarding's own surface (its keys never reach the coach's, D-316).
import type { CSSProperties, HTMLAttributes, ReactNode, RefObject } from 'react'
import { stopCanvas } from '../foundation/canvasGuard'
import { Window } from './Window'
import styles from './PromptOverlay.module.css'

type Props = Omit<HTMLAttributes<HTMLElement>, 'children' | 'role'> & {
  label: string
  onClose: () => void
  // Its `>` line: it takes the focus as it opens.
  field: RefObject<HTMLElement | null>
  layer?: 'float' | 'menu'
  coach?: boolean
  // The cell-by-cell build (the guide's), or none (the finder's, which glides as it grows).
  entrance?: 'cells' | 'none'
  // Into the body, or where it's drawn (the finder, inside the workspace's layout).
  portal?: boolean
  style?: CSSProperties
  children: ReactNode
  [data: `data-${string}`]: unknown
}

export function PromptOverlay({ label, onClose, field, layer = 'float', coach, entrance = 'none', portal = true, className, children, ...rest }: Props) {
  const coachMark = coach ? { 'data-coach': true } : {}
  return (
    <Window
      label={label}
      onClose={onClose}
      escape={false}
      trap={false}
      look="bare"
      entrance={entrance}
      portal={portal}
      focus={field}
      scrimProps={{ className: styles.scrim, 'data-layer': layer, ...coachMark, ...stopCanvas }}
      className={[styles.overlay, className].filter(Boolean).join(' ')}
      {...coachMark}
      {...rest}
      onPointerDown={(e) => {
        e.stopPropagation()
        rest.onPointerDown?.(e)
      }}
    >
      {children}
    </Window>
  )
}
