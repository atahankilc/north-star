// /w: your workspaces, plus create, ask to join with a code, and invites waiting for you (D-012, D-062).
import { AnimatePresence } from 'motion/react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AuthUser } from '../../data/auth'
import { createExampleWorkspace } from '../../data/example'
import type { WithId } from '../../data/hooks'
import type { JoinRequest, Workspace } from '../../data/model'
import {
  acceptInvite,
  createWorkspace,
  declineInvite,
  deleteWorkspace,
  JoinError,
  leaveWorkspace,
  renameWorkspace,
  requestToJoin,
  useMyInvites,
  useMyJoinRequests,
  useMyWorkspaces,
  useRequestsToMe,
  withdrawJoinRequest,
} from '../../data/workspaces'
import { useHoldCurtain } from '../../state/curtain'
import { AsciiButton } from '../../ui/AsciiButton'
import { DecodeText } from '../../ui/DecodeText'
import { Hud } from '../../ui/Hud'
import { Appear } from '../../ui/Appear'
import styles from './Workspaces.module.css'

export function Workspaces({ user }: { user: AuthUser }) {
  const workspaces = useMyWorkspaces(user.id)
  const waiting = useRequestsToMe(user.id)
  const navigate = useNavigate()
  useHoldCurtain('workspaces', workspaces.isLoading)
  const sorted = [...workspaces.data].sort((a, b) => b.createdAt - a.createdAt)

  return (
    <main className={styles.page}>
      <Hud crumbs={[{ label: 'workspaces' }]} />

      <section className={styles.content}>
        <h1 className={styles.title}>
          <DecodeText text="Workspaces" />
        </h1>

        <div className={styles.forms}>
          <CreateForm uid={user.id} onCreated={(id) => navigate(`/w/${id}`)} />
          <JoinForm user={user} onJoined={(id) => navigate(`/w/${id}`)} />
          <ExampleStrip uid={user.id} onCreated={(id) => navigate(`/w/${id}`)} />
        </div>

        <Pending user={user} onJoined={(id) => navigate(`/w/${id}`)} />

        {workspaces.error && <p className={styles.error}>! {workspaces.error.message}</p>}

        {/* The list and the empty state are independent, so the last card can break apart before "empty" builds in. */}
        <ul className={styles.grid}>
          <AnimatePresence>
            {sorted.map((w) => (
              <Appear as="li" key={w.id}>
                <WorkspaceCard
                  workspace={w}
                  uid={user.id}
                  waiting={waiting.data.filter((r) => r.workspaceId === w.id).length}
                  onOpen={() => navigate(`/w/${w.id}`)}
                />
              </Appear>
            ))}
          </AnimatePresence>
        </ul>
        <AnimatePresence>
          {!workspaces.isLoading && sorted.length === 0 && (
            <Appear key="empty" className={styles.empty}>
              <span className={styles.label}>no workspaces yet</span>
              <p className={styles.emptyText}>Create one above, or ask to join a teammate's with their invite code.</p>
            </Appear>
          )}
        </AnimatePresence>
      </section>
    </main>
  )
}

type Mode = 'idle' | 'renaming' | 'confirm' | 'busy'

type CardProps = { workspace: WithId<Workspace>; uid: string; waiting: number; onOpen: () => void }

function WorkspaceCard({ workspace: w, uid, waiting, onOpen }: CardProps) {
  const isOwner = w.ownerId === uid
  const [mode, setMode] = useState<Mode>('idle')
  const [draft, setDraft] = useState(w.name)
  const [error, setError] = useState<string | null>(null)
  const nameInput = useRef<HTMLInputElement>(null)

  // An unanswered delete/leave confirm quietly backs off.
  useEffect(() => {
    if (mode !== 'confirm') return
    const t = window.setTimeout(() => setMode('idle'), 5000)
    return () => window.clearTimeout(t)
  }, [mode])

  useEffect(() => {
    if (mode === 'renaming') nameInput.current?.select()
  }, [mode])

  const startRename = () => {
    setDraft(w.name)
    setError(null)
    setMode('renaming')
  }

  const saveRename = () => {
    const name = draft.trim()
    setMode('idle')
    if (!name || name === w.name) return
    renameWorkspace(w.id, name).catch((e: Error) => setError(e.message))
  }

  const remove = async () => {
    setMode('busy')
    setError(null)
    try {
      await (isOwner ? deleteWorkspace(w.id, w.inviteCode, uid) : leaveWorkspace(w.id, uid))
    } catch (e) {
      setError((e as Error).message)
      setMode('idle')
    }
  }

  const verb = isOwner ? 'delete' : 'leave'

  return (
    <article className={styles.card} data-mode={mode} title={`Created ${new Date(w.createdAt).toLocaleDateString()}`}>
      {/* The whole card opens the workspace; name and actions sit above this layer. */}
      <button className={styles.open} onClick={onOpen} disabled={mode !== 'idle'} aria-label={`Open ${w.name}`} />

      {mode === 'renaming' ? (
        <input
          ref={nameInput}
          className={`${styles.cardName} ${styles.nameInput}`}
          value={draft}
          maxLength={80}
          aria-label="Workspace name"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveRename()
            if (e.key === 'Escape') setMode('idle')
          }}
        />
      ) : (
        <span className={styles.cardName}>{w.name}</span>
      )}

      {/* Every mode: info or message on the left, actions on the right. */}
      <div className={styles.cardFoot}>
        {mode === 'renaming' ? (
          <>
            <span className={styles.cardMeta}>enter a new name</span>
            <span className={styles.actions} data-active>
              <button className={styles.action} data-tone="primary" onClick={saveRename} disabled={!draft.trim()}>
                save
              </button>
              <button className={styles.action} onClick={() => setMode('idle')}>
                cancel
              </button>
            </span>
          </>
        ) : mode === 'confirm' ? (
          <>
            <span className={styles.warn}>{isOwner ? 'Delete it and all its ideas?' : 'Leave this workspace?'}</span>
            <span className={styles.actions} data-active>
              <button className={styles.action} data-tone="danger" onClick={remove}>
                {verb}
              </button>
              <button className={styles.action} onClick={() => setMode('idle')}>
                cancel
              </button>
            </span>
          </>
        ) : mode === 'busy' ? (
          <span className={styles.warn}>{isOwner ? 'deleting…' : 'leaving…'}</span>
        ) : (
          <>
            <span className={styles.cardMeta}>
              {isOwner ? 'owner' : 'editor'} · {w.memberIds.length} {w.memberIds.length === 1 ? 'member' : 'members'}
              {waiting > 0 && <span className={styles.waiting}> · {waiting} waiting</span>}
            </span>
            <span className={styles.actions}>
              <button className={styles.action} onClick={startRename}>
                rename
              </button>
              <button className={styles.action} data-tone="danger" onClick={() => setMode('confirm')}>
                {verb}
              </button>
            </span>
          </>
        )}
      </div>
      {error && <p className={styles.error}>! {error}</p>}
    </article>
  )
}

function CreateForm({ uid, onCreated }: { uid: string; onCreated: (id: string) => void }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onCreated(await createWorkspace(name, uid))
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <Appear as="form" className={styles.form} onSubmit={submit}>
      <label className={styles.label} htmlFor="ws-name">
        new workspace
      </label>
      <div className={styles.row}>
        <input
          id="ws-name"
          className={styles.input}
          placeholder="e.g. Pet-sitting marketplace"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
        />
        <AsciiButton type="submit" disabled={busy || !name.trim()}>
          Create
        </AsciiButton>
      </div>
      {error && <p className={styles.error}>! {error}</p>}
    </Appear>
  )
}

// D-052: a filled-in workspace to explore every view with.
function ExampleStrip({ uid, onCreated }: { uid: string; onCreated: (id: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = async () => {
    setBusy(true)
    setError(null)
    try {
      onCreated(await createExampleWorkspace(uid))
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <Appear className={styles.example}>
      <span className={styles.label}>example</span>
      <p className={styles.exampleText}>
        A made-up startup with every view filled in: customers, problems, competitors, ideas, a roadmap and the matrix.
      </p>
      <AsciiButton accent="green" onClick={create} disabled={busy}>
        {busy ? 'Creating' : 'Create example'}
      </AsciiButton>
      {error && <p className={styles.error}>! {error}</p>}
    </Appear>
  )
}

// D-062: the code only asks; the owner lets you in from their settings.
function JoinForm({ user, onJoined }: { user: AuthUser; onJoined: (id: string) => void }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSent(false)
    try {
      const result = await requestToJoin(code, user)
      if (result.status === 'member') return onJoined(result.workspaceId)
      setSent(true)
      setCode('')
    } catch (err) {
      setError(err instanceof JoinError ? err.message : 'Could not send the request. Check the code and try again.')
    }
    setBusy(false)
  }

  return (
    <Appear as="form" className={styles.form} data-accent="cyan" onSubmit={submit}>
      <label className={styles.label} htmlFor="ws-code">
        ask to join with a code
      </label>
      <div className={styles.row}>
        <input
          id="ws-code"
          className={`${styles.input} ${styles.codeInput}`}
          placeholder="ABCD-EFGH"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          autoComplete="off"
          spellCheck={false}
          maxLength={12}
        />
        <AsciiButton type="submit" accent="cyan" disabled={busy || !code.trim()}>
          Ask
        </AsciiButton>
      </div>
      {error && <p className={styles.error}>! {error}</p>}
      {sent && <p className={styles.ok}>Request sent. You're in once the owner approves it.</p>}
    </Appear>
  )
}

// Invites to your address and requests you sent, both waiting on someone (D-062).
function Pending({ user, onJoined }: { user: AuthUser; onJoined: (id: string) => void }) {
  const invites = useMyInvites(user.email)
  const requests = useMyJoinRequests(user.id)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError((e as Error).message)
    }
    setBusy(null)
  }

  if (invites.data.length === 0 && requests.data.length === 0) return null

  return (
    <Appear className={styles.pending}>
      <span className={styles.label}>waiting</span>
      <ul className={styles.pendingList}>
        {invites.data.map((w) => (
          <li key={w.id} className={styles.pendingItem}>
            <span className={styles.pendingName}>{w.name}</span>
            <span className={styles.pendingMeta}>invited you · {w.memberIds.length} {w.memberIds.length === 1 ? 'member' : 'members'}</span>
            <span className={styles.pendingActions}>
              <button
                className={styles.action}
                data-tone="primary"
                disabled={busy !== null}
                onClick={() => run(w.id, async () => {
                  await acceptInvite(w.id, user)
                  onJoined(w.id)
                })}
              >
                join
              </button>
              <button className={styles.action} data-tone="danger" disabled={busy !== null} onClick={() => run(w.id, () => declineInvite(w.id, user.email ?? ''))}>
                decline
              </button>
            </span>
          </li>
        ))}
        {requests.data.map((r: WithId<JoinRequest>) => (
          <li key={r.id} className={styles.pendingItem}>
            <span className={styles.pendingName}>{r.code.slice(0, 4)}-{r.code.slice(4)}</span>
            <span className={styles.pendingMeta}>you asked to join · waiting for the owner</span>
            <span className={styles.pendingActions}>
              <button className={styles.action} disabled={busy !== null} onClick={() => run(r.id, () => withdrawJoinRequest(r.workspaceId, user.id))}>
                withdraw
              </button>
            </span>
          </li>
        ))}
      </ul>
      {error && <p className={styles.error}>! {error}</p>}
    </Appear>
  )
}
