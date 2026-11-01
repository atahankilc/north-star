import { example } from '../../gallery/example'
import { Avatar } from './Avatar'
import { Button } from './Button'
import { ToolButton } from './ToolButton'
import { GearIcon } from './hudIcons'

const none = () => {}
const row = { display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }

export default example({
  name: 'Avatar',
  place: 'hud/presence',
  file: 'src/ui/primitives/Avatar.tsx',
  note: 'a person’s square (D-344): hud like a ToolButton (30 px; 24 or 36 with the HUD’s size, D-348), sm 24 px like a Button; framed when not here; grey when away',
  states: {
    sizes: () => (
      <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
        <div style={row}>
          <Avatar name="Ayla" color="var(--accent-cyan)" />
          <Avatar name="Jonas" color="var(--accent-yellow)" />
          <ToolButton label="settings" onClick={none}>
            <GearIcon />
          </ToolButton>
        </div>
        <div style={row}>
          <Avatar name="Ayla" color="var(--accent-cyan)" size="sm" />
          <Button onClick={none}>follow</Button>
        </div>
      </div>
    ),
    'hud sizes': () => (
      <div style={row}>
        {(['small', 'normal', 'large'] as const).map((s) => (
          <div key={s} data-hud={s} style={row}>
            <Avatar name="Ayla" color="var(--accent-cyan)" />
            <ToolButton label={`settings, ${s}`} onClick={none}>
              <GearIcon />
            </ToolButton>
          </div>
        ))}
      </div>
    ),
    'not here (framed)': () => <Avatar name="Lena" size="sm" />,
    away: () => <Avatar name="Jonas" color="var(--accent-yellow)" away />,
  },
})
