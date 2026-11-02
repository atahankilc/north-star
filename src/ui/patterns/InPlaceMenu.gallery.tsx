import { example } from '../../gallery/example'
import type { MenuEntry } from './Menu'
import { InPlaceMenu } from './InPlaceMenu'

const CARDS: MenuEntry[] = [
  { key: '#suggested', heading: 'suggested' },
  { key: 's1', label: 'Office workers on a short break', glyph: '◆', hint: 'nearest', onSelect: () => 'keep' },
  { key: '#problems', heading: 'problems · 3' },
  { key: 'p1', label: 'Lunch takes too long', glyph: '◆', onSelect: () => 'keep' },
  { key: 'p2', label: 'Same food every day', glyph: '◆', onSelect: () => 'keep' },
  { key: 'p3', label: 'Greasy options only', glyph: '◆', onSelect: () => 'keep' },
]

const CHATS: MenuEntry[] = [
  { key: 'h-yours', heading: 'yours' },
  { key: 'c1', label: 'Restructure the segments', hint: '2h', onSelect: () => 'keep' },
  { key: 'c2', label: 'Rivals in Germany', hint: 'yesterday', onSelect: () => 'keep' },
  { key: 'h-shared', heading: 'shared with the workspace' },
  { key: 'c3', label: 'Pricing questions', hint: '3d', onSelect: () => 'keep' },
]

const box = (children: React.ReactNode) => <div style={{ width: 400 }}>{children}</div>

export default example({
  name: 'In-place menu',
  place: 'forms/pickers',
  also: ['panels/agent'],
  file: 'src/ui/patterns/InPlaceMenu.tsx',
  note: 'the prompt (D-222) laid in the page, not floating: a card panel’s picker, the agent’s saved chats',
  states: {
    'card picker': () => box(<InPlaceMenu items={CARDS} ariaLabel="Pick a card" prompt="find a card…" onClose={() => {}} />),
    'saved chats (full)': () => box(<InPlaceMenu items={CHATS} ariaLabel="Saved chats" prompt="find a chat…" height="full" onClose={() => {}} />),
    empty: () => box(<InPlaceMenu items={[]} ariaLabel="Pick a card" empty="No cards to pick yet" onClose={() => {}} />),
  },
})
