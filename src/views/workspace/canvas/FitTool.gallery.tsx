import { example } from '../../../gallery/example'
import { FitTool } from './FitTool'

export default example({
  name: 'FitTool',
  place: 'hud/navigation',
  file: 'src/views/workspace/canvas/FitTool.tsx',
  note: 'the side nav’s fit (D-186), the same as `0`: the whole canvas, or in a focus the plane; a click does nothing here',
  states: {
    canvas: () => <FitTool plane={null} />,
    'in focus': () => <FitTool plane="a-plane" />,
  },
})
