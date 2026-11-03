// A section's `+ card` that opens the card picker under it (D-361: written six times): the section's `add` while
// closed (none while open, so it doesn't open twice), and a pick that closes it first.
import { useState } from 'react'

export function usePicker() {
  const [picking, setPicking] = useState(false)
  const close = () => setPicking(false)
  return {
    picking,
    open: () => setPicking(true),
    toggle: () => setPicking((v) => !v),
    close,
    add: (label: string, when = true) => (when && !picking ? { label, onClick: () => setPicking(true) } : undefined),
    pick:
      <T,>(act: (t: T) => void) =>
      (t: T) => {
        close()
        act(t)
      },
  }
}
