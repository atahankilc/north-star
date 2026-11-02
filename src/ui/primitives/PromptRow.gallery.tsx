import { useState, type ReactNode } from 'react'
import { example } from '../../gallery/example'
import { Hit, PromptHead, PromptRow } from './PromptRow'
import type { PromptItem } from '../foundation/promptModel'

const none = () => {}
const box = (children: ReactNode) => <div style={{ width: 'var(--size-md)', background: 'var(--bg)' }}>{children}</div>
const row = (item: Partial<PromptItem> & { key: string }, picked = false, q = '') => (
  <PromptRow key={item.key} item={{ label: item.key, onSelect: none, ...item }} picked={picked} q={q} onPick={none} onPoint={none} />
)

function Ticks() {
  const [on, setOn] = useState(['home'])
  const flip = (k: string) => setOn((o) => (o.includes(k) ? o.filter((x) => x !== k) : [...o, k]))
  return box(
    ['gym', 'home', 'night'].map((k, i) => (
      <PromptRow key={k} item={{ key: k, label: ['Gym-goers', 'Home cooks', 'Night shifts'][i], tone: 'var(--type-customer)', checked: on.includes(k), hint: `${i + 3}`, onSelect: () => flip(k) }} picked={i === 0} q="" onPick={(it) => it.onSelect({ shift: false, alt: false })} onPoint={none} />
    )),
  )
}

export default example({
  name: 'Prompt row',
  place: 'overlays/menus',
  also: ['forms/pickers'],
  file: 'src/ui/primitives/PromptRow.tsx',
  note: 'one row for every prompt (D-222): `›` and a band while picked, its glyph or tick box, the label, `▸ N inside`, a hint, `✓` for the value now; `# SECTION ──` heads',
  states: {
    rows: () =>
      box(
        <>
          <PromptHead head={{ key: 'h', heading: 'pieces' }} />
          {row({ key: 'plane', glyph: '▦', hint: 'cards and links' }, true)}
          {row({ key: 'matrix…', glyph: '▤' })}
          {row({ key: 'idea', glyph: '▌', tone: 'var(--type-idea)' })}
          <PromptHead head={{ key: 'r', heading: '' }} />
          {row({ key: 'delete', glyph: '×', danger: true })}
        </>,
      ),
    'picked in its tone': () => box(row({ key: 'feature', glyph: '▌', tone: 'var(--type-feature)', hint: '02 product' }, true)),
    'danger picked': () => box(row({ key: 'delete', glyph: '×', danger: true }, true)),
    ticks: () => <Ticks />,
    'value now': () =>
      box(
        <>
          {row({ key: 'owner' })}
          {row({ key: 'editor', current: true }, true)}
          {row({ key: 'viewer' })}
        </>,
      ),
    'heads with counts': () =>
      box(
        <>
          <PromptHead head={{ key: 'c', heading: 'customers', count: 4 }} />
          {row({ key: 'Office workers', glyph: '▌', tone: 'var(--type-customer)', hint: '01 lunch' })}
          <PromptHead head={{ key: 'p', heading: 'problems', count: 3 }} />
          {row({ key: 'A 30-minute break leaves no time to queue', glyph: '▌', tone: 'var(--type-problem)', hint: '01 lunch, 02 product, 03 pricing' })}
        </>,
      ),
    folds: () =>
      box(
        <>
          {row({ key: '01 Lunch', glyph: '▦', hint: 'plane', fold: { open: true, count: 2, onToggle: none } }, true)}
          {row({ key: 'Who we serve', glyph: '#', indent: true })}
          {row({ key: 'Rivals', glyph: '#', indent: true })}
          {row({ key: '02 Product', glyph: '▦', hint: 'plane', fold: { open: false, count: 1, onToggle: none } })}
        </>,
      ),
    typed: () =>
      box(
        <>
          {row({ key: 'table…', glyph: '▥' }, true, 'ta')}
          {row({ key: 'sticky note' }, false, 'ta')}
        </>,
      ),
    'hit (found)': () => box(<p style={{ margin: 0, padding: 'var(--space-3)' }}><Hit text="Lunch takes too long" q="takes" tone="found" /></p>),
    'long label and hint': () => box(row({ key: 'Cooks don’t know which permit they need to sell their food', glyph: '▌', tone: 'var(--type-problem)', hint: '01 lunch, 02 product' }, true)),
  },
})
