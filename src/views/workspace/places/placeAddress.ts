// A place in the address (D-423, docs/specs/shell.md): the place open and what's open in it are written to the
// address as they change, so a reload brings them back and a link sent to someone opens the same place.
//   ?place=talk | tasks | docs     the place beside the canvas
//   ?page=talk | tasks | docs      the place as the page
//   &thread=<id>                   Talk: the conversation open
//   &deck=<tab>&days&linked=<id>   Tasks: its tab (a deck's id, `mine`, `all`), its days, the plane it's linked to
//   &doc=<id>&folder=<id>          Docs: the document open, the folder shown
// The address is read once, on arriving at a workspace; after that the stores lead and the address follows, always in
// place (a place is never a step back), and put back when something else writes the address (a focus, a canvas).
import { useEffect, useLayoutEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePlace, type Place } from './placeStore'
import { useThreadView } from '../threads/threadView'
import { useDocsAt } from '../documents/DocsPlace'

const KEYS = ['place', 'page', 'thread', 'deck', 'days', 'linked', 'doc', 'folder'] as const
const PLACES: readonly Place[] = ['talk', 'tasks', 'docs']

// What the stores say now, as the address's keys.
export function placeAddress(): Record<string, string> {
  const { open, page, tasks } = usePlace.getState()
  if (!open) return {}
  const out: Record<string, string> = { [page ? 'page' : 'place']: open }
  if (open === 'talk') {
    const { openId } = useThreadView.getState()
    if (openId) out.thread = openId
  }
  if (open === 'tasks' && tasks) {
    out.deck = tasks.tab
    if (tasks.days) out.days = ''
    if (tasks.linked) out.linked = tasks.linked
  }
  if (open === 'docs') {
    const { open: doc, folder } = useDocsAt.getState()
    if (doc) out.doc = doc
    if (folder) out.folder = folder
  }
  return out
}

// The address's keys into the stores: what it names opens, and with no place named every place is closed.
export function openFromAddress(q: URLSearchParams) {
  const asPage = q.get('page')
  const name = asPage ?? q.get('place')
  const place = PLACES.find((p) => p === name) ?? null
  if (place !== 'talk') useThreadView.setState({ inbox: false, openId: null, draft: null })
  if (!place) return void usePlace.setState({ open: null, page: false })
  const deck = q.get('deck')
  usePlace.setState({
    open: place,
    page: asPage !== null,
    ...(place === 'tasks' && deck && { tasks: { tab: deck, days: q.has('days'), linked: q.get('linked') } }),
  })
  if (place === 'talk') useThreadView.setState({ inbox: true, scope: null, openId: q.get('thread'), draft: null })
  if (place === 'docs') useDocsAt.setState({ open: q.get('doc'), folder: q.get('folder') })
}

const same = (q: URLSearchParams, want: Record<string, string>) =>
  KEYS.every((k) => (k in want ? q.get(k) === want[k] : !q.has(k)))

// The address with the place's keys as the stores say, the rest (canvas, focus, beside) as it was.
function written(q: URLSearchParams, want: Record<string, string>) {
  const next = new URLSearchParams(q)
  for (const k of KEYS) next.delete(k)
  for (const [k, v] of Object.entries(want)) next.set(k, v)
  return next
}

// Mounted once by the workspace's page (the app's only, not the gallery's or the lessons' demo).
export function usePlaceAddress(wid: string) {
  const [params, setParams] = useSearchParams()
  // Arriving: the address decides, before anything is drawn from the stores.
  useLayoutEffect(() => {
    openFromAddress(new URLSearchParams(window.location.search))
  }, [wid])
  // The stores lead: each change written in place.
  useEffect(() => {
    const write = () => {
      const q = new URLSearchParams(window.location.search)
      const want = placeAddress()
      if (!same(q, want)) setParams(written(q, want), { replace: true })
    }
    const offs = [usePlace.subscribe(write), useThreadView.subscribe(write), useDocsAt.subscribe(write)]
    return () => offs.forEach((off) => off())
  }, [setParams])
  // Something else wrote the address (a focus, another canvas) and left the place's keys out: put them back.
  useEffect(() => {
    const want = placeAddress()
    if (!same(params, want)) setParams(written(params, want), { replace: true })
  }, [params, setParams])
}
