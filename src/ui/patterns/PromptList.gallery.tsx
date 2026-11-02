import { useState } from 'react'
import { example } from '../../gallery/example'
import { PromptList } from './PromptList'
import type { PromptEntry } from '../foundation/promptModel'

const none = () => {}
const GO_TO = (open: boolean, toggle: () => void): PromptEntry[] => [
  { key: 'h', heading: 'go to · on the canvas', count: 5 },
  { key: 'title', label: 'Pazar', glyph: '★', hint: 'project', onSelect: none },
  { key: 'lunch', label: '01 Lunch', glyph: '▦', hint: 'plane', fold: { open, count: 2, onToggle: toggle }, onSelect: none },
  ...(open
    ? [
        { key: 'who', label: 'Who we serve', glyph: '#', indent: true, onSelect: none },
        { key: 'rivals', label: 'Rivals', glyph: '#', indent: true, onSelect: none },
      ]
    : []),
  { key: 'matrix', label: '03 Who covers what', glyph: '▤', hint: 'matrix', onSelect: none },
  { key: 'deck', label: '05 Launch', glyph: '▥', hint: 'deck', onSelect: none },
]

function Places() {
  const [open, setOpen] = useState(true)
  const [picked, setPicked] = useState<string | null>('lunch')
  return (
    <div style={{ width: 'var(--size-lg)', height: 'var(--size-sm)', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <PromptList entries={GO_TO(open, () => setOpen((o) => !o))} picked={picked} q="" label="Places" onPick={none} onPoint={setPicked} idOf={(k) => `places-${k}`} />
    </div>
  )
}

const frame = { width: 'var(--size-md)', display: 'flex', flexDirection: 'column' as const, background: 'var(--bg)' }

export default example({
  name: 'Prompt list',
  place: 'overlays/menus',
  also: ['forms/pickers'],
  file: 'src/ui/patterns/PromptList.tsx',
  note: 'the prompt’s list (D-222): heads and rows, the picked one given from outside, only the list scrolls; the menus, the finder and the guide hold it',
  states: {
    'places with a fold': () => <Places />,
    empty: () => <div style={frame}><PromptList entries={[]} picked={null} q="" label="Cards" empty="No cards on this plane yet" onPick={none} onPoint={none} idOf={(k) => k} /></div>,
    'no match': () => <div style={frame}><PromptList entries={[]} picked={null} q="zz" label="Cards" onPick={none} onPoint={none} idOf={(k) => k} /></div>,
  },
})
