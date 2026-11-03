// A panel's chips with a `+ word` that types one more (D-361: a card's tags, several cards' tags, a task's labels, a
// competitor's regions had each written it). Chips with `×` while editing; the field is the kit's AddField: Enter adds
// and stays open for the next, Escape or leaving closes. What's typed is cleaned here: trimmed, a leading `#` dropped,
// cut to `max`, never twice, never past `room`. `suggest`: words offered as you type (a deck's other labels).
// The caller holds `draft` (null: closed), so a section's own `+ tag` can open it.
import { AddField } from '../../../ui/primitives/AddField'
import { Button } from '../../../ui/primitives/Button'
import { ButtonGroup } from '../../../ui/primitives/ButtonGroup'
import { Chip } from '../../../ui/primitives/Chip'
import styles from './CardPanel.module.css'

type Props = {
  items: string[]
  editor: boolean
  // What one is called: the field's label and placeholder (`tag`, `label`, `region`).
  word: string
  placeholder?: string
  // Shown as `#tag` (tags, labels) or as typed (regions).
  hash?: boolean
  max: number
  room?: number
  suggest?: string[]
  removeLabel?: string
  draft: string | null
  onDraft: (draft: string | null) => void
  onAdd: (item: string) => void
  onRemove: (item: string) => void
  // A `+ word` button after the chips (a list inside a section's rows, not a section of its own).
  inlineAdd?: boolean
}

// `hash`: a leading `#` is the tag's mark, not its word, so it's dropped; a list without one (regions) keeps what's typed.
export const cleanTag = (typed: string, max: number, hash = true) => (hash ? typed.trim().replace(/^#/, '') : typed).trim().slice(0, max)

export function TagList({ items, editor, word, placeholder, hash = true, max, room = Infinity, suggest = [], removeLabel = 'Remove', draft, onDraft, onAdd, onRemove, inlineAdd }: Props) {
  const add = (typed: string) => {
    const t = cleanTag(typed, max, hash)
    if (t && !items.includes(t) && items.length < room) onAdd(t)
    onDraft('')
  }
  const typed = cleanTag(draft ?? '', max, hash).toLowerCase()
  const offer = draft === null ? [] : suggest.filter((s) => !items.includes(s) && s.toLowerCase().includes(typed)).slice(0, 6)
  return (
    <>
      <div className={styles.tags}>
        {items.map((t) => (
          <Chip key={t} onRemove={editor ? () => onRemove(t) : undefined} removeLabel={removeLabel}>
            {hash ? `#${t}` : t}
          </Chip>
        ))}
        {draft !== null ? (
          <AddField className={styles.tagInput} label={word[0].toUpperCase() + word.slice(1)} placeholder={placeholder ?? word} value={draft} maxLength={max} onChange={onDraft} onClose={() => onDraft(null)} onAdd={add} />
        ) : (
          inlineAdd &&
          editor && (
            <Button onClick={() => onDraft('')}>
              <span className={styles.plus}>+</span> {word}
            </Button>
          )
        )}
      </div>
      {offer.length > 0 && (
        <ButtonGroup>
          {offer.map((l) => (
            <Button key={l} onMouseDown={(e) => e.preventDefault()} onClick={() => add(l)}>
              {hash ? `#${l}` : l}
            </Button>
          ))}
        </ButtonGroup>
      )}
    </>
  )
}
