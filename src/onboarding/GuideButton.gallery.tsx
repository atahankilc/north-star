import { example } from '../gallery/example'
import { Fresh } from '../gallery/onboarding'
import { LESSONS } from './lessons'
import { GuideButton } from './GuideButton'

export default example({
  name: 'GuideButton',
  place: 'onboarding/guides',
  also: ['hud/corner'],
  file: 'src/onboarding/GuideButton.tsx',
  note: 'the side nav’s `?`, a magenta dot while something new is unseen; a click does nothing here (no coach mounted)',
  states: {
    default: () => <Fresh progress={{ seen: Object.fromEntries(LESSONS.map((l) => [l.id, 1])), armed: [] }}><GuideButton /></Fresh>,
    'something new': () => <Fresh progress={{ armed: ['side-nav'] }}><GuideButton /></Fresh>,
  },
})
