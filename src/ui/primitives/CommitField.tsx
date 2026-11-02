// A value edited where it's shown (D-221, D-359): the kit's Field, what's typed kept apart until Enter or leaving it
// (the user: not while still typing; useCommit), Escape undoing it. The card panel's fields, a task's title, the notes.
// - `enter`: `ends` (one line: Enter ends it, a line break never typed), `shift` (Enter ends it, ⇧Enter a new line),
//   `newline` (Enter a new line, leaving or Escape ends it: notes);
// - `escape`: `undo` what was typed (default), or `keep` it (notes: Escape only leaves);
// - `empty`: left empty it's saved (default), or put back (`undo`: a title can't be empty).
// Always a textarea as tall as its text; `onSave` hears the whole text (the caller trims or checks).
import { useRef } from 'react'
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
  [data: `data-${string}`]: unknown
}

export function CommitField({ value, onSave, enter = 'ends', escape = 'undo', empty = 'save', rows = 1, ...field }: Props) {
  const el = useRef<HTMLTextAreaElement>(null)
  const { draft, setDraft, commit, revert } = useCommit(value, onSave)
  return (
    <Field
      {...field}
      ref={el as never}
      multiline
      rows={rows}
      value={draft}
      onChange={(v) => setDraft(enter === 'ends' ? v.replace(/\n/g, '') : v)}
      onBlur={() => (empty === 'undo' && !draft.trim() ? revert() : commit())}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing && enter !== 'newline' && !(enter === 'shift' && e.shiftKey)) (e.preventDefault(), e.currentTarget.blur())
        if (e.key === 'Escape') {
          e.preventDefault()
          if (escape === 'undo') revert()
          requestAnimationFrame(() => el.current?.blur())
        }
      }}
    />
  )
}
