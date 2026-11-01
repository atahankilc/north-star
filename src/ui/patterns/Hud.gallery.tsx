import { example } from '../../gallery/example'
import { Hud } from './Hud'

export default example({
  name: 'Hud',
  place: 'hud/layout',
  file: 'src/ui/patterns/Hud.tsx',
  note: 'the breadcrumb top left, you and the gear bottom left; placed on the screen, so shown in the whole middle',
  states: {
    workspace: { size: 'full', render: () => <Hud crumbs={[{ label: 'workspaces', to: '/workspaces' }, { label: 'Pazar' }]} settingsName="Pazar" /> },
    'in focus': { size: 'full', render: () => <Hud crumbs={[{ label: 'workspaces', to: '/workspaces' }, { label: 'Pazar', to: '/workspaces/demo' }, { label: 'Rivals' }]} settingsName="Pazar" /> },
    'settings badge': { size: 'full', render: () => <Hud crumbs={[{ label: 'workspaces', to: '/workspaces' }, { label: 'Pazar' }]} settingsName="Pazar" settings={() => null} settingsBadge={2} /> },
    'long names': {
      size: 'full',
      render: () => <Hud crumbs={[{ label: 'workspaces', to: '/workspaces' }, { label: 'A workspace with a very long name indeed', to: '/' }, { label: 'And a plane named at length too' }]} settingsName="x" />,
    },
  },
})
