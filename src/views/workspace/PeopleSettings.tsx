// Settings → workspace → people (D-062, D-098): who is in the workspace and their roles, who's asking to join, email
// invites and the invite code. Owners change anyone's role (several owners are fine, never none) and remove people;
// everyone else sees the list. The list loads only on this page, a page at a time.
import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../data/auth'
import type { WithId } from '../../data/hooks'
import { ROLES, type JoinRequest, type Role } from '../../data/model'
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
} from '../../data/workspaces'
import { AsciiButton } from '../../ui/AsciiButton'
import { Loading } from '../../ui/Loading'
import { Select } from '../../ui/Select'
import { Note, Row, Section } from '../../ui/Settings'
import type { WorkspaceCtx } from './context'
import styles from './PeopleSettings.module.css'

const ROLE_HINT: Record<Role, string> = {
  owner: 'manages people and the invite code; can delete it',
  editor: 'changes everything on the canvas',
  viewer: 'reads everything, keeps their own documents, changes nothing',
}

type Props = { wid: string; workspace: WorkspaceCtx['workspace']; requests: WithId<JoinRequest>[] }

export function PeopleSettings({ wid, workspace, requests }: Props) {
  const { user } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const isOwner = isOwnerOf(workspace, user?.id)
  const run = (p: Promise<unknown>) => {
    setError(null)
    p.catch((e: Error) => setError(e.message))
  }

  return (
    <>
      <Members wid={wid} workspace={workspace} run={run} />
      {isOwner && (
        <Section label="asking to join">
          <Row label="requests" hint="People who entered the invite code. They join as editors.">
            {requests.length === 0 ? (
              <span className={styles.dim}>no one is waiting</span>
            ) : (
              <ul className={styles.list}>
                {requests.map((r) => (
                  <li key={r.id} className={styles.request}>
                    <span className={styles.who}>
                      {r.name}
                      {r.email && r.email !== r.name && <span className={styles.dim}> {r.email}</span>}
                    </span>
                    <span>
                      <button className={styles.action} data-tone="primary" onClick={() => run(approveJoinRequest(wid, r))}>
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
          <EmailInvites workspace={workspace} onError={setError} />
        </Section>
      )}
      <InviteCode wid={wid} workspace={workspace} isOwner={isOwner} run={run} />
      {error && <Note tone="error">! {error}</Note>}
    </>
  )
}

function Members({ wid, workspace, run }: { wid: string; workspace: WorkspaceCtx['workspace']; run: (p: Promise<unknown>) => void }) {
  const { user } = useAuth()
  const members = useMembers(wid)
  const isOwner = isOwnerOf(workspace, user?.id)
  const owners = ownerCount(workspace)
  const [confirm, setConfirm] = useState<string | null>(null)
  // Only people still in it: an entry can outlive a member who was removed before D-098.
  const listed = members.data.filter((m) => workspace.memberIds.includes(m.id))
  // Members without an entry yet (they haven't opened it since the list began), once the whole list is in.
  const unlisted = members.hasMore || members.isLoading ? [] : workspace.memberIds.filter((uid) => !members.data.some((m) => m.id === uid))
  const total = workspace.memberIds.length

  const row = (uid: string, name: string, email?: string) => {
    const role = roleOf(workspace, uid) ?? 'editor'
    const me = uid === user?.id
    // The rules keep someone owning it: the last owner can't step down or be removed.
    const lastOwner = role === 'owner' && owners <= 1
    return (
      <li key={uid} className={styles.member}>
        <span className={styles.avatar} aria-hidden>
          {name.trim()[0]?.toUpperCase() ?? '?'}
        </span>
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
              <>
                <button
                  className={styles.action}
                  data-tone="danger"
                  onClick={() => {
                    setConfirm(null)
                    run(removeMember(wid, uid))
                  }}
                >
                  remove {name.split(' ')[0]}?
                </button>
                <button className={styles.action} onClick={() => setConfirm(null)}>
                  keep
                </button>
              </>
            ) : (
              <button className={styles.action} data-tone="danger" onClick={() => setConfirm(uid)}>
                remove
              </button>
            )
          )}
        </span>
      </li>
    )
  }

  return (
    <Section
      label={`members · ${total}`}
      note={
        <>
          <p>
            <b>owner</b> {ROLE_HINT.owner}. <b>editor</b> {ROLE_HINT.editor}. <b>viewer</b> {ROLE_HINT.viewer}.
          </p>
          {isOwner && <p>A workspace can have several owners; there's always at least one.</p>}
        </>
      }
    >
      {members.isLoading ? (
        <Loading label="loading people…" />
      ) : members.error ? (
        <Note tone="error">! Couldn&apos;t load the people list.</Note>
      ) : (
        <ul className={styles.list}>
          {listed.map((m) => row(m.id, m.name, m.email))}
          {unlisted.map((uid) => row(uid, 'someone who hasn’t opened it lately', undefined))}
        </ul>
      )}
      {members.hasMore && (
        <div className={styles.more}>
          <button className={styles.action} onClick={members.more} disabled={members.loadingMore}>
            {members.loadingMore ? 'loading…' : 'show more'}
          </button>
          <span className={styles.dim}>
            {listed.length} of {total}
          </span>
        </div>
      )}
    </Section>
  )
}

function InviteCode({ wid, workspace, isOwner, run }: { wid: string; workspace: WorkspaceCtx['workspace']; isOwner: boolean; run: (p: Promise<unknown>) => void }) {
  const { user } = useAuth()
  const [copied, setCopied] = useState(false)
  const code = workspace.inviteCode
  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }
  return (
    <Section
      label="invite code"
      note={
        isOwner
          ? 'People who enter the code ask to join, and an owner lets them in above. A new code stops the old one; invited addresses join without one.'
          : 'People who enter the code ask to join; an owner lets them in.'
      }
    >
      <Row label="code" hint="Share it with the people you want in.">
        <span className={styles.code}>{`${code.slice(0, 4)}-${code.slice(4)}`}</span>
        <AsciiButton accent="cyan" onClick={copy}>
          {copied ? 'copied' : 'copy'}
        </AsciiButton>
        {isOwner && user && (
          <button className={styles.action} onClick={() => run(renewInviteCode(wid, code, user.id))}>
            new code
          </button>
        )}
      </Row>
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
    <Row label="invite by email" hint="No mail is sent: they find the invite when they sign in with that Google address.">
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
          invite
        </AsciiButton>
      </form>
      {invited.length > 0 && (
        <ul className={styles.list}>
          {invited.map((address) => (
            <li key={address} className={styles.request}>
              <span className={styles.who}>
                {address} <span className={styles.dim}>invited</span>
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
