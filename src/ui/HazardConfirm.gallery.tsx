import { useState, type ComponentProps } from 'react'
import { example } from '../gallery/example'
import { HazardConfirm } from './HazardConfirm'

// A modal <dialog> over the whole page (the gallery too): cancel, Escape or an answer closes it, `[show again]` brings it
// back, as the app's caller would.
function Confirm(p: Omit<ComponentProps<typeof HazardConfirm>, 'onConfirm' | 'onCancel'>) {
  const [open, setOpen] = useState(true)
  const [said, setSaid] = useState('')
  const close = (what: string) => () => (setSaid(what), setOpen(false))
  if (!open)
    return (
      <p style={{ color: 'var(--fg-dim)' }}>
        {said} ·{' '}
        <button style={{ background: 'none', border: 0, color: 'var(--accent-cyan)', font: 'inherit', cursor: 'pointer' }} onClick={() => setOpen(true)}>
          [show again]
        </button>
      </p>
    )
  return <HazardConfirm {...p} also={p.also && { ...p.also, onSelect: close(p.also.label) }} onConfirm={close(p.confirm)} onCancel={close('cancelled')} />
}

export default example({
  name: 'HazardConfirm',
  section: 'ui',
  file: 'src/ui/HazardConfirm.tsx',
  note: 'a modal over the whole page; answer or Escape to get the gallery back',
  states: {
    default: () => <Confirm title="Delete Pazar?" lines={['Its 6 cards, 3 links and text go with it.', '⌘Z brings it back.']} confirm="delete" />,
    'with also': () => <Confirm title="Delete Rivals?" lines={['It is on 2 canvases.']} confirm="delete everywhere" also={{ label: 'only from here', onSelect: () => {} }} />,
    'title only': () => <Confirm title="Leave this workspace?" confirm="leave" />,
  },
})
