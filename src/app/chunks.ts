// The workspace's code is its own chunk, loaded when a workspace opens (and fetched ahead once you're signed in). Pages
// drops the old chunks when a new version deploys, so a tab opened before that can't load them: it reloads once, onto
// the new version. Not again within a minute, so a chunk that really can't load shows its error instead of looping.
const RELOADED = 'north-star.chunk-reload'

function reloadOnce(error: unknown): never {
  const last = Number(sessionStorage.getItem(RELOADED) ?? 0)
  if (Date.now() - last > 60_000) {
    sessionStorage.setItem(RELOADED, String(Date.now()))
    location.reload()
  }
  throw error
}

export const loadWorkspace = () => import('../views/workspace/WorkspaceLayout').catch(reloadOnce)

// Fetched while nothing else is going on, so opening a workspace doesn't wait for it. A failed fetch here only waits:
// opening one reloads if need be.
export function fetchWorkspaceAhead() {
  const go = () => void import('../views/workspace/WorkspaceLayout').catch(() => {})
  if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 3000 })
  else setTimeout(go, 1500)
}
