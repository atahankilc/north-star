// `matrix-keys` (onboarding-lessons.md §5), "Scoring cells": Pazar's matrix in focus (features down, competitors across),
// no HUD, framed on its top-left corner so the cells and their bar read. The hand clicks the empty cell `Allergen labels
// × The office canteen`: it's selected, its bar under it. Clicked again it takes the first step (○ none); `3` typed (its
// key chip) puts it on the third (● full); `↓` moves the selection to the next cell down. Each score the demo can't write is
// shown with set() at the moment it would land.
import { SCALES } from '../../data/scales'
import { cursor, key, onStage, wait, type Scene } from '../director'
import { view } from '../fixtures/o10'
import { base } from '../fixtures/kit'
import { MATRIX, NO_DOCK, cellSet, matrixRoute, NO_HUD, fresh, pageStyle } from '../fixtures/o11'

const ID = 'matrix-keys'
const ROW = 'f-allergens'
const COL = 'k-canteen'
const CELL = `[data-cell$="|${ROW}|${COL}"]`
const steps = SCALES[0].steps

const scene: Scene = {
  id: ID,
  fixture: base,
  view: 'focus',
  route: matrixRoute,
  size: [480, 300],
  length: 5200,
  poster: 5100,
  cursor: onStage(440, 120),
  // The heads and the first three columns, clear of where the heads would stick (D-214), the bar's room under the
  // first row.
  setup: [fresh(), pageStyle(ID, `${NO_HUD} ${NO_DOCK}`), view(0.75, 58, 64)],
  steps: [
    { at: 300, do: cursor.to(CELL, 1000) },
    { do: wait(350) },
    { do: cursor.press() },
    { do: wait(600) },
    { do: cursor.press() },
    { do: cellSet(MATRIX, ROW, COL, { value: steps[0].id }) },
    { do: wait(800) },
    { do: key('3') },
    { do: cellSet(MATRIX, ROW, COL, { value: steps[2].id }) },
    { do: wait(1000) },
    { do: key('↓') },
    { do: wait(500) },
  ],
}
export default scene
