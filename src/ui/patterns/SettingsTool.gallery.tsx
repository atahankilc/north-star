import { example } from '../../gallery/example'
import { SettingsTool } from './SettingsTool'

const none = () => {}

export default example({
  name: 'SettingsTool',
  place: 'hud/corner',
  file: 'src/ui/patterns/SettingsTool.tsx',
  note: 'the corner’s gear (D-175): cyan while settings are open, a cyan count of people waiting to join',
  states: {
    default: () => <SettingsTool open={false} onClick={none} />,
    open: () => <SettingsTool open onClick={none} />,
    'people waiting': () => <SettingsTool open={false} waiting={2} onClick={none} />,
    hover: { render: () => <span data-g="g"><SettingsTool open={false} onClick={none} /></span>, hover: '[data-g="g"] button' },
  },
})
