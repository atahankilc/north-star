import { example } from '../../../gallery/example'
import { screen, twoCanvases } from '../../../gallery/screens'

export default example({
  name: 'Canvas switch',
  place: 'hud/navigation',
  file: 'src/views/workspace/canvas/CanvasSwitch.tsx',
  note: 'the breadcrumb’s canvas prompt: each canvas with its pieces and its ⌥ key (D-302)',
  states: {
    'one canvas: open': screen({ then: (c) => c.click('[data-learn="crumb"]') }),
    'three canvases: crumb': screen({ change: twoCanvases }),
    'three canvases: open': screen({ change: twoCanvases, then: (c) => c.click('[data-learn="crumb"]') }),
  },
})
