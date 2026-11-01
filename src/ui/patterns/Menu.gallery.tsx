import { useState } from 'react'
import { example } from '../../gallery/example'
import { Menu, MenuPanel, type MenuEntry } from './Menu'

const none = () => {}
const ADD: MenuEntry[] = [
  { key: 'h1', heading: '# pieces' },
  { key: 'plane', label: 'plane', letter: 'p', glyph: '▦', hint: 'cards and links', onSelect: none },
  { key: 'matrix', label: 'matrix…', letter: 'm', glyph: '▤', onSelect: none },
  { key: 'table', label: 'table…', letter: 't', glyph: '▥', onSelect: none },
  { key: 'deck', label: 'deck…', letter: 'd', glyph: '▧', onSelect: none },
  { key: 'h2', heading: '# text' },
  { key: 'heading', label: 'heading', letter: 'h', onSelect: none },
  { key: 'sticky', label: 'sticky note', letter: 's', onSelect: none },
  { key: 'r', heading: '' },
  { key: 'del', label: 'delete', danger: true, onSelect: none },
]

function Checks() {
  const [on, setOn] = useState({ for: false, relates: false, competes: true })
  const items: MenuEntry[] = (Object.keys(on) as (keyof typeof on)[]).map((k) => ({ key: k, label: k, checked: on[k], onSelect: () => setOn({ ...on, [k]: !on[k] }) }))
  return <Menu label="links" summary={`${Object.values(on).filter(Boolean).length}/3`} items={items} ariaLabel="links shown" />
}

const panel = { width: 320, border: '1px solid var(--line-hover)', background: 'var(--bg)' }

export default example({
  name: 'Menu',
  place: 'overlays/menus',
  also: ['forms/pickers'],
  file: 'src/ui/patterns/Menu.tsx',
  note: 'the prompt (D-222): `>` narrows, Enter picks the first, a letter goes first; its trigger the one dropdown trigger, ticked rows ✓ on a wash (D-344)',
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
      note: '"ta" typed: matches lit, the first picked by Enter',
    },
    checkboxes: { render: () => <div style={{ height: 200 }}><Checks /></div>, setup: (c) => c.click('[aria-haspopup="menu"]') },
    'panel alone': () => <div style={panel}><MenuPanel items={ADD} ariaLabel="add" onClose={none} /></div>,
    empty: () => <div style={panel}><MenuPanel items={[]} ariaLabel="cards" empty="No cards on this plane yet" onClose={none} /></div>,
    plain: () => <Menu label="lanes" summary="none" plain items={[{ key: 'p', label: 'person', onSelect: none }, { key: 'c', label: 'card', onSelect: none }]} ariaLabel="lanes" />,
    primary: () => <Menu label="+ new" primary items={ADD} ariaLabel="add" />,
    icon: () => <Menu label="+" icon items={ADD} ariaLabel="add" />,
  },
})
