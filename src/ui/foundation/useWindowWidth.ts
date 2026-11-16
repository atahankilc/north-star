// The window's width, drawn again when it changes: for what can't fit side by side in a narrow one (the threads' list
// and a conversation, D-393). CSS can't decide that there: one of the two isn't drawn at all.
import { useSyncExternalStore } from 'react'

const listen = (changed: () => void) => {
  window.addEventListener('resize', changed)
  return () => window.removeEventListener('resize', changed)
}

export const useWindowWidth = () => useSyncExternalStore(listen, () => window.innerWidth)
