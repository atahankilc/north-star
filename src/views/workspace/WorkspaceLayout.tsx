// /w/:wid/*: loads one workspace and everything in it once, then renders the current view (D-036).
import { useMemo, useState } from 'react'
import { Link, Outlet, useParams } from 'react-router-dom'
import { renameWorkspace, useWorkspace } from '../../data/workspaces'
import { useWorkspaceData } from '../../data/workspaceData'
import { useHoldCurtain } from '../../state/curtain'
import { Appear } from '../../ui/Appear'
import { DecodeText } from '../../ui/DecodeText'
import { Hud } from '../../ui/Hud'
import { InlineEdit } from '../../ui/InlineEdit'
import { WorkspaceContext, type WorkspaceCtx } from './context'
import styles from './WorkspaceLayout.module.css'

export function WorkspaceLayout() {
  const { wid = '' } = useParams()
  const workspace = useWorkspace(wid)
  useHoldCurtain('workspace', workspace.isLoading)

  if (workspace.isLoading) return <Status text="Loading workspace" />
  if (workspace.error || !workspace.data) {
    return <Status text="Workspace not found, or you're not a member" back />
  }
  return <Loaded wid={wid} workspace={workspace.data} />
}

function Loaded({ wid, workspace }: { wid: string; workspace: WorkspaceCtx['workspace'] }) {
  const { data, isLoading } = useWorkspaceData(wid)
  useHoldCurtain('board', isLoading)
  const ctx = useMemo<WorkspaceCtx>(() => ({ ...data, wid, workspace }), [data, wid, workspace])
  const base = `/w/${wid}`

  return (
    <WorkspaceContext.Provider value={ctx}>
      <Hud
        crumbs={[
          { label: 'workspaces', to: '/w' },
          { label: <InlineEdit label="workspace" value={workspace.name} onSave={(n) => renameWorkspace(wid, n)} /> },
        ]}
        tabs={[
          { label: 'ideas', to: base, end: true },
          { label: 'features', to: `${base}/features` },
          { label: 'competitors', to: `${base}/competitors` },
          { label: 'matrix', to: `${base}/matrix` },
        ]}
        right={<InviteChip code={workspace.inviteCode} />}
      />
      {!isLoading && <Outlet />}
    </WorkspaceContext.Provider>
  )
}

function InviteChip({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const pretty = `${code.slice(0, 4)}-${code.slice(4)}`

  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Appear as="button" className={styles.invite} onClick={copy} title="Copy invite code">
      <span className={styles.inviteLabel}>{copied ? 'copied' : 'invite'}</span>
      <span className={styles.code}>{pretty}</span>
    </Appear>
  )
}

function Status({ text, back }: { text: string; back?: boolean }) {
  return (
    <main className={styles.status}>
      <p>
        <DecodeText text={text} />
      </p>
      {back && (
        <Link to="/w" className={styles.backLink}>
          ← back to workspaces
        </Link>
      )}
    </main>
  )
}
