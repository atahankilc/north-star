// Every app URL in one place (D-070). Plain paths under the Pages base, no `#`:
//   /                                   landing
//   /workspaces                         your workspaces
//   /workspaces/<id>                    a workspace's board
//   /workspaces/<id>/flow|table|matrix  its other views
//   /workspaces/<id>/reports            saved research reports (D-090); ?report=<id> is one as a page
//   ?item=<id>                          selects an item (board); &feature=<id> opens a competitor's feature
import type { PresenceView } from '../data/presence'

export const WORKSPACES = '/workspaces'

export function workspacePath(wid: string, view: PresenceView = 'board') {
  return view === 'board' ? `${WORKSPACES}/${wid}` : `${WORKSPACES}/${wid}/${view}`
}

export function itemPath(wid: string, itemId: string, featureId?: string) {
  return `${workspacePath(wid)}?item=${itemId}${featureId ? `&feature=${featureId}` : ''}`
}

export function reportPath(wid: string, reportId: string) {
  return `${workspacePath(wid, 'reports')}?report=${reportId}`
}

// Links from before D-070 looked like `/#/w/<id>/table?n=<id>&f=<id>`. Rewrite them in place before the router starts.
export function upgradeLegacyUrl() {
  const { hash } = window.location
  if (!hash.startsWith('#/')) return
  const url = new URL(hash.slice(1), window.location.origin)
  const path = url.pathname.replace(/^\/w(?=\/|$)/, WORKSPACES)
  const params = new URLSearchParams()
  for (const [k, v] of url.searchParams) params.set(k === 'n' ? 'item' : k === 'f' ? 'feature' : k, v)
  const query = params.toString()
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  window.history.replaceState(null, '', `${base}${path}${query ? `?${query}` : ''}`)
}
