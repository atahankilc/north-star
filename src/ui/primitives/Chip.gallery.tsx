import { useState, type ReactNode } from 'react'
import { example } from '../../gallery/example'
import { CARD_TONE } from '../foundation/cardTone'
import { Chip } from './Chip'

const wrap = (n: ReactNode) => <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', maxWidth: 520, alignItems: 'center' }}>{n}</div>
const rows = (items: [string, ReactNode][]) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'var(--space-3) var(--space-6)', alignItems: 'center' }}>
    {items.map(([k, n]) => [
      <span key={`${k}-l`} style={{ color: 'var(--fg-faint)', fontSize: 'var(--text-xs)' }}>
        {k}
      </span>,
      <span key={k}>{n}</span>,
    ])}
  </div>
)

// Tags taken off as you click their `×`, as a card's panel does.
function Removable() {
  const [tags, setTags] = useState(['b2c', 'supply', 'berlin', 'pilot'])
  return wrap(
    <>
      {tags.map((t) => (
        <Chip key={t} onRemove={() => setTags(tags.filter((x) => x !== t))} removeLabel="take it off">
          #{t}
        </Chip>
      ))}
      {tags.length === 0 && <span style={{ color: 'var(--fg-faint)' }}>all taken off · [reset]</span>}
    </>,
  )
}

const TYPES = ['customer', 'problem', 'competitor', 'idea', 'feature', 'package'] as const

export default example({
  name: 'Chip',
  place: 'text/chips',
  also: ['forms/pickers'],
  file: 'src/ui/primitives/Chip.tsx',
  note: 'the small inline token (D-326): tag (a #tag), pill (a value in colour), kind (caps, framed in its colour)',
  states: {
    tags: () => wrap(['#b2c', '#supply', '#berlin', '#pilot'].map((t) => <Chip key={t}>{t}</Chip>)),
    removable: { render: () => <Removable />, note: 'point at a tag: its × shows; Tab reaches it too' },
    'removable, × shown': { render: () => <Removable />, hover: '[data-variant="tag"]' },
    'clickable': () => wrap(['#b2c', '#supply'].map((t) => <Chip key={t} onClick={() => {}} title={`show only ${t}`}>{t}</Chip>)),
    'long text': () => (
      <div style={{ width: 260 }}>
        <Chip onRemove={() => {}}>#a-tag-with-a-very-long-name-that-goes-on-and-on</Chip>
      </div>
    ),
    pills: () =>
      rows([
        ['priority', wrap(<><Chip variant="pill" tone="var(--accent-magenta)">P1</Chip><Chip variant="pill" tone="var(--fg)">P2</Chip><Chip variant="pill">P3</Chip></>)],
        ['differs (P2 → P1)', <Chip variant="pill" tone="var(--accent-yellow)">P2 → P1</Chip>],
        ['status', wrap(<><Chip variant="pill" tone="var(--accent-green)">validated</Chip><Chip variant="pill" tone="var(--accent-yellow)">testing</Chip><Chip variant="pill">hypothesis</Chip></>)],
      ]),
    kinds: () => wrap(['solves', 'part of', 'competes', 'depends on'].map((k, i) => <Chip key={k} variant="kind" tone={['var(--link-solves)', 'var(--link-part)', 'var(--link-competes)', 'var(--link-depends)'][i]}>{k}</Chip>)),
    'by card type': () => rows(TYPES.map((t) => [t, wrap(<><Chip tone={CARD_TONE[t]}>#{t}</Chip><Chip variant="pill" tone={CARD_TONE[t]}>{t}</Chip><Chip variant="kind" tone={CARD_TONE[t]}>{t}</Chip></>)])),
  },
})
