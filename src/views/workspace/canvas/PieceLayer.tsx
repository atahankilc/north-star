// A piece's contents in its window (D-403): the layer that fills the piece, and inside it the world that the view
// moves. Six views had written these two elements out (round 1 shared only their CSS, PieceLayer.module.css). Only the
// world's transform changes as the view pans or zooms (D-278, D-279): what's inside is drawn again when the zoom
// settles, never per step, so keep it memoised.
// `layer`, `world`: the view's own classes (each composes PieceLayer.module.css and hangs its rules on them).
// `still`: its contents keep the canvas's size though it isn't live (a matrix held still while it glides into focus).
// `over`: what lies in the layer over the world, at screen size (a selected cell's bar).
import type { CSSProperties, ReactNode, Ref } from 'react'
import type { PlaneCam } from '../../../state/canvasView'
import { zsIn } from '../../../ui/primitives/Marks'

type Props = {
  layer: string
  world: string
  view: PlaneCam
  // The zoom once it settled (useSettledZoom): what's at screen size reads this one.
  settled: number
  live: boolean
  onCanvas: boolean
  still?: boolean
  layerRef?: Ref<HTMLDivElement>
  worldRef?: Ref<HTMLDivElement>
  children: ReactNode
  over?: ReactNode
  'data-timeline'?: boolean
}

export function PieceLayer({ layer, world, view, settled, live, onCanvas, still = false, layerRef, worldRef, children, over, ...rest }: Props) {
  const style: CSSProperties = { transform: `translate(${view.ox}px, ${view.oy}px) scale(${view.zoom})`, ...zsIn(settled, onCanvas || !(live || still)) }
  return (
    <div ref={layerRef} className={layer} {...rest} data-live={live || undefined} data-on-canvas={onCanvas || undefined}>
      <div ref={worldRef} className={world} data-world data-zooming={view.zoom !== settled || undefined} style={style}>
        {children}
      </div>
      {over}
    </div>
  )
}
