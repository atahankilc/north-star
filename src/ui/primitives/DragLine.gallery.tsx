import { useRef, useState } from 'react'
import { example } from '../../gallery/example'
import { DragLine } from './DragLine'

const frame = { position: 'relative', border: 'var(--line-w) solid var(--line-hover)', background: 'var(--bg)', color: 'var(--fg-dim)', padding: 'var(--space-3)' } as const
const part = { position: 'absolute', top: 0, bottom: 0, padding: 'var(--space-3)', color: 'var(--fg-dim)' } as const

function Wide() {
  const [w, setW] = useState(320)
  const at = useRef({ x: 0, w })
  return (
    <div style={{ ...frame, width: w, height: 160, marginLeft: 'auto' }}>
      <DragLine at="left" label="width" onStart={(e) => (at.current = { x: e.clientX, w })} onDrag={(e) => setW(Math.round(Math.min(560, Math.max(200, at.current.w + at.current.x - e.clientX))))} />
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
        <DragLine at="top" label="height" onStart={(e) => (at.current = { y: e.clientY, h })} onDrag={(e) => setH(Math.round(Math.min(300, Math.max(80, at.current.h + at.current.y - e.clientY))))} />
        a dock on the bottom, {h} px: drag its top edge
      </div>
    </div>
  )
}

function Sideways() {
  const [at, setAt] = useState(0.5)
  const [box, setBox] = useState<HTMLDivElement | null>(null)
  const w = box?.clientWidth ?? 600
  return (
    <div ref={setBox} style={{ position: 'relative', width: 600, height: 200, background: 'var(--bg)', border: 'var(--line-w) solid var(--line)' }}>
      <div style={{ ...part, left: 0, width: at * w }}>the plane</div>
      <div style={{ ...part, left: at * w, right: 0 }}>what’s beside it</div>
      <DragLine at="x" label="Plane and what's beside it" style={{ left: at * w }} onDrag={(e) => box && setAt(Math.min(0.75, Math.max(0.25, (e.clientX - box.getBoundingClientRect().left) / w)))} />
    </div>
  )
}

function Across() {
  const [at, setAt] = useState(100)
  const [box, setBox] = useState<HTMLDivElement | null>(null)
  return (
    <div ref={setBox} style={{ position: 'relative', width: 400, height: 240, background: 'var(--bg)', border: 'var(--line-w) solid var(--line)' }}>
      <div style={{ ...part, bottom: 'auto', height: at }}>a pane</div>
      <div style={{ ...part, top: at }}>the next pane</div>
      <DragLine at="y" label="Between two panes" style={{ left: 0, top: at }} onDrag={(e) => box && setAt(Math.min(200, Math.max(40, e.clientY - box.getBoundingClientRect().top)))} />
    </div>
  )
}

export default example({
  name: 'DragLine',
  place: 'panels/edges',
  file: 'src/ui/primitives/DragLine.tsx',
  note: 'a line that’s dragged (D-359; one component since D-397): on an edge of its parent to resize it (the agent’s column, a side panel; nothing drawn at rest), or between two parts of the screen (beside a plane, stacked panes, the side view and its days, the documents; a rule at rest); 9 px to grab, cyan while pointed at or held; the size and its limits are the caller’s',
  states: {
    'left edge (a column)': () => <Wide />,
    'top edge (a dock)': () => <Tall />,
    'between two parts, standing (x)': () => <Sideways />,
    'between two parts, lying (y)': () => <Across />,
  },
})
