// /workspaces: your workspaces, plus create, ask to join with a code, import an export (D-080, D-246), and invites waiting
// for you (D-012, D-062).
import { AnimatePresence } from 'motion/react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { workspacePath } from '../../app/paths'
import type { AuthUser } from '../../data/auth'
import type { WithId } from '../../data/hooks'
import { importWorkspace } from '../../data/importWorkspace'
import type { JoinRequest, Workspace } from '../../data/model'
import { readBundle } from '../../io/bundle'
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
  useJoinRequests,
  canEditIn,
  isOwnerOf,
  ownerCount,
  roleOf,
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
          <CreateForm uid={user.id} onCreated={(id) => navigate(workspacePath(id))} />
          <JoinForm user={user} onJoined={(id) => navigate(workspacePath(id))} />
          <ImportStrip user={user} onCreated={(id) => navigate(workspacePath(id))} />
        </div>

        <Pending user={user} onJoined={(id) => navigate(workspacePath(id))} />

        {workspaces.error && <p className={styles.error}>! {workspaces.error.message}</p>}

        {/* The list and the empty state are independent, so the last card can break apart before "empty" builds in. */}
        <ul className={styles.grid}>
          <AnimatePresence>
            {sorted.map((w) => (
              <Appear as="li" key={w.id}>
                <WorkspaceCard
                  workspace={w}
                  uid={user.id}
                  // Every workspace opens on its canvas (D-174).
                  onOpen={() => navigate(workspacePath(w.id))}
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

type CardProps = { workspace: WithId<Workspace>; uid: string; onOpen: () => void }

function WorkspaceCard({ workspace: w, uid, onOpen }: CardProps) {
  // Roles (D-098): owners delete it, and may leave while another owner remains; everyone else leaves.
  const isOwner = isOwnerOf(w, uid)
  const role = roleOf(w, uid) ?? 'editor'
  const canLeave = !isOwner || ownerCount(w) > 1
  // Only owners may list who's asking to join; any of them settles it.
  const waiting = useJoinRequests(isOwner ? w.id : null).data.length
  const [mode, setMode] = useState<Mode>('idle')
  const [doing, setDoing] = useState<'delete' | 'leave'>(isOwner ? 'delete' : 'leave')
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
      await (doing === 'delete' ? deleteWorkspace(w.id, w.inviteCode, uid) : leaveWorkspace(w.id, uid))
    } catch (e) {
      setError((e as Error).message)
      setMode('idle')
    }
  }

  const ask = (what: 'delete' | 'leave') => {
    setDoing(what)
    setMode('confirm')
  }

  return (
    <article className={styles.card} data-mode={mode}>
      {/* The whole card opens the workspace; name and actions sit above this layer. */}
      <button className={styles.open} onClick={onOpen} disabled={mode !== 'idle'} aria-label={`Open ${w.name}`} />

      <div className={styles.cardHead}>
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
        <span className={styles.cardDate}>
          created {new Date(w.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>

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
            <span className={styles.warn}>{doing === 'delete' ? 'Delete it and all its ideas?' : 'Leave this workspace?'}</span>
            <span className={styles.actions} data-active>
              <button className={styles.action} data-tone="danger" onClick={remove}>
                {doing}
              </button>
              <button className={styles.action} onClick={() => setMode('idle')}>
                cancel
              </button>
            </span>
          </>
        ) : mode === 'busy' ? (
          <span className={styles.warn}>{doing === 'delete' ? 'deleting…' : 'leaving…'}</span>
        ) : (
          <>
            <span className={styles.cardMeta}>
              {role} · {w.memberIds.length} {w.memberIds.length === 1 ? 'member' : 'members'}
              {waiting > 0 && <span className={styles.waiting}> · {waiting} waiting</span>}
            </span>
            <span className={styles.actions}>
              {canEditIn(w, uid) && (
                <button className={styles.action} onClick={startRename}>
                  rename
                </button>
              )}
              {isOwner && canLeave && (
                <button className={styles.action} onClick={() => ask('leave')}>
                  leave
                </button>
              )}
              <button className={styles.action} data-tone="danger" onClick={() => ask(isOwner ? 'delete' : 'leave')}>
                {isOwner ? 'delete' : 'leave'}
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
          create
        </AsciiButton>
      </div>
      {error && <p className={styles.error}>! {error}</p>}
    </Appear>
  )
}

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
          ask
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

// An exported .zip becomes a new workspace you own (D-080, D-246). What had to stay behind (files, broken parts) is said
// before going there; otherwise it opens at once.
function ImportStrip({ user, onCreated }: { user: AuthUser; onCreated: (id: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ id: string; files: number; skipped: number } | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const load = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      const bundle = await readBundle(file)
      const result = await importWorkspace(bundle, user.id, user.name || user.email || 'someone')
      if (result.filesLeftOut || result.skipped) {
        setDone({ id: result.workspaceId, files: result.filesLeftOut, skipped: result.skipped })
        setBusy(false)
      } else onCreated(result.workspaceId)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    } finally {
      if (input.current) input.current.value = ''
    }
  }

  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
  return (
    <div className={styles.import}>
      <span className={styles.label}>import</span>
      <p className={styles.importText}>
        A workspace exported from North Star (.zip, in settings → workspace → export) becomes a new workspace you own.
      </p>
      <input ref={input} type="file" accept=".zip,.json,application/zip,application/json" hidden onChange={(e) => void load(e.target.files?.[0])} />
      <AsciiButton accent="cyan" onClick={() => input.current?.click()} disabled={busy}>
        {busy ? 'importing' : 'choose file'}
      </AsciiButton>
      {done && (
        <>
          <p className={styles.importText}>
            Imported.
            {done.files > 0 && ` ${plural(done.files, 'file was', 'files were')} left out: files can't be stored here yet.`}
            {done.skipped > 0 && ` ${plural(done.skipped, 'thing was', 'things were')} left out: broken, or pointing at something not in the file.`}
          </p>
          <AsciiButton accent="green" onClick={() => onCreated(done.id)}>
            open workspace
          </AsciiButton>
        </>
      )}
      {error && <p className={styles.error}>! {error}</p>}
    </div>
  )
}
