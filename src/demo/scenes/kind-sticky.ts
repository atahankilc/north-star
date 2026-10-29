// The kind guide's `sticky note` row (onboarding-lessons.md §2): a clear stretch of canvas, no HUD. A yellow sticky note
// appears, its glue band saying who wrote it and when; its words come in as typed (shown with set()); a second one, in
// green, from Ayla beside it.
import { CANVAS, type Label } from '../../data/labels'
import { camera, set, wait, type Scene, type Step } from '../director'
import { AWAY, CLEAR, bare, base, text } from '../fixtures/kit'
import { DEMO_USER, PEOPLE } from '../fixtures/pazar'

const WORDS = 'Ask Jonas about the permit before Friday'
const mine = text({ id: 's-new', pieceId: CANVAS, kind: 'sticky', text: '', color: 'yellow', w: 150, uid: DEMO_USER.uid, author: DEMO_USER.name, x: CLEAR.x, y: CLEAR.y })
const hers = text({ id: 's-ayla', pieceId: CANVAS, kind: 'sticky', text: 'Two lobbies said yes to a shelf!', color: 'green', w: 150, uid: PEOPLE.ayla.uid, author: 'Ayla', x: CLEAR.x + 200, y: CLEAR.y + 25 })
const typed = (s: string): Step['do'] => set((ws) => ({ ...ws, labels: [...ws.labels.filter((l) => l.id !== mine.id), { ...mine, text: s } as Label] }), `typed ${s.length}`)
const words = WORDS.split(' ')

const scene: Scene = {
  id: 'kind-sticky',
  fixture: base,
  view: 'canvas',
  size: [480, 300],
  length: 3600,
  poster: 3500,
  cursor: AWAY,
  setup: [bare('kind-sticky'), camera.set(CLEAR.x + 175, CLEAR.y + 75, 1.25)],
  steps: [
    { at: 300, do: typed('') },
    ...words.map((_, i) => ({ at: 800 + i * 220, do: typed(words.slice(0, i + 1).join(' ')) })),
    { at: 2600, do: set((ws) => ({ ...ws, labels: [...ws.labels, hers] }), 'Ayla’s') },
    { do: wait(1000) },
  ],
}
export default scene
