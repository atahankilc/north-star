import { useState } from 'react'
import { example } from '../../gallery/example'
import type { PromptEntry } from '../foundation/promptModel'
import { Console, FloorTitle } from './Console'
import { FilterColumn, FilterColumns } from './FilterColumn'

const TAGS = ['pricing', 'pilot', 'delivery', 'trust', 'onboarding', 'retention', 'b2b', 'subscription', 'logistics', 'quality', 'packaging', 'partners']
const TYPES = [
  ['customers', 'var(--type-customer)'],
  ['problems', 'var(--type-problem)'],
  ['ideas', 'var(--type-idea)'],
  ['features', 'var(--type-feature)'],
] as const

// A narrowing filter: `any` first, ticked while nothing is; `start` picked to begin with.
function Picks({ label, values, start = [] }: { label: string; values: string[]; start?: string[] }) {
  const [picked, setPicked] = useState<string[]>(start)
  const flip = (v: string) => setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))
  const items: PromptEntry[] = [
    { key: 'any', label: `any ${label}`, checked: picked.length === 0, onSelect: () => setPicked([]) },
    ...values.map((v, i) => ({ key: v, label: label === 'tag' ? `#${v}` : v, hint: `${values.length - i}`, checked: picked.includes(v), onSelect: () => flip(v) })),
  ]
  return <FilterColumn label={label} items={items} narrowing={picked.length} rise ariaLabel={`Only these ${label}s`} />
}

// A showing filter: every value on to start, a click hides one; no default, so nothing rises.
function Show() {
  const [hidden, setHidden] = useState<string[]>([])
  const items: PromptEntry[] = TYPES.map(([t, tone]) => ({ key: t, label: t, tone, checked: !hidden.includes(t), onSelect: () => setHidden((h) => (h.includes(t) ? h.filter((x) => x !== t) : [...h, t])) }))
  return <FilterColumn label="show" items={items} narrowing={hidden.length} ariaLabel="Show card types" />
}

export default example({
  name: 'Filter column',
  place: 'forms/filters',
  file: 'src/ui/patterns/FilterColumn.tsx',
  note: 'a filter as a column of tick rows (D-364): a plane’s and a deck’s filter drawers lay them side by side; what’s picked moves up under `any …` once the pointer leaves',
  states: {
    'side by side': () => (
      <FilterColumns>
        <Show />
        <Picks label="region" values={['Germany', 'Europe', 'US', 'Global']} />
        <Picks label="tag" values={TAGS} />
      </FilterColumns>
    ),
    // Past 70 % of what it hangs on the drawer takes the whole edge: the columns share it, nothing left over on the right.
    'on a whole edge': () => (
      <div style={{ position: 'relative', width: 'calc(var(--size-md) * 2)', height: 'calc(var(--size-sm) * 1.5)' }}>
        <Console
          at="foot"
          info="14 cards"
          floor={
            <>
              <FloorTitle summary="everything's shown">filter</FloorTitle>
              <FilterColumns>
                <Show />
                <Picks label="region" values={['Germany', 'Europe', 'US', 'Global']} />
                <Picks label="tag" values={TAGS} />
              </FilterColumns>
            </>
          }
        >
          <span />
        </Console>
      </div>
    ),
    'some picked': () => (
      <FilterColumns>
        <Picks label="tag" values={TAGS} start={['trust', 'partners']} />
      </FilterColumns>
    ),
    empty: () => (
      <FilterColumns>
        <FilterColumn label="tag" items={[{ key: 'any', label: 'any tag', checked: true, onSelect: () => {} }]} rise ariaLabel="Only these tags" empty="No tags on this plane" />
      </FilterColumns>
    ),
  },
})
