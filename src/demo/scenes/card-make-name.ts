// `card-made` page 1, "Name it here" (onboarding-lessons.md §3): 01 Lunch in focus, no HUD, a customer and a problem
// on it. A right-click on empty plane: the real menu; `r` typed puts `problem` first, a click on it: a problem card appears there
// (shown with set(), what `addCard` would have made) with its panel open, the title field ready; a title typed at a
// person's pace, Enter keeps it (the panel shuts, the card stays, named). What the title would write shown with set().
import type { Card } from '../../data/cards'
import { useCanvasView } from '../../state/canvasView'
import { aim, cursor, inFocus, key, run, set, wait, type Scene } from '../director'
import { PLANE_K, focusRoute, moved, rightClick, smallPlane, type } from '../fixtures/kit'
import { stage, view } from '../fixtures/o10'

const fresh: Card = { id: 'r-noon', type: 'problem', pieceId: PLANE_K, title: '', x: 0, y: 175 }
const TITLE = 'Lunch spots are full by 12:15'
const SPOT = inFocus(90, 215)
const PROBLEM = '[role="menu"] [data-key="problem"]'

const scene: Scene = {
  id: 'card-make-name',
  fixture: smallPlane([moved('c-office', PLANE_K, 0, 0), moved('r-greasy', PLANE_K, 250, 0)]),
  view: 'focus',
  route: focusRoute(),
  size: [640, 400],
  length: 7900,
  poster: 7800,
  cursor: inFocus(420, 330),
  setup: [...stage('card-make-name'), view(0.9, 24, 40)],
  steps: [
    { at: 300, do: cursor.to(SPOT, 800) },
    { do: wait(350) },
    { do: rightClick(SPOT) },
    { do: wait(700) },
    // `r` typed narrows the menu (`problem` first); a click takes it.
    ...type('r', 0),
    { do: wait(500) },
    { do: cursor.to(aim(PROBLEM, 0.3, 0.5), 600) },
    { do: wait(300) },
    { do: cursor.press() },
    { do: set((ws) => ({ ...ws, cards: [...ws.cards, fresh] }), 'a problem appears') },
    // After the menu's own (refused) make has said it made nothing: the new card picked, its title ready (D-250).
    { do: wait(60) },
    { do: run(() => useCanvasView.setState({ cardSelected: fresh.id, cardEditing: fresh.id, fresh: fresh.id, cardMulti: [] }), 'its panel, the title ready') },
    { do: wait(640) },
    ...type(TITLE, 62),
    { do: wait(400) },
    { do: key('↵') },
    { do: set((ws) => ({ ...ws, cards: ws.cards.map((c) => (c.id === fresh.id ? { ...c, title: TITLE } : c)) }), 'named') },
    { do: wait(300) },
  ],
}
export default scene
