// /w/:wid/*: loads one workspace and everything in it once, then renders the current view (D-036, D-040).
import { useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useParams } from 'react-router-dom'
import { useAuth } from '../../data/auth'
import { renameWorkspace, useWorkspace } from '../../data/workspaces'
import { useWorkspaceData } from '../../data/workspaceData'
import { useHoldCurtain } from '../../state/curtain'
import { useWsView } from '../../state/workspaceView'
import { AsciiButton } from '../../ui/AsciiButton'
import { DecodeText } from '../../ui/DecodeText'
import { Hud } from '../../ui/Hud'
import { InlineEdit } from '../../ui/InlineEdit'
import { Row, Section } from '../../ui/Settings'
import { Toast } from '../../ui/Toast'
import { WorkspaceContext, type WorkspaceCtx } from './context'
import { useEditKeys } from './useEditKeys'
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
  const load = useWsView((s) => s.load)
  useEffect(() => load(wid), [load, wid])

  return (
    <WorkspaceContext.Provider value={ctx}>
      <Hud
        crumbs={[
          { label: 'workspaces', to: '/w' },
          { label: <InlineEdit label="workspace" value={workspace.name} onSave={(n) => renameWorkspace(wid, n)} /> },
        ]}
        views={[
          { label: 'board', to: `/w/${wid}`, end: true },
          { label: 'flow', to: `/w/${wid}/flow` },
          { label: 'table', to: `/w/${wid}/table` },
          { label: 'matrix', to: `/w/${wid}/matrix` },
        ]}
        settings={<WorkspaceSettings wid={wid} workspace={workspace} />}
      />
      {!isLoading && <Outlet />}
      <EditKeys />
      <Toast />
    </WorkspaceContext.Provider>
  )
}

function EditKeys() {
  useEditKeys()
  return null
}

// The workspace's part of the settings modal (D-054): its name, who's in it, and the code to invite more.
function WorkspaceSettings({ wid, workspace }: { wid: string; workspace: WorkspaceCtx['workspace'] }) {
  const [copied, setCopied] = useState(false)
  const { user } = useAuth()
  const code = workspace.inviteCode
  const pretty = `${code.slice(0, 4)}-${code.slice(4)}`
  const members = workspace.memberIds.length
  const role = user ? workspace.roles[user.id] : undefined

  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Section label="this workspace">
      <Row label="name">
        <InlineEdit label="workspace" value={workspace.name} onSave={(n) => renameWorkspace(wid, n)} />
      </Row>
      <Row label="members">
        {members} {members === 1 ? 'person' : 'people'}
        {role && <span className={styles.role}>you're the {role}</span>}
      </Row>
      <Row label="invite code">
        <span className={styles.code}>{pretty}</span>
        <AsciiButton accent="cyan" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </AsciiButton>
      </Row>
      <p className={styles.hint}>Anyone signed in can join with this code from their workspaces page.</p>
    </Section>
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
