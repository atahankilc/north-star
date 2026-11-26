// The right side is one column (D-435): the thing selected (a card's, a task's panel: SidePanel) and the agent's column
// stand in the same place, as wide as the agent's, and share it by tabs; what came last is in front. With only one of
// them there are no tabs. Each says it's there; the one behind isn't shown and takes no keys.
import { useLayoutEffect } from 'react'
import { create } from 'zustand'

export type RightTab = 'thing' | 'agent'
type State = { thing: string | null; agent: boolean; front: RightTab }
export const useRightColumn = create<State>(() => ({ thing: null, agent: false, front: 'thing' }))
export const bringFront = (front: RightTab) => useRightColumn.setState({ front })

// The thing's panel is up, by its kind's word (`feature`); another thing picked (`what` changes) comes to the front too.
// Never while its sheet's column is leaving (`on` false).
export function useThingPanel(kind: string, what: string, on: boolean) {
  useLayoutEffect(() => {
    if (!on) return
    useRightColumn.setState({ thing: kind, front: 'thing' })
  }, [kind, what, on])
  useLayoutEffect(() => {
    if (!on) return
    return () => useRightColumn.setState({ thing: null })
  }, [on])
}

export function useAgentPanel(on: boolean) {
  useLayoutEffect(() => {
    if (!on) return
    useRightColumn.setState({ agent: true, front: 'agent' })
    return () => useRightColumn.setState({ agent: false })
  }, [on])
}

// Behind the other one now.
export const isBehind = (me: RightTab) => {
  const s = useRightColumn.getState()
  return !!s.thing && s.agent && s.front !== me
}
export const useBehind = (me: RightTab) => useRightColumn(() => isBehind(me))
