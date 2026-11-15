import { example } from '../../gallery/example'
import { ToolButton } from './ToolButton'
import { Button } from './Button'
import { CloseIcon, CompassIcon, DeckIcon, FitIcon, GearIcon, GuideIcon, ThreadsIcon } from './hudIcons'

const none = () => {}
const SET = [
  ['fit', FitIcon],
  ['find', CompassIcon],
  ['guide', GuideIcon],
  ['decks', DeckIcon],
  ['threads', ThreadsIcon],
  ['settings', GearIcon],
] as const

export default example({
  name: 'hudIcons',
  place: 'hud/navigation',
  also: ['hud/corner'],
  file: 'src/ui/primitives/hudIcons.tsx',
  note: 'the HUD’s icons (D-343): one 18-unit grid, 1.5 strokes, sized by ToolButton; top to bottom as on the screen',
  states: {
    'close, in a Button (D-384)': () => (
      <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'center' }}>
        <Button icon title="close" onClick={none}><CloseIcon /></Button>
        <Button icon tone="danger" title="take it out" onClick={none}><CloseIcon /></Button>
        <Button icon onClick={none}>‹ back</Button>
      </div>
    ),
    set: () => (
      <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'center' }}>
        {SET.map(([k, I]) => (
          <ToolButton key={k} label={k} onClick={none}>
            <I />
          </ToolButton>
        ))}
      </div>
    ),
    'one open': () => (
      <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'center' }}>
        {SET.map(([k, I]) => (
          <ToolButton key={k} label={k} pressed={k === 'decks'} badge={k === 'threads' ? 2 : 0} dot={k === 'guide'} onClick={none}>
            <I />
          </ToolButton>
        ))}
      </div>
    ),
  },
})
