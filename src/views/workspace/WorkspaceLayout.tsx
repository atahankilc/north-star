// /w/:wid/*: loads one workspace and everything in it once, then renders the current view (D-036, D-040).
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, Outlet, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '../../data/auth'
import {
  approveJoinRequest,
  denyJoinRequest,
  inviteEmail,
  isEmail,
  normalizeEmail,
  renameWorkspace,
  renewInviteCode,
  uninviteEmail,
  useRequestsToMe,
  useWorkspace,
} from '../../data/workspaces'
import type { WithId } from '../../data/hooks'
import type { JoinRequest } from '../../data/model'
import { setPresenceSelection, usePresenceSession, type PresenceView } from '../../data/presence'
import { useWorkspaceData } from '../../data/workspaceData'
import { useCanvas } from '../../state/canvasStore'
import { useHoldCurtain } from '../../state/curtain'
import { useWsView } from '../../state/workspaceView'
import { AsciiButton } from '../../ui/AsciiButton'
import { DecodeText } from '../../ui/DecodeText'
import { Hud } from '../../ui/Hud'
import { InlineEdit } from '../../ui/InlineEdit'
import { PeopleHere } from '../../ui/PeopleHere'
import { Row, Section } from '../../ui/Settings'
import { Toast } from '../../ui/Toast'
import { forgetCamera } from '../canvas/Board'
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
  // Opening a workspace frames all its cards; switching views inside it keeps your place.
  // During the first render, so it's done before the board below reads its camera.
  useState(() => forgetCamera(wid))
  const { user } = useAuth()
  const isOwner = user?.id === workspace.ownerId
  // Non-owners query their own (empty) slice, which the rules allow; the badge only counts for the owner.
  const requests = useRequestsToMe(user?.id ?? '', wid)
  // Presence (D-065): who's here, on which view, and what they have selected.
  const view = viewOf(useLocation().pathname, wid)
  usePresenceSession(wid, user, view)
  const selectedId = useCanvas((s) => s.selectedId)
  useEffect(() => setPresenceSelection(selectedId), [selectedId])

  return (
    <WorkspaceContext.Provider value={ctx}>
      <Hud
        crumbs={[
          { label: 'workspaces', to: '/w' },
          // Renaming lives in settings and on the workspaces page, not here.
          { label: workspace.name },
        ]}
        views={[
          { label: 'board', to: `/w/${wid}`, end: true },
          { label: 'flow', to: `/w/${wid}/flow` },
          { label: 'table', to: `/w/${wid}/table` },
          { label: 'matrix', to: `/w/${wid}/matrix` },
        ]}
        right={<PeopleHere wid={wid} onBoard={view === 'board'} />}
        settings={<WorkspaceSettings wid={wid} workspace={workspace} requests={isOwner ? requests.data : []} />}
        settingsBadge={isOwner ? requests.data.length : 0}
      />
      {!isLoading && <Outlet />}
      <EditKeys />
      <Toast />
    </WorkspaceContext.Provider>
  )
}

function viewOf(path: string, wid: string): PresenceView {
  const rest = path.slice(`/w/${wid}`.length).replace(/^\//, '').split('/')[0]
  return rest === 'flow' || rest === 'table' || rest === 'matrix' ? rest : 'board'
}

function EditKeys() {
  useEditKeys()
  return null
}

// The workspace page of the settings modal (D-054, D-064): its name, who's in it, and how people get in (D-062).
type SettingsProps = { wid: string; workspace: WorkspaceCtx['workspace']; requests: WithId<JoinRequest>[] }

function WorkspaceSettings({ wid, workspace, requests }: SettingsProps) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()
  const code = workspace.inviteCode
  const pretty = `${code.slice(0, 4)}-${code.slice(4)}`
  const members = workspace.memberIds.length
  const role = user ? workspace.roles[user.id] : undefined
  const isOwner = role === 'owner'

  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const run = (p: Promise<unknown>) => {
    setError(null)
    p.catch((e: Error) => setError(e.message))
  }

  return (
    <>
      <Section label="general">
        <Row label="name">
          <InlineEdit label="workspace" value={workspace.name} onSave={(n) => renameWorkspace(wid, n)} />
        </Row>
        <Row label="members">
          {members} {members === 1 ? 'person' : 'people'}
          {role && <span className={styles.role}>you're the {role}</span>}
        </Row>
      </Section>

      {isOwner && (
        <Section label="people">
          <Row label="asking to join">
            {requests.length === 0 ? (
              <span className={styles.role}>no one is waiting</span>
            ) : (
              <ul className={styles.list}>
                {requests.map((r) => (
                  <li key={r.id} className={styles.item}>
                    <span className={styles.who}>
                      {r.name}
                      {r.email && r.email !== r.name && <span className={styles.role}> {r.email}</span>}
                    </span>
                    <span>
                      <button className={styles.action} data-tone="primary" onClick={() => run(approveJoinRequest(wid, r.uid))}>
                        let in
                      </button>
                      <button className={styles.action} data-tone="danger" onClick={() => run(denyJoinRequest(wid, r.uid))}>
                        deny
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Row>
          <EmailInvites wid={wid} invited={workspace.invitedEmails ?? []} onError={setError} />
        </Section>
      )}

      <Section label="invite code">
        <Row label="code">
          <span className={styles.code}>{pretty}</span>
          <AsciiButton accent="cyan" onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </AsciiButton>
          {isOwner && user && (
            <button className={styles.action} onClick={() => run(renewInviteCode(wid, code, user.id))}>
              new code
            </button>
          )}
        </Row>
        <p className={styles.hint}>
          {isOwner
            ? 'People who enter the code ask to join, and you let them in here. A new code stops the old one; invited addresses join without one.'
            : 'People who enter the code ask to join; the owner lets them in.'}
        </p>
      </Section>
      {error && <p className={styles.error}>! {error}</p>}
    </>
  )
}

// No email is sent: the invite shows up on their workspaces page once they sign in with that Google address.
function EmailInvites({ wid, invited, onError }: { wid: string; invited: string[]; onError: (e: string | null) => void }) {
  const [draft, setDraft] = useState('')
  const email = normalizeEmail(draft)
  const valid = isEmail(email)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!valid) return
    onError(null)
    inviteEmail(wid, email)
      .then(() => setDraft(''))
      .catch((err: Error) => onError(err.message))
  }

  return (
    <Row label="invite by email">
      <form className={styles.inviteForm} onSubmit={submit}>
        <input
          className={styles.input}
          type="email"
          placeholder="name@gmail.com"
          aria-label="Email to invite"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <AsciiButton type="submit" accent="cyan" disabled={!valid || invited.includes(email)}>
          Invite
        </AsciiButton>
      </form>
      {invited.length > 0 && (
        <ul className={styles.list}>
          {invited.map((address) => (
            <li key={address} className={styles.item}>
              <span className={styles.who}>
                {address} <span className={styles.role}>invited</span>
              </span>
              <button className={styles.action} data-tone="danger" onClick={() => uninviteEmail(wid, address).catch((e: Error) => onError(e.message))}>
                remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </Row>
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
