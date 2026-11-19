// Talk's store (D-197, D-199): the pins shown, the open thread or one being started, the list and its scope. Apart from
// Threads.tsx so the places' store (placeStore.ts) can read it without pulling the components in (D-422: an import
// cycle at start).
import { create } from 'zustand'
import type { NewThread } from '../../../data/threads'

export type ThreadView = {
  // Pins shown (`c`); only threads with something new (D-166); resolved ones too.
  show: boolean
  newOnly: boolean
  resolvedToo: boolean
  // The open thread, or one being started (no messages yet).
  openId: string | null
  draft: NewThread | null
  // The threads panel's list (D-166), bottom left (D-193); `scope`: only a plane's (on it, or in it), from its console.
  // The panel has two halves that work apart (D-199): the list and the open thread. Either opens the other; closing the
  // list closes both, closing the thread leaves the list open.
  inbox: boolean
  scope: string | null
}

export const useThreadView = create<ThreadView>(() => ({ show: true, newOnly: false, resolvedToo: false, openId: null, draft: null, inbox: false, scope: null }))
export const toggleThreadPins = () => useThreadView.setState((s) => ({ show: !s.show }))
export const openThread = (id: string) => useThreadView.setState({ openId: id, draft: null })
export const startComment = (draft: NewThread) => useThreadView.setState({ draft, openId: null, show: true })
export const closeThread = () => useThreadView.setState({ openId: null, draft: null })
export const toggleInbox = (on?: boolean, scope: string | null = null) =>
  useThreadView.setState((s) => {
    const inbox = on ?? !s.inbox
    return inbox ? { inbox, scope } : { inbox, scope, openId: null, draft: null }
  })

