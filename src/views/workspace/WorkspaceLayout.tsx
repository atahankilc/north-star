// /workspaces/:wid: loads one workspace and its canvas (D-036, D-174). There are no pages: the old views are archived
// (src/archive/, D-177) and come back as pieces on the canvas.
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { WORKSPACES, workspacePath } from '../../app/paths'
import { useAuth } from '../../data/auth'
import { setReadOnly } from '../../data/history'
import type { WithId } from '../../data/hooks'
import type { JoinRequest, PieceKind } from '../../data/model'
import { addPiece } from '../../data/pieces'
import { addCard, CARD_TYPES, type CardType } from '../../data/cards'
import { addLabel, CANVAS, PARA_W, STICKY_W, TITLE_W } from '../../data/labels'
import { snap } from '../../data/grid'
import { labelBox, useAuthor } from './TextItems'
import { spaceBounds } from './spaceBounds'
import { TYPE_ACCENT } from './PlaneCards'
import { InboxButton } from './ThreadInbox'
import { usePresenceSession } from '../../data/presence'
import { useWorkspaceData } from '../../data/workspaceData'
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
import { canvasCenter, fitCanvas, fitPlane, useCanvasView } from '../../state/canvasView'
import { useHoldCurtain } from '../../state/curtain'
import { AutosaveField } from '../../ui/AutosaveField'
import { DecodeText } from '../../ui/DecodeText'
import { Hud } from '../../ui/Hud'
import { InlineEdit } from '../../ui/InlineEdit'
import { Menu } from '../../ui/Menu'
import { PeopleHere } from '../../ui/PeopleHere'
import { Note, Row, Section, type WorkspacePage } from '../../ui/Settings'
import { Toast } from '../../ui/Toast'
import { CanvasView } from './CanvasView'
import { useWs, WorkspaceContext, type WorkspaceCtx } from './context'
import { PeopleSettings } from './PeopleSettings'
import { useEditKeys } from './useEditKeys'
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
  const ctx = useMemo<WorkspaceCtx>(() => ({ ...data, wid, workspace }), [data, wid, workspace])
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
  // Presence (D-065): who's here. The canvas is the only view (D-174).
  usePresenceSession(wid, user, 'canvas')
  useEditKeys(wid)
  // A plane in focus (D-184) is the view: its name ends the breadcrumb, and the canvas's `+` goes away.
  const focusId = useSearchParams()[0].get('focus')
  const focused = focusId ? data.pieces.find((p) => p.id === focusId) : undefined

  return (
    <WorkspaceContext.Provider value={ctx}>
      <div className={styles.app} data-app>
        <Hud
          crumbs={[
            { label: 'workspaces', to: WORKSPACES },
            focused ? { label: workspace.name, to: workspacePath(wid) } : { label: workspace.name },
            ...(focused ? [{ label: focused.name || 'plane' }] : []),
          ]}
          right={<PeopleHere />}
          settings={(page) => <WorkspaceSettings page={page} wid={wid} workspace={workspace} requests={requests.data} />}
          settingsName={workspace.name}
          settingsBadge={requests.data.length}
          side={
            <>
              {editor && <AddToCanvas wid={wid} plane={focused?.id ?? null} />}
              <FitButton wid={wid} plane={focused?.id ?? null} />
              <InboxButton wid={wid} threads={data.threads} />
            </>
          }
        />
        {!isLoading && <CanvasView />}
        <Toast />
      </div>
    </WorkspaceContext.Provider>
  )
}

// The side nav's fit (D-186), under the `+`; `0` does the same: everything on the canvas in view, or in focus the plane's
// contents centred and fitted.
function FitButton({ wid, plane }: { wid: string; plane: string | null }) {
  const { pieces, cards, labels } = useWs()
  const focused = plane !== null
  return (
    <button
      className={styles.fit}
      aria-label={focused ? 'Fit the plane to the screen' : 'Fit everything on the canvas'}
      title={focused ? 'fit the plane (0)' : 'fit everything (0)'}
      onClick={() =>
        focused
          ? fitPlane(spaceBounds(cards.filter((c) => c.pieceId === plane), labels.filter((l) => l.pieceId === plane)))
          : fitCanvas(wid, [...pieces, ...labels.filter((l) => l.pieceId === CANVAS).map(labelBox)])
      }
    >
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <path d="M1 6V1h5M12 1h5v5M17 12v5h-5M6 17H1v-5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <rect x="6" y="6" width="6" height="6" fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>
    </button>
  )
}

// The side nav's `+` (D-176): on the canvas a plane (D-180) at the middle of the screen, selected; in a focused plane a
// card (D-187), at the middle of its view, its title ready to type. In both, text (D-188): a heading, a paragraph or a
// sticky note in the middle, typed at once; a section drawn with the crosshair; the project title (on the canvas, one).
// Viewers make nothing (D-098).
function AddToCanvas({ wid, plane }: { wid: string; plane: string | null }) {
  const { pieces, cards, labels } = useWs()
  const me = useAuthor()
  const hasTitle = labels.some((l) => l.kind === 'title')
  // The middle of the screen in the open space's px.
  const middle = (): [number, number] | null => {
    const { planeCam: c, size } = useCanvasView.getState()
    if (!plane) return canvasCenter(wid)
    return c ? [(size.w / 2 - c.ox) / c.zoom, (size.h / 2 - c.oy) / c.zoom] : null
  }
  const addText = async (what: 'heading' | 'paragraph' | 'sticky' | 'title') => {
    const at = middle()
    if (!at) return
    const space = plane ?? CANVAS
    const fields =
      what === 'heading'
        ? { size: 'heading' as const, w: undefined, dx: 150, dy: 30 }
        : what === 'paragraph'
          ? { size: 'note' as const, w: PARA_W.initial, dx: PARA_W.initial / 2, dy: 40 }
          : what === 'sticky'
            ? { kind: 'sticky' as const, w: STICKY_W.initial, color: 'yellow' as const, ...me, dx: STICKY_W.initial / 2, dy: 50 }
            : { kind: 'title' as const, w: TITLE_W.initial, dx: TITLE_W.initial / 2, dy: 80 }
    const { dx, dy, ...rest } = fields
    const id = await addLabel(wid, { pieceId: space, text: '', ...rest, x: snap(at[0] - dx), y: snap(at[1] - dy) })
    useCanvasView.setState({ labelSelected: id, labelEditing: id, cardSelected: null, selected: null })
  }
  const text = [
    { key: 'text', heading: 'text' },
    { key: 'heading', label: 'heading', glyph: 'T', onSelect: () => void addText('heading') },
    { key: 'paragraph', label: 'paragraph', glyph: '¶', onSelect: () => void addText('paragraph') },
    { key: 'sticky', label: 'sticky note', glyph: '▤', tone: 'var(--accent-yellow)', onSelect: () => void addText('sticky') },
    { key: 'section', label: 'section', glyph: '⬚', hint: 'draw', onSelect: () => useCanvasView.setState({ drawing: plane ?? CANVAS }) },
    // The project title goes on the canvas only, once (D-190).
    ...(hasTitle || plane ? [] : [{ key: 'title', label: 'project title', glyph: '✦', onSelect: () => void addText('title') }]),
  ]
  const add = async (kind: PieceKind) => {
    const id = await addPiece(wid, kind, canvasCenter(wid), pieces)
    useCanvasView.setState({ selected: id })
  }
  const addHere = async (type: CardType) => {
    const { planeCam: c, size } = useCanvasView.getState()
    if (!plane || !c) return
    const at: [number, number] = [(size.w / 2 - c.ox) / c.zoom, (size.h / 2 - c.oy) / c.zoom]
    const id = await addCard(wid, plane, type, at, cards.filter((x) => x.pieceId === plane))
    useCanvasView.setState({ cardSelected: id, cardEditing: id })
  }
  return (
    <Menu
      icon
      right
      label={
        // Drawn, not a glyph: a font's `+` is small and sits off centre.
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
          <path d="M10 2v16M2 10h16" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      }
      ariaLabel={plane ? 'Add to the plane' : 'Add to the canvas'}
      items={
        plane
          ? [
              { key: 'cards', heading: 'card' },
              ...CARD_TYPES.map((t) => ({ key: t, label: t, glyph: '▌', tone: TYPE_ACCENT[t], onSelect: () => void addHere(t) })),
              ...text,
            ]
          : [
              { key: 'canvas', heading: 'on the canvas' },
              { key: 'plane', label: 'plane', glyph: '▦', onSelect: () => void add('plane') },
              ...text,
            ]
      }
    />
  )
}

// The workspace's pages in the settings modal (D-054, D-064, D-097): general (name, what we're building) and people
// (PeopleSettings.tsx: members and roles, requests, invites, the code; D-062, D-098). Export (D-080) is archived (D-177).
type SettingsProps = { page: WorkspacePage; wid: string; workspace: WorkspaceCtx['workspace']; requests: WithId<JoinRequest>[] }

function WorkspaceSettings({ page, wid, workspace, requests }: SettingsProps) {
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()
  const editor = canEditIn(workspace, user?.id)

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
