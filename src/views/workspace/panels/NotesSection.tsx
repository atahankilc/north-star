// A panel's notes (D-361: a card's and a task's had each written it): Inter, as long as they are; kept as typed and on
// leaving the field (Enter is a new line), Escape leaves it too. Nothing typed clears them (`onSave(undefined)`).
import { CommitField } from '../../../ui/primitives/CommitField'
import { PanelSection } from '../../../ui/patterns/SidePanel'
import styles from './CardPanel.module.css'

type Props = { n: number; value?: string; placeholder: string; max: number; editor: boolean; onSave: (notes: string | undefined) => void }

export function NotesSection({ n, value, placeholder, max, editor, onSave }: Props) {
  return (
    <PanelSection n={n} name="notes">
      <CommitField
        enter="newline"
        escape="keep"
        className={styles.notes}
        rows={2}
        value={value ?? ''}
        readOnly={!editor}
        placeholder={placeholder}
        maxLength={max}
        label="Notes"
        onSave={(v) => onSave(v.trim() ? v : undefined)}
      />
    </PanelSection>
  )
}
