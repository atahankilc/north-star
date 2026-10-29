// Every app URL in one place (D-070). Plain paths under the Pages base, no `#`:
//   /                                   landing
//   /workspaces                         your workspaces
//   /workspaces/<id>                    a workspace's canvas (D-174); there are no other pages
//   /workspaces/<id>?canvas=<c>         another of its canvases (D-302)
export const WORKSPACES = '/workspaces'

export function workspacePath(wid: string) {
  return `${WORKSPACES}/${wid}`
}

// One of its canvases (D-302): `?canvas=<id>`, left out for the first (`main`, src/data/canvases.ts).
// With a focus it's said for `main` too: a piece shown there through a spot (D-302's session 3) stays there.
export const canvasParams = (canvas: string, rest: Record<string, string> = {}): Record<string, string> => (canvas === 'main' && !rest.focus ? rest : { canvas, ...rest })
export function canvasPath(wid: string, canvas: string) {
  return canvas === 'main' ? workspacePath(wid) : `${workspacePath(wid)}?canvas=${encodeURIComponent(canvas)}`
}
