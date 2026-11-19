import type { CSSProperties } from 'react'
import { example } from '../../gallery/example'
import { ToolButton } from './ToolButton'
import { CompassIcon } from './hudIcons'
import { none } from '../../gallery/samples'

const icon = <CompassIcon />

export default example({
  name: 'ToolButton',
  place: 'actions/buttons',
  also: ['hud/navigation'],
  file: 'src/ui/primitives/ToolButton.tsx',
  note: 'the HUD’s icon tool (D-326): the side nav’s fit, compass and ?, the decks-and-days and threads buttons, the settings gear; every icon from hudIcons.tsx, one size (D-343); nothing behind it, a round shade when pointed at, the icon itself lit while on (D-384)',
  states: {
    states: () => (
      <div style={{ display: 'flex', gap: 'var(--space-8)', alignItems: 'center' }}>
        <ToolButton label="find" onClick={none}>{icon}</ToolButton>
        <ToolButton label="find, open" pressed onClick={none}>{icon}</ToolButton>
        <ToolButton label="guide, something new" dot onClick={none}>{icon}</ToolButton>
        <ToolButton label="decks, 3 new" badge={3} onClick={none}>{icon}</ToolButton>
      </div>
    ),
    'interface sizes': {
      render: () => (
        <div style={{ display: 'flex', gap: 'var(--space-8)', alignItems: 'center' }}>
          {([0.75, 1, 1.5] as const).map((s) => (
            <div key={s} data-ui style={{ '--ui': s } as CSSProperties}>
              <ToolButton label={`find, ${s * 100} %`} onClick={none}>{icon}</ToolButton>
            </div>
          ))}
        </div>
      ),
      note: 'Settings → display → interface size (D-417): 75, 100, 150 %; 30 px and an 18 px icon at 100',
    },
    hover: { render: () => <ToolButton label="find" data-g="t" onClick={none}>{icon}</ToolButton>, hover: '[data-g="t"]' },
  },
})
