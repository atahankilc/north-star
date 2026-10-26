// Drawing a section (D-130, D-188): the side nav's `+` → section turns the space's pointer into a crosshair; press, drag,
// release draws the frame (snapped to the grid, alt = free) and its name is typed at once. Escape, or a press that
// doesn't drag, leaves it.
import { useState, type PointerEvent as ReactPointerEvent } from 'react'
import { addLabel, SECTION_MIN } from '../../data/labels'
import { snap } from '../../data/grid'
import { useCanvasView } from '../../state/canvasView'
import { useWs } from './context'
import styles from './DrawSection.module.css'

type Props = { space: string; toSpace: (clientX: number, clientY: number) => [number, number] }

export function DrawSection({ space, toSpace }: Props) {
  const { wid } = useWs()
  // The frame being drawn, on screen (px from this overlay's corner).
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  const press = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const el = e.currentTarget
    const box = el.getBoundingClientRect()
    const [sx, sy] = [e.clientX, e.clientY]
    const a = toSpace(sx, sy)
    let b: [number, number] | null = null
    el.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent) => {
      b = toSpace(ev.clientX, ev.clientY)
      setRect({ x: Math.min(sx, ev.clientX) - box.left, y: Math.min(sy, ev.clientY) - box.top, w: Math.abs(ev.clientX - sx), h: Math.abs(ev.clientY - sy) })
      if (ev.altKey) el.dataset.free = 'true'
      else delete el.dataset.free
    }
    const up = async (ev: PointerEvent) => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      setRect(null)
      useCanvasView.setState({ drawing: null })
      if (!b) return
      const at = (v: number) => (ev.altKey ? Math.round(v) : snap(v))
      const x = at(Math.min(a[0], b[0]))
      const y = at(Math.min(a[1], b[1]))
      const w = Math.max(SECTION_MIN.w, at(Math.max(a[0], b[0])) - x)
      const h = Math.max(SECTION_MIN.h, at(Math.max(a[1], b[1])) - y)
      const id = await addLabel(wid, { pieceId: space, text: '', kind: 'section', x, y, w, h })
      useCanvasView.setState({ labelSelected: id, labelEditing: id, fresh: id })
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
  }

  return (
    <div className={styles.draw} onPointerDown={press} aria-label="Draw a section">
      {rect && <div className={styles.rect} style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} />}
      {!rect && <span className={styles.hint}>drag to draw a section · esc to stop</span>}
    </div>
  )
}
