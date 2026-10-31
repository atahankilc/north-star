// `matrix-keys` page 2 for editors (onboarding-lessons.md §5), "How sure?": Pazar's matrix in focus, framed as matrix-keys is. The
// hand clicks `Allergen labels × Lieferando` (full): its bar opens under it. `~ inferred`, a press: the cell's corner
// says `~`. Then into the note: "Seen in their app" typed at a person's pace; the field is left
// at once (its save a step of its own), and the cell's other corner folds (it has a note). A click away lets the cell go and the view comes
// closer on it, so both corners read. The writes the demo can't make are shown with set() as they land.
import { cursor, onStage, run, wait, type Scene } from '../director'
import { base, byText, type } from '../fixtures/kit'
import { view } from '../fixtures/o10'
import { MATRIX, NO_DOCK, cellSet, glideTo, matrixRoute, NO_HUD, fresh, pageStyle } from '../fixtures/o11'

const ID = 'matrix-sure'
const ROW = 'f-allergens'
const COL = 'k-lieferando'
const CELL = `[data-cell$="|${ROW}|${COL}"]`
const BAR = '[data-learn="cell-bar"]'
const INFERRED = byText(`${BAR} button`, '~ inferred', 0.5, 0.5)
const NOTE = `${BAR} textarea`
const NOTE_TEXT = 'Seen in their app'

const scene: Scene = {
  id: ID,
  fixture: base,
  view: 'focus',
  route: matrixRoute,
  size: [480, 300],
  length: 7900,
  poster: 7800,
  cursor: onStage(440, 110),
  setup: [fresh(), pageStyle(ID, `${NO_HUD} ${NO_DOCK}`), view(0.75, 58, 64)],
  steps: [
    { at: 300, do: cursor.to(CELL, 800) },
    { do: wait(300) },
    { do: cursor.press() },
    { do: wait(500) },
    { do: cursor.to(INFERRED, 700) },
    { do: wait(300) },
    { do: cursor.press() },
    { do: cellSet(MATRIX, ROW, COL, { confidence: 'inferred' }) },
    { do: wait(450) },
    { do: cursor.to(NOTE, 650) },
    { do: wait(250) },
    { do: cursor.press() },
    { do: wait(200) },
    ...type(NOTE_TEXT, 50),
    // The field is left at once after the last key (as Tab would): its save lands now, as a step, not on the field's own
    // 400 ms timer (real time, which a seek can't replay the same way). The cell's corner folds (it has a note).
    { do: run(() => document.querySelector<HTMLElement>('[data-learn="cell-bar"] textarea')?.blur(), 'the note field left') },
    { do: cellSet(MATRIX, ROW, COL, { notes: NOTE_TEXT }) },
    { do: wait(350) },
    // A click on the empty canvas lets the cell go; the view comes closer, so its two corners read: `~` and the note.
    { do: cursor.to(onStage(150, 40), 550) },
    { do: cursor.press() },
    // Its end a tenth of a pixel off the grid: at 1.25 a whole plane px lands on a quarter, so some text sat on an exact
    // half pixel, which Chrome rounded either way from one draw to the next (the end 1.15 % off, 1 run in 3).
    { do: glideTo(1.25, 58.1, 64.1, 550) },
    // Still long enough for what's drawn at screen size to settle at the new zoom (D-278's 120 ms, and its redraw)
    // before the poster and the end.
    { do: wait(450) },
  ],
}
export default scene
