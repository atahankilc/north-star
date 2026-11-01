// Where a dropdown hangs from its anchor (D-093): fixed to the viewport in a portal, so a scrolling panel or table can't clip
// it. Below the anchor unless it only fits above; kept inside its side panel, else the app's box (clear of the assistant's
// window, D-081). Inside a modal <dialog> it goes in the dialog (the top layer would hide it otherwise), measured from the
// dialog's padding box, since a filtered dialog is the containing block for fixed children.
export type Floating = {
  host: HTMLElement
  style: { left: number; top: number | 'auto'; bottom: number | 'auto'; width?: number; minWidth?: number }
}

export function floatFrom(
  anchor: HTMLElement,
  { height, width, minWidth = 200 }: { height: number; width?: number; minWidth?: number },
): Floating {
  const dialog = anchor.closest('dialog')
  const r = anchor.getBoundingClientRect()
  const box = dialog?.getBoundingClientRect()
  const origin = box && dialog ? { left: box.left + dialog.clientLeft, top: box.top + dialog.clientTop } : { left: 0, top: 0 }
  const viewHeight = dialog?.clientHeight ?? window.innerHeight
  const right =
    (anchor.closest('[data-side-panel]') ?? anchor.closest('[data-app]') ?? dialog)?.getBoundingClientRect().right ?? window.innerWidth
  const w = width ?? Math.max(r.width, minWidth)
  const left = Math.max(8, Math.min(r.left, right - w - 1)) - origin.left
  const below = window.innerHeight - r.bottom
  const size = width === undefined ? { minWidth: w } : { width: w }
  return {
    host: dialog ?? document.body,
    style:
      below < height + 8 && r.top > below
        ? { left, top: 'auto', bottom: viewHeight - (r.top - origin.top) + 4, ...size }
        : { left, top: r.bottom - origin.top + 4, bottom: 'auto', ...size },
  }
}
