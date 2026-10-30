// `card-deck` page 1 (onboarding-lessons.md §7), "Cards on a deck": a deck of Pazar's features by status in focus, no
// HUD, framed on `planned` and `building`. The hand takes "Pickup shelf opened with a QR code" from `planned` and drops
// it in `building`, with real pointer events (the deck's own lift and drop box); its status changes with it (the write
// shown with set()): it's counted in `building` now, its column its status.
import { emptyKanban } from '../../data/tasks'
import { KANBAN_TEMPLATES } from '../../model/kanbanCards'
import { K } from '../../views/workspace/Kanban'
import { aim, cursor, find, onStage, set, wait, type Scene } from '../director'
import { base, piece } from '../fixtures/kit'
import { view } from '../fixtures/o10'
import { NO_HUD, pageStyle } from '../fixtures/o12'
import { WID } from '../fixtures/pazar'

export const CARD_DECK = 'k-features'
export const cardDeck = piece(CARD_DECK, { kind: 'kanban', x: 0, y: 1550, w: 1500, h: 600, name: '08 Features by status', kanban: { ...emptyKanban(), ...KANBAN_TEMPLATES[1].setup() } })
const CARD = '[data-ccard="f-qr"]'
// Under the last card in `building`.
const dropAt = () => {
  const col = find('[data-ccol="building"]')
  if (!col) return null
  const r = col.getBoundingClientRect()
  const last = [...col.querySelectorAll('[data-ccard]')].at(-1)?.getBoundingClientRect()
  return { x: r.left + r.width * 0.45, y: (last ? last.bottom : r.top) + 40 }
}
// The columns: no value, idea, planned, building, shipped: `planned` is the third.
const PLANNED_X = 2 * (K.col + K.gap)

const scene: Scene = {
  id: 'card-deck',
  fixture: { ...base, pieces: [...base.pieces, cardDeck] },
  view: 'focus',
  route: `/workspaces/${WID}?focus=${CARD_DECK}`,
  size: [640, 400],
  length: 4800,
  poster: 4700,
  cursor: onStage(320, 370),
  setup: [pageStyle('card-deck', NO_HUD)],
  steps: [
    // At 0, not in the setup: what the loop before left open, shut as it starts again, refits the piece as the stage
    // settles, and this comes after it.
    { at: 0, do: view(1.1, 20 - PLANNED_X * 1.1, 16) },
    { at: 300, do: cursor.to(aim(CARD, 0.4, 0.5), 1000) },
    { do: wait(400) },
    {
      do: cursor.drag(
        aim(CARD, 0.4, 0.5),
        dropAt,
        1700,
        set((ws) => ({ ...ws, cards: ws.cards.map((c) => (c.id === 'f-qr' ? { ...c, status: 'building' } : c)) }), 'its status is building'),
      ),
    },
    { do: wait(400) },
    { do: cursor.to(onStage(560, 360), 800) },
  ],
}
export default scene
