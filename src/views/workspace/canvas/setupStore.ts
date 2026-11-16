// Whose setup is open, and on which tab (D-212, D-268; one store since D-392). A matrix's, a table's and a deck's
// setup each kept this in its own store, and the three had drifted (which closes on leaving focus, which reopens on
// its first tab). One setup is open at a time, wherever it is: in a focus, a pane beside a plane, the tasks side view,
// or for a piece open on the canvas. Opening one closes another; it opens on its first tab unless a tab is asked for.
import { useEffect } from 'react'
import { create } from 'zustand'

// `tab` null: the kind's first (SetupShell reads it against the kind's own tabs).
export const useSetup = create<{ piece: string | null; tab: string | null }>(() => ({ piece: null, tab: null }))

export const openSetup = (piece: string, tab?: string) => useSetup.setState({ piece, tab: tab ?? null })
// The dock's `setup`: open on the first tab, or closed when it's this one's.
export const toggleSetup = (piece: string) => useSetup.setState((s) => (s.piece === piece ? { piece: null, tab: null } : { piece, tab: null }))
// `piece`: only when it's that one's (a view leaving focus closes its own, never another's).
export const closeSetup = (piece?: string) => useSetup.setState((s) => (!piece || s.piece === piece ? { piece: null, tab: null } : s))
export const setSetupTab = (tab: string) => useSetup.setState({ tab })

// Whether this piece's setup is open.
export const useSetupOn = (piece: string): boolean => useSetup((s) => s.piece === piece)
// The piece whose setup is open, if any.
export const useOpenSetup = (): string | null => useSetup((s) => s.piece)

// The open setup closes (Escape); false when none was.
export function closeOneSetup(): boolean {
  const open = !!useSetup.getState().piece
  if (open) closeSetup()
  return open
}

// A live view (in focus, in a pane, open on the canvas) closes its own setup when it goes, never another piece's.
// Not at once: dev runs an effect's cleanup once on mount, and a setup opened just before its view came (a new deck
// made from a deck's setup opens on `cards`) must stay.
const live = new Map<string, number>()
export function useSetupClosesOnLeave(piece: string, on: boolean) {
  useEffect(() => {
    if (!on) return
    live.set(piece, (live.get(piece) ?? 0) + 1)
    return () => {
      live.set(piece, (live.get(piece) ?? 1) - 1)
      setTimeout(() => !live.get(piece) && closeSetup(piece), 0)
    }
  }, [piece, on])
}

// The tab the open setup is on, one of this kind's: its first when none was asked for (or another kind's was).
export function useSetupTab<T extends string>(tabs: readonly T[]): T {
  const tab = useSetup((s) => s.tab)
  return (tabs as readonly string[]).includes(tab ?? '') ? (tab as T) : tabs[0]
}
