// A textarea as tall as its text, so it never scrolls: again on every change and when its width changes.
// `rows` stays the least it shows.
import { useEffect, useLayoutEffect, type RefObject } from 'react'

export function useAutoGrow(ref: RefObject<HTMLTextAreaElement | null>, value: string) {
  useLayoutEffect(() => grow(ref.current), [ref, value])
  useEffect(() => {
    const el = ref.current
    if (!(el instanceof HTMLTextAreaElement)) return
    let width = el.clientWidth
    const watch = new ResizeObserver(() => {
      if (el.clientWidth === width) return
      width = el.clientWidth
      grow(el)
    })
    watch.observe(el)
    return () => watch.disconnect()
  }, [ref])
}

function grow(el: HTMLTextAreaElement | null) {
  if (!(el instanceof HTMLTextAreaElement)) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`
}
