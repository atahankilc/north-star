// /w: your workspaces, plus create and join-by-invite-code (D-012).
import { motion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut, type AuthUser } from '../../data/auth'
import { createWorkspace, joinWorkspace, JoinError, useMyWorkspaces } from '../../data/workspaces'
import { AsciiButton } from '../../ui/AsciiButton'
import { DecodeText } from '../../ui/DecodeText'
import styles from './Workspaces.module.css'

export function Workspaces({ user }: { user: AuthUser }) {
  const workspaces = useMyWorkspaces(user.id)
  const navigate = useNavigate()
  const sorted = [...workspaces.data].sort((a, b) => b.createdAt - a.createdAt)

  return (
    <main className={styles.page}>
      <header className={styles.bar}>
        <span>
          <span className={styles.hash}>#</span> north-star / workspaces
        </span>
        <span className={styles.user}>
          {user.email}
          <AsciiButton accent="cyan" onClick={() => signOut()}>
            Sign out
          </AsciiButton>
        </span>
      </header>

      <section className={styles.content}>
        <h1 className={styles.title}>
          <DecodeText text="Workspaces" />
        </h1>

        <div className={styles.forms}>
          <CreateForm uid={user.id} onCreated={(id) => navigate(`/w/${id}`)} />
          <JoinForm uid={user.id} onJoined={(id) => navigate(`/w/${id}`)} />
        </div>

        {workspaces.error && <p className={styles.error}>! {workspaces.error.message}</p>}

        {!workspaces.isLoading && sorted.length === 0 ? (
          <pre className={styles.empty} aria-label="No workspaces yet">
{`┌──────────────────────────────────┐
│  no workspaces yet               │
│  create one, or join with a code │
└──────────────────────────────────┘`}
          </pre>
        ) : (
          <ul className={styles.grid}>
            {sorted.map((w, i) => (
              <motion.li
                key={w.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <button className={styles.card} onClick={() => navigate(`/w/${w.id}`)}>
                  <span className={styles.cardName}>{w.name}</span>
                  <span className={styles.cardMeta}>
                    {w.memberIds.length} {w.memberIds.length === 1 ? 'member' : 'members'} ·{' '}
                    {w.ownerId === user.id ? 'owner' : 'editor'} · {new Date(w.createdAt).toLocaleDateString()}
                  </span>
                </button>
              </motion.li>
            ))}
          </ul>
        )}
      </section>
    </main>
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
    <form className={styles.form} onSubmit={submit}>
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
    </form>
  )
}

function JoinForm({ uid, onJoined }: { uid: string; onJoined: (id: string) => void }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onJoined(await joinWorkspace(code, uid))
    } catch (err) {
      setError(err instanceof JoinError ? err.message : 'Could not join. Check the code and try again.')
      setBusy(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <label className={styles.label} htmlFor="ws-code">
        join with invite code
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
          Join
        </AsciiButton>
      </div>
      {error && <p className={styles.error}>! {error}</p>}
    </form>
  )
}
