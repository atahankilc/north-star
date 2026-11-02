import { useState } from 'react'
import { example } from '../../gallery/example'
import { Select, type SelectOption } from './Select'

const KINDS: SelectOption<string>[] = [
  { value: 'solves', label: 'solves' },
  { value: 'part', label: 'part of' },
  { value: 'competes', label: 'competes with' },
  { value: 'depends', label: 'depends on' },
]
const MANY: SelectOption<string>[] = Array.from({ length: 14 }, (_, i) => ({ value: `o${i}`, label: `option ${i + 1}` }))

function Pick({ options = KINDS, start = 'solves', disabled }: { options?: SelectOption<string>[]; start?: string; disabled?: boolean }) {
  const [v, setV] = useState(start)
  return <Select value={v} options={options} onChange={setV} ariaLabel="link kind" disabled={disabled} />
}

export default example({
  name: 'Select',
  place: 'forms/pickers',
  file: 'src/ui/patterns/Select.tsx',
  note: 'never a native <select> (D-093): the one dropdown trigger (D-344) opening the prompt (PromptPanel) in a Popover; the value now cyan with ✓; the `>` line past 7 options, else a letter jumps',
  states: {
    closed: () => <Pick />,
    open: { render: () => <div style={{ height: 240 }}><Pick /></div>, setup: (c) => c.click('[aria-haspopup]') },
    'many options': { render: () => <div style={{ height: 460 }}><Pick options={MANY} start="o3" /></div>, setup: (c) => c.click('[aria-haspopup]') },
    'a letter': {
      render: () => <div style={{ height: 240 }}><Pick /></div>,
      setup: async (c) => {
        c.click('[aria-haspopup]')
        await c.wait(120)
        c.key('d')
      },
      note: '`d` on a short list: depends on is picked',
    },
    'many, typed': {
      render: () => <div style={{ height: 460 }}><Pick options={MANY} start="o3" /></div>,
      setup: async (c) => {
        c.click('[aria-haspopup]')
        await c.wait(120)
        c.type('1', 'input')
      },
    },
    disabled: () => <Pick disabled />,
  },
})
