// `following` page 1 (onboarding-lessons.md §8), "Following": the whole screen, Pazar fitted, Ayla and Jonas here, Ayla's
// cursor over the first plane. The hand clicks Ayla's square: the page is framed in her colour with `following Ayla`
// at the top (the real PeopleHere). Ayla goes into the plane (her presence says so): the real Follow takes you in with
// her, the ink spreading; inside, her cursor goes on to a card. Nothing written.
import { cursor, onStage, wait, type Scene } from '../director'
import { base } from '../fixtures/kit'
import { AYLA, JONAS, calm, cursorGone, cursorInto, cursorOf, drift, keepPlaced, presence, cornerOnly } from '../fixtures/o13'
import { P } from '../fixtures/pazar'

const AYLA_SQUARE = '[data-learn="people"] button[aria-label^="Ayla"]'

const scene: Scene = {
  id: 'follow',
  fixture: base,
  view: 'canvas',
  size: [640, 400],
  length: 7000,
  // In the plane with her, framed in her colour, her cursor on a card.
  poster: 6900,
  cursor: onStage(460, 380),
  setup: [cornerOnly('follow'), calm(), presence(AYLA.uid, {}, AYLA), presence(JONAS.uid, {}, JONAS), cursorOf(AYLA, { x: 300, y: 560 }), cursorOf(JONAS, { x: 2000, y: 400 })],
  steps: [
    { at: 200, do: drift(AYLA.uid, { x: 600, y: 360 }, 1400) },
    { at: 400, do: cursor.to(AYLA_SQUARE, 1200) },
    { do: wait(450) },
    { do: cursor.press() },
    // Framed in her colour; the hand off to the side (only a click or a pan of your own would stop it).
    { do: wait(300) },
    { do: cursor.to(onStage(560, 250), 800) },
    // She goes into the plane: you go with her, the ink spreading; her cursor stays on her point of it.
    { at: 3300, do: presence(AYLA.uid, { plane: P.lunch }) },
    { at: 3300, do: keepPlaced(1100) },
    { at: 3300, do: cursorGone(JONAS.uid) },
    { at: 4400, do: cursorInto(AYLA.uid, { x: 600, y: 360 }, 'focus') },
    { at: 4500, do: drift(AYLA.uid, { x: 330, y: 300 }, 1400) },
    { at: 5900, do: wait(1100) },
  ],
}
export default scene
