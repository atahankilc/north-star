// The tasks side view's button (D-300) in the side nav, after `+`, fit and the compass: columns over a time bar (a
// deck and its days), shown only while the canvas has a deck or a timeline; cyan while the side view is open; `t` does
// the same. A click opens it on the deck you had, or on MINE when something new is given to you. Its magenta count is
// still tasks given to you since you last looked (D-261; looking is MINE shown, your read marks
// `threadReads/{you}.tasks`), as `☐` by your square had; finished ones aren't counted. Where it's open goes out with your
// presence, so a follower's opens there too.
import { useEffect } from 'react'
import { useAuth } from '../../../data/auth'
import { piecesOn } from '../../../data/canvases'
import { setPresenceTasks } from '../../../data/presence'
import { finished } from '../../../data/tasks'
import { useReads } from '../../../data/threads'
import { useWs } from '../canvas/context'
import { loadTasksSide, sideShared, toggleTasksSide, useTasksSide } from './sideState'
import { ToolButton } from '../../../ui/primitives/ToolButton'
import { DeckIcon } from '../../../ui/primitives/hudIcons'

export function TasksTool() {
  const { wid, tasks, pieces, canvas, spots } = useWs()
  const { user } = useAuth()
  const me = user?.id ?? null
  const reads = useReads(wid, me)
  const lookedAt = reads.data?.tasks ?? 0
  const open = useTasksSide((s) => s.open)
  useEffect(() => loadTasksSide(wid), [wid])
  const shared = useTasksSide(sideShared)
  useEffect(() => setPresenceTasks(shared), [shared])

  const mine = tasks.filter((t) => me && t.assignee === me && !finished(t, pieces) && pieces.some((p) => p.id === t.pieceId))
  // Nothing counts as new until your read marks are in.
  const fresh = reads.isLoading ? 0 : mine.filter((t) => (t.givenAt ?? 0) > lookedAt && t.givenBy !== me).length
  if (!piecesOn(canvas, pieces, spots).some((p) => p.kind === 'kanban' || p.kind === 'timeline')) return null
  return (
    <ToolButton
      data-learn="tasks"
      pressed={open}
      badge={fresh}
      label={`Decks and their days${fresh ? `: ${fresh} task${fresh === 1 ? '' : 's'} given to you, new` : ''}`}
      title={fresh ? `decks and days (t) · ${fresh} given to you since you last looked` : 'decks and days (t)'}
      data-viewer-ok
      onClick={() => toggleTasksSide(fresh && !open ? 'mine' : undefined)}
    >
      <DeckIcon />
    </ToolButton>
  )
}
