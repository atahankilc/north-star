// Find (D-236): one finder for the whole workspace, in the middle of the screen (Finder.tsx), opened by ⌘F or the side
// nav's compass; it is go to too (D-196's places come first). What's typed is found in everything the workspace holds,
// grouped by where it is: the canvas's text, each plane's cards and text, each table's, matrix's and documents list's
// contents (every page, not only what's drawn), each document's text. `here` is the space you're in, every other one
// folded to one row (`N inside`); `everywhere` opens them all. Picked, the view goes there (into a piece's focus when
// it's in one) and lands where the preview showed; every match there stays lit, the picked one solid, until Escape.
// This file: the matching, the painting (the CSS highlight API, so nothing on the page is drawn again) and where a
// match lands on the screen, shared by the preview and the going so they agree.
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { create } from 'zustand'
import { fitInto, type Bounds, type PlaneCam } from '../../state/canvasView'
import { isReducedMotion } from '../../state/motion'
import type { Place } from './goTo'

export type FindOpts = { caseSensitive: boolean; words: boolean; regex: boolean }
// `here`: the space you're in, the rest of its canvas folded; `canvas`: all of the canvas shown; `everywhere`: every
// canvas (D-302).
export type FindScope = 'here' | 'canvas' | 'everywhere'

// What's lit after going: `lens`, a match in a table, matrix or list (its element `data-find` = key); `page`, in a
// document's page (the k-th on it); `space`, in the canvas's or a plane's DOM (the element `data-target` = key).
// `focus`: the piece to go into first (a document beside its list: the list's); `view`: where its view lands there.
// `place`: a place on the canvas or in a plane, gone to as go to goes (D-196).
export type FindTarget = { kind: 'lens' | 'page' | 'space'; space: string; key?: string; k: number; focus?: string; view?: PlaneCam; place?: Place }

type FindState = {
  open: boolean
  query: string
  opts: FindOpts
  scope: FindScope
  target: FindTarget | null
  // Bumped by each going, so even the same match is brought into view again.
  asked: number
}

export const useFind = create<FindState>(() => ({
  open: false,
  query: '',
  opts: { caseSensitive: false, words: false, regex: false },
  scope: 'here',
  target: null,
  asked: 0,
}))

// Opened, what was looked for last still there (selected, to type over), as an editor's; what was lit goes.
export const openFinder = () => useFind.setState({ open: true, target: null })
export const closeFinder = () => useFind.setState({ open: false })
export const clearFound = () => useFind.setState({ target: null })
export const setQuery = (query: string) => useFind.setState({ query })
export const toggleOpt = (k: keyof FindOpts) => useFind.setState((s) => ({ opts: { ...s.opts, [k]: !s.opts[k] } }))
// The next of the scopes there are (Tab), from the one shown.
export const toggleScope = (scopes: FindScope[], shown: FindScope) => useFind.setState({ scope: scopes[(scopes.indexOf(shown) + 1) % scopes.length] })
export const setScope = (scope: FindScope) => useFind.setState({ scope })
export const findGo = (target: FindTarget) => useFind.setState((s) => ({ open: false, target, asked: s.asked + 1 }))

export const docScope = (id: string) => `doc:${id}`

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

// What's typed as a regular expression; `bad`: not one (a regular expression being typed).
export function matcherOf(query: string, opts: FindOpts): RegExp | 'bad' | null {
  if (!query) return null
  let src = opts.regex ? query : escape(query)
  if (opts.words) src = `(?<![\\p{L}\\p{N}_])(?:${src})(?![\\p{L}\\p{N}_])`
  try {
    return new RegExp(src, `gu${opts.caseSensitive ? '' : 'i'}`)
  } catch {
    return 'bad'
  }
}

export function useMatcher() {
  const query = useFind((s) => s.query)
  const opts = useFind((s) => s.opts)
  return useMemo(() => matcherOf(query, opts), [query, opts])
}

// More than this and the rest aren't counted (a regular expression matching everything).
export const MOST = 5000

// Where `re` matches in `text`: [from, to] each; an empty match is stepped over.
export function matchesIn(text: string, re: RegExp, most = MOST): [number, number][] {
  const out: [number, number][] = []
  re.lastIndex = 0
  for (let m = re.exec(text); m && out.length < most; m = re.exec(text)) {
    if (m[0].length === 0) {
      re.lastIndex++
      continue
    }
    out.push([m.index, m.index + m[0].length])
  }
  return out
}

// The matches on the page under `root`, as ranges, one text node at a time; not in what's marked `data-find-skip`
// (a document's line of who and when).
export function rangesIn(root: Node, re: RegExp, most = MOST): Range[] {
  const out: Range[] = []
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest('[data-find-skip]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  })
  for (let n = walk.nextNode(); n && out.length < most; n = walk.nextNode()) {
    const text = n.nodeValue ?? ''
    if (!text.trim()) continue
    for (const [a, b] of matchesIn(text, re, most - out.length)) {
      const r = document.createRange()
      r.setStart(n, a)
      r.setEnd(n, b)
      out.push(r)
    }
  }
  return out
}

// ---- Painting: every match, and the current one (global.css has their colours). One painter at a time: the
// finder's preview while it's open, what was picked once it's gone.
const canPaint = () => typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined'
export function paint(all: Range[], at: Range[]) {
  if (!canPaint()) return
  CSS.highlights.set('find', new Highlight(...all))
  CSS.highlights.set('find-at', new Highlight(...at))
}
export function unpaint() {
  if (!canPaint()) return
  CSS.highlights.delete('find')
  CSS.highlights.delete('find-at')
}
// A match that isn't text on the page (a scale's step shows a square, a note isn't shown): its box is lit.
const FOUND = 'data-found'
export const unmark = (root: Element) => root.querySelectorAll(`[${FOUND}]`).forEach((el) => el.removeAttribute(FOUND))

// Paints the matches under `root` and the current one: the element `current` (its k-th match, or its box when it has
// no text match), or the k-th match of the whole page.
export function paintIn(root: Element, re: RegExp, current: { el: Element | null; k: number } | { k: number } | null) {
  unmark(root)
  const all = rangesIn(root, re)
  let now: Range[] = []
  if (current && 'el' in current) {
    if (current.el) {
      const rs = rangesIn(current.el, re)
      const r = rs[Math.min(current.k, rs.length - 1)]
      if (r) now = [r]
      else (current.el.closest('[data-find-box]') ?? current.el).setAttribute(FOUND, 'at')
    }
  } else if (current && all.length) now = [all[Math.min(current.k, all.length - 1)]]
  paint(all, now)
  return now[0] ?? null
}

// The page drawn again (rows coming into sight, a body loading): painted again, once a frame.
export function watch(root: Element, again: () => void) {
  let raf = 0
  const mo = new MutationObserver(() => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(again)
  })
  mo.observe(root, { childList: true, subtree: true, characterData: true })
  return () => {
    cancelAnimationFrame(raf)
    mo.disconnect()
  }
}

// ---- What a table, matrix or list holds, each text with the box it's drawn in (its own px) and its page.
export type FindItem = { key: string; text: string; box: Bounds; page?: number }

// A document's page (in its focus, or open beside its list) once you've gone to a match in it: the picked one brought
// into view once it's `ready` (arrived) and its text is in, by `reveal` (its place on the screen); then let go. Only the
// preview lights matches; the page itself is left as it is.
export function useLandOnPage(scope: string, root: RefObject<HTMLElement | null>, ready: boolean, reveal: (r: DOMRect) => void) {
  const on = useFind((s) => !s.open && s.target?.kind === 'page' && s.target.space === scope)
  const re = useMatcher()
  const revealRef = useRef(reveal)
  revealRef.current = reveal
  useEffect(() => {
    const el = root.current
    if (!on || !ready || !el || !(re instanceof RegExp)) return
    const look = () => {
      const k = useFind.getState().target?.k ?? 0
      const rs = rangesIn(el, re)
      const r = rs[Math.min(k, rs.length - 1)]
      if (!r) return false
      revealRef.current(r.getBoundingClientRect())
      clearFound()
      return true
    }
    if (look()) return
    // Its text may come in after.
    return watch(el, () => void look())
  }, [on, re, root, ready])
}

// ---- Where a match lands on the screen: the piece fitted as its focus does (D-186, 96 px round), then, when the
// match is off the screen or too small to read, glided to bring it to the middle, clear of the breadcrumb on top, the
// dock under, the side nav's tools on the left (and a matrix's held heads, `heads`).
const CLEAR = { top: 76, bottom: 64, left: 64, right: 24 }
const READ_PX = 18

export function landing(content: Bounds, box: Bounds, room: { w: number; h: number }, heads = { top: 0, left: 0 }): PlaneCam {
  const f = fitInto(content, room.w, room.h, 96)
  const fitted = { zoom: f.zoom, ox: room.w / 2 - f.cx * f.zoom, oy: room.h / 2 - f.cy * f.zoom }
  return revealed(fitted, box, room, heads)
}

export function revealed(view: PlaneCam, box: Bounds, room: { w: number; h: number }, heads = { top: 0, left: 0 }): PlaneCam {
  const zoom = box.h * view.zoom < READ_PX ? Math.min(1, (READ_PX * 1.5) / box.h) : view.zoom
  const x0 = view.ox + box.x * zoom
  const y0 = view.oy + box.y * zoom
  const top = CLEAR.top + heads.top * zoom
  const left = CLEAR.left + heads.left * zoom
  const inside = zoom === view.zoom && x0 >= left && y0 >= top && x0 + box.w * zoom <= room.w - CLEAR.right && y0 + box.h * zoom <= room.h - CLEAR.bottom
  if (inside) return view
  const cx = left + (room.w - CLEAR.right - left) / 2
  const cy = top + (room.h - CLEAR.bottom - top) / 2
  // Wider than the room: its start in sight rather than its middle.
  const ox = box.w * zoom > room.w - CLEAR.right - left ? left - box.x * zoom : cx - (box.x + box.w / 2) * zoom
  return { zoom, ox, oy: cy - (box.y + box.h / 2) * zoom }
}

// A document in its focus (scrolled by its view's oy): a match outside [96, h − 120] on the screen comes to 40 % down.
export function docScrolledTo(oy: number, top: number, bottom: number, h: number) {
  return top >= 96 && bottom <= h - 120 ? oy : oy - (top - h * 0.4)
}

// A page that scrolls itself (a document beside its list): the match brought to 40 % down when it's out of sight.
export function scrollTo(scroller: HTMLElement | null, r: DOMRect) {
  if (!scroller) return
  const box = scroller.getBoundingClientRect()
  if (r.top >= box.top + CLEAR.top && r.bottom <= box.bottom - CLEAR.bottom) return
  scroller.scrollTo({ top: scroller.scrollTop + r.top - box.top - box.height * 0.4, behavior: isReducedMotion() ? 'auto' : 'smooth' })
}
