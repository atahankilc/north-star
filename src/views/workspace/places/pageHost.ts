// Where Talk's page draws its list and conversation (D-412): the page sets it, ThreadInbox portals into it.
import { create } from 'zustand'
export const usePageHost = create<{ el: HTMLElement | null }>(() => ({ el: null }))
