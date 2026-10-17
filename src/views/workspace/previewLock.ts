// While the assistant's preview is open (D-087) the app is a bare preview screen: the HUD, filters and board tools are hidden
// (`data-preview-hide`, AiChat.module.css), so you can't leave the workspace from it, and nothing can be edited: every text
// field, select and checkbox in the app's box goes disabled, and so do a side panel's buttons (except close) and the Table's
// pickers (`data-edit`). Selecting, opening panels, panning, zooming and the preview's own view tabs still work. Dropped or
// pasted files are stopped too. Writes are refused underneath anyway (history.ts); this keeps the UI honest.
const FIELDS = 'input, textarea, select, [contenteditable="true"]'
const BUTTONS = '[data-side-panel] button, [data-edit]'
const LOCKED = 'data-preview-locked'

// The preview's own bar, and a panel's close button.
const allowed = (el: Element) =>
  !!el.closest('[data-preview-bar]') || (el.matches('button') && /^close/i.test(el.getAttribute('aria-label') ?? ''))

function lockAll(app: Element) {
  for (const el of app.querySelectorAll<HTMLElement>(`${FIELDS}, ${BUTTONS}`)) {
    if (el.hasAttribute(LOCKED) || allowed(el)) continue
    if (el.isContentEditable) el.contentEditable = 'false'
    else if ('disabled' in el && !(el as HTMLButtonElement).disabled) (el as HTMLButtonElement).disabled = true
    else continue
    el.setAttribute(LOCKED, '')
    if (el === document.activeElement) el.blur()
  }
}

function unlockAll(app: Element) {
  for (const el of app.querySelectorAll<HTMLElement>(`[${LOCKED}]`)) {
    el.removeAttribute(LOCKED)
    if (el.getAttribute('contenteditable') === 'false') el.contentEditable = 'true'
    else (el as HTMLButtonElement).disabled = false
  }
}

const stop = (e: Event) => {
  e.preventDefault()
  e.stopPropagation()
}

// Locks the app until the returned function is called.
export function lockApp(app: HTMLElement): () => void {
  app.setAttribute('data-previewing', '')
  lockAll(app)
  // New panels, cells turned into inputs, React re-enabling a field: lock again.
  const watch = new MutationObserver(() => lockAll(app))
  watch.observe(app, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'contenteditable'] })
  const events = ['drop', 'dragover', 'paste'] as const
  for (const t of events) app.addEventListener(t, stop, true)
  return () => {
    watch.disconnect()
    for (const t of events) app.removeEventListener(t, stop, true)
    unlockAll(app)
    app.removeAttribute('data-previewing')
  }
}
