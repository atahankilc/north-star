// Focuses a field drawn over the board through drei's <Html>, which attaches it to the page a moment after it renders:
// a focus before that does nothing, and what's typed next goes wherever focus was (the + menu's button, which then
// opened on Enter). Tries each frame until the field has focus, for a few frames at most.
export function focusField(get: () => HTMLInputElement | null, select = true, frames = 10) {
  const tryNow = (left: number) => {
    const el = get()
    if (el?.isConnected) {
      el.focus({ preventScroll: true })
      if (select) el.select()
      if (document.activeElement === el) return
    }
    if (left > 0) requestAnimationFrame(() => tryNow(left - 1))
  }
  tryNow(frames)
}
