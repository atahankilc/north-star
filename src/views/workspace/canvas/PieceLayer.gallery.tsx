import { example } from '../../../gallery/example'
import { PieceLayer } from './PieceLayer'
import styles from './PieceLayer.module.css'

const frame = { position: 'relative', width: 420, height: 220, border: 'var(--line-w) solid var(--line-hover)', background: 'var(--bg)', overflow: 'hidden' } as const
const sheet = { width: 300, padding: 'var(--space-3)', border: 'var(--line-w) dashed var(--line-hover)', color: 'var(--fg-dim)' } as const

function Shown({ zoom, ox = 24, oy = 24, over }: { zoom: number; ox?: number; oy?: number; over?: boolean }) {
  return (
    <div style={frame}>
      <PieceLayer layer={styles.layer} world={styles.world} view={{ zoom, ox, oy }} settled={zoom} live onCanvas={false} over={over ? <span style={{ position: 'absolute', right: 8, bottom: 8, color: 'var(--accent-cyan)' }}>over the world, at screen size</span> : undefined}>
        <div style={sheet}>the world: what the view moves and scales ({Math.round(zoom * 100)} %)</div>
      </PieceLayer>
    </div>
  )
}

export default example({
  name: 'PieceLayer',
  place: 'canvas/pieces',
  file: 'src/views/workspace/canvas/PieceLayer.tsx',
  note: 'a piece’s contents in its window (D-403): the layer that fills the piece and the world the view moves; a matrix, a table, a deck, a timeline and the documents list stand on it; only the world’s transform changes as the view pans or zooms',
  states: {
    'at its own size': () => <Shown zoom={1} />,
    'zoomed out, moved': () => <Shown zoom={0.6} ox={120} oy={60} />,
    'with something over the world': () => <Shown zoom={1} over />,
  },
})
