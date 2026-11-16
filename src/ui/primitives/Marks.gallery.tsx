import type { CSSProperties, ReactNode } from 'react'
import { example } from '../../gallery/example'
import { BoxSelect, EVERY_HANDLE, Landing, Marks } from './Marks'

// A card-sized thing to put the marks round.
function Thing({ children, w = 200, h = 100, label = 'idea', round }: { children?: ReactNode; w?: number; h?: number; label?: string; round?: string }) {
  return (
    <div style={{ position: 'relative', width: w, height: h, background: 'var(--bg-raised)', border: '1px solid var(--line)', padding: 'var(--space-2)', color: 'var(--fg-dim)', borderRadius: round, cornerShape: round ? 'squircle' : undefined } as CSSProperties}>
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
  file: 'src/ui/primitives/Marks.tsx',
  note: 'the L’s of anything selectable (D-265): distance = state, tone = what it is; round a round thing, a piece of its corner’s curve (D-387); point at the first to see hover live',
  states: {
    states: () =>
      row([
        ['live (point at it)', <Thing><Marks /></Thing>],
        ['hover', <Thing><Marks hover /></Thing>],
        ['pressed', <Thing><Marks pressed /></Thing>],
        ['selected', <Thing><Marks selected /></Thing>],
        ['target', <Thing><Marks target /></Thing>],
      ]),
    'a round thing: the corner’s curve (D-387)': () =>
      row([
        ['hover', <Thing round="var(--w-card-radius)"><Marks hover corner="var(--w-card-radius)" /></Thing>],
        ['pressed', <Thing round="var(--w-card-radius)"><Marks pressed corner="var(--w-card-radius)" /></Thing>],
        ['selected', <Thing round="var(--w-card-radius)"><Marks selected corner="var(--w-card-radius)" /></Thing>],
        ['a line tall', <Thing w={160} h={28} label="task" round="var(--w-card-radius-sm)"><Marks tier="s" selected corner="var(--w-card-radius-sm)" /></Thing>],
        ['a peer', <Thing round="var(--w-card-radius)"><Marks corner="var(--w-card-radius)" peers={[{ uid: 'b', name: 'Bob', color: '#3d7bff' }]} /></Thing>],
        ['where it lands', <div style={{ position: 'relative', width: 240, height: 130 }}><Landing x={20} y={15} w={200} h={100} zoom={1} corner="var(--w-card-radius)" /></div>],
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
        ['resizing se', <Thing w={320} h={200} label="plane"><Marks tier="l" selected handles={EVERY_HANDLE} resizing="se" /></Thing>],
      ]),
    'landing and box': () =>
      row([
        ['landing', <div style={{ position: 'relative', width: 260, height: 140 }}><Landing x={30} y={20} w={200} h={100} zoom={1} /></div>],
        ['box select', <div style={{ position: 'relative', width: 260, height: 140 }}><BoxSelect x={10} y={10} w={240} h={120} zoom={1} /></div>],
      ]),
  },
})
