// The side nav's fit (D-186), under the `+`; the same as `0` (CanvasView's fit): everything on the canvas in view, or in
// focus the piece's contents centred and fitted, whatever kind it is. `plane`: the piece in focus, if any.
import { fitHere } from '../../../state/canvasView'
import { ToolButton } from '../../../ui/primitives/ToolButton'
import { FitIcon } from '../../../ui/primitives/hudIcons'

export function FitTool({ plane }: { plane: string | null }) {
  const focused = plane !== null
  return (
    <ToolButton
      label={focused ? 'Fit the plane to the screen' : 'Fit everything on the canvas'}
      title={focused ? 'fit the plane (0)' : 'fit everything (0)'}
      onClick={fitHere}
    >
      <FitIcon />
    </ToolButton>
  )
}
