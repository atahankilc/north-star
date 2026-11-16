import { useState } from 'react'
import { example } from '../../gallery/example'
import { Select, type SelectOption } from './Select'

const KINDS: SelectOption<string>[] = [
  { value: 'solves', label: 'solves' },
  { value: 'part', label: 'part of' },
  { value: 'competes', label: 'competes with' },
  { value: 'depends', label: 'depends on' },
]
// Labels drawn, not written: found by their `words`.
const NAMES = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
const DRAWN: SelectOption<string>[] = NAMES.map((n, i) => ({ value: `o${i}`, label: <span>◆ {n}</span>, words: n }))
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
    wide: () => <Select wide value="a" options={[{ value: 'a', label: 'gpt-5.6-terra · not tried yet · suggested' }]} onChange={() => {}} ariaLabel="model" />,
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
    'drawn labels, typed': {
      render: () => <div style={{ height: 460 }}><Pick options={DRAWN} start="o3" /></div>,
      setup: async (c) => {
        c.click('[aria-haspopup]')
        await c.wait(120)
        c.type('nine', 'input')
      },
      note: 'a label that is drawn (a mark and a word) is found by its `words`, else by its value (D-401: it found nothing)',
    },
    disabled: () => <Pick disabled />,
  },
})
