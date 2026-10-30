// `side-nav` page 2 (onboarding-lessons.md §1), "Fit": the side nav at the stage's left edge, the canvas beside it,
// zoomed in close on the launch deck's corner. The hand goes to the side nav's fit (under the `+`), rests, clicks: the
// real fit glides the camera out until everything on the canvas is in view (the app's own 420 ms glide, in slow motion
// so it can be followed). Starts close, ends fitted.
import { camera, cursor, onStage, slow, wait, type Scene } from '../director'
import { sideOnly } from '../fixtures/o13'
import { base } from '../fixtures/kit'
import { calmTasks } from '../fixtures/o12'

const FIT = '[aria-label="Fit everything on the canvas"]'

const scene: Scene = {
  id: 'sidenav-fit',
  // A week on: nothing due this week, so no SOON band over the deck it starts close on.
  fixture: { ...base, tasks: calmTasks(base.tasks) },
  view: 'canvas',
  size: [640, 400],
  length: 4700,
  // Fitted: every piece in view, the hand resting by the button.
  poster: 4650,
  cursor: onStage(330, 300),
  // Close on the deck's columns (its name and first tasks readable), as someone working in it would be.
  setup: [sideOnly('sidenav-fit'), camera.set(380, 1010, 1.1)],
  steps: [
    // At 0, not in the setup: the fit's glide of the loop before may still be landing as the stage is made again.
    { at: 0, do: camera.set(380, 1010, 1.1) },
    { at: 400, do: cursor.to(FIT, 1100) },
    { do: wait(450) },
    { do: cursor.press() },
    { do: slow(0.35, 1300) },
    { do: wait(300) },
    { do: cursor.to(onStage(120, 330), 700) },
  ],
}
export default scene
