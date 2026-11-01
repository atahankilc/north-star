import type { ReactNode } from 'react'
import { example } from '../../gallery/example'
import { Button } from './Button'

const row = (items: [string, ReactNode][]) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: 'var(--space-3) var(--space-8)', alignItems: 'baseline' }}>
    {items.map(([k, n]) => [
      <span key={`${k}-l`} style={{ color: 'var(--fg-faint)', fontSize: 'var(--text-xs)' }}>
        {k}
      </span>,
      <span key={k}>{n}</span>,
    ])}
  </div>
)
const none = () => {}

export default example({
  name: 'Button',
  place: 'actions/buttons',
  file: 'src/ui/primitives/Button.tsx',
  note: 'the one button (D-326; cells, D-344): every button the same cell, its kind only its fill and ink; sm for rows and bars, md the page’s; a row of them joins in a ButtonGroup',
  states: {
    'look (inside a target)': () => (
      <Button look>choose file</Button>
    ),
    'sm tones': () =>
      row([
        ['default', <Button onClick={none}>edit</Button>],
        ['primary (the one that goes)', <Button tone="primary" onClick={none}>save</Button>],
        ['danger (hover it)', <Button tone="danger" onClick={none}>delete</Button>],
        ['hazard (the confirm’s delete)', <Button tone="hazard" onClick={none}>delete plane</Button>],
        ['main', <Button tone="main" onClick={none}>unfocus</Button>],
        ['pressed', <Button pressed onClick={none}>⇆ table</Button>],
        ['disabled', <Button disabled onClick={none}>edit</Button>],
        ['primary disabled', <Button tone="primary" disabled onClick={none}>make matrix</Button>],
      ]),
    icons: () =>
      row([
        ['a glyph', <Button icon title="close" onClick={none}>×</Button>],
        ['a glyph and a word', <Button icon onClick={none}>‹ back</Button>],
        ['pressed', <Button icon pressed onClick={none}>✓</Button>],
      ]),
    link: () =>
      row([
        ['in a row', <span style={{ color: 'var(--fg)', fontSize: 'var(--text-xs)' }}>relates → <Button link onClick={none}>Busy parents who travel for work</Button></span>],
      ]),
    'link hover': { render: () => <span style={{ color: 'var(--fg)', fontSize: 'var(--text-xs)' }}><Button link data-g="l" onClick={none}>Pet-sitting marketplace</Button></span>, hover: '[data-g="l"]' },
    hover: { render: () => <Button data-g="b" onClick={none}>edit</Button>, hover: '[data-g="b"]' },
    'primary hover': { render: () => <Button tone="primary" data-g="p" onClick={none}>save</Button>, hover: '[data-g="p"]' },
    'danger hover': { render: () => <Button tone="danger" data-g="d" onClick={none}>delete</Button>, hover: '[data-g="d"]' },
    'md accents': () =>
      row((['magenta', 'cyan', 'yellow', 'blue', 'green'] as const).map((a) => [a, <Button size="md" accent={a} onClick={none}>create workspace</Button>])),
    'md hover': { render: () => <Button size="md" data-g="m" onClick={none}>create workspace</Button>, hover: '[data-g="m"]' },
  },
})
