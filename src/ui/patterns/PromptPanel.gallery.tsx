import { useState } from 'react'
import { example } from '../../gallery/example'
import { PromptPanel } from './PromptPanel'
import { Tabs } from '../primitives/Tabs'
import type { PromptEntry } from '../foundation/promptModel'

const none = () => {}
const ADD: PromptEntry[] = [
  { key: 'h1', heading: 'pieces' },
  { key: 'plane', label: 'plane', letter: 'p', glyph: '▦', hint: 'cards and links', onSelect: none },
  { key: 'matrix', label: 'matrix…', letter: 'm', glyph: '▤', onSelect: none },
  { key: 'table', label: 'table…', letter: 't', glyph: '▥', onSelect: none },
  { key: 'deck', label: 'deck…', letter: 'd', glyph: '▧', onSelect: none },
  { key: 'h2', heading: 'text' },
  { key: 'heading', label: 'heading', letter: 'h', glyph: 'T', onSelect: none },
  { key: 'sticky', label: 'sticky note', letter: 's', glyph: '▆', tone: 'var(--accent-yellow)', onSelect: none },
  { key: 'r', heading: '' },
  { key: 'existing', label: 'existing card…', letter: 'e', glyph: '⧉', hint: 'from another plane', onSelect: none },
]

function Ticks() {
  const [on, setOn] = useState(['home'])
  const flip = (k: string) => setOn((o) => (o.includes(k) ? o.filter((x) => x !== k) : [...o, k]))
  const items: PromptEntry[] = [
    { key: 'any', label: 'any customer', checked: on.length === 0, onSelect: () => setOn([]) },
    ...['Gym-goers', 'Home cooks', 'Night shifts', 'Office workers'].map((t, i) => {
      const k = ['gym', 'home', 'night', 'office'][i]
      return { key: k, label: t, checked: on.includes(k), tone: 'var(--type-customer)', hint: `${[3, 5, 1, 7][i]}`, onSelect: () => flip(k) }
    }),
  ]
  return <PromptPanel items={items} ariaLabel="for" onClose={none} />
}

function Scoped() {
  const [scope, setScope] = useState('canvas')
  const items: PromptEntry[] = [
    { key: 'title', label: 'Pazar', glyph: '★', hint: 'project', onSelect: none },
    { key: 'lunch', label: '01 Lunch', glyph: '▦', hint: 'plane', onSelect: none },
    { key: 'matrix', label: '03 Who covers what', glyph: '▤', hint: 'matrix', onSelect: none },
  ]
  return (
    <PromptPanel
      items={items}
      ariaLabel="go to"
      prompt="find a place…"
      hitTone="found"
      onClose={none}
      tools={<Tabs look="segments" label="where" value={scope} onChange={setScope} options={[{ value: 'here', label: 'here' }, { value: 'canvas', label: 'this canvas' }, { value: 'all', label: 'everywhere' }]} />}
    />
  )
}

const box = (w = 'var(--size-sm)') => ({ width: w, padding: 'var(--space-4)' })

export default example({
  name: 'Prompt panel',
  place: 'overlays/menus',
  also: ['forms/pickers'],
  file: 'src/ui/patterns/PromptPanel.tsx',
  note: 'the prompt (D-222): a `>` line over the list, a console’s corners (D-347); the keys stay in the line, Enter picks the lit row; nothing under it',
  states: {
    default: () => <div style={box()}><PromptPanel items={ADD} ariaLabel="add" onClose={none} /></div>,
    typed: {
      render: () => <div style={box()}><PromptPanel items={ADD} ariaLabel="add" onClose={none} /></div>,
      setup: async (c) => {
        await c.wait(80)
        c.type('ta', 'input')
      },
      note: '"ta" typed: matches lit, the first picked',
    },
    'a letter': {
      render: () => <div style={box()}><PromptPanel items={ADD} ariaLabel="add" onClose={none} /></div>,
      setup: async (c) => {
        await c.wait(80)
        c.type('s', 'input')
      },
      note: '`s` puts sticky note first (its letter), then what holds an s',
    },
    'keys moved': {
      render: () => <div style={box()}><PromptPanel items={ADD} ariaLabel="add" onClose={none} /></div>,
      setup: async (c) => {
        await c.wait(80)
        c.key('ArrowDown', 'input')
        c.key('ArrowDown', 'input')
      },
    },
    ticks: () => <div style={box()}><Ticks /></div>,
    'a Select’s options': () => (
      <div style={box()}>
        <PromptPanel role="listbox" start="editor" ariaLabel="role" prompt="role…" onClose={none} items={['owner', 'editor', 'viewer'].map((r) => ({ key: r, label: r, current: r === 'editor', onSelect: none }))} />
      </div>
    ),
    'tools on the line': () => <div style={box('calc(var(--size-lg) + var(--size-sm))')}><Scoped /></div>,
    'made from what’s typed': {
      render: () => (
        <div style={box()}>
          <PromptPanel items={[{ key: 'main', label: 'Main', current: true, hint: '7 pieces', onSelect: none }]} ariaLabel="canvases" prompt="go to a canvas…" onClose={none} more={(t) => [{ key: '+new', label: `new canvas “${t}”`, glyph: '+', onSelect: none }]} />
        </div>
      ),
      setup: async (c) => {
        await c.wait(80)
        c.type('Launch', 'input')
      },
    },
    empty: () => <div style={box()}><PromptPanel items={[]} ariaLabel="cards" empty="No cards on this plane yet" onClose={none} /></div>,
  },
})
