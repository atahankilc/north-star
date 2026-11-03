// The workspace's code is its own chunk, loaded when a workspace opens (and fetched ahead once you're signed in). Pages
// drops the old chunks when a new version deploys, so a tab opened before that can't load them: it reloads once, onto
// the new version. Not again within a minute, so a chunk that really can't load shows its error (App's `Crash`)
// instead of looping.
import type { ComponentType } from 'react'

const RELOADED = 'north-star.chunk-reload'
const RELOAD_GAP_MS = 60_000 // tokens-ok: how long a reload counts as just done, not a design value

// Reloads the tab unless it did so a moment ago; says whether it did. With storage blocked it can't tell, so it never
// reloads by itself (it could loop): the error shows, with its own reload button.
function reloaded(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOADED) ?? 0)
    if (Date.now() - last <= RELOAD_GAP_MS) return false
    sessionStorage.setItem(RELOADED, String(Date.now()))
  } catch {
    return false
  }
  location.reload()
  return true
}

function reloadOnce(error: unknown): never {
  reloaded()
  throw error
}

export const loadWorkspace = () => import('../views/workspace/canvas/WorkspaceLayout').catch(reloadOnce)

// A chunk the page can do without (the onboarding's coach on the workspaces page): reloads once like the workspace's,
// and past that draws nothing rather than taking the page down.
export function loadOptional<P extends object>(load: () => Promise<ComponentType<P>>): Promise<{ default: ComponentType<P> }> {
  return load().then(
    (c) => ({ default: c }),
    () => {
      reloaded()
      return { default: () => null }
    },
  )
}

// Fetched while nothing else is going on, so opening a workspace doesn't wait for it. A failed fetch here only waits:
// opening one reloads if need be.
export function fetchWorkspaceAhead() {
  const go = () => void import('../views/workspace/canvas/WorkspaceLayout').catch(() => {})
  if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 3000 })
  else setTimeout(go, 1500)
}
