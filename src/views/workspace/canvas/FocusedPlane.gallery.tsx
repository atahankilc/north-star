import { example } from '../../../gallery/example'
import { onCanvas, P } from '../../../gallery/canvas'
import { lensFixture, PLANE_F } from '../../../demo/fixtures/kit'

export default example({
  name: 'Focused plane',
  place: 'canvas/focus',
  also: ['motion/camera'],
  file: 'src/views/workspace/canvas/FocusedPlane.tsx',
  note: 'a plane as the view: its own camera, the focus dock on the bottom edge (D-184, D-189)',
  states: {
    'in focus': onCanvas({ only: [P.lunch], focus: P.lunch }),
    'filter open': onCanvas({ only: [P.lunch], focus: P.lunch, then: (c) => c.click('button[title="what this plane shows"]') }),
    'linked · 1': {
      ...onCanvas({ change: () => lensFixture(true), only: ['p-f', 't-f'], focus: PLANE_F, then: (c) => [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes('linked'))?.click() ?? c.wait(0) }),
      note: 'the pieces stuck to it, a strip over the dock (D-235)',
    },
    competitors: onCanvas({ only: [P.product], focus: P.product }),
  },
})
