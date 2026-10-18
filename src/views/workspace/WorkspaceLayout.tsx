// /workspaces/:wid/*: loads one workspace and everything in it once, then renders the current view (D-036, D-040).
import { useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useLocation, useParams } from 'react-router-dom'
import { focusPath, WORKSPACES, workspacePath } from '../../app/paths'
import { attachmentBytes, useOrphanSweep } from '../../data/attachments'
import { useAuth } from '../../data/auth'
import {
  canEditIn,
  describeWorkspace,
  DESCRIPTION_MAX,
  ensureMemberEntry,
  isOwnerOf,
  renameWorkspace,
  useJoinRequests,
  useWorkspace,
} from '../../data/workspaces'
import { fetchReports } from '../../data/reports'
import type { WithId } from '../../data/hooks'
import type { JoinRequest } from '../../data/model'
import { setPresenceSelection, usePresenceSession, type PresenceView } from '../../data/presence'
import { useWorkspaceData } from '../../data/workspaceData'
import { useCanvas } from '../../state/canvasStore'
import { useHoldCurtain } from '../../state/curtain'
import { useWsView } from '../../state/workspaceView'
import { AiChat } from '../../ui/AiChat'
import { AsciiButton } from '../../ui/AsciiButton'
import { DecodeText } from '../../ui/DecodeText'
import { Hud } from '../../ui/Hud'
import { AutosaveField } from '../../ui/AutosaveField'
import { InlineEdit } from '../../ui/InlineEdit'
import { PeopleHere } from '../../ui/PeopleHere'
import { Note, Row, Section, type WorkspacePage } from '../../ui/Settings'
import { firebase } from '../../data/firebase'
import { PeopleSettings } from './PeopleSettings'
import { useViewerLock } from './viewerLock'
import { Toast } from '../../ui/Toast'
import { forgetCamera } from '../canvas/Board'
import { lastFocus } from '../canvas/focus'
import { attachmentEntry, download, fileSlug, makeBundle, zipBundle } from '../../io/bundle'
import { matrixTsv } from '../../io/tsv'
import { useWs, WorkspaceContext, type WorkspaceCtx } from './context'
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
  const { user } = useAuth()
  const { data, isLoading } = useWorkspaceData(wid)
  useHoldCurtain('board', isLoading)
  // Attachment files nobody points at any more, at most once a day (D-083).
  useOrphanSweep(wid)
  const ctx = useMemo<WorkspaceCtx>(() => ({ ...data, wid, workspace }), [data, wid, workspace])
  const load = useWsView((s) => s.load)
  useEffect(() => load(wid), [load, wid])
  // Opening a workspace frames all its cards; switching views inside it keeps your place.
  // During the first render, so it's done before the board below reads its camera.
  useState(() => forgetCamera(wid))
  const isOwner = isOwnerOf(workspace, user?.id)
  // Only owners may list who's asking (D-098); any of them settles a request.
  const requests = useJoinRequests(isOwner ? wid : null)
  // Your name in the people list (D-098), written when it's missing or changed.
  useEffect(() => {
    if (user) ensureMemberEntry(wid, user).catch(() => {})
  }, [wid, user])
  // Viewers read only (D-098): the app is locked like the preview, writes are refused underneath.
  useViewerLock(!canEditIn(workspace, user?.id))
  // Presence (D-065): who's here, on which view, and what they have selected.
  const view = viewOf(useLocation().pathname, wid)
  usePresenceSession(wid, user, view)
  const selectedId = useCanvas((s) => s.selectedId)
  const selection = useCanvas((s) => s.selection)
  useEffect(() => setPresenceSelection(selectedId, selection), [selectedId, selection])

  return (
    <WorkspaceContext.Provider value={ctx}>
      {/* The app's box: everything fixed inside is laid out in it, so it all makes room for the assistant's window (D-081). */}
      <div className={styles.app} data-app>
        <Hud
          crumbs={[
            { label: 'workspaces', to: WORKSPACES },
            // Renaming lives in settings and on the workspaces page, not here.
            { label: workspace.name },
          ]}
          views={[
            { label: 'board', to: workspacePath(wid), end: true },
            // The selected card's chain (D-127), or the last one focused here.
            { label: 'focus', to: focusPath(wid, selectedId ?? lastFocus(wid)) },
            { label: 'flow', to: workspacePath(wid, 'flow') },
            { label: 'table', to: workspacePath(wid, 'table') },
            { label: 'matrix', to: workspacePath(wid, 'matrix') },
            { label: 'reports', to: workspacePath(wid, 'reports') },
          ]}
          right={<PeopleHere wid={wid} view={view} />}
          settings={(page) => <WorkspaceSettings page={page} wid={wid} workspace={workspace} requests={requests.data} />}
          settingsName={workspace.name}
          settingsBadge={requests.data.length}
        />
        {!isLoading && <Outlet />}
        <EditKeys />
        <Toast />
      </div>
      {!isLoading && <AiChat />}
    </WorkspaceContext.Provider>
  )
}

function viewOf(path: string, wid: string): PresenceView {
  const rest = path.slice(workspacePath(wid).length).replace(/^\//, '').split('/')[0]
  // The focus view is the board with most of it hidden (D-127): same places, so cursors and follow still line up.
  return rest === 'flow' || rest === 'table' || rest === 'matrix' || rest === 'reports' ? rest : 'board'
}

function EditKeys() {
  useEditKeys()
  return null
}

// The workspace's pages in the settings modal (D-054, D-064, D-097): general (name, what we're building), people
// (PeopleSettings.tsx: members and roles, requests, invites, the code; D-062, D-098) and export (D-080).
type SettingsProps = { page: WorkspacePage; wid: string; workspace: WorkspaceCtx['workspace']; requests: WithId<JoinRequest>[] }

function WorkspaceSettings({ page, wid, workspace, requests }: SettingsProps) {
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()
  const editor = canEditIn(workspace, user?.id)

  if (page === 'export') return <ExportSection />
  if (page === 'people') return <PeopleSettings wid={wid} workspace={workspace} requests={requests} />

  const run = (p: Promise<unknown>) => {
    setError(null)
    p.catch((e: Error) => setError(e.message))
  }
  return (
    <>
      <Section label="about" note={editor ? undefined : "You're a viewer here: an owner can make you an editor."}>
        <Row label="name" hint="Shown in the breadcrumb and on the workspaces page.">
          {editor ? <InlineEdit label="workspace" value={workspace.name} onSave={(n) => renameWorkspace(wid, n)} /> : <span>{workspace.name}</span>}
        </Row>
        <Row label="what we're building" hint="A sentence or two. The assistant reads it first.">
          {editor ? (
            <AutosaveField
              multiline
              rows={3}
              className={`${styles.input} ${styles.about}`}
              label="what we're building"
              placeholder="e.g. Tablebook: shift scheduling for independent restaurants"
              maxLength={DESCRIPTION_MAX}
              value={workspace.description ?? ''}
              onSave={(d) => run(describeWorkspace(wid, d))}
            />
          ) : (
            <span>{workspace.description || 'not written yet'}</span>
          )}
        </Row>
      </Section>
      {error && <Note tone="error">! {error}</Note>}
    </>
  )
}

// Export (D-080): the whole workspace as a file you can import again, the matrix for a spreadsheet, the board as a picture.
function ExportSection() {
  const ws = useWs()
  const snapshot = useCanvas((s) => s.snapshot)
  const [busy, setBusy] = useState(false)
  const [zipping, setZipping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const slug = fileSlug(ws.workspace.name)
  const date = new Date().toISOString().slice(0, 10)

  // Attachment files (D-083) are fetched only now, one by one; a missing one is left out of the zip.
  const bundle = async () => {
    setZipping(true)
    setError(null)
    setNote(null)
    try {
      const files: Record<string, Uint8Array> = {}
      let missing = 0
      for (const a of ws.attachments) {
        const bytes = await attachmentBytes(a.path)
        if (bytes) files[attachmentEntry(a.id, a.path)] = bytes
        else missing++
      }
      // Reports aren't loaded with the workspace (D-098): fetched, whole, only now.
      const uid = firebase?.auth.currentUser?.uid
      const reports = uid ? await fetchReports(ws.wid, uid) : []
      download(zipBundle(makeBundle(ws.workspace.name, ws.workspace.description, ws, reports), files), `${slug}-${date}.zip`)
      if (missing) setNote(`${missing} ${missing === 1 ? 'attachment is' : 'attachments are'} missing their file and stayed out of the .zip.`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setZipping(false)
    }
  }
  const tsv = () =>
    download(
      new Blob([matrixTsv(ws.features, ws.competitors, ws.comparisons)], { type: 'text/tab-separated-values;charset=utf-8' }),
      `${slug}-matrix.tsv`,
    )
  const png = async () => {
    if (!snapshot) return
    setBusy(true)
    setError(null)
    try {
      download(await snapshot(), `${slug}-board.png`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const items = ws.customers.length + ws.problems.length + ws.ideas.length + ws.features.length + ws.competitors.length

  return (
    <>
      <Section
        label="files"
        note={
          <>
            <p>
              The .zip holds every item, link, matrix cell, label and attachment, and the research reports you can see. Import it from
              the workspaces page to make a copy you own; members, invite codes and assistant keys stay here.
            </p>
            {note && <p>{note}</p>}
        </>
      }
    >
      <Row label="workspace" hint="Everything, to import again later.">
        <AsciiButton accent="cyan" onClick={() => void bundle()} disabled={zipping}>
          {zipping ? 'packing' : 'download .zip'}
        </AsciiButton>
        <span className={styles.role}>
          {items} {items === 1 ? 'item' : 'items'}, {ws.edges.length} {ws.edges.length === 1 ? 'link' : 'links'}
          {ws.attachments.length > 0 && `, ${ws.attachments.length} ${ws.attachments.length === 1 ? 'file' : 'files'}`}
        </span>
      </Row>
      <Row label="matrix" hint="Features × competitors, for a spreadsheet.">
        <AsciiButton accent="cyan" onClick={tsv} disabled={ws.features.length === 0 || ws.competitors.length === 0}>
          download .tsv
        </AsciiButton>
      </Row>
      <Row label="board" hint="A picture of the whole board as it's filtered now.">
        <AsciiButton accent="cyan" onClick={png} disabled={!snapshot || busy}>
          {busy ? 'drawing' : 'download .png'}
        </AsciiButton>
        {!snapshot && <span className={styles.role}>open the board view first</span>}
      </Row>
    </Section>
    {error && <Note tone="error">! {error}</Note>}
    </>
  )
}

function Status({ text, back }: { text: string; back?: boolean }) {
  return (
    <main className={styles.status}>
      <p>
        <DecodeText text={text} />
      </p>
      {back && (
        <Link to={WORKSPACES} className={styles.backLink}>
          ← back to workspaces
        </Link>
      )}
    </main>
  )
}
