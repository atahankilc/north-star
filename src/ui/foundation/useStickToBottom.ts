// A list that grows at its foot (the agent's chat, a thread's messages, D-361): kept at the bottom as things come in,
// unless the person scrolled up to read (then it stays where they are); back at the bottom once they scroll there
// again, send something (`toBottom`), or another list is shown (`reset` changes).
import { useLayoutEffect, useRef, type DependencyList, type RefObject, type UIEvent } from 'react'
import { STICK_PX } from './feel'

export function useStickToBottom(el: RefObject<HTMLElement | null>, grows: DependencyList, reset?: unknown) {
  const stick = useRef(true)
  useLayoutEffect(() => {
    stick.current = true
  }, [reset])
  useLayoutEffect(() => {
    const node = el.current
    if (node && stick.current) node.scrollTop = node.scrollHeight
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reset, ...grows])
  const onScroll = (e: UIEvent<HTMLElement>) => {
    const node = e.currentTarget
    stick.current = node.scrollHeight - node.scrollTop - node.clientHeight < STICK_PX
  }
  const toBottom = () => {
    stick.current = true
  }
  return { onScroll, toBottom }
}
