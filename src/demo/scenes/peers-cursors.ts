// `people-here` page 1 (onboarding-lessons.md §8), "{peer} is here": the whole screen, Pazar fitted, nobody else here.
// Ayla arrives: her square comes in bottom left (the real PeopleHere, from the presence store) and her cursor, with her
// name, over the first plane; then Jonas, his square beside hers, his cursor over the second. The hand goes to Ayla's
// square and rests on it: its tag says who and where (`Ayla · on the canvas`), a click away from following her.
import { cursor, onStage, wait, type Scene } from '../director'
import { base } from '../fixtures/kit'
import { AYLA, JONAS, calm, cursorOf, drift, presence, cornerOnly } from '../fixtures/o13'

const AYLA_SQUARE = '[data-learn="people"] button[aria-label^="Ayla"]'

const scene: Scene = {
  id: 'peers-cursors',
  fixture: base,
  view: 'canvas',
  size: [640, 400],
  length: 5800,
  // Both here, their cursors on the planes, the hand on Ayla's square with its tag.
  poster: 5700,
  cursor: onStage(460, 380),
  setup: [cornerOnly('peers-cursors'), calm()],
  steps: [
    // Ayla: her square, her cursor at the first plane's edge, moving in over the problems.
    { at: 500, do: presence(AYLA.uid, {}, AYLA) },
    { at: 500, do: cursorOf(AYLA, { x: 160, y: 820 }) },
    { at: 650, do: drift(AYLA.uid, { x: 420, y: 330 }, 1500) },
    // Jonas a moment after, over the second plane.
    { at: 1700, do: presence(JONAS.uid, {}, JONAS) },
    { at: 1700, do: cursorOf(JONAS, { x: 2350, y: 780 }) },
    { at: 1850, do: drift(JONAS.uid, { x: 1850, y: 300 }, 1600) },
    { at: 2400, do: drift(AYLA.uid, { x: 760, y: 420 }, 1600) },
    // The hand: down to Ayla's square, resting on it (its tag).
    { at: 2900, do: cursor.to(AYLA_SQUARE, 1300) },
    { do: wait(1500) },
    { at: 3700, do: drift(JONAS.uid, { x: 2000, y: 520 }, 1500) },
  ],
}
export default scene
