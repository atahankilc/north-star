import { useState } from 'react'
import { example } from '../../gallery/example'
import { SplitLine } from './SplitLine'

const part = { position: 'absolute', top: 0, bottom: 0, padding: 'var(--space-3)', color: 'var(--fg-dim)' } as const

function Sideways() {
  const [at, setAt] = useState(0.5)
  const [box, setBox] = useState<HTMLDivElement | null>(null)
  const w = box?.clientWidth ?? 600
  return (
    <div ref={setBox} style={{ position: 'relative', width: 600, height: 200, background: 'var(--bg)', border: 'var(--line-w) solid var(--line)' }}>
      <div style={{ ...part, left: 0, width: at * w }}>the plane</div>
      <div style={{ ...part, left: at * w, right: 0 }}>what’s beside it</div>
      <SplitLine label="Plane and what's beside it" style={{ left: at * w }} onDrag={(e) => box && setAt(Math.min(0.75, Math.max(0.25, (e.clientX - box.getBoundingClientRect().left) / w)))} />
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
      <SplitLine axis="y" label="Between two panes" style={{ left: 0, top: at }} onDrag={(e) => box && setAt(Math.min(200, Math.max(40, e.clientY - box.getBoundingClientRect().top)))} />
    </div>
  )
}

export default example({
  name: 'SplitLine',
  place: 'panels/edges',
  file: 'src/ui/primitives/SplitLine.tsx',
  note: 'the line that shares the screen between two parts (D-359): beside a plane, between stacked panes, the side view and its days, the documents; 9 px to grab, cyan while pointed at or dragged',
  states: {
    'standing (x)': () => <Sideways />,
    'lying (y)': () => <Across />,
  },
})
