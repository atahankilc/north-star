// A value edited where it's shown (D-221, D-359): the kit's Field, what's typed kept apart until Enter or leaving it
// (the user: not while still typing; useCommit), Escape undoing it. The card panel's fields, a task's title, the notes.
// - `enter`: `ends` (one line: Enter ends it, a line break never typed), `shift` (Enter ends it, ⇧Enter a new line),
//   `newline` (Enter a new line, leaving or Escape ends it: notes);
// - `escape`: `undo` what was typed (default), or `keep` it (notes: Escape only leaves);
// - `empty`: left empty it's saved (default), or put back (`undo`: a title can't be empty).
// A textarea as tall as its text; `line`: one line in an input, for a name or a number typed over where it's shown
// (a deck column's name, a checklist's step, a document's title in its row; D-392: each had its own draft and its own
// way to undo). There: `autoFocus`, `select` (everything selected as it opens), `clean` (what may be typed), and
// `onEnd` once it's over (kept, put back or untouched), so the caller can stop showing it.
// `onSave` hears the whole text, only when it changed (the caller trims or checks).
import { useRef, type CSSProperties, type InputHTMLAttributes, type MouseEventHandler, type PointerEventHandler } from 'react'
import { useCommit } from '../foundation/useCommit'
import { Field } from './Field'

type Props = {
  value: string
  onSave: (value: string) => void
  label: string
  placeholder?: string
  enter?: 'ends' | 'shift' | 'newline'
  escape?: 'undo' | 'keep'
  empty?: 'save' | 'undo'
  size?: 'sm' | 'md'
  quiet?: boolean
  rows?: number
  maxLength?: number
  readOnly?: boolean
  className?: string
  line?: boolean
  autoFocus?: boolean
  select?: boolean
  clean?: (typed: string) => string
  onEnd?: () => void
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode']
  style?: CSSProperties
  onClick?: MouseEventHandler
  onPointerDown?: PointerEventHandler
  [data: `data-${string}`]: unknown
}

export function CommitField({ value, onSave, enter = 'ends', escape = 'undo', empty = 'save', rows = 1, line, select, clean, onEnd, ...field }: Props) {
  const el = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  const { draft, setDraft, commit, revert } = useCommit(value, onSave)
  // Leaving ends it once (a field taken away while it has the keyboard can blur again).
  const ended = useRef(false)
  const leave = () => {
    if (ended.current) return
    ended.current = true
    if (empty === 'undo' && !draft.trim()) revert()
    else commit()
    onEnd?.()
  }
  const undo = () => {
    if (escape === 'undo') revert()
    // Blurs once the draft is back, so nothing is saved.
    requestAnimationFrame(() => el.current?.blur())
  }
  const shared = {
    ...field,
    ref: el as never,
    value: draft,
    onFocus: (e: { currentTarget: HTMLInputElement | HTMLTextAreaElement }) => ((ended.current = false), select && e.currentTarget.select()),
    onBlur: leave,
  }
  if (line) return <Field {...shared} onChange={(v) => setDraft(clean ? clean(v) : v)} onEnter={() => el.current?.blur()} onEscape={undo} />
  return (
    <Field
      {...shared}
      multiline
      rows={rows}
      onChange={(v) => setDraft(clean ? clean(v) : enter === 'ends' ? v.replace(/\n/g, '') : v)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing && enter !== 'newline' && !(enter === 'shift' && e.shiftKey)) (e.preventDefault(), e.currentTarget.blur())
        if (e.key === 'Escape') (e.preventDefault(), undo())
      }}
    />
  )
}
