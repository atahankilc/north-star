// Escape, one stack for everything that closes on it (D-359): windows, menus, panels, docks. What opened last is on top
// and hears Escape first; nothing under it does. One listener on the window, heard on the way down (before the canvas,
// which would leave focus), never what onboarding's coach hears (`[data-coach]`).
// - `on`: in the stack only while true; turned on again it goes on top (a list shut by a thread comes back under it).
// - `fields`: Escape typed in a field closes it too (a window: its fields are its own). Without it a field keeps its
//   Escape (undo what was typed, leave the field) and the layer waits for the next one.
// - `root`: what the layer is. A menu or a dialog of someone else's that has the focus keeps its Escape. A layer with
//   no root (a console's drawer, D-388) can sit inside a docked panel, so only a menu or a modal is someone else's.
// - `first`: heard before every other layer, wherever the key is (stop following someone: D-191's `esc to stop`).
import { useEffect, useRef, type RefObject } from 'react'
import { keysHeld } from './focus'

type Layer = { close: () => void; fields: boolean; first: boolean; root?: RefObject<HTMLElement | null> }

const stack: Layer[] = []

const FIELD = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])'
// What hears Escape itself: a menu or list with the focus, another dialog (a native <dialog> too).
const OWN = '[role=menu], [role=listbox], [role=dialog], [role=alertdialog], dialog'
// The same for a layer with no root: a docked panel (`role="dialog"`, not modal) may be what holds it.
const OWN_ANYWHERE = '[role=menu], [role=listbox], [aria-modal=true], [role=alertdialog], dialog'

function onKey(e: KeyboardEvent) {
  // A box being drawn holds the keys (focus.ts' holdKeys): its Escape is its own.
  if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing || keysHeld()) return
  const t = e.target as Element | null
  if (t?.closest?.('[data-coach]')) return
  const first = [...stack].reverse().find((l) => l.first)
  if (first) return (e.preventDefault(), e.stopPropagation(), first.close())
  const top = stack[stack.length - 1]
  if (!top) return
  const inside = !!top.root?.current && !!t && top.root.current.contains(t)
  if (!inside) {
    const own = t?.closest?.(top.root ? OWN : OWN_ANYWHERE)
    // Someone else's menu or dialog, not one holding this layer.
    if (own && !own.contains(top.root?.current ?? null)) return
  }
  if (!top.fields && t?.closest?.(FIELD)) return
  e.preventDefault()
  e.stopPropagation()
  top.close()
}

export function useEscapeLayer(onEscape: () => void, { on = true, fields = false, first = false, root }: { on?: boolean; fields?: boolean; first?: boolean; root?: RefObject<HTMLElement | null> } = {}) {
  const close = useRef(onEscape)
  close.current = onEscape
  useEffect(() => {
    if (!on) return
    const layer: Layer = { close: () => close.current(), fields, first, root }
    if (!stack.length) window.addEventListener('keydown', onKey, true)
    stack.push(layer)
    return () => {
      const i = stack.indexOf(layer)
      if (i >= 0) stack.splice(i, 1)
      if (!stack.length) window.removeEventListener('keydown', onKey, true)
    }
  }, [on, fields, first, root])
}
