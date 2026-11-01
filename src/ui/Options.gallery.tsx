import { useState } from 'react'
import { example } from '../gallery/example'
import { Options } from './Options'
import { CARD_TONE } from './cardTone'

const TYPES = ['customer', 'problem', 'competitor', 'idea', 'feature'] as const
type Type = (typeof TYPES)[number]
const COUNTS: Record<Type, number> = { customer: 6, problem: 8, competitor: 5, idea: 6, feature: 8 }

function OneOf({ clearable, start }: { clearable?: boolean; start?: Type }) {
  const [v, setV] = useState<Type | undefined>(start)
  return (
    <Options
      pick="one"
      clearable={clearable}
      label="Every card of a type"
      value={v}
      options={TYPES.map((t) => ({ value: t, label: `${t}s`, swatch: CARD_TONE[t], count: COUNTS[t] }))}
      onChange={setV}
    />
  )
}

function ManyOf() {
  const [v, setV] = useState<string[]>(['status', 'priority'])
  return <Options pick="many" label="Fields as columns" values={v} options={['status', 'priority', 'impact', 'effort', 'regions'].map((f) => ({ value: f, label: f }))} onChange={setV} />
}

function Cards() {
  const [v, setV] = useState<'scale' | 'number' | 'text'>('scale')
  return (
    <div style={{ width: 640 }}>
      <Options
        pick="one"
        cards
        label="What a cell holds"
        value={v}
        options={[
          { value: 'scale', label: 'a mark from a scale', sample: '■ ■ ■', line: 'steps you name, one key each; a cell is a square filled to its step' },
          { value: 'number', label: 'a number', sample: '42€', line: 'with a unit; the totals average them' },
          { value: 'text', label: 'a few words', sample: 'beta only', line: 'up to 200 characters; the totals count what is written' },
        ]}
        onChange={(k) => k && setV(k)}
      />
    </div>
  )
}

const none = () => {}

export default example({
  name: 'Options',
  place: 'forms/pickers',
  file: 'src/ui/Options.tsx',
  note: 'framed options (D-326): one-of (arrows pick), many-of, or actions; a swatch, a count, or cards with a sample and a line',
  states: {
    'one of': () => <OneOf start="feature" />,
    'one of, none picked': () => <OneOf clearable />,
    'many of': () => <ManyOf />,
    actions: () => <Options pick="act" label="Add a rule on" options={['type', 'status', 'tag', 'plane', 'title'].map((f) => ({ value: f, label: `+ ${f}` }))} onPick={none} />,
    'with a disabled one': () => (
      <Options pick="many" label="Fields" values={['status']} options={[{ value: 'status', label: 'status' }, { value: 'impact', label: 'impact' }, { value: 'effort', label: 'effort', disabled: true }]} onChange={none} />
    ),
    cards: () => <Cards />,
    hover: { render: () => <OneOf start="feature" />, hover: '[data-value="idea"]' },
  },
})
