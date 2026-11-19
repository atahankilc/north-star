import { useState } from 'react'
import { example } from '../../gallery/example'
import { Slider } from './Slider'

const percent = (n: number) => `${n} %`

function Size({ start, disabled }: { start: number; disabled?: boolean }) {
  const [v, setV] = useState(start)
  return <Slider label="interface size" min={75} max={150} step={5} mark={100} format={percent} value={v} onChange={setV} disabled={disabled} />
}

export default example({
  name: 'Slider',
  place: 'forms/pickers',
  file: 'src/ui/primitives/Slider.tsx',
  note: 'a number along a line (D-417): a faint line, ink up to the knob, the knob an empty circle (D-384), cyan with the keyboard; the value read beside it in mono; the tick under where it starts. Settings → display’s interface size',
  states: {
    normal: () => <Size start={100} />,
    larger: () => <Size start={125} />,
    smallest: () => <Size start={75} />,
    keyboard: {
      render: () => <Size start={110} />,
      setup: ({ root }) => root.querySelector<HTMLInputElement>('input')?.focus(),
      note: 'a cyan ring on the knob; an arrow moves it a step and sets it at once',
    },
    disabled: () => <Size start={100} disabled />,
  },
})
