// `canvases` page 1 (onboarding-lessons.md §9), "More than one canvas": the whole screen, Pazar split in two canvases
// (`Main`: the planes, the matrix and the table; `Launch week`: the deck, its days and the research). The hand clicks
// the canvas's name in the breadcrumb: the real prompt lists the canvases, each with its pieces and its `⌥` key; it
// picks `Launch week`: the canvas breaks cell by cell and the other builds (the real one, its own camera, fitted), the
// breadcrumb now naming it. Going there writes nothing.
import { cursor, onStage, aim, wait, type Scene } from '../director'
import { AT, base } from '../fixtures/kit'
import { calm, cornerOnly, sideOnly } from '../fixtures/o13'
import { P } from '../fixtures/pazar'

const LAUNCH = 'c-launch'
const ON_LAUNCH = new Set<string>([P.deck, P.days, P.docs])
const CRUMB = '[data-learn="crumb"]'
const ROW = aim(`[role="menu"] [data-key="${LAUNCH}"]`, 0.3, 0.5)

const scene: Scene = {
  id: 'canvases',
  fixture: {
    ...base,
    canvases: [...base.canvases, { id: LAUNCH, name: 'Launch week', order: 1, createdAt: AT }],
    pieces: base.pieces.map((p) => (ON_LAUNCH.has(p.id) ? { ...p, canvasId: LAUNCH } : p)),
  },
  view: 'canvas',
  size: [640, 400],
  length: 6200,
  // On `Launch week`: its deck and days built, the breadcrumb naming it.
  poster: 6100,
  cursor: onStage(420, 300),
  // Only the breadcrumb of the HUD: the side nav and the corner would crowd each other on a stage this small.
  setup: [sideOnly('canvases'), cornerOnly('canvases'), calm()],
  steps: [
    { at: 300, do: cursor.to(CRUMB, 1100) },
    { do: wait(400) },
    { do: cursor.press() },
    // The prompt builds; a look at the canvases and their keys, then down to `Launch week`.
    { do: wait(900) },
    { do: cursor.to(ROW, 800) },
    { do: wait(400) },
    { do: cursor.press() },
    // The canvas breaks and the other builds; the hand off the breadcrumb.
    { do: wait(500) },
    // Up along the top bar, clear of the pieces (a hand over one lights its marks).
    { do: cursor.to(onStage(420, 34), 900) },
    { do: wait(600) },
  ],
}
export default scene
