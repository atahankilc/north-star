// The assistant's keys (D-073, D-079): your own OpenAI key (only in this browser, D-006), the workspace's shared key
// (kept on the server; the owner picks who may use it), which one this workspace uses, and a model per task (D-077).
// The key form also shows inside the chat panel when no key is set.
import { useContext, useState, type FormEvent } from 'react'
import { checkKey } from '../ai/openai'
import { keySourceFor, maskKey, useAiSettings } from '../ai/settings'
import {
  canUseWorkspaceKey,
  setKeyAccess,
  setWorkspaceKey,
  useAiConfig,
  type AiConfig,
  type KeyAccess,
  workspaceKeysAvailable,
} from '../data/ai'
import { useAuth } from '../data/auth'
import type { Workspace } from '../data/model'
import { isOwnerOf, useMembers } from '../data/workspaces'
import { Loading } from './Loading'
import { WorkspaceContext } from '../views/workspace/context'
import { Choice } from './Choice'
import { AsciiButton } from './AsciiButton'
import { InThisWorkspace, OwnKeyModels, WorkspaceKeyModels } from './AiModels'
import styles from './AiSettings.module.css'
import { Note, Row, Section } from './Settings'

export const KEY_PRIVACY =
  'Kept only in this browser and sent only to OpenAI, never to North Star or your collaborators. Each person uses their own key.'

export function AiKeyForm({ onSaved }: { onSaved?: () => void }) {
  const model = useAiSettings((s) => s.ownModels.default.chat)
  const setKey = useAiSettings((s) => s.setKey)
  const [draft, setDraft] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const key = draft.trim()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!key || checking) return
    setChecking(true)
    setError(null)
    checkKey(key, model)
      .then(() => {
        setKey(key)
        setDraft('')
        onSaved?.()
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setChecking(false))
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.line}>
        <input
          className={styles.input}
          type="password"
          placeholder="sk-…"
          aria-label="OpenAI API key"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <AsciiButton type="submit" accent="cyan" disabled={!key || checking}>
          {checking ? 'checking' : 'save'}
        </AsciiButton>
      </div>
      {error && <p className={styles.error}>! {error}</p>}
    </form>
  )
}

export function AiKeysPage() {
  const apiKey = useAiSettings((s) => s.apiKey)
  const setKey = useAiSettings((s) => s.setKey)
  const ws = useContext(WorkspaceContext)
  const [replacing, setReplacing] = useState(false)

  return (
    <>
      {ws && <Summary wid={ws.wid} workspace={ws.workspace} />}
      <Section
        label="your key"
        note={
          <>
            {KEY_PRIVACY} Get one at{' '}
            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">
              platform.openai.com/api-keys
            </a>
            .
          </>
        }
      >
        {apiKey && !replacing ? (
          <Row label="OpenAI key" hint="Used for your own calls.">
            <span className={styles.key}>{maskKey(apiKey)}</span>
            <button className={styles.action} onClick={() => setReplacing(true)}>
              replace
            </button>
            <button className={styles.action} data-tone="danger" onClick={() => setKey('')}>
              remove
            </button>
          </Row>
        ) : (
          <Row label="OpenAI key" hint="Paste a key; it's checked with OpenAI before it's kept.">
            <AiKeyForm onSaved={() => setReplacing(false)} />
          </Row>
        )}
      </Section>
      {ws && !workspaceKeysAvailable ? (
        <Section
          label="workspace key"
          note="Coming soon: the owner sets one key that chosen members use, kept on North Star's server where nobody can read it. For now everyone uses their own key."
        />
      ) : ws ? (
        <WorkspaceKey wid={ws.wid} workspace={ws.workspace} />
      ) : (
        <Section label="workspace key" note="Open a workspace to see or set its shared key." />
      )}
      <OwnKeyModels wid={ws?.wid ?? null} name={ws?.workspace.name ?? null} />
      {ws && workspaceKeysAvailable && <WorkspaceModels wid={ws.wid} workspace={ws.workspace} />}
      <Section
        label="what it sees"
        note="When you ask something, the workspace you're in (cards, links, competitors, the matrix) goes to OpenAI with your question. The chat stays in this tab and is gone when you reload. It only changes the workspace when you apply one of its proposals."
      />
    </>
  )
}

// The workspace's shared key (D-079): the owner sets it and picks who may use it; it never comes back to any browser.
function WorkspaceKey({ wid, workspace }: { wid: string; workspace: Workspace }) {
  const { user } = useAuth()
  const config = useAiConfig(wid).data
  const isOwner = isOwnerOf(workspace, user?.id)
  const usable = canUseWorkspaceKey(config, user?.id, isOwner)

  return (
    <Section
      label="workspace key"
      note={
        isOwner
          ? "Your key is sent once to North Star's server, kept encrypted there and never shown to anyone again, you included. Calls on it go through the server, which logs what each one used (usage). Anyone may still use their own key instead."
          : 'The owner pays for the workspace key; the owner sees what you use on it. Calls on your own key are seen only by you.'
      }
    >
      {isOwner ? (
        <OwnerKey wid={wid} workspace={workspace} config={config} />
      ) : (
        <Row label="shared key">
          <span className={styles.key}>
            {!config?.hasKey ? 'none' : usable ? `${config.keyHint ?? 'set'} · you may use it` : "set · the owner hasn't let you use it"}
          </span>
        </Row>
      )}
    </Section>
  )
}

function OwnerKey({ wid, workspace, config }: { wid: string; workspace: Workspace; config: AiConfig | null }) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [replacing, setReplacing] = useState(false)
  const access = config?.access ?? 'chosen'
  const allowed = config?.allowed ?? []

  const save = (key: string) => {
    setBusy(true)
    setError(null)
    setWorkspaceKey(wid, key)
      .then(() => {
        setDraft('')
        setReplacing(false)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false))
  }

  const setAccess = (next: KeyAccess, list = allowed) => void setKeyAccess(wid, next, list).catch((e: Error) => setError(e.message))
  const toggle = (uid: string) => setAccess('chosen', allowed.includes(uid) ? allowed.filter((u) => u !== uid) : [...allowed, uid])

  return (
    <>
      {config?.hasKey && !replacing ? (
        <Row label="shared key" hint="Paid by you, used by the people you pick.">
          <span className={styles.key}>{config.keyHint}</span>
          <button className={styles.action} onClick={() => setReplacing(true)}>
            replace
          </button>
          <button className={styles.action} data-tone="danger" disabled={busy} onClick={() => save('')}>
            remove
          </button>
        </Row>
      ) : (
        <Row label="shared key" hint="Paid by you, used by the people you pick.">
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault()
              if (draft.trim() && !busy) save(draft.trim())
            }}
          >
            <div className={styles.line}>
              <input
                className={styles.input}
                type="password"
                placeholder="sk-…"
                aria-label="Workspace OpenAI API key"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              <AsciiButton type="submit" accent="cyan" disabled={!draft.trim() || busy}>
                {busy ? 'checking' : 'save'}
              </AsciiButton>
            </div>
          </form>
        </Row>
      )}
      {error && <Note tone="error">! {error}</Note>}
      <Row label="who may use it" hint={access === 'chosen' ? 'Only the members you tick; owners always may.' : 'Every member of this workspace.'}>
        <Choice label="who may use it" bare options={['everyone', 'chosen'] as const} value={access} onChange={(v) => v && setAccess(v)} />
        {access === 'chosen' && <KeyMembers wid={wid} workspace={workspace} allowed={allowed} onToggle={toggle} />}
      </Row>
    </>
  )
}

// Who may use the key, from the people list (D-098), a page at a time; owners always may, so they aren't listed.
function KeyMembers({ wid, workspace, allowed, onToggle }: { wid: string; workspace: Workspace; allowed: string[]; onToggle: (uid: string) => void }) {
  const members = useMembers(wid)
  const others = members.data.filter((m) => workspace.memberIds.includes(m.id) && !isOwnerOf(workspace, m.id))
  return (
    <div className={styles.members}>
      {members.isLoading ? (
        <Loading label="loading members…" />
      ) : others.length === 0 && !members.hasMore ? (
        <span className={styles.note}>No one else is in this workspace yet.</span>
      ) : (
        others.map((m) => (
          <label key={m.id} className={styles.member}>
            <input type="checkbox" checked={allowed.includes(m.id)} onChange={() => onToggle(m.id)} />
            <span>{m.name}</span>
            {m.email && <span className={styles.note}>{m.email}</span>}
          </label>
        ))
      )}
      {members.hasMore && (
        <button className={styles.action} onClick={members.more} disabled={members.loadingMore}>
          {members.loadingMore ? 'loading…' : 'show more'}
        </button>
      )}
    </div>
  )
}

// Which key pays in this workspace and what each task runs on (D-101), at the top of the page.
function Summary({ wid, workspace }: { wid: string; workspace: Workspace }) {
  const { user } = useAuth()
  const config = useAiConfig(wid).data
  const apiKey = useAiSettings((s) => s.apiKey)
  const keyChoice = useAiSettings((s) => s.keyChoice)
  const setKeyChoice = useAiSettings((s) => s.setKeyChoice)
  const usable = canUseWorkspaceKey(config, user?.id, isOwnerOf(workspace, user?.id))
  const source = keySourceFor({ apiKey, keyChoice }, wid, usable)
  const sources = (['workspace', 'own'] as const).filter((o) => (o === 'own' ? !!apiKey : usable))
  return <InThisWorkspace wid={wid} name={workspace.name} source={source} sources={sources} config={config} onPick={(v) => setKeyChoice(wid, v)} />
}

function WorkspaceModels({ wid, workspace }: { wid: string; workspace: Workspace }) {
  const { user } = useAuth()
  const config = useAiConfig(wid).data
  const isOwner = isOwnerOf(workspace, user?.id)
  if (!config?.hasKey && !isOwner) return null
  return <WorkspaceKeyModels wid={wid} config={config} isOwner={isOwner} usable={canUseWorkspaceKey(config, user?.id, isOwner)} />
}
