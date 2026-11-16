import type { CSSProperties, ReactNode } from 'react'
import { example } from '../../gallery/example'
import { Button } from './Button'
import { CloseIcon } from './hudIcons'
import { none } from '../../gallery/samples'

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

export default example({
  name: 'Button',
  place: 'actions/buttons',
  file: 'src/ui/primitives/Button.tsx',
  note: 'the one button (D-326; D-384): nothing behind it at rest, a round shade when pointed at, only the one that goes filled; a lamp before a switch’s word, a glyph alone lights itself; sm for rows and bars, md the page’s',
  states: {
    'look (inside a target)': () => (
      <Button look>choose file</Button>
    ),
    'sm tones': () =>
      row([
        ['default', <Button onClick={none}>edit</Button>],
        ['primary (the one that goes)', <Button tone="primary" onClick={none}>save</Button>],
        ['danger', <Button tone="danger" onClick={none}>delete</Button>],
        ['hazard (the confirm’s delete)', <Button tone="hazard" onClick={none}>delete plane</Button>],
        ['main', <Button tone="main" onClick={none}>unfocus</Button>],
        ['pressed', <Button pressed onClick={none}>⇆ table</Button>],
        ['not pressed (a switch that’s off)', <Button pressed={false} onClick={none}>⇆ table</Button>],
        ['pressed, its own colour', <Button pressed style={{ '--button-on': 'var(--accent-green)' } as CSSProperties} onClick={none}>done</Button>],
        ['disabled', <Button disabled onClick={none}>edit</Button>],
        ['primary disabled', <Button tone="primary" disabled onClick={none}>make matrix</Button>],
      ]),
    icons: () =>
      row([
        ['a drawn glyph (every close)', <Button icon title="close" onClick={none}><CloseIcon /></Button>],
        ['take away', <Button icon tone="danger" title="remove" onClick={none}><CloseIcon /></Button>],
        ['a glyph and a word', <Button icon onClick={none}>‹ back</Button>],
        ['off and on: the glyph lights', <><Button icon pressed={false} title="bold" onClick={none}>B</Button><Button icon pressed title="bold" onClick={none}>B</Button></>],
        ['on, its own colour', <Button icon pressed style={{ '--button-on': 'var(--accent-green)' } as CSSProperties} onClick={none}>✓</Button>],
        ['disabled', <Button icon disabled onClick={none}>‹</Button>],
      ]),
    link: () =>
      row([
        ['in a row', <span style={{ color: 'var(--fg)', fontSize: 'var(--text-xs)' }}>relates → <Button link onClick={none}>Busy parents who travel for work</Button></span>],
      ]),
    'link hover': { render: () => <span style={{ color: 'var(--fg)', fontSize: 'var(--text-xs)' }}><Button link data-g="l" onClick={none}>Pet-sitting marketplace</Button></span>, hover: '[data-g="l"]' },
    'icon hover': { render: () => <Button icon data-g="i" title="close" onClick={none}><CloseIcon /></Button>, hover: '[data-g="i"]' },
    'main hover': { render: () => <Button tone="main" data-g="mn" onClick={none}>unfocus</Button>, hover: '[data-g="mn"]' },
    hover: { render: () => <Button data-g="b" onClick={none}>edit</Button>, hover: '[data-g="b"]' },
    'primary hover': { render: () => <Button tone="primary" data-g="p" onClick={none}>save</Button>, hover: '[data-g="p"]' },
    'danger hover': { render: () => <Button tone="danger" data-g="d" onClick={none}>delete</Button>, hover: '[data-g="d"]' },
    'md accents': () =>
      row((['magenta', 'cyan', 'yellow', 'blue', 'green'] as const).map((a) => [a, <Button size="md" accent={a} onClick={none}>create workspace</Button>])),
    'md hover': { render: () => <Button size="md" data-g="m" onClick={none}>create workspace</Button>, hover: '[data-g="m"]' },
  },
})
