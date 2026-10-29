// The kind guide's `project title` row (onboarding-lessons.md §2): a clear stretch of canvas, no HUD. The project title
// appears (star and PROJECT, the corner brackets) and the workspace's name comes in big as it's typed, then what you're
// building under it (each shown with set(): the title reads the workspace's own name and description).
import { CANVAS } from '../../data/labels'
import { camera, set, wait, type Scene } from '../director'
import { AWAY, CLEAR, bare, base, text } from '../fixtures/kit'
import { workspace } from '../fixtures/pazar'

const t = text({ id: 'title-new', pieceId: CANVAS, kind: 'title', text: '', w: 800, x: CLEAR.x, y: CLEAR.y })
const NAME = workspace.name
const named = (name: string, description = '') => set((ws) => ({ ...ws, workspace: { ...ws.workspace, name, description } }), `named ${name}`)

const scene: Scene = {
  id: 'kind-title',
  fixture: { ...base, workspace: { ...workspace, name: '', description: '' } },
  view: 'canvas',
  size: [480, 300],
  length: 3400,
  poster: 3300,
  cursor: AWAY,
  setup: [bare('kind-title'), camera.set(CLEAR.x + 400, CLEAR.y + 120, 0.5)],
  steps: [
    { at: 300, do: set((ws) => ({ ...ws, labels: [...ws.labels, t] }), 'the title appears') },
    ...[...NAME].map((_, i) => ({ at: 1000 + i * 140, do: named(NAME.slice(0, i + 1)) })),
    { at: 1000 + NAME.length * 140 + 400, do: named(NAME, workspace.description ?? '') },
    { do: wait(1300) },
  ],
}
export default scene
