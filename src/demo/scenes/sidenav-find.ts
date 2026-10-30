// `side-nav` page 3 (onboarding-lessons.md §1), "Find": the side nav at the stage's left edge, the canvas fitted beside
// it. The hand clicks the side nav's compass: the real finder opens in the middle with its places; `permit` is typed at
// a readable pace, the matches and the preview of the first come; `↵`: the finder goes there, into the plane's focus
// (the ink spreads), and the hand goes to the card found, lighting it. (finder-go is the same arrival from `⌘F`.)
import { aim, cursor, key, onStage, wait, type Scene } from '../director'
import { base, type } from '../fixtures/kit'
import { calm, sideOnly } from '../fixtures/o13'

const FIND = '[aria-label="Find and go to"]'

const scene: Scene = {
  id: 'sidenav-find',
  fixture: base,
  view: 'canvas',
  size: [640, 400],
  length: 6400,
  // There: in the plane, the card found lit under the hand.
  poster: 6300,
  cursor: onStage(330, 330),
  setup: [sideOnly('sidenav-find'), calm()],
  steps: [
    { at: 300, do: cursor.to(FIND, 1000) },
    { do: wait(400) },
    { do: cursor.press() },
    // The finder builds with its places; the hand off it, to the side; a look, then the word.
    { do: wait(300) },
    { do: cursor.to(onStage(600, 360), 600) },
    { do: wait(200) },
    ...type('permit', 130),
    { do: wait(850) },
    { do: key('↵', 900) },
    { do: wait(900) },
    { do: cursor.to(aim('[data-target="card:r-permit"]', 0.6, 0.6), 800) },
  ],
}
export default scene
