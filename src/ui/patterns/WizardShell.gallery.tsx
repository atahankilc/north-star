import { useState } from 'react'
import { example } from '../../gallery/example'
import { Button } from '../primitives/Button'
import { Checkbox } from '../primitives/Checkbox'
import { WizardShell } from './WizardShell'

const STEPS = ['start from', 'rows', 'cells'] as const
const QUESTION = ['Start from', 'What goes down the side?', 'What goes in a cell?']

function Wizard({ start = 0 }: { start?: number }) {
  const [open, setOpen] = useState(true)
  const [step, setStep] = useState(start)
  const [made, setMade] = useState(false)
  const [sure, setSure] = useState(true)
  if (!open)
    return (
      <Button tone="primary" onClick={() => (setOpen(true), setMade(false), setStep(start))}>
        {made ? 'made · open it again' : 'open the wizard'}
      </Button>
    )
  return (
    <WizardShell
      label="A new matrix"
      steps={STEPS}
      step={step}
      onStep={setStep}
      title={QUESTION[step]}
      make="make the matrix"
      onMake={() => (setMade(true), setOpen(false))}
      onClose={() => setOpen(false)}
      preview={<p style={{ margin: 0 }}>8 features × 5 competitors</p>}
    >
      {step === 0 && <p style={{ margin: 0 }}>A template, or my own. Enter goes on; on the last step it makes it.</p>}
      {step === 1 && <p style={{ margin: 0 }}>Every feature on 02 Product.</p>}
      {step === 2 && <Checkbox checked={sure} onChange={setSure} label="how sure" hint="each cell says documented, inferred or a guess" />}
    </WizardShell>
  )
}

export default example({
  name: 'WizardShell',
  place: 'overlays/wizards',
  file: 'src/ui/patterns/WizardShell.tsx',
  note: 'the three wizards’ shell (D-326): numbered steps, the question and a preview, the foot; Enter next, the last makes it',
  states: {
    'first step': () => <Wizard />,
    'a middle step': () => <Wizard start={1} />,
    'the last step': () => <Wizard start={2} />,
  },
})
