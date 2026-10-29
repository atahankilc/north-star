// The welcome's first page (onboarding-lessons.md §1 `welcome`): the whole screen, the canvas fitted. The cursor drags
// the canvas so the first plane comes to the middle, the wheel zooms in on it, a moment to look, then `0` (its key chip
// shown; the hand gone to empty canvas) goes through the canvas's real key handler and the real fit glides back out until everything fits. The glide
// is the app's own 420 ms, played in slow motion here so it can be followed. Starts and ends fitted.
import { cursor, key, onCanvas, onStage, slow, wait, type Ctx, type Pt, type Scene } from '../director'
import { pazar, workspace, WID } from '../fixtures/pazar'

// The first plane's middle (canvas px), and an empty stretch of canvas under the decks.
const PLANE = { x: 600, y: 362 }
const EMPTY = { x: 800, y: 1620 }
// Where the drag ends: as far as brings the plane's middle to the stage's middle.
const dragTo = (c: Ctx): Pt => {
  const from = onCanvas(EMPTY.x, EMPTY.y)(c)
  const mid = onCanvas(PLANE.x, PLANE.y)(c)
  return { x: from.x + (c.size.w / 2) * c.scale - mid.x, y: from.y + (c.size.h / 2) * c.scale - mid.y }
}

const scene: Scene = {
  id: 'canvas-fit',
  fixture: { ...pazar, wid: WID, workspace },
  view: 'canvas',
  size: [960, 600],
  length: 7900,
  // `0` pressed, its chip up, the camera halfway out: what the key does, as it does it.
  poster: 6900,
  cursor: onCanvas(250, 1680),
  steps: [
    // To empty canvas under the decks, a rest, then a drag: the whole canvas moves with the hand.
    { at: 300, do: cursor.to(onCanvas(EMPTY.x, EMPTY.y), 800) },
    { do: wait(250) },
    { do: cursor.drag(onCanvas(EMPTY.x, EMPTY.y), dragTo, 1100) },
    { do: wait(200) },
    // Onto the plane's middle (now the stage's), and the wheel zooms in round it.
    { do: cursor.to(onCanvas(PLANE.x, PLANE.y), 700) },
    { do: wait(150) },
    { do: cursor.wheel(-600, 1100) },
    // The hand off the plane, onto empty canvas left of it (empty there before the fit and after), so no piece's console
    // shows; then a look at it close up.
    { do: wait(200) },
    { do: cursor.to(onStage(86, 470), 700) },
    { do: wait(800) },
    // `0`: the canvas's own fit, everything back in view.
    { do: key('0', 1500) },
    { do: slow(0.4, 1100) },
    { do: wait(500) },
  ],
}
export default scene
