import { useState } from 'react'
import { example } from '../../gallery/example'
import { Steps } from './Steps'

function Live({ start = 1, width = 460, keyboard }: { start?: number; width?: number; keyboard?: boolean }) {
  const [step, setStep] = useState(start)
  const names = ['start from', 'rows', 'columns', 'cells']
  return (
    <div style={{ width }}>
      <Steps steps={names} titles={names} step={step} onStep={setStep} keyboard={keyboard} />
    </div>
  )
}

export default example({
  name: 'Steps',
  place: 'overlays/wizards',
  also: ['onboarding/welcome', 'forms/pickers'],
  file: 'src/ui/patterns/Steps.tsx',
  note: 'a wizard’s numbered steps (D-326): WizardShell’s and the onboarding welcome’s, one part; built on Tabs (lead, progress, even; D-344); arrows move unless keyboard={false}',
  states: {
    'second step': () => <Live />,
    'first step': () => <Live start={0} />,
    'last step': () => <Live start={3} />,
    'narrow, cut with …': () => <Live start={1} width={320} />,
    'keyboard off (onboarding)': () => <Live start={1} keyboard={false} />,
  },
})
