import { example } from '../../../gallery/example'
import { onCanvas, P, PAZAR } from '../../../gallery/canvas'
import { rightClick } from '../../../gallery/docks'
import { CANVAS } from '../../../model/labels'
import { MAIN } from '../../../data/canvases'

const AT = Date.UTC(2026, 9, 19, 9, 0)
const withText = (ws: typeof PAZAR) => ({
  ...ws,
  labels: [
    { id: 'h-who', pieceId: P.lunch, text: 'Who it’s for', size: 'subheading' as const, x: 0, y: -100, createdAt: AT },
    { id: 's-canvas', pieceId: CANVAS, canvasId: MAIN, kind: 'sticky' as const, color: 'yellow' as const, text: 'Call Factory on Monday', w: 150, uid: 'demo', author: 'You', x: -400, y: 0, createdAt: AT + 1 },
  ],
})

export default example({
  name: 'Right-click menu',
  place: 'overlays/menus',
  file: 'src/views/workspace/canvas/ContextMenu.tsx',
  note: 'right-click is the prompt (D-222, D-237): what can be done with what’s under the pointer',
  states: {
    card: onCanvas({ only: [P.lunch], focus: P.lunch, then: () => rightClick('[data-target="card:i-preorder"]') }),
    text: onCanvas({ only: [P.lunch], focus: P.lunch, change: withText, then: () => rightClick('[data-target="label:h-who"]') }),
    link: onCanvas({ only: [P.lunch], focus: P.lunch, then: () => rightClick('[data-target="link:e-7"]') }),
    'the plane': onCanvas({ only: [P.lunch], focus: P.lunch, then: () => rightClick('[data-target="card:i-plan"]', 0.5, 2.2), note: 'on the plane’s empty grid: paste and add here' }),
    'several picked': onCanvas({ only: [P.lunch], focus: P.lunch, cards: ['r-greasy', 'r-break', 'r-same'], then: () => rightClick('[data-target="card:r-break"]') }),
    'a piece on the canvas': onCanvas({ only: [P.lunch, P.matrix], then: () => rightClick(`[data-target="plane:${P.matrix}"]`) }),
    'sticky on the canvas': onCanvas({ only: [P.lunch], change: withText, then: () => rightClick('[data-target="label:s-canvas"]') }),
  },
})
