// The bar under a selected text label (D-108): a heading's size (H1, H2, H3; a paragraph has none, D-160), how it's set (bold, italic, caps),
// turned a quarter either way (D-156), its colour, edit, remove. A section's (D-130) the same for its name, without
// paragraph, and with where the name sits instead of turning (D-157); removing it leaves what it holds.
// All undoable (labels.ts). Viewers and the assistant's preview get no bar. `at` is the label's bottom-left corner.
import { Html } from '@react-three/drei'
import type { WithId } from '../../data/hooks'
import { updateLabel } from '../../data/labels'
import { PARAGRAPH_SCALES, type Label } from '../../data/model'
import { useCanvas } from '../../state/canvasStore'
import { useThemeAccent } from '../../state/theme'
import { accents } from '../../styles/tokens'
import { removeLabel } from '../workspace/useEditKeys'
import { isSection, SECTION_SIZES } from './sections'
import { STICKY_COLOR, isSticky } from './stickyNote'
import { SIZE_HINTS, SIZE_NAMES, isParagraph, paraBox } from './textStyle'
import { keepTopLeft } from './BoardLabel'
import styles from './FloatBar.module.css'

// Each switch is shown in the style it sets.
const STYLES = [
  { key: 'bold', glyph: 'B', name: 'Bold', look: { fontWeight: 700 } },
  { key: 'italic', glyph: 'I', name: 'Italic', look: { fontStyle: 'italic' } },
  { key: 'caps', glyph: 'AA', name: 'Capitals', look: {} },
] as const

// Headings' sizes; a paragraph (`note`) is made as one from + and stays one (D-160).
const HEADING_SIZES = ['heading', 'subheading', 'minor'] as const

// A quarter turn either way (D-156): ↺ reads bottom to top, ↻ top to bottom.
const TURNS = [
  { turn: 90, glyph: '↺', name: 'Turn left: reads upwards' },
  { turn: -90, glyph: '↻', name: 'Turn right: reads downwards' },
] as const

// Where a section's name sits (D-157): in the top edge, or up the left one.
const SIDES = [
  { key: 'top', glyph: '⌐ top', name: 'Name in the top edge' },
  { key: 'left', glyph: '⌊ left', name: 'Name up the left edge' },
] as const

export function LabelBar({ wid, label, at }: { wid: string; label: WithId<Label>; at: [number, number] }) {
  const tone = useThemeAccent()
  const size = label.size ?? 'heading'
  const section = isSection(label)
  // A sticky note (D-158): only its colour (yellow when none is set), edit and remove.
  const sticky = isSticky(label)
  // A paragraph stays a paragraph and a heading a heading (D-160): a heading picks H1–H3, a paragraph no size.
  const paragraph = isParagraph(label)
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
        {paragraph &&
          PARAGRAPH_SCALES.map((sc) => (
            <button
              key={sc}
              className={styles.button}
              aria-pressed={(label.scale ?? 'medium') === sc}
              title={`${sc[0].toUpperCase()}${sc.slice(1)} text`}
              // Medium is the default and isn't stored.
              // Its top-left corner stays put as the text grows or shrinks.
              onClick={() => {
                if ((label.scale ?? 'medium') === sc) return
                const scale = sc === 'medium' ? undefined : sc
                const [x, y] = keepTopLeft(label, paraBox(label), paraBox({ ...label, scale }))
                void updateLabel(wid, label.id, { scale, x, y })
              }}
            >
              {sc[0].toUpperCase()}
            </button>
          ))}
        {!sticky && !paragraph && (section ? SECTION_SIZES : HEADING_SIZES).map((s) => (
          <button
            key={s}
            className={styles.button}
            aria-pressed={size === s}
            title={SIZE_HINTS[s]}
            // The default isn't stored, so old labels and new ones read the same.
            onClick={() => size !== s && void updateLabel(wid, label.id, { size: s === 'heading' ? undefined : s })}
          >
            {SIZE_NAMES[s]}
          </button>
        ))}
        {!sticky && <span className={styles.rule} />}
        {!sticky && STYLES.map((st) => (
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
        {!sticky && <span className={styles.rule} />}
        {sticky ? null : section
          ? SIDES.map((sd) => (
              <button
                key={sd.key}
                className={styles.button}
                aria-pressed={(label.side ?? 'top') === sd.key}
                title={sd.name}
                onClick={() => (label.side ?? 'top') !== sd.key && void updateLabel(wid, label.id, { side: sd.key === 'top' ? undefined : 'left' })}
              >
                {sd.glyph}
              </button>
            ))
          : TURNS.map((t) => (
              <button
                key={t.turn}
                className={styles.button}
                aria-pressed={label.rotate === t.turn}
                aria-label={t.name}
                title={t.name}
                // Pressed again, it's level again.
                onClick={() => void updateLabel(wid, label.id, { rotate: label.rotate === t.turn ? undefined : t.turn })}
              >
                {t.glyph}
              </button>
            ))}
        {!sticky && <span className={styles.rule} />}
        <span className={styles.dots}>
          {!sticky && <button
            className={styles.dot}
            style={{ ['--tone' as string]: 'var(--fg)' }}
            aria-pressed={!label.color}
            aria-label="Plain"
            onClick={() => label.color && void updateLabel(wid, label.id, { color: undefined })}
          />}
          {accents.map((c) => (
            <button
              key={c}
              className={styles.dot}
              style={{ ['--tone' as string]: tone(c) }}
              aria-pressed={label.color === c || (sticky && !label.color && c === STICKY_COLOR)}
              aria-label={`Colour ${c}`}
              // A sticky note's yellow is its default, not stored.
              onClick={() => label.color !== c && void updateLabel(wid, label.id, { color: sticky && c === STICKY_COLOR ? undefined : c })}
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
