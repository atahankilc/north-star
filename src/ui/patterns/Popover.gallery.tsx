import { useRef, useState } from 'react'
import { example } from '../../gallery/example'
import { Popover } from './Popover'
import { Button } from '../primitives/Button'
import { PromptPanel } from './PromptPanel'

const none = () => {}
const ITEMS = ['solves', 'part of', 'competes with', 'depends on'].map((l) => ({ key: l, label: l, onSelect: none }))

function Opened({ bottom }: { bottom?: boolean }) {
  const anchor = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(true)
  return (
    <div style={{ height: 'var(--list-h)', display: 'flex', alignItems: bottom ? 'flex-end' : 'flex-start' }}>
      <Button ref={anchor} onClick={() => setOpen((o) => !o)}>
        kind
      </Button>
      {open && (
        <Popover anchor={anchor} onClose={() => setOpen(false)}>
          <PromptPanel items={ITEMS} ariaLabel="kind" line={false} onClose={() => setOpen(false)} />
        </Popover>
      )}
    </div>
  )
}

export default example({
  name: 'Popover',
  place: 'overlays/menus',
  file: 'src/ui/patterns/Popover.tsx',
  note: 'what a trigger opens in its own layer (D-093): fixed in a portal, under its anchor unless it only fits above, following it on scroll; a press outside or Escape closes it. A Select’s list',
  states: {
    'under its anchor': () => <Opened />,
    'above it, no room below': { size: 'full', render: () => <Opened bottom /> },
  },
})
