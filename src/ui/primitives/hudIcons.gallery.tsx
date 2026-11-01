import { example } from '../../gallery/example'
import { ToolButton } from './ToolButton'
import { CompassIcon, DeckIcon, FitIcon, GearIcon, GuideIcon, ThreadsIcon } from './hudIcons'

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
  place: 'hud/side-nav',
  also: ['hud/corner'],
  file: 'src/ui/primitives/hudIcons.tsx',
  note: 'the HUD’s icons (D-343): one 18-unit grid, 1.5 strokes, sized by ToolButton; top to bottom as on the screen',
  states: {
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
