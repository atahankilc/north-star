// The bar under a selected text label (D-108): its size (heading, subheading, note), its colour, edit, remove.
// All undoable (labels.ts). Viewers and the assistant's preview get no bar. `at` is the label's bottom-left corner.
import { Html } from '@react-three/drei'
import type { WithId } from '../../data/hooks'
import { updateLabel } from '../../data/labels'
import { LABEL_SIZES, type Label } from '../../data/model'
import { useCanvas } from '../../state/canvasStore'
import { useThemeAccent } from '../../state/theme'
import { accents } from '../../styles/tokens'
import { removeLabel } from '../workspace/useEditKeys'
import styles from './FloatBar.module.css'

const SIZE_NAMES = { heading: 'H1', subheading: 'H2', note: 'note' } as const

export function LabelBar({ wid, label, at }: { wid: string; label: WithId<Label>; at: [number, number] }) {
  const tone = useThemeAccent()
  const size = label.size ?? 'heading'
  return (
    <Html position={[at[0], at[1], 0]} zIndexRange={[15, 15]}>
      <div
        className={styles.bar}
        data-align="start"
        style={{ ['--tone' as string]: label.color ? tone(label.color) : 'var(--line-hover)' }}
        role="toolbar"
        aria-label="Text"
        onPointerDown={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        {LABEL_SIZES.map((s) => (
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
        <button className={styles.button} title="Or double-click the text" onClick={() => useCanvas.getState().setEditingLabel(label.id)}>
          edit
        </button>
        <button className={styles.button} data-tone="danger" title="Delete or Backspace" onClick={() => removeLabel(wid, label.id, label.text)}>
          × remove
        </button>
      </div>
    </Html>
  )
}
