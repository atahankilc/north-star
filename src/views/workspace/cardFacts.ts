// What a card says besides its title: the pure part moved to src/model/cardFacts.ts (R8); the hook stays here.
import { useMemo } from 'react'
import { taskTally } from '../../data/tasks'
import { useWs } from './context'

export * from '../../model/cardFacts'

// Each card's tasks, finished and all (D-254); the same map while the counts stay (a task's notes typed don't redraw
// every card).
export function useTaskTally() {
  const { tasks, pieces } = useWs()
  const tally = useMemo(() => taskTally(tasks, pieces), [tasks, pieces])
  const key = [...tally].map(([id, n]) => `${id}:${n.done}/${n.all}`).join(',')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => tally, [key])
}
