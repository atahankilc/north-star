// The kind guide's `heading` row (onboarding-lessons.md §2): a clear stretch of canvas, no HUD. A heading appears and its
// words come in as typed (each shown with set()), its small line over it; H1's rule fading right under it.
import { CANVAS, type Label } from '../../data/labels'
import { camera, set, wait, type Scene, type Step } from '../director'
import { AWAY, CLEAR, bare, base, text } from '../fixtures/kit'

const WORDS = 'Who we beat'
const h = text({ id: 'h-new', pieceId: CANVAS, text: '', size: 'heading', kicker: '02', x: CLEAR.x, y: CLEAR.y })
const typed = (s: string): Step['do'] => set((ws) => ({ ...ws, labels: [...ws.labels.filter((l) => l.id !== h.id), { ...h, text: s } as Label] }), `typed ${s}`)

const scene: Scene = {
  id: 'kind-heading',
  fixture: base,
  view: 'canvas',
  size: [480, 300],
  length: 3000,
  poster: 2900,
  cursor: AWAY,
  setup: [bare('kind-heading'), camera.set(CLEAR.x + 190, CLEAR.y + 30, 1.1)],
  steps: [
    { at: 300, do: typed(WORDS[0]) },
    ...[...WORDS].slice(1).map((_, i) => ({ at: 450 + i * 110, do: typed(WORDS.slice(0, i + 2)) })),
    { at: 450 + WORDS.length * 110, do: wait(1200) },
  ],
}
export default scene
