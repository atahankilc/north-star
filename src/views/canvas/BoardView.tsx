// /w/:wid (ideas) and /w/:wid/features: one board of cards (D-037).
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { BoardType } from '../../data/model'
import { createBoardNode } from '../../data/nodes'
import { useCanvas } from '../../state/canvasStore'
import { AsciiButton } from '../../ui/AsciiButton'
import { DecodeText } from '../../ui/DecodeText'
import { useWs } from '../workspace/context'
import { Board } from './Board'
import { BOARD_KINDS } from './boardKinds'
import { findFreeSpot } from './cardLayout'
import { DetailPanel } from './DetailPanel'
import styles from './BoardView.module.css'

export function BoardView({ type }: { type: BoardType }) {
  const ws = useWs()
  const { wid, edges } = ws
  const nodes = type === 'idea' ? ws.ideas : ws.features
  const kind = BOARD_KINDS[type]
  const select = useCanvas((s) => s.select)
  const [params, setParams] = useSearchParams()

  // `?n=<id>` (from a link in another view) selects that card and starts the camera on it.
  const [focus] = useState(() => {
    const n = nodes.find((c) => c.id === params.get('n'))
    return n ? ([n.x, n.y] as [number, number]) : undefined
  })
  useEffect(() => {
    const id = params.get('n')
    if (!id) return
    const n = nodes.find((c) => c.id === id)
    if (n) {
      select(id)
      useCanvas.getState().focusOn([n.x, n.y])
    }
    setParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  // Leaving the board clears selection; Escape deselects.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') select(null)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      select(null)
    }
  }, [select])

  const add = async () => {
    const [x, y] = findFreeSpot(useCanvas.getState().viewCenter(), nodes)
    const id = await createBoardNode(wid, type, { x, y })
    select(id)
  }

  return (
    <main className={styles.page}>
      <Board key={type} wid={wid} type={type} nodes={nodes} edges={edges} focus={focus} />

      <footer className={styles.tools}>
        <AsciiButton onClick={add}>{kind.addLabel}</AsciiButton>
        <span className={styles.hints}>
          double-click: new {kind.label} · drag: move · shift+drag: link · drag board: pan · scroll: zoom
        </span>
      </footer>

      {nodes.length === 0 && (
        <div className={styles.empty}>
          <DecodeText text={kind.empty} />
        </div>
      )}

      <DetailPanel type={type} nodes={nodes} />
    </main>
  )
}
