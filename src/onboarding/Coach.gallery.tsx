import { example, type GalleryCtx } from '../gallery/example'
import { Fresh, shown } from '../gallery/onboarding'
import { Canvas, onCanvas, P } from '../gallery/canvas'
import { Screen } from '../gallery/screens'
import { SAMPLE_RELEASES } from './releases.sample'
import { Coach, coachDev } from './Coach'

// The coach mounted for real over the canvas, its queue quiet, one surface forced (devMount.show's). Its seen-state
// has no Firestore here: it reads `unavailable` and keeps to this page's in-memory storage.
const force = (what: (d: NonNullable<typeof coachDev.current>) => void) => async (c: GalleryCtx) => {
  for (let i = 0; i < 60 && !coachDev.current; i++) await c.wait(50)
  const d = coachDev.current
  if (!d) throw new Error('the coach did not mount')
  d.quiet(true)
  d.force(null)
  d.news(null)
  d.hint(null)
  d.guide(false)
  await c.wait(100)
  what(d)
}

const withCoach = (o: NonNullable<Parameters<typeof onCanvas>[0]>, what: Parameters<typeof force>[0], progress?: Parameters<typeof Fresh>[0]['progress'], hud = false) => {
  const s = onCanvas({ ...o, then: force(what) })
  return {
    ...s,
    render: () => (
      <>
        {hud ? <Screen /> : <Canvas />}
        <Fresh progress={progress}>
          <Coach />
        </Fresh>
      </>
    ),
  }
}

export default example({
  name: 'Coach',
  place: 'screens/onboarding in place',
  file: 'src/onboarding/Coach.tsx',
  note: 'not a look of its own: the coach decides what shows when and draws the onboarding surfaces (Pages for the welcome and every lesson, D-349; EmptyHint, the kind guide, Guide) over the real canvas; here one is forced at a time. The surfaces alone are under onboarding.',
  states: {
    welcome: withCoach({ only: [P.lunch] }, (d) => d.force(shown('welcome'))),
    'lesson in focus': withCoach({ only: [P.lunch], focus: P.lunch }, (d) => d.force(shown('focus-plane'))),
    'what’s new': withCoach({ only: [P.lunch] }, (d) => d.news(SAMPLE_RELEASES as never)),
    // The welcome seen (while it's still to come the coach keeps this hint back, Coach.tsx `welcomeQueued`), and the whole
    // screen: the hint sits beside the side nav's `+`.
    'empty canvas': withCoach({ only: [] }, (d) => d.hint('empty-canvas'), { seen: { welcome: 1 } }, true),
    guide: withCoach({ only: [P.lunch] }, (d) => d.guide(true)),
  },
})
