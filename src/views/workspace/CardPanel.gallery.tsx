import { example } from '../../gallery/example'
import { onCanvas, P } from '../../gallery/canvas'
import { PACKAGE, withPackage } from '../../gallery/panels'

const lunch = (card: string, note?: string) => onCanvas({ only: [P.lunch], focus: P.lunch, card, note })
const product = (card: string, note?: string) => onCanvas({ only: [P.product], focus: P.product, card, note })

export default example({
  name: 'Card panel',
  place: 'panels/cards',
  file: 'src/views/workspace/CardPanel.tsx',
  note: 'a card’s right panel (D-221): what it is → what backs it → links by meaning → tags → notes',
  states: {
    customer: lunch('c-office'),
    problem: lunch('r-greasy', 'validated, with evidence for it'),
    idea: lunch('i-preorder', 'testing: one for, one against'),
    'invalidated customer': lunch('c-gyms'),
    feature: product('f-pickup', 'plan, criteria, rests on, tasks'),
    competitor: product('k-wolt', 'profile, regions, its features'),
    package: onCanvas({ only: [P.product], focus: P.product, change: withPackage, card: PACKAGE.id, note: 'rating, what it holds, confidence from it' }),
    'several selected': onCanvas({ only: [P.lunch], focus: P.lunch, cards: ['r-greasy', 'r-break', 'r-same'], note: '`3 selected`: line up, space out, tag, package' }),
  },
})
