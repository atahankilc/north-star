// The loading curtain stays up while any part of the app "holds" it (auth, fonts, page data).
import { useLayoutEffect } from 'react'
import { create } from 'zustand'

type CurtainState = {
  // key → human-readable status line, e.g. { workspaces: 'loading workspaces' }
  holds: Record<string, string>
  // False while the curtain covers the page. Entrances and text decode start the moment it turns
  // true, all together, as the page rebuilds.
  revealed: boolean
  hold: (key: string, label: string) => void
  release: (key: string) => void
  setRevealed: (revealed: boolean) => void
}

export const useCurtain = create<CurtainState>((set) => ({
  holds: {},
  revealed: false,
  hold: (key, label) => set((s) => ({ holds: { ...s.holds, [key]: label } })),
  release: (key) =>
    set((s) => {
      const holds = { ...s.holds }
      delete holds[key]
      return { holds }
    }),
  setRevealed: (revealed) => set({ revealed }),
}))

const LABELS: Record<string, string> = {
  auth: 'checking your session',
  fonts: 'loading type',
  workspaces: 'loading workspaces',
  workspace: 'opening workspace',
  board: 'loading ideas',
}

// Layout effect: registers before paint, so a page never flashes before the curtain knows about it.
export function useHoldCurtain(key: string, holding: boolean) {
  useLayoutEffect(() => {
    if (!holding) return
    const { hold, release } = useCurtain.getState()
    hold(key, LABELS[key] ?? key)
    return () => release(key)
  }, [key, holding])
}

export function useRevealed() {
  return useCurtain((s) => s.revealed)
}

// Dev-only handle for inspecting state from the console or automation.
if (import.meta.env.DEV) {
  ;(window as unknown as { __curtain: typeof useCurtain }).__curtain = useCurtain
}
