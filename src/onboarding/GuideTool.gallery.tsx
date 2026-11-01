import { useEffect } from 'react'
import { example } from '../gallery/example'
import { Fresh } from '../gallery/onboarding'
import { LESSONS } from './lessons'
import { GuideTool } from './GuideTool'
import { useGuideShown } from './Guide'

// The guide open while shown (the coach sets it in the app); back to closed after, so other states stay grey.
function Open() {
  useEffect(() => {
    useGuideShown.setState({ open: true })
    return () => useGuideShown.setState({ open: false })
  }, [])
  return <GuideTool />
}

export default example({
  name: 'GuideTool',
  place: 'onboarding/guides',
  also: ['hud/navigation'],
  file: 'src/onboarding/GuideTool.tsx',
  note: 'the side nav’s `?`, a magenta dot while something new is unseen; a click does nothing here (no coach mounted)',
  states: {
    default: () => <Fresh progress={{ seen: Object.fromEntries(LESSONS.map((l) => [l.id, 1])), armed: [] }}><GuideTool /></Fresh>,
    'something new': () => <Fresh progress={{ armed: ['side-nav'] }}><GuideTool /></Fresh>,
    open: { render: () => <Open />, note: 'cyan while the guide is open, as every HUD tool (D-343)' },
  },
})
