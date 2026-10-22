// Every app URL in one place (D-070). Plain paths under the Pages base, no `#`:
//   /                                   landing
//   /workspaces                         your workspaces
//   /workspaces/<id>                    a workspace's canvas (D-174); there are no other pages
export const WORKSPACES = '/workspaces'

export function workspacePath(wid: string) {
  return `${WORKSPACES}/${wid}`
}
