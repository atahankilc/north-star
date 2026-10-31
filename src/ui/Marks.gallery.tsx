import type { ReactNode } from 'react'
import { example } from '../gallery/example'
import { BoxSelect, EVERY_HANDLE, Landing, Marks } from './Marks'

// A card-sized thing to put the marks round.
function Thing({ children, w = 200, h = 100, label = 'idea' }: { children?: ReactNode; w?: number; h?: number; label?: string }) {
  return (
    <div style={{ position: 'relative', width: w, height: h, background: 'var(--bg-raised)', border: '1px solid var(--line)', padding: 'var(--space-2)', color: 'var(--fg-dim)' }}>
      {label}
      {children}
    </div>
  )
}

const row = (items: [string, ReactNode][]) => (
  <div style={{ display: 'flex', gap: 'var(--space-12)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
    {items.map(([k, n]) => (
      <div key={k} style={{ display: 'grid', gap: 'var(--space-4)', justifyItems: 'center' }}>
        {n}
        <span style={{ color: 'var(--fg-faint)', fontSize: 'var(--text-xs)' }}>{k}</span>
      </div>
    ))}
  </div>
)

export default example({
  name: 'Marks',
  place: 'motion/feedback',
  also: ['canvas/selection'],
  file: 'src/ui/Marks.tsx',
  note: 'the L’s of anything selectable (D-265): distance = state, tone = what it is; point at the first to see hover live',
  states: {
    states: () =>
      row([
        ['live (point at it)', <Thing><Marks /></Thing>],
        ['hover', <Thing><Marks hover /></Thing>],
        ['pressed', <Thing><Marks pressed /></Thing>],
        ['selected', <Thing><Marks selected /></Thing>],
        ['target', <Thing><Marks target /></Thing>],
      ]),
    tiers: () =>
      row([
        ['s', <Thing w={90} h={28} label="cell"><Marks tier="s" selected /></Thing>],
        ['m', <Thing><Marks tier="m" selected /></Thing>],
        ['l', <Thing w={320} h={200} label="plane"><Marks tier="l" selected /></Thing>],
      ]),
    tones: () =>
      row([
        ['customer', <Thing label="customer"><Marks selected tone="var(--accent-yellow)" /></Thing>],
        ['problem', <Thing label="problem"><Marks selected tone="var(--accent-magenta)" /></Thing>],
        ['idea', <Thing label="idea"><Marks selected tone="var(--accent-green)" /></Thing>],
      ]),
    peers: () =>
      row([
        ['two others', <Thing><Marks peers={[{ uid: 'b', name: 'Bob', color: '#3d7bff' }, { uid: 'c', name: 'Carol', color: '#ffd23f' }]} /></Thing>],
        ['mine and one other', <Thing><Marks selected peers={[{ uid: 'b', name: 'Bob', color: '#3d7bff' }]} /></Thing>],
      ]),
    resize: () =>
      row([
        ['handles', <Thing w={320} h={200} label="plane in edit mode"><Marks tier="l" selected handles={EVERY_HANDLE} /></Thing>],
        ['resizing se', <Thing w={320} h={200} label="plane"><Marks tier="l" selected handles={EVERY_HANDLE} resizing="se" readout="960 × 600" /></Thing>],
      ]),
    'landing and box': () =>
      row([
        ['landing', <div style={{ position: 'relative', width: 260, height: 140 }}><Landing x={30} y={20} w={200} h={100} zoom={1} /></div>],
        ['box select', <div style={{ position: 'relative', width: 260, height: 140 }}><BoxSelect x={10} y={10} w={240} h={120} zoom={1} /></div>],
      ]),
  },
})
