// Every app URL in one place (D-070). Plain paths under the Pages base, no `#`:
//   /                                   landing
//   /workspaces                         your workspaces
//   /workspaces/<id>                    a workspace's canvas (D-174); there are no other pages (D-177)
// The old views' paths are in src/archive/app/paths.ts.
export const WORKSPACES = '/workspaces'

export function workspacePath(wid: string) {
  return `${WORKSPACES}/${wid}`
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
