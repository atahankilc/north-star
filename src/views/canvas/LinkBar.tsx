// The bar under a selected link (D-108): change its kind, turn it around, give it a label of its own, or remove it.
// Everything is undoable (edges.ts). Viewers and the assistant's preview get no bar. A link just drawn (or `label…` from
// its menu) opens it with the cursor in the label field (D-154).
import { Html } from '@react-three/drei'
import { useEffect, useRef, useState } from 'react'
import type { WithId } from '../../data/hooks'
import { reverseEdge, updateEdge } from '../../data/edges'
import { FOR, type Edge } from '../../data/model'
import { useCanvas } from '../../state/canvasStore'
import { Select } from '../../ui/Select'
import { removeLink } from '../workspace/useEditKeys'
import { EDGE_KINDS, LINK_TONE, linkStyle } from './linkKinds'
import styles from './FloatBar.module.css'

// A kind in a picker: a short bar in its group's colour, then its name.
export function KindOption({ kind }: { kind: string }) {
  const style = linkStyle(kind)
  return (
    <span style={{ ['--tone' as string]: LINK_TONE[style.group] }}>
      <span className={styles.swatch} aria-hidden />
      {style.label}
    </span>
  )
}

export function LinkBar({ wid, edge, at }: { wid: string; edge: WithId<Edge>; at: [number, number] }) {
  const [draft, setDraft] = useState(edge.label ?? '')
  useEffect(() => setDraft(edge.label ?? ''), [edge.label])
  const input = useRef<HTMLInputElement>(null)
  const labelling = useCanvas((s) => s.labelling)
  useEffect(() => {
    if (!labelling) return
    // `<Html>` mounts the bar in a root of its own a frame or two later: wait for the field, for up to half a second.
    let raf = 0
    let tries = 30
    const focus = () => {
      if (input.current) {
        input.current.focus({ preventScroll: true })
        useCanvas.getState().doneLabelling()
      } else if (tries-- > 0) raf = requestAnimationFrame(focus)
      else useCanvas.getState().doneLabelling()
    }
    raf = requestAnimationFrame(focus)
    return () => cancelAnimationFrame(raf)
  }, [labelling, edge.id])
  const tone = LINK_TONE[linkStyle(edge.kind).group]

  const saveLabel = () => {
    const next = draft.trim()
    if (next === (edge.label ?? '')) return
    void updateEdge(wid, edge.id, { label: next || undefined })
  }

  return (
    <Html position={[at[0], at[1], 0]} zIndexRange={[15, 15]}>
      <div
        className={styles.bar}
        style={{ ['--tone' as string]: tone }}
        role="toolbar"
        aria-label="Link"
        // The board pans on a press; this is a toolbar.
        onPointerDown={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        <Select
          className={styles.kind}
          value={edge.kind}
          options={EDGE_KINDS.map((k) => ({ value: k, label: <KindOption kind={k} /> }))}
          onChange={(kind) => void updateEdge(wid, edge.id, { kind })}
          ariaLabel="Link type"
        />
        <span className={styles.rule} />
        <input
          ref={input}
          className={styles.input}
          value={draft}
          maxLength={200}
          placeholder="label…"
          aria-label="Link label"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={saveLabel}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') {
              setDraft(edge.label ?? '')
              requestAnimationFrame(() => (e.target as HTMLInputElement).blur())
            }
          }}
        />
        <span className={styles.rule} />
        {/* A customer tag always points item → customer (D-044). */}
        <button
          className={styles.button}
          disabled={edge.kind === FOR}
          title={edge.kind === FOR ? 'A customer tag always points at the customer' : 'Turn the arrow around'}
          onClick={() => void reverseEdge(wid, edge.id, edge)}
        >
          ⇄ reverse
        </button>
        <button className={styles.button} data-tone="danger" title="Delete or Backspace" onClick={() => removeLink(wid, edge.id)}>
          × remove
        </button>
      </div>
    </Html>
  )
}
