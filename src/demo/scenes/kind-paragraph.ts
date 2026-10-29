// The kind guide's `paragraph` row (onboarding-lessons.md §2): a clear stretch of canvas, no HUD. A paragraph appears
// and fills a line at a time (shown with set()), light Markdown in it: a bold phrase, a list.
import { CANVAS, type Label } from '../../data/labels'
import { camera, set, wait, type Scene } from '../director'
import { AWAY, CLEAR, bare, base, text } from '../fixtures/kit'

const LINES = ['**Why the night before?** Cooks shop in the morning', 'and need to know how much to make.', '', '- cut-off at 9 pm', '- pickup from 11:45']
const p = text({ id: 'para-new', pieceId: CANVAS, text: '', size: 'note', scale: 'large', w: 420, x: CLEAR.x, y: CLEAR.y })
const upTo = (n: number) => set((ws) => ({ ...ws, labels: [...ws.labels.filter((l) => l.id !== p.id), { ...p, text: LINES.slice(0, n).join('\n') } as Label] }), `${n} lines`)

const scene: Scene = {
  id: 'kind-paragraph',
  fixture: base,
  view: 'canvas',
  size: [480, 300],
  length: 3300,
  poster: 3200,
  cursor: AWAY,
  setup: [bare('kind-paragraph'), camera.set(CLEAR.x + 210, CLEAR.y + 60, 1.0)],
  steps: [
    { at: 300, do: upTo(1) },
    { at: 800, do: upTo(2) },
    { at: 1300, do: upTo(4) },
    { at: 1800, do: upTo(5) },
    { do: wait(1500) },
  ],
}
export default scene
