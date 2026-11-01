// The focus dock's `view` on a plane (D-231, D-347): how it's shown and handled, a tab of the rail whose drawer opens
// as the dock's upper floor (one at a time with the filter and what's linked). ARRANGE (editors): snapping to the grid
// (g) and the alignment guides (a). SHOW: the comments' chips (c, D-159). More switches go here, not in the dock.
import { AnimatePresence } from 'motion/react'
import { ConsoleFloor, ConsoleTab, FloorRow, FloorTitle } from '../../../ui/patterns/Console'
import { Appear } from '../../../ui/primitives/Appear'
import { ButtonGroup } from '../../../ui/primitives/ButtonGroup'
import { Checkbox } from '../../../ui/primitives/Checkbox'
import { toggleGuides, toggleSnap, useGuides } from './guides'
import { toggleThreadPins, useThreadView } from '../threads/Threads'
import { SHUT, useShelf } from './FilterDock'

export function ViewMenu({ editor = true }: { editor?: boolean }) {
  const open = useShelf((s) => s.view)
  const snap = useGuides((s) => s.snap)
  const guides = useGuides((s) => s.guides)
  const comments = useThreadView((s) => s.show)
  return (
    <>
      <ConsoleTab label="view" open={open} learn="dock-view" title={open ? 'close' : 'how this plane is shown'} onClick={() => useShelf.setState({ ...SHUT, view: !open })} />
      <ConsoleFloor>
        <AnimatePresence>
          {open && (
            <Appear key="view" role="group" aria-label="How this plane is shown">
              <FloorTitle>view</FloorTitle>
              {editor && (
                <FloorRow name="arrange">
                  <ButtonGroup>
                    <Checkbox label="snap to the grid" title="g" checked={snap} onChange={toggleSnap} />
                    <Checkbox label="alignment guides" title="a" checked={guides} onChange={toggleGuides} />
                  </ButtonGroup>
                </FloorRow>
              )}
              <FloorRow name="show">
                <ButtonGroup>
                  <Checkbox label="comments" title="c" checked={comments} onChange={toggleThreadPins} />
                </ButtonGroup>
              </FloorRow>
            </Appear>
          )}
        </AnimatePresence>
      </ConsoleFloor>
    </>
  )
}
