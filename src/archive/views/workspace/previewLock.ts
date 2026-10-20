// While the assistant's preview is open (D-087) the app is a bare preview screen: the HUD, filters and board tools are hidden
// (`data-preview-hide`, AiChat.module.css), so you can't leave the workspace from it, and nothing can be edited: every text
// field, select and checkbox in the app's box goes disabled, and so do a side panel's buttons (except close) and the Table's
// pickers (`data-edit`). Selecting, opening panels, panning, zooming and the preview's own view tabs still work. Dropped or
// pasted files are stopped too. Writes are refused underneath anyway (history.ts); this keeps the UI honest.
//
// A viewer (D-098) gets the same lock for good, without the bare screen: the HUD, filters, Settings and the reports tab
// stay usable (`data-viewer-ok`), and the board's create button is hidden (`data-edit-only`, under `[data-viewer]`).
const FIELDS = 'input, textarea, select, [contenteditable="true"]'
const BUTTONS = '[data-side-panel] button, [data-edit]'

export type LockMode = 'preview' | 'viewer'
const LOCKED: Record<LockMode, string> = { preview: 'data-preview-locked', viewer: 'data-viewer-locked' }
const MARK: Record<LockMode, string> = { preview: 'data-previewing', viewer: 'data-viewer' }

// The preview's own bar, and a panel's close button; for a viewer also settings, filters and their own reports.
const allowed = (el: Element, mode: LockMode) =>
  !!el.closest('[data-preview-bar]') ||
  (el.matches('button') && /^close/i.test(el.getAttribute('aria-label') ?? '')) ||
  // Buttons that only move you around (follow a link, open a file, unfold a feature) work for a viewer.
  (mode === 'viewer' && !!el.closest('dialog, [data-preview-hide], [data-viewer-ok], [data-nav]'))

function lockAll(app: Element, mode: LockMode) {
  const attr = LOCKED[mode]
  for (const el of app.querySelectorAll<HTMLElement>(`${FIELDS}, ${BUTTONS}`)) {
    if (el.hasAttribute(attr) || allowed(el, mode)) continue
    // Already locked by the other mode: hold it too, so either one ending keeps it locked.
    const held = Object.values(LOCKED).some((a) => el.hasAttribute(a))
    if (el.isContentEditable) el.contentEditable = 'false'
    else if ('disabled' in el && (held || !(el as HTMLButtonElement).disabled)) (el as HTMLButtonElement).disabled = true
    else continue
    el.setAttribute(attr, '')
    if (el === document.activeElement) el.blur()
  }
}

function unlockAll(app: Element, mode: LockMode) {
  for (const el of app.querySelectorAll<HTMLElement>(`[${LOCKED[mode]}]`)) {
    el.removeAttribute(LOCKED[mode])
    // Still held by the other lock.
    if (Object.values(LOCKED).some((a) => el.hasAttribute(a))) continue
    if (el.getAttribute('contenteditable') === 'false') el.contentEditable = 'true'
    else (el as HTMLButtonElement).disabled = false
  }
}

const stop = (e: Event) => {
  e.preventDefault()
  e.stopPropagation()
}

// Locks the app until the returned function is called.
export function lockApp(app: HTMLElement, mode: LockMode = 'preview'): () => void {
  app.setAttribute(MARK[mode], '')
  lockAll(app, mode)
  // New panels, cells turned into inputs, React re-enabling a field: lock again.
  const watch = new MutationObserver(() => lockAll(app, mode))
  watch.observe(app, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'contenteditable'] })
  // A viewer may still drop a .md on the reports tab and paste into settings or filters.
  const guard = (e: Event) => (mode === 'viewer' && e.target instanceof Element && allowed(e.target, mode) ? undefined : stop(e))
  const events = ['drop', 'dragover', 'paste'] as const
  for (const t of events) app.addEventListener(t, guard, true)
  return () => {
    watch.disconnect()
    for (const t of events) app.removeEventListener(t, guard, true)
    unlockAll(app, mode)
    app.removeAttribute(MARK[mode])
  }
}
