import { useRef, useState } from 'react'
import { example } from '../../gallery/example'
import { ResizeEdge } from './ResizeEdge'

const frame = { position: 'relative', border: 'var(--line-w) solid var(--line-hover)', background: 'var(--bg)', color: 'var(--fg-dim)', padding: 'var(--space-3)' } as const

function Wide() {
  const [w, setW] = useState(320)
  const at = useRef({ x: 0, w })
  return (
    <div style={{ ...frame, width: w, height: 160, marginLeft: 'auto' }}>
      <ResizeEdge edge="left" label="width" onStart={(e) => (at.current = { x: e.clientX, w })} onDrag={(e) => setW(Math.round(Math.min(560, Math.max(200, at.current.w + at.current.x - e.clientX))))} />
      a column on the right, {w} px: drag its left edge
    </div>
  )
}

function Tall() {
  const [h, setH] = useState(140)
  const at = useRef({ y: 0, h })
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', height: 320 }}>
      <div style={{ ...frame, width: 360, height: h }}>
        <ResizeEdge edge="top" label="height" onStart={(e) => (at.current = { y: e.clientY, h })} onDrag={(e) => setH(Math.round(Math.min(300, Math.max(80, at.current.h + at.current.y - e.clientY))))} />
        a dock on the bottom, {h} px: drag its top edge
      </div>
    </div>
  )
}

export default example({
  name: 'ResizeEdge',
  place: 'panels/edges',
  file: 'src/ui/primitives/ResizeEdge.tsx',
  note: 'an edge dragged to resize (D-359): the agent’s column (left), the threads dock (top); a cyan line while pointed at or held; the size and its limits are the caller’s',
  states: {
    'left edge (a column)': () => <Wide />,
    'top edge (a dock)': () => <Tall />,
  },
})
