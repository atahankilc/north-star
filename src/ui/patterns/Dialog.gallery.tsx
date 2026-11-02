import { useState } from 'react'
import { example } from '../../gallery/example'
import { Button } from '../primitives/Button'
import { Field } from '../primitives/Field'
import { Dialog } from './Dialog'

const none = () => {}

function Naming({ about }: { about?: boolean }) {
  const [name, setName] = useState('Pet-sitting marketplace')
  const [what, setWhat] = useState('')
  return (
    <Dialog
      title={about ? 'New workspace' : 'Rename workspace'}
      onClose={none}
      foot={
        <>
          <Button onClick={none}>cancel</Button>
          <Button tone="primary" disabled={!name.trim()} onClick={none}>
            {about ? 'create' : 'rename'}
          </Button>
        </>
      }
    >
      <Field value={name} onChange={setName} label="Name" placeholder="e.g. Pet-sitting marketplace" />
      {about && <Field value={what} onChange={setWhat} label="What are you building?" placeholder="One line: who it's for and what it does (optional)" multiline />}
    </Dialog>
  )
}

export default example({
  name: 'Dialog',
  place: 'overlays/windows',
  file: 'src/ui/patterns/Dialog.tsx',
  note: 'a small window that asks one thing (D-359): title, fields, answers joined at the foot, the go last; on the one Window (Escape, the scrim, [×] esc); the workspaces page’s naming windows',
  states: {
    'new workspace': { size: 'full', render: () => <Naming about /> },
    rename: { size: 'full', render: () => <Naming /> },
  },
})
