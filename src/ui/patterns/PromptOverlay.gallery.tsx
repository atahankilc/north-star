import { useRef, useState } from 'react'
import { example } from '../../gallery/example'
import { PromptField } from '../primitives/PromptField'
import { PromptList } from './PromptList'
import { PromptOverlay } from './PromptOverlay'

const none = () => {}
const ROWS = ['01 Lunch', '02 Product', '03 Rivals', '05 Launch'].map((t) => ({ key: t, label: t, onSelect: none }))

function Overlay({ layer, coach }: { layer?: 'float' | 'menu'; coach?: boolean }) {
  const field = useRef<HTMLTextAreaElement>(null)
  const [q, setQ] = useState('')
  const rows = ROWS.filter((r) => r.label.toLowerCase().includes(q.toLowerCase()))
  return (
    <PromptOverlay label="Find" onClose={none} field={field} layer={layer} coach={coach} style={{ width: 480 }}>
      <PromptField ref={field} value={q} onChange={setQ} onSubmit={none} label="Find" placeholder="find a plane, a card, a heading…" />
      <PromptList entries={rows} picked={rows[0]?.key ?? null} q={q} label="Places" onPick={none} onPoint={none} idOf={(k) => `g-${k}`} />
    </PromptOverlay>
  )
}

export default example({
  name: 'PromptOverlay',
  place: 'overlays/prompts',
  file: 'src/ui/patterns/PromptOverlay.tsx',
  note: 'a prompt over the page, in the middle (D-359): the finder and the ? guide; the scrim, focus on its > line, the prompt’s frame; its keys are the caller’s',
  states: {
    'the finder’s layer': { size: 'full', render: () => <Overlay /> },
    'the guide’s (a menu’s, the coach’s)': { size: 'full', render: () => <Overlay layer="menu" coach /> },
  },
})
