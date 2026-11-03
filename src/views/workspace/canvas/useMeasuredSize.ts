// A piece's drawn size into its store (sizes.ts, D-361): measured now and on every resize, written only when it changes
// (each write redraws whoever reads the store). `on`: only while it's drawn the way that's measured (a documents list
// unframed on the canvas).
import { useLayoutEffect, type RefObject } from 'react'
import type { UseBoundStore, StoreApi } from 'zustand'

type Sizes = UseBoundStore<StoreApi<Record<string, { w: number; h: number }>>>

export function useMeasuredSize(el: RefObject<HTMLElement | null>, store: Sizes, id: string, on = true) {
  useLayoutEffect(() => {
    const node = el.current
    if (!node || !on) return
    const note = () => {
      const size = { w: node.offsetWidth, h: node.offsetHeight }
      const was = store.getState()[id]
      if (!was || was.w !== size.w || was.h !== size.h) store.setState({ [id]: size })
    }
    note()
    const ro = new ResizeObserver(note)
    ro.observe(node)
    return () => ro.disconnect()
  }, [el, store, id, on])
}
