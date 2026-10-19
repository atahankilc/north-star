// The bar under a selected text label (D-108): its size (H1, H2, H3, note), how it's set (bold, italic, caps), its
// colour, edit, remove. A section's (D-130) the same for its name, without note; removing it leaves what it holds.
// All undoable (labels.ts). Viewers and the assistant's preview get no bar. `at` is the label's bottom-left corner.
import { Html } from '@react-three/drei'
import type { WithId } from '../../data/hooks'
import { updateLabel } from '../../data/labels'
import { LABEL_SIZES, type Label } from '../../data/model'
import { useCanvas } from '../../state/canvasStore'
import { useThemeAccent } from '../../state/theme'
import { accents } from '../../styles/tokens'
import { removeLabel } from '../workspace/useEditKeys'
import { isSection, SECTION_SIZES } from './sections'
import { SIZE_NAMES } from './textStyle'
import styles from './FloatBar.module.css'

// Each switch is shown in the style it sets.
const STYLES = [
  { key: 'bold', glyph: 'B', name: 'Bold', look: { fontWeight: 700 } },
  { key: 'italic', glyph: 'I', name: 'Italic', look: { fontStyle: 'italic' } },
  { key: 'caps', glyph: 'AA', name: 'Capitals', look: {} },
] as const

export function LabelBar({ wid, label, at }: { wid: string; label: WithId<Label>; at: [number, number] }) {
  const tone = useThemeAccent()
  const size = label.size ?? 'heading'
  const section = isSection(label)
  return (
    <Html
      position={[at[0], at[1], 0]}
      zIndexRange={[15, 15]}
      // Its box stays where the bar would be unmoved (the bar is shifted under its anchor): only the bar takes the pointer.
      style={{ pointerEvents: 'none' }}
    >
      <div
        className={styles.bar}
        data-align="start"
        style={{ ['--tone' as string]: label.color ? tone(label.color) : 'var(--line-hover)' }}
        role="toolbar"
        aria-label={section ? 'Section' : 'Text'}
        onPointerDown={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        {(section ? SECTION_SIZES : LABEL_SIZES).map((s) => (
          <button
            key={s}
            className={styles.button}
            aria-pressed={size === s}
            title={s}
            // The default isn't stored, so old labels and new ones read the same.
            onClick={() => size !== s && void updateLabel(wid, label.id, { size: s === 'heading' ? undefined : s })}
          >
            {SIZE_NAMES[s]}
          </button>
        ))}
        <span className={styles.rule} />
        {STYLES.map((st) => (
          <button
            key={st.key}
            className={styles.button}
            style={st.look}
            aria-pressed={!!label[st.key]}
            aria-label={st.name}
            title={st.name}
            // Off isn't stored.
            onClick={() => void updateLabel(wid, label.id, { [st.key]: label[st.key] ? undefined : true })}
          >
            {st.glyph}
          </button>
        ))}
        <span className={styles.rule} />
        <span className={styles.dots}>
          <button
            className={styles.dot}
            style={{ ['--tone' as string]: 'var(--fg)' }}
            aria-pressed={!label.color}
            aria-label="Plain"
            onClick={() => label.color && void updateLabel(wid, label.id, { color: undefined })}
          />
          {accents.map((c) => (
            <button
              key={c}
              className={styles.dot}
              style={{ ['--tone' as string]: tone(c) }}
              aria-pressed={label.color === c}
              aria-label={`Colour ${c}`}
              onClick={() => label.color !== c && void updateLabel(wid, label.id, { color: c })}
            />
          ))}
        </span>
        <span className={styles.rule} />
        <button
          className={styles.button}
          title={section ? 'Or double-click the name' : 'Or double-click the text'}
          onClick={() => useCanvas.getState().setEditingLabel(label.id)}
        >
          {section ? 'rename' : 'edit'}
        </button>
        <button
          className={styles.button}
          data-tone="danger"
          title={section ? 'Delete or Backspace; what it holds stays' : 'Delete or Backspace'}
          onClick={() => removeLabel(wid, label.id, label.text, section)}
        >
          × remove
        </button>
      </div>
    </Html>
  )
}
