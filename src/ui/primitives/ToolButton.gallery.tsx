import { example } from '../../gallery/example'
import { ToolButton } from './ToolButton'

const none = () => {}
const icon = (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
    <circle cx="9" cy="9" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M9 3.5 11 9H7z" fill="currentColor" />
  </svg>
)

export default example({
  name: 'ToolButton',
  place: 'actions/buttons',
  also: ['hud/side-nav'],
  file: 'src/ui/primitives/ToolButton.tsx',
  note: 'the HUD’s icon tool (D-326): the side nav’s fit, compass and ?, the decks-and-days and threads buttons',
  states: {
    states: () => (
      <div style={{ display: 'flex', gap: 'var(--space-8)', alignItems: 'center' }}>
        <ToolButton label="find" onClick={none}>{icon}</ToolButton>
        <ToolButton label="find, open" pressed onClick={none}>{icon}</ToolButton>
        <ToolButton label="guide, something new" dot onClick={none}>{icon}</ToolButton>
        <ToolButton label="decks, 3 new" badge={3} onClick={none}>{icon}</ToolButton>
      </div>
    ),
    hover: { render: () => <ToolButton label="find" data-g="t" onClick={none}>{icon}</ToolButton>, hover: '[data-g="t"]' },
  },
})
