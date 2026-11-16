// Settings → workspace → people (D-062, D-098): who is in the workspace and their roles, who's asking to join, email
// invites and the invite code. Owners change anyone's role (several owners are fine, never none) and remove people;
// everyone else sees the list. The list loads only on this page, a page at a time.
// Laid out by D-404: who's asking on top (drawn only while someone is), then the members, then the ways in.
import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../../data/auth'
import { safePhoto } from '../../../data/presence'
import { usePersonColor } from '../threads/Threads'
import type { WithId } from '../../../data/hooks'
import { ROLES, type JoinRequest, type Role } from '../../../data/model'
import {
  approveJoinRequest,
  denyJoinRequest,
  inviteEmail,
  isEmail,
  isOwnerOf,
  syncInvites,
  normalizeEmail,
  ownerCount,
  removeMember,
  renewInviteCode,
  roleOf,
  setRole,
  uninviteEmail,
  useMembers,
} from '../../../data/workspaces'
import { Avatar } from '../../../ui/primitives/Avatar'
import { Button } from '../../../ui/primitives/Button'
import { ButtonGroup } from '../../../ui/primitives/ButtonGroup'
import { Loading } from '../../../ui/primitives/Loading'
import { Select } from '../../../ui/patterns/Select'
import { Note, Row, Section } from '../../../ui/patterns/Settings'
import type { WorkspaceCtx } from '../canvas/context'
import { Field } from '../../../ui/primitives/Field'
import styles from './PeopleSettings.module.css'
import { codeText, firstName } from '../../../model/words'

type Props = { wid: string; workspace: WorkspaceCtx['workspace']; requests: WithId<JoinRequest>[] }

export function PeopleSettings({ wid, workspace, requests }: Props) {
  const { user } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const isOwner = isOwnerOf(workspace, user?.id)
  const run = (p: Promise<unknown>) => {
    setError(null)
    p.catch((e: Error) => setError(e.message))
  }

  // Numbered as drawn: `asking to join` is there only for an owner with someone waiting.
  const asking = isOwner && requests.length > 0
  const from = asking ? 1 : 0
  return (
    <>
      {asking && (
        <Section n={1} label="asking to join" count={requests.length}>
          {requests.map((r) => (
            <div key={r.id} className={styles.person}>
              <Avatar name={r.name} size="sm" />
              <span className={styles.who}>
                <span className={styles.name}>{r.name}</span>
                {r.email && r.email !== r.name && <span className={styles.email}>{r.email}</span>}
              </span>
              <ButtonGroup>
                <Button tone="main" onClick={() => run(approveJoinRequest(wid, r))}>
                  let in
                </Button>
                <Button tone="danger" onClick={() => run(denyJoinRequest(wid, r.uid))}>
                  deny
                </Button>
              </ButtonGroup>
            </div>
          ))}
        </Section>
      )}
      <Members n={from + 1} wid={wid} workspace={workspace} run={run} />
      <Inviting n={from + 2} wid={wid} workspace={workspace} isOwner={isOwner} run={run} onError={setError} />
      {error && <Note tone="error">! {error}</Note>}
    </>
  )
}

function Members({ n, wid, workspace, run }: { n: number; wid: string; workspace: WorkspaceCtx['workspace']; run: (p: Promise<unknown>) => void }) {
  const { user } = useAuth()
  const members = useMembers(wid)
  const isOwner = isOwnerOf(workspace, user?.id)
  const owners = ownerCount(workspace)
  const [confirm, setConfirm] = useState<string | null>(null)
  const listed = members.data
  // Members without an entry yet (they haven't opened it since the list began), once the whole list is in.
  const unlisted = members.hasMore || members.isLoading ? [] : workspace.memberIds.filter((uid) => !members.data.some((m) => m.id === uid))
  const total = workspace.memberIds.length

  // Each in their colour (the one they have here, else their own, D-398), with their Google picture when the entry
  // holds one (only from Google's own host, D-317).
  const colorOf = usePersonColor()
  const row = (uid: string, name: string, email?: string, photo?: string, known = true) => {
    const role = roleOf(workspace, uid) ?? 'editor'
    const me = uid === user?.id
    // The rules keep someone owning it: the last owner can't step down or be removed.
    const lastOwner = role === 'owner' && owners <= 1
    return (
      <div key={uid} className={styles.person}>
        <Avatar name={name} size="sm" photo={safePhoto(photo)} color={known ? colorOf(uid) : undefined} />
        <span className={styles.who}>
          <span className={styles.name}>
            {name}
            {me && <span className={styles.dim}> (you)</span>}
          </span>
          {email && <span className={styles.email}>{email}</span>}
        </span>
        <span className={styles.controls}>
          {isOwner ? (
            <Select<Role>
              className={styles.role}
              ariaLabel={`Role of ${name}`}
              value={role}
              disabled={lastOwner}
              options={ROLES.map((r) => ({ value: r, label: r }))}
              onChange={(r) => r !== role && run(setRole(wid, uid, r))}
            />
          ) : (
            <span className={styles.roleText} data-role={role}>
              {role}
            </span>
          )}
          {isOwner && !me && !lastOwner && (
            confirm === uid ? (
              <ButtonGroup>
                <Button
                  tone="hazard"
                  onClick={() => {
                    setConfirm(null)
                    run(removeMember(wid, uid))
                  }}
                >
                  remove {firstName(name)}?
                </Button>
                <Button onClick={() => setConfirm(null)}>
                  keep
                </Button>
              </ButtonGroup>
            ) : (
              <Button tone="danger" onClick={() => setConfirm(uid)}>
                remove
              </Button>
            )
          )}
        </span>
      </div>
    )
  }

  return (
    <Section n={n} label="members" count={total} note="An owner manages people and the invite code and can delete the workspace; there is always at least one. An editor changes everything on the canvas. A viewer reads everything and keeps their own documents.">
      {members.isLoading ? (
        <Loading label="loading people…" />
      ) : members.error ? (
        <Note tone="error">! Couldn&apos;t load the people list.</Note>
      ) : (
        <>
          {listed.map((m) => row(m.id, m.name, m.email, m.photo))}
          {unlisted.map((uid) => row(uid, 'someone who hasn’t opened it lately', undefined, undefined, false))}
        </>
      )}
      {members.hasMore && (
        <div className={styles.more}>
          <Button onClick={members.more} disabled={members.loadingMore}>
            {members.loadingMore ? 'loading…' : 'show more'}
          </Button>
          <span className={styles.dim}>
            {listed.length} of {total}
          </span>
        </div>
      )}
    </Section>
  )
}

// The ways in: the code anyone can pass on, and for an owner an address invited by hand.
function Inviting({ n, wid, workspace, isOwner, run, onError }: { n: number; wid: string; workspace: WorkspaceCtx['workspace']; isOwner: boolean; run: (p: Promise<unknown>) => void; onError: (e: string | null) => void }) {
  const { user } = useAuth()
  const [copied, setCopied] = useState(false)
  const code = workspace.inviteCode
  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }
  return (
    <Section n={n} label="inviting">
      <Row
        label="invite code"
        hint={isOwner ? 'Whoever enters it asks to join, and an owner lets them in here. A new code stops the old one.' : 'Whoever enters it asks to join, and an owner lets them in.'}
      >
        <span className={styles.code}>{codeText(code)}</span>
        <ButtonGroup>
          <Button onClick={copy}>{copied ? 'copied' : 'copy'}</Button>
          {isOwner && user && <Button onClick={() => run(renewInviteCode(wid, code, user.id))}>new code</Button>}
        </ButtonGroup>
      </Row>
      {isOwner && <EmailInvites workspace={workspace} onError={onError} />}
    </Section>
  )
}

// No email is sent: the invite shows up on their workspaces page once they sign in with that Google address.
function EmailInvites({ workspace, onError }: { workspace: WorkspaceCtx['workspace']; onError: (e: string | null) => void }) {
  const wid = workspace.id
  const invited = workspace.invitedEmails ?? []
  // Every address has its invite, with today's name and count (D-323); once each time the page opens.
  useEffect(() => {
    syncInvites(workspace).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [draft, setDraft] = useState('')
  const email = normalizeEmail(draft)
  const valid = isEmail(email)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!valid) return
    onError(null)
    inviteEmail(workspace, email)
      .then(() => setDraft(''))
      .catch((err: Error) => onError(err.message))
  }

  return (
    <>
      <Row wide label="invite by email" hint="No mail is sent: they find the invite when they sign in with that Google address.">
        <form className={styles.inviteForm} onSubmit={submit}>
          <Field className={styles.input} type="email" placeholder="name@gmail.com" label="Email to invite" value={draft} onChange={setDraft} />
          <Button tone="main" type="submit" disabled={!valid || invited.includes(email)}>
            invite
          </Button>
        </form>
      </Row>
      {invited.map((address) => (
        <div key={address} className={styles.person}>
          <span className={styles.who}>
            <span className={styles.name}>{address}</span>
            <span className={styles.email}>invited, not signed in yet</span>
          </span>
          <Button tone="danger" onClick={() => uninviteEmail(wid, address).catch((e: Error) => onError(e.message))}>
            remove
          </Button>
        </div>
      ))}
    </>
  )
}
