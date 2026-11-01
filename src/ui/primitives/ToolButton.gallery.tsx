import { example } from '../../gallery/example'
import { ToolButton } from './ToolButton'
import { CompassIcon } from './hudIcons'

const none = () => {}
const icon = <CompassIcon />

export default example({
  name: 'ToolButton',
  place: 'actions/buttons',
  also: ['hud/navigation'],
  file: 'src/ui/primitives/ToolButton.tsx',
  note: 'the HUD’s icon tool (D-326): the side nav’s fit, compass and ?, the decks-and-days and threads buttons, the settings gear; every icon from hudIcons.tsx, one size (D-343); a cell like every Button (D-344)',
  states: {
    states: () => (
      <div style={{ display: 'flex', gap: 'var(--space-8)', alignItems: 'center' }}>
        <ToolButton label="find" onClick={none}>{icon}</ToolButton>
        <ToolButton label="find, open" pressed onClick={none}>{icon}</ToolButton>
        <ToolButton label="guide, something new" dot onClick={none}>{icon}</ToolButton>
        <ToolButton label="decks, 3 new" badge={3} onClick={none}>{icon}</ToolButton>
      </div>
    ),
    'hud sizes': {
      render: () => (
        <div style={{ display: 'flex', gap: 'var(--space-8)', alignItems: 'center' }}>
          {(['small', 'normal', 'large'] as const).map((s) => (
            <div key={s} data-hud={s}>
              <ToolButton label={`find, ${s}`} onClick={none}>{icon}</ToolButton>
            </div>
          ))}
        </div>
      ),
      note: 'Settings → display → hud size (D-348): 24, 30, 36 px, the icon 14, 18, 22',
    },
    hover: { render: () => <ToolButton label="find" data-g="t" onClick={none}>{icon}</ToolButton>, hover: '[data-g="t"]' },
  },
})
