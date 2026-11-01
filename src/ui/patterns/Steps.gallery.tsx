import { useState } from 'react'
import { example } from '../../gallery/example'
import { Steps } from './Steps'

function Live({ start = 1 }: { start?: number }) {
  const [step, setStep] = useState(start)
  return (
    <div style={{ width: 640 }}>
      <Steps steps={['start from', 'rows', 'columns', 'cells']} step={step} onStep={setStep} />
    </div>
  )
}

export default example({
  name: 'Steps',
  place: 'overlays/wizards',
  also: ['onboarding/welcome', 'forms/pickers'],
  file: 'src/ui/patterns/Steps.tsx',
  note: 'a wizard’s numbered steps (D-326): WizardShell’s and the onboarding welcome’s, one part; Tabs’ cells (D-344)',
  states: {
    'second step': () => <Live />,
    'first step': () => <Live start={0} />,
  },
})
