import type { ReactNode } from 'react'
import { example } from '../gallery/example'
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
  file: 'src/ui/Button.tsx',
  note: 'the one button (D-326): sm the [verb] of rows and bars, md the page’s; AsciiButton, PanelAction and DockAction draw it',
  states: {
    'sm tones': () =>
      row([
        ['default', <Button onClick={none}>edit</Button>],
        ['primary', <Button tone="primary" onClick={none}>save</Button>],
        ['danger (hover it)', <Button tone="danger" onClick={none}>delete</Button>],
        ['main', <Button tone="main" onClick={none}>unfocus</Button>],
        ['pressed', <Button pressed onClick={none}>⇆ table</Button>],
        ['disabled', <Button disabled onClick={none}>edit</Button>],
      ]),
    'sm with key': () =>
      row([
        ['key hint', <Button keyHint="esc" tone="main" onClick={none}>unfocus</Button>],
        ['on a bar (a dock)', <span style={{ display: 'flex', gap: 'var(--space-3)' }}><Button keyHint="c" onClick={none}>comment</Button><Button pressed onClick={none}>⇆ deck</Button><Button keyHint="esc" tone="main" onClick={none}>unfocus</Button></span>],
        ['icon', <Button icon title="close" onClick={none}>×</Button>],
      ]),
    hover: { render: () => <Button data-g="b" onClick={none}>edit</Button>, hover: '[data-g="b"]' },
    'md accents': () =>
      row((['magenta', 'cyan', 'yellow', 'blue', 'green'] as const).map((a) => [a, <Button size="md" accent={a} onClick={none}>create workspace</Button>])),
    'md hover': { render: () => <Button size="md" data-g="m" onClick={none}>create workspace</Button>, hover: '[data-g="m"]' },
  },
})
