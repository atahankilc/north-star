// `timeline` page 1 (onboarding-lessons.md §7), "Days without end": 06 Launch days in focus, no HUD, its tasks by who has
// them. The hand presses on an empty stretch of the strip and drags it sideways: the days run by under it, on into
// November; then it presses `[month]` in the dock: the strip eases out to months, the weeks before and after in view.
// All real: where you are on the strip is yours, never written.
import { resetStrip } from '../../views/workspace/Timeline'
import { aim, cursor, onStage, run, wait, type Ctx, type Scene } from '../director'
import { base } from '../fixtures/kit'
import { view } from '../fixtures/o10'
import { NO_HUD, pageStyle } from '../fixtures/o12'
import { WID, P } from '../fixtures/pazar'

const days = base.pieces.map((p) => (p.id === P.days ? { ...p, timeline: { rows: 'assignee' as const } } : p))
const MONTH = aim('button[title^="18 px a day"]')
// An empty stretch of the strip, low in its rows.
const GRAB = onStage(500, 300)
const along = (c: Ctx) => ({ x: (500 - 280) * c.scale, y: 304 * c.scale })

const scene: Scene = {
  id: 'timeline-scroll',
  fixture: { ...base, pieces: days },
  view: 'focus',
  route: `/workspaces/${WID}?focus=${P.days}`,
  size: [640, 400],
  length: 6400,
  poster: 6300,
  cursor: onStage(560, 250),
  setup: [pageStyle('timeline-scroll', NO_HUD), run(() => resetStrip(P.days), 'today, by weeks'), view(1, 6, 4)],
  steps: [
    { at: 300, do: cursor.to(GRAB, 800) },
    { do: wait(300) },
    { do: cursor.drag(GRAB, along, 1600) },
    { do: wait(500) },
    { do: cursor.to(MONTH, 900) },
    { do: wait(350) },
    { do: cursor.press() },
    { do: wait(900) },
  ],
}
export default scene
