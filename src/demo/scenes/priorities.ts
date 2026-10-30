// `card-deck` page 2 (onboarding-lessons.md §7), "Suggested order": a priorities deck of Pazar's features in focus (effort
// across, impact down, the corners named), no HUD, the whole grid in view (S M L across, impact's rows down), its suggested order put away. The hand presses
// the dock's `[order]`: the order builds beside the grid and the view glides to it, best first, each with its score and the P1–P3 it suggests (`P2 → P1` in yellow where
// the card's own priority differs). All real: the order is only read, never written.
import { emptyKanban } from '../../data/tasks'
import { KANBAN_TEMPLATES } from '../../model/kanbanCards'
import { orderShown, toggleOrder } from '../../views/workspace/CardKanban'
import { aim, camera, cursor, onStage, run, wait, type Scene } from '../director'
import { base, frameTo, piece } from '../fixtures/kit'
import { NO_HUD, pageStyle } from '../fixtures/o12'
import { WID } from '../fixtures/pazar'

const DECK = 'k-priorities'
const deck = piece(DECK, { kind: 'kanban', x: 0, y: 1550, w: 1500, h: 700, name: '08 Priorities', kanban: { ...emptyKanban(), ...KANBAN_TEMPLATES[2].setup() } })
// The fourth in the order, where the card's own P2 differs from the P1 suggested.
const DIFFERS = aim('aside[aria-label="Suggested order"] button:nth-of-type(4) [data-differs]', 0.3, 0.5)
const ORDER = aim('button[title^="the suggested order beside it"]')

const scene: Scene = {
  id: 'priorities',
  fixture: { ...base, pieces: [...base.pieces, deck] },
  view: 'focus',
  route: `/workspaces/${WID}?focus=${DECK}`,
  size: [640, 400],
  length: 5000,
  poster: 4900,
  cursor: onStage(200, 300),
  setup: [pageStyle('priorities', NO_HUD), run(() => orderShown(DECK) && toggleOrder(DECK), 'the order put away')],
  steps: [
    // At 0, not in the setup: what the loop before left open, shut as it starts again, refits the piece as the stage
    // settles, and this comes after it.
    { at: 0, do: camera.frame({ x: -10, y: 0, w: 1170, h: 700 }, 8) },
    { at: 300, do: cursor.to(ORDER, 1000) },
    { do: wait(400) },
    { do: cursor.press() },
    { do: wait(500) },
    // Its view glides to the order beside the grid's last column, so it reads.
    { do: frameTo({ x: 846, y: 0, w: 654, h: 380 }, 900, 8) },
    { do: wait(300) },
    { do: cursor.to(DIFFERS, 900) },
    { do: wait(400) },
  ],
}
export default scene
