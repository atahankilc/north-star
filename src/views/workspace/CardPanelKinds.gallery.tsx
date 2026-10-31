import { example } from '../../gallery/example'
import { onCanvas, P } from '../../gallery/canvas'
import { PACKAGE, withMatch, withPackage, withParts } from '../../gallery/panels'
import { useCanvasView } from '../../state/canvasView'

const scroll = (to: string) => async () => {
  await new Promise((r) => setTimeout(r, 500))
  const panel = document.querySelector<HTMLElement>('[data-learn="card-panel"]')
  const head = [...(panel?.querySelectorAll<HTMLElement>('h3') ?? [])].find((h) => h.textContent?.toLowerCase().includes(to))
  head?.scrollIntoView({ block: 'start' })
}

export default example({
  name: 'Card panel parts',
  place: 'panels/cards',
  file: 'src/views/workspace/CardPanelKinds.tsx',
  note: 'the kind-specific sections of a card’s panel: a competitor’s profile and features, a feature’s parts, criteria, rests on, matched by, packages',
  states: {
    'competitor profile': onCanvas({ only: [P.product], focus: P.product, card: 'k-shef' }),
    'competitor features: one open': onCanvas({
      only: [P.product], focus: P.product, card: 'k-shef',
      then: async (c) => { useCanvasView.setState({ cfOpen: 's-1' }); void c; await scroll('features')() },
    }),
    'feature: criteria': onCanvas({ only: [P.product], focus: P.product, card: 'f-pickup', then: scroll('judged') }),
    'feature: rests on': onCanvas({ only: [P.product], focus: P.product, card: 'f-pickup', then: scroll('rests') }),
    'feature: parts': onCanvas({ only: [P.product], focus: P.product, change: withParts, card: 'f-pickup', then: scroll('parts') }),
    'part: its parent': onCanvas({ only: [P.product], focus: P.product, change: withParts, card: 'f-cutoff' }),
    'feature: matched by': onCanvas({ only: [P.product], focus: P.product, change: withMatch, card: 'f-pickup', then: scroll('match') }),
    'member: in package': onCanvas({ only: [P.product], focus: P.product, change: withPackage, card: 'f-qr', note: `in ${PACKAGE.title} ↑` }),
  },
})
