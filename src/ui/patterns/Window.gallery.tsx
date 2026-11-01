import { useState } from 'react'
import { example } from '../../gallery/example'
import { Button } from '../primitives/Button'
import { Window } from './Window'

// Opens on its own; closed (Escape, the scrim, `[×] esc`), a button brings it back.
function Shown({ children, ...props }: Omit<Parameters<typeof Window>[0], 'onClose' | 'children'> & { children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  if (!open)
    return (
      <Button tone="primary" onClick={() => setOpen(true)}>
        open the window
      </Button>
    )
  return (
    <Window {...props} onClose={() => setOpen(false)}>
      {children}
    </Window>
  )
}

const body = (
  <div style={{ display: 'grid', gap: 'var(--space-3)', padding: 'var(--space-6)', width: 'var(--size-lg)' }}>
    <h3 style={{ margin: 0, color: 'var(--fg-strong)', fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)' }}>Move it to another canvas?</h3>
    <p style={{ margin: 0 }}>What's stuck to it goes with it. Escape, a press outside or [×] closes this.</p>
    <span style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
      <Button>cancel</Button>
      <Button tone="main">move</Button>
    </span>
  </div>
)

export default example({
  name: 'Window',
  place: 'overlays/dialogs',
  file: 'src/ui/patterns/Window.tsx',
  note: 'the one window (D-326): role=dialog, focus in and back, Escape, the scrim, [×] esc, the wizard window’s frame',
  states: {
    'modal, with its close': () => (
      <Shown label="A window" close>
        {body}
      </Shown>
    ),
    'modal, built cell by cell': () => (
      <Shown label="A window" close entrance="cells">
        {body}
      </Shown>
    ),
    'not modal, in place': () => (
      <div style={{ position: 'relative', width: 'var(--size-xl)', height: 'var(--size-lg)', border: 'var(--line-w) dashed var(--line)' }}>
        <Shown label="A question" modal={false} portal={false} style={{ position: 'absolute', left: 'var(--space-6)', top: 'var(--space-6)' }}>
          {body}
        </Shown>
      </div>
    ),
  },
})
