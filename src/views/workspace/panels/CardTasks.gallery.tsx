import { example } from '../../../gallery/example'
import { onCanvas, P } from '../../../gallery/canvas'

const scrollTo = async () => {
  await new Promise((r) => setTimeout(r, 500))
  const panel = document.querySelector<HTMLElement>('[data-learn="card-panel"]')
  ;[...(panel?.querySelectorAll<HTMLElement>('h3') ?? [])].find((h) => h.textContent?.toLowerCase().includes('tasks'))?.scrollIntoView({ block: 'start' })
}

export default example({
  name: 'Card tasks',
  place: 'panels/cards',
  also: ['panels/tasks'],
  file: 'src/views/workspace/panels/CardTasks.tsx',
  note: 'a card’s tasks in its panel (D-254), `+ test it` while it’s being tested; the deck must be on the canvas',
  states: {
    'with tasks': onCanvas({ only: [P.lunch, P.deck], focus: P.lunch, card: 'c-cooks', then: scrollTo }),
    'testing: + test it': onCanvas({ only: [P.lunch, P.deck], focus: P.lunch, card: 'r-same', then: scrollTo }),
    'no deck': onCanvas({ only: [P.lunch], focus: P.lunch, card: 'c-cooks', then: scrollTo, note: 'no deck on the canvas: it says where to put one' }),
  },
})
