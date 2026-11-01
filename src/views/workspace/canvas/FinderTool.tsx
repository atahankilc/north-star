// The side nav's compass, under fit: the finder (D-236), which is go to too (D-196): the places with nothing typed (↓),
// anything in the workspace once something is. ⌘F does the same; cyan while the finder is open. Under it the guide's `?`.
import { openFinder, useFind } from '../find/find'
import { ToolButton } from '../../../ui/primitives/ToolButton'
import { CompassIcon } from '../../../ui/primitives/hudIcons'

export function FinderTool() {
  const open = useFind((s) => s.open)
  return (
    <ToolButton pressed={open} label="Find and go to" title="find, go to (⌘F)" onClick={openFinder} data-learn="finder">
      <CompassIcon />
    </ToolButton>
  )
}
