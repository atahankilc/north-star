import { example } from '../../../gallery/example'
import { screen } from '../../../gallery/screens'
import { docTexts, P } from '../../../gallery/canvas'
import { threadMessages, withThreads } from '../../../gallery/panels'
import { openThread } from '../threads/Threads'
import { openPlace, usePlace, type Place } from './placeStore'

const open = (place: Place, page = false) => () => {
  threadMessages()
  docTexts()
  openPlace(place)
  usePlace.setState({ page })
}

export default example({
  name: 'Places',
  place: 'screens/places',
  file: 'src/views/workspace/places/Places.tsx',
  note: 'Talk, Tasks and Docs (D-412, docs/specs/shell.md): beside the canvas a column on the left ground, `full` the page in the canvas’s place; the canvas fills the window until something docks',
  states: {
    'nothing open': screen({ only: [P.lunch, P.product, P.deck] }),
    'talk beside': screen({ only: [P.lunch, P.product], change: withThreads, then: open('talk') }),
    'a conversation in its place': screen({ only: [P.lunch, P.product], change: withThreads, then: () => (open('talk')(), openThread('t-pickup')) }),
    'talk as the page': screen({ only: [P.lunch, P.product], change: withThreads, then: () => (open('talk', true)(), openThread('t-pickup')) }),
    'tasks beside': screen({ only: [P.lunch, P.product, P.deck], then: open('tasks') }),
    'tasks as the page': screen({ only: [P.lunch, P.product, P.deck, P.days], then: open('tasks', true) }),
    'docs beside': screen({ only: [P.lunch, P.product, P.docs], then: open('docs') }),
    'docs as the page': screen({ only: [P.lunch, P.product, P.docs], then: open('docs', true) }),
  },
})
