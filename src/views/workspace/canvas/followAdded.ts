// A row or column you just added to a grid (a matrix, a table): its view glides to bring it in (D-214; D-394: each
// grid had written it, the matrix only from its dashed cards and never in a pane beside a plane). Whoever adds says so
// (`followAdded`, before the write: the local copy shows it before the promise settles); the grid's view hears where
// the new one is and glides there. Others' adds don't move you: an ask not met within FOLLOW_MS is forgotten.
import { useEffect, useRef } from 'react'
import { create } from 'zustand'

const FOLLOW_MS = 4000
const useAsked = create<{ ask: { piece: string; at: number } | null }>(() => ({ ask: null }))

export const followAdded = (piece: string) => useAsked.setState({ ask: { piece, at: Date.now() } })

// `rows`, `cols`: the keys the grid holds now, in order. `go` hears the place of the first new row and the first new
// column (−1: none); it gives `false` when it couldn't move the view (not its own to move), and the ask stays.
export function useFollowAdded(piece: string, live: boolean, rows: readonly string[], cols: readonly string[], go: (row: number, col: number) => boolean | void) {
  const seen = useRef<{ rows: Set<string>; cols: Set<string> } | null>(null)
  const latest = useRef(go)
  latest.current = go
  const rowKeys = rows.join('|')
  const colKeys = cols.join('|')
  useEffect(() => {
    const was = seen.current
    seen.current = { rows: new Set(rows), cols: new Set(cols) }
    const ask = useAsked.getState().ask
    if (!was || !live || ask?.piece !== piece || Date.now() - ask.at > FOLLOW_MS) return
    const ri = rows.findIndex((k) => !was.rows.has(k))
    const ci = cols.findIndex((k) => !was.cols.has(k))
    if (ri < 0 && ci < 0) return
    if (latest.current(ri, ci) !== false) useAsked.setState({ ask: null })
    // When one comes in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowKeys, colKeys])
}
