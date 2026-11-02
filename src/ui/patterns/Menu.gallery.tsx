import { useState } from 'react'
import { example } from '../../gallery/example'
import { Menu } from './Menu'
import type { PromptEntry } from '../foundation/promptModel'

const none = () => {}
const ADD: PromptEntry[] = [
  { key: 'h1', heading: 'pieces' },
  { key: 'plane', label: 'plane', letter: 'p', glyph: '▦', hint: 'cards and links', onSelect: none },
  { key: 'matrix', label: 'matrix…', letter: 'm', glyph: '▤', onSelect: none },
  { key: 'table', label: 'table…', letter: 't', glyph: '▥', onSelect: none },
  { key: 'deck', label: 'deck…', letter: 'd', glyph: '▧', onSelect: none },
  { key: 'h2', heading: 'text' },
  { key: 'heading', label: 'heading', letter: 'h', onSelect: none },
  { key: 'sticky', label: 'sticky note', letter: 's', onSelect: none },
  { key: 'r', heading: '' },
  { key: 'del', label: 'delete', danger: true, onSelect: none },
]

function Checks() {
  const [on, setOn] = useState({ for: false, relates: false, competes: true })
  const items: PromptEntry[] = (Object.keys(on) as (keyof typeof on)[]).map((k) => ({ key: k, label: k, checked: on[k], onSelect: () => setOn({ ...on, [k]: !on[k] }) }))
  return <Menu label="links" summary={`${Object.values(on).filter(Boolean).length}/3`} items={items} ariaLabel="links shown" />
}

export default example({
  name: 'Menu',
  place: 'overlays/menus',
  also: ['forms/pickers'],
  file: 'src/ui/patterns/Menu.tsx',
  note: 'a trigger (the one dropdown trigger, D-344) opening the prompt (PromptPanel, D-222) under it, above it or beside it; ticked rows keep it open',
  states: {
    closed: () => <Menu label="+" items={ADD} ariaLabel="add" />,
    open: { render: () => <div style={{ height: 420 }}><Menu label="+" items={ADD} ariaLabel="add" /></div>, setup: (c) => c.click('[aria-haspopup="menu"]') },
    typed: {
      render: () => <div style={{ height: 420 }}><Menu label="+" items={ADD} ariaLabel="add" /></div>,
      setup: async (c) => {
        c.click('[aria-haspopup="menu"]')
        await c.wait(80)
        c.type('ta', 'input')
      },
      note: '"ta" typed: matches lit, the first picked',
    },
    checkboxes: { render: () => <div style={{ height: 200 }}><Checks /></div>, setup: (c) => c.click('[aria-haspopup="menu"]') },
    plain: () => <Menu label="lanes" summary="none" plain items={[{ key: 'p', label: 'person', onSelect: none }, { key: 'c', label: 'card', onSelect: none }]} ariaLabel="lanes" />,
    primary: () => <Menu label="+ new" primary items={ADD} ariaLabel="add" />,
    icon: () => <Menu label="+" icon items={ADD} ariaLabel="add" />,
    'icon in the hud': {
      render: () => (
        <div style={{ display: 'flex', gap: 'var(--space-8)', alignItems: 'center' }}>
          {(['small', 'normal', 'large'] as const).map((s) => (
            <div key={s} data-hud={s}>
              <Menu label={<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden><path d="M10 2v16M2 10h16" stroke="currentColor" strokeWidth="1.5" /></svg>} icon hud items={ADD} ariaLabel={`add, ${s}`} />
            </div>
          ))}
        </div>
      ),
      note: 'the side nav’s `+`: `hud` sizes it with the HUD’s tools (D-348)',
    },
  },
})
