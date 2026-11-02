// The `>` line (D-222, D-326): the prompt every typed request starts from (a menu's, the finder's, a comment, the
// agent's, a deck's add-task). A sign (`>` magenta, the Spinner while `running`), then a Field with no line of its own
// (the prompt's border is the row's). Enter submits; in a `multiline` one Shift+Enter is a new line (as the agent and
// threads take it). Escape calls `onEscape`. `framed` draws the row's bottom rule (a menu's head); without it, it sits
// in what holds it.
import { forwardRef, type CSSProperties, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Field } from './Field'
import { Spinner } from './Spinner'
import styles from './PromptField.module.css'

type Props = {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  onEscape?: () => void
  label: string
  placeholder?: string
  // What stands before it: `>` by default; a running job shows the Spinner instead.
  sign?: ReactNode
  running?: boolean
  multiline?: boolean
  framed?: boolean
  autoFocus?: boolean
  disabled?: boolean
  maxLength?: number
  className?: string
  // Leaving it (a deck's add-task keeps what was typed, then closes).
  onBlur?: () => void
  // The caller's own keys after Enter/Escape (the finder: arrows move the pick, Tab its scope); `passKeys` lets keys
  // reach the window (⌘F again while the finder is open).
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  passKeys?: boolean
  // What's typed can't be used (the finder's bad regular expression): magenta.
  invalid?: boolean
  // More on the row after the field (the finder's scope and switches).
  children?: ReactNode
  style?: CSSProperties
  // Coming into it (the agent's box opens its column), and `data-*` the caller finds the field by.
  onFocus?: (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  data?: Record<`data-${string}`, string | true | undefined>
  // A list under it whose rows the keys move through while focus stays here (the prompt's, D-222): its id, and the
  // picked row's.
  controls?: string
  active?: string
}

export const PromptField = forwardRef<HTMLInputElement | HTMLTextAreaElement | null, Props>(function PromptField(
  { value, onChange, onSubmit, onEscape, label, placeholder, sign = '>', running, multiline, framed, autoFocus, disabled, maxLength, className, onBlur, onKeyDown, passKeys, invalid, children, style, onFocus, data, controls, active },
  ref,
) {
  const shared = { ...data, value, onChange, label, placeholder, onEscape, autoFocus, disabled, maxLength, onBlur, onFocus, passKeys, 'data-invalid': invalid || undefined, 'aria-controls': controls, 'aria-activedescendant': active, className: styles.input }
  return (
    <label className={[styles.prompt, className].filter(Boolean).join(' ')} style={style} data-framed={framed || undefined} data-running={running || undefined}>
      <span className={styles.sign} aria-hidden>
        {running ? <Spinner /> : sign}
      </span>
      {multiline ? (
        <Field
          {...shared}
          ref={ref}
          multiline
          rows={1}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) (e.preventDefault(), onSubmit(value))
            onKeyDown?.(e)
          }}
        />
      ) : (
        <Field {...shared} ref={ref} onEnter={onSubmit} onKeyDown={onKeyDown} />
      )}
      {children}
    </label>
  )
})
