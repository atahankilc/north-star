// /workspaces/:wid: loads one workspace and its canvas (D-036, D-174). There are no pages: the old views are archived
// (src/archive/, D-177) and come back as pieces on the canvas.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { canvasPath, WORKSPACES } from '../../app/paths'
import { useAuth } from '../../data/auth'
import { setReadOnly } from '../../data/history'
import type { WithId } from '../../data/hooks'
import type { JoinRequest } from '../../data/model'
import { KIND_NAME, kindOfPiece } from '../../data/pieces'
import { InboxButton } from './ThreadInbox'
import { Finder } from './Finder'
import { usePresenceSession } from '../../data/presence'
import { useWorkspaceData } from '../../data/workspaceData'
import { canvasOf, MAIN, setCanvasHere } from '../../data/canvases'
import { CanvasCrumb } from './CanvasSwitch'
import { runCells } from '../../ui/Appear'
import { isReducedMotion } from '../../state/motion'
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
import { swapCam } from '../../state/canvasView'
import { useHoldCurtain } from '../../state/curtain'
import { AsciiButton } from '../../ui/AsciiButton'
import { AutosaveField } from '../../ui/AutosaveField'
import { DecodeText } from '../../ui/DecodeText'
import { Hud } from '../../ui/Hud'
import { InlineEdit } from '../../ui/InlineEdit'
import { PeopleHere } from '../../ui/PeopleHere'
import { Note, Row, Section, type WorkspacePage } from '../../ui/Settings'
import { Toast } from '../../ui/Toast'
import { CanvasView } from './CanvasView'
import { useWorkspaceStore, WorkspaceContext, type WorkspaceCtx } from './context'
import { PeopleSettings } from './PeopleSettings'
import { SideNav } from './SideNav'
import { exportWorkspace } from '../../data/exportWorkspace'
import { download, fileSlug, zipBundle } from '../../io/bundle'
import { useEditKeys } from './useEditKeys'
import { Coach } from '../../onboarding/Coach'
import styles from './WorkspaceLayout.module.css'

const VIEWER = "You're a viewer in this workspace: an owner can make you an editor."

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
  useHoldCurtain('canvas', isLoading)
  const [params] = useSearchParams()
  // A plane in focus (D-184) is the view: its name ends the breadcrumb, and the canvas's `+` goes away.
  const focusId = params.get('focus')
  const focused = focusId ? data.pieces.find((p) => p.id === focusId) : undefined
  // The canvas (D-302): the focused piece's, else `?canvas=` when it's one of them, else the first.
  const asked = params.get('canvas')
  // A piece on the canvas asked for through a spot (D-302's session 3) stays on it.
  const sharedHere = !!focused && !!asked && data.spots.some((s) => s.pieceId === focused.id && s.canvasId === asked)
  const canvas = focused && !sharedHere ? canvasOf(focused) : asked && (isLoading || data.canvases.some((c) => c.id === asked)) ? asked : MAIN
  const shown = useShownCanvas(wid, canvas)
  const ctx = useMemo<WorkspaceCtx>(() => ({ ...data, wid, workspace, canvas: shown }), [data, wid, workspace, shown])
  const store = useWorkspaceStore(ctx)
  const isOwner = isOwnerOf(workspace, user?.id)
  const editor = canEditIn(workspace, user?.id)
  // Only owners may list who's asking (D-098); any of them settles a request.
  const requests = useJoinRequests(isOwner ? wid : null)
  // Your name in the people list (D-098), written when it's missing or changed.
  useEffect(() => {
    if (user) ensureMemberEntry(wid, user).catch(() => {})
  }, [wid, user])
  // Viewers read only (D-098): tracked writes are refused with a toast, and the canvas makes and moves nothing.
  useEffect(() => {
    if (editor) return
    setReadOnly(VIEWER, 'viewer')
    return () => setReadOnly(null, 'viewer')
  }, [editor])
  // Presence (D-065): who's here. The canvas is the only view (D-174), on one of the canvases (D-302).
  usePresenceSession(wid, user, 'canvas', shown)
  useEditKeys(wid)
  // With one canvas the workspace's name opens the canvases (D-302); with more, the canvas's own crumb does.
  const several = data.canvases.length > 1
  const canvasName = data.canvases.find((c) => c.id === shown)?.name ?? ''

  return (
    <WorkspaceContext.Provider value={store}>
      <div className={styles.app} data-app>
        <Hud
          crumbs={[
            { label: 'workspaces', to: WORKSPACES },
            several
              ? { label: workspace.name, to: canvasPath(wid, MAIN) }
              : focused
                ? { label: workspace.name, to: canvasPath(wid, shown) }
                : { label: isLoading ? workspace.name : <CanvasCrumb label={workspace.name} current /> },
            ...(several ? [focused ? { label: canvasName, to: canvasPath(wid, shown) } : { label: <CanvasCrumb label={canvasName} current /> }] : []),
            // A document on its own goes by its document's title (D-232).
            ...(focused ? [{ label: focused.name || data.documents.find((d) => d.id === focused.docId)?.title || KIND_NAME[kindOfPiece(focused)] }] : []),
          ]}
          settings={(page) => <WorkspaceSettings page={page} wid={wid} workspace={workspace} requests={requests.data} />}
          settingsName={workspace.name}
          settingsBadge={requests.data.length}
          corner={
            <>
              {/* Who's here, then the threads, just above your square (D-193). */}
              <PeopleHere />
              <InboxButton wid={wid} threads={data.threads} />
            </>
          }
          side={<SideNav wid={wid} focused={focused} editor={editor} />}
        />
        {/* One per canvas (D-302): going to another builds it anew, its camera its own. */}
        {!isLoading && <CanvasView key={shown} />}
        {!isLoading && <Finder />}
        <Toast />
        <Coach />
      </div>
    </WorkspaceContext.Provider>
  )
}

// The canvas shown (D-302) as it follows the one asked for: the old one breaks cell by cell, then the cameras swap (each
// canvas keeps its own) and the new one builds. The first one, and reduced motion, at once.
function useShownCanvas(wid: string, canvas: string) {
  const [shown, setShown] = useState(canvas)
  // New things go on the canvas shown.
  setCanvasHere(shown)
  const built = useRef(false)
  const swapped = useRef(false)
  const canvasEl = () => document.querySelector<HTMLElement>('[data-app] [role="application"][aria-label="Canvas"]')
  useLayoutEffect(() => {
    if (canvas === shown) return
    const swap = () => {
      swapCam(wid, shown, canvas)
      swapped.current = true
      setShown(canvas)
    }
    const el = canvasEl()
    if (!built.current || !el || isReducedMotion()) return swap()
    return runCells(el, 'exit', 0, 200, swap)
  }, [wid, canvas, shown])
  // Once the canvas has been on screen: a canvas found only as the workspace loads (a focused plane's) isn't animated.
  useEffect(() => void (built.current ||= !!canvasEl()))
  useLayoutEffect(() => {
    const el = canvasEl()
    if (!swapped.current || !el) return
    swapped.current = false
    return runCells(el, 'enter', 0, 320)
  }, [shown])
  return shown
}

// The workspace's pages in the settings modal (D-054, D-064, D-097): general (name, what we're building) and people
// (PeopleSettings.tsx: members and roles, requests, invites, the code; D-062, D-098) and export (D-080, D-246).
type SettingsProps = { page: WorkspacePage; wid: string; workspace: WorkspaceCtx['workspace']; requests: WithId<JoinRequest>[] }

function WorkspaceSettings({ page, wid, workspace, requests }: SettingsProps) {
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()
  const editor = canEditIn(workspace, user?.id)

  if (page === 'people') return <PeopleSettings wid={wid} workspace={workspace} requests={requests} />
  if (page === 'export') return <ExportSection wid={wid} workspace={workspace} />

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

// The whole workspace as a .zip (D-246), read fresh when asked; what was packed is said after.
function ExportSection({ wid, workspace }: { wid: string; workspace: WorkspaceCtx['workspace'] }) {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [packed, setPacked] = useState<string | null>(null)

  const run = async () => {
    if (!user) return
    setBusy(true)
    setError(null)
    setPacked(null)
    try {
      const { bundle, leftOut } = await exportWorkspace(wid, user.id, workspace)
      download(zipBundle(bundle), `${fileSlug(workspace.name)}-${new Date().toISOString().slice(0, 10)}.zip`)
      const cards = bundle.customers.length + bundle.problems.length + bundle.competitors.length + bundle.ideas.length + bundle.features.length + bundle.packages.length
      const n = (count: number, one: string) => `${count} ${one}${count === 1 ? '' : 's'}`
      setPacked(
        `Packed ${n(bundle.pieces.length, 'piece')}, ${n(cards, 'card')}, ${n(bundle.edges.length, 'link')}, ${n(bundle.labels.length, 'text item')}, ` +
          `${n(bundle.cells.length, 'cell')} and ${n(bundle.documents.length, 'document')}.` +
          (leftOut ? ` ${n(leftOut, 'file')} (images, PDFs) stayed behind: files can't travel until Storage is live.` : ''),
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Section
        label="files"
        note={
          <>
            <p>
              The .zip holds everything on every canvas (and the canvases themselves): planes and their cards, links,
              evidence, competitor features, packages, text, matrices and tables with their cells, and the documents you can see. Import it from the workspaces page to
              make a copy you own. Members, invite codes and comment threads stay here.
            </p>
            {packed && <p>{packed}</p>}
          </>
        }
      >
        <Row label="workspace" hint="Everything, to import again later.">
          <AsciiButton accent="cyan" onClick={() => void run()} disabled={busy}>
            {busy ? 'packing' : 'download .zip'}
          </AsciiButton>
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
