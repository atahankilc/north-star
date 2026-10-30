// `matrix-criteria` (onboarding-lessons.md §5), "Judged on": Pazar's matrix in focus, two features down (Allergen labels,
// Pre-order by 9 pm) against three competitors (none cut at the stage's edge), no HUD. Pre-order is judged on two things; its head says `[+] 2`. The hand
// presses it: the two criteria open as rows under it (the write shown with set()). It scores `Order cut-off the night
// before × Shef`: a click, `3` (● full). The feature's own cell now reads from its criteria, a small square each. A click
// on the empty canvas lets the cell go, so the matrix reads whole.
import type { MatrixSetup } from '../../data/matrix'
import { SCALES } from '../../data/scales'
import { cursor, key, onStage, wait, type Scene } from '../director'
import { view } from '../fixtures/o10'
import { MATRIX, NO_DOCK, cellSet, matrixRoute, NO_HUD, fresh, pageStyle, pieceSet, withMatrix } from '../fixtures/o11'

const ID = 'criteria'
const FEATURE = 'f-pickup'
const SUB = `${FEATURE}~cr-cutoff`
const COL = 'k-shef'
const UNFOLD = '[data-learn="axis"] button'
const CELL = `[data-cell$="|${SUB}|${COL}"]`
const rows = (m: MatrixSetup): MatrixSetup => ({ ...m, rows: { ...m.rows, unfold: 'criteria', hide: ['f-qr', 'f-profile', 'f-counter', 'f-weekly', 'f-split', 'f-tips'] }, cols: { ...m.cols, hide: ['k-tgtg', 'k-canteen'] } })

const scene: Scene = {
  id: ID,
  fixture: withMatrix(rows),
  view: 'focus',
  route: matrixRoute,
  size: [480, 300],
  length: 6100,
  poster: 6000,
  cursor: onStage(420, 40),
  setup: [fresh(), pageStyle(ID, `${NO_HUD} ${NO_DOCK}`), view(0.72, 58, 64)],
  steps: [
    { at: 300, do: cursor.to(UNFOLD, 900) },
    { do: wait(350) },
    { do: cursor.press() },
    { do: pieceSet(MATRIX, (p) => ({ ...p, matrix: { ...(p.matrix as MatrixSetup), rows: { ...(p.matrix as MatrixSetup).rows, open: [FEATURE] } } }), 'its criteria open') },
    { do: wait(900) },
    { do: cursor.to(CELL, 800) },
    { do: wait(300) },
    { do: cursor.press() },
    { do: wait(400) },
    { do: key('3') },
    { do: cellSet(MATRIX, SUB, COL, { value: SCALES[0].steps[2].id }) },
    { do: wait(700) },
    // Away from the cell, a click on the empty canvas: the bar goes, the feature's cell reads from its two criteria.
    { do: cursor.to(onStage(150, 40), 800) },
    { do: cursor.press() },
    { do: wait(200) },
  ],
}
export default scene
