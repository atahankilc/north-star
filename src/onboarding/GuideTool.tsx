// The side nav's `?` (D-315, docs/specs/onboarding.md §4.6), under the compass: opens the guide (every note again, the
// keys, tips on/off), as `?` does. A magenta dot on it while something new is still unseen.
import { openGuide } from './Coach'
import { useGuideDot } from './Guide'
import { ToolButton } from '../ui/primitives/ToolButton'
import { GuideIcon } from '../ui/primitives/hudIcons'

export function GuideTool() {
  const dot = useGuideDot()
  return (
    <ToolButton
      label={`Guide: every note again${dot ? ', something new' : ''}`}
      dot={dot}
      title={dot ? 'guide (?) · something new' : 'guide (?)'}
      data-viewer-ok
      onClick={openGuide}
    >
      <GuideIcon />
    </ToolButton>
  )
}
