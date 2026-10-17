// The assistant's keys (D-073, D-079): your own OpenAI key (only in this browser, D-006), the workspace's shared key
// (kept on the server; the owner picks who may use it), which one this workspace uses, and a model per task (D-077).
// The key form also shows inside the chat panel when no key is set.
import { useContext, useEffect, useState, type FormEvent } from 'react'
import { checkKey } from '../ai/openai'
import { MODELS, keySourceFor, maskKey, useAiSettings, type AiTask } from '../ai/settings'
import {
  canUseWorkspaceKey,
  listMembers,
  setKeyAccess,
  setWorkspaceKey,
  useAiConfig,
  type AiConfig,
  type KeyAccess,
  type Member,
  workspaceKeysAvailable,
} from '../data/ai'
import { useAuth } from '../data/auth'
import { WorkspaceContext } from '../views/workspace/context'
import { Choice } from './Choice'
import { AsciiButton } from './AsciiButton'
import styles from './AiSettings.module.css'
import { Row, Section } from './Settings'

export const KEY_PRIVACY =
  'Kept only in this browser and sent only to OpenAI, never to North Star or your collaborators. Each person uses their own key.'

export function AiKeyForm({ onSaved }: { onSaved?: () => void }) {
  const model = useAiSettings((s) => s.models.chat)
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
          {checking ? 'Checking' : 'Save'}
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
      <Section label="your key">
        {apiKey && !replacing ? (
          <Row label="key">
            <span className={styles.key}>{maskKey(apiKey)}</span>
            <button className={styles.action} onClick={() => setReplacing(true)}>
              replace
            </button>
            <button className={styles.action} data-tone="danger" onClick={() => setKey('')}>
              remove
            </button>
          </Row>
        ) : (
          <Row label="key">
            <AiKeyForm onSaved={() => setReplacing(false)} />
          </Row>
        )}
        <p className={styles.note}>
          {KEY_PRIVACY} Get one at{' '}
          <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">
            platform.openai.com/api-keys
          </a>
          .
        </p>
      </Section>
      {ws && !workspaceKeysAvailable ? (
        <Section label="workspace key">
          <p className={styles.note}>
            Coming soon: the owner sets one key that chosen members use, kept on North Star&apos;s server where nobody can
            read it. For now everyone uses their own key.
          </p>
        </Section>
      ) : ws ? (
        <WorkspaceKey wid={ws.wid} ownerId={ws.workspace.ownerId} memberIds={ws.workspace.memberIds} />
      ) : (
        <Section label="workspace key">
          <p className={styles.note}>Open a workspace to see or set its shared key.</p>
        </Section>
      )}
      <Section label="models">
        <Row label="chat">
          <ModelPicker task="chat" />
        </Row>
        <Row label="research">
          <ModelPicker task="research" />
        </Row>
        <p className={styles.note}>
          Chat answers questions and proposes changes; research is used for messages sent with [web] on, where a stronger
          model finds and reads more. Each message sends the whole workspace, so reading is most of a call&apos;s cost; see
          usage for what each call used.
        </p>
      </Section>
      <Section label="what it sees">
        <p className={styles.note}>
          When you ask something, the workspace you&apos;re in (cards, links, competitors, the matrix) goes to OpenAI with your
          question. The chat stays in this tab and is gone when you reload. It only changes the workspace when you apply
          one of its proposals.
        </p>
      </Section>
    </>
  )
}

// The workspace's shared key (D-079): the owner sets it and picks who may use it; it never comes back to any browser.
function WorkspaceKey({ wid, ownerId, memberIds }: { wid: string; ownerId: string; memberIds: string[] }) {
  const { user } = useAuth()
  const config = useAiConfig(wid).data
  const apiKey = useAiSettings((s) => s.apiKey)
  const choice = useAiSettings((s) => s.keyChoice[wid])
  const setKeyChoice = useAiSettings((s) => s.setKeyChoice)
  const isOwner = user?.id === ownerId
  const usable = canUseWorkspaceKey(config, user?.id, ownerId)
  const source = keySourceFor({ apiKey, keyChoice: choice ? { [wid]: choice } : {} }, wid, usable)

  return (
    <Section label="workspace key">
      {isOwner ? (
        <OwnerKey wid={wid} ownerId={ownerId} memberIds={memberIds} config={config} />
      ) : (
        <Row label="key">
          <span className={styles.key}>
            {!config?.hasKey ? 'none' : usable ? `${config.keyHint ?? 'set'} · you may use it` : "set · the owner hasn't let you use it"}
          </span>
        </Row>
      )}
      {(usable || apiKey) && (
        <Choice
          label="this workspace uses"
          options={(['workspace', 'own'] as const).filter((o) => (o === 'own' ? apiKey : usable))}
          value={source ?? undefined}
          onChange={(v) => v && setKeyChoice(wid, v)}
        />
      )}
      <p className={styles.note}>
        {isOwner
          ? 'Your key is sent once to North Star\'s server, kept encrypted there and never shown to anyone again, you included. Calls on it go through the server, which logs what each one used (usage). Anyone may still use their own key instead.'
          : 'The owner pays for the workspace key; the owner sees what you use on it. Calls on your own key are seen only by you.'}
      </p>
    </Section>
  )
}

function OwnerKey({ wid, ownerId, memberIds, config }: { wid: string; ownerId: string; memberIds: string[]; config: AiConfig | null }) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [replacing, setReplacing] = useState(false)
  const [members, setMembers] = useState<Member[] | null>(null)
  const access = config?.access ?? 'chosen'
  const allowed = config?.allowed ?? []

  // Names come from the server (the workspace only holds ids); fetched again whenever someone joins or leaves.
  const memberKey = memberIds.join(',')
  useEffect(() => {
    let live = true
    listMembers(wid)
      .then((m) => live && setMembers(m))
      .catch(() => live && setMembers([]))
    return () => {
      live = false
    }
  }, [wid, memberKey])

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
        <Row label="key">
          <span className={styles.key}>{config.keyHint}</span>
          <button className={styles.action} onClick={() => setReplacing(true)}>
            replace
          </button>
          <button className={styles.action} data-tone="danger" disabled={busy} onClick={() => save('')}>
            remove
          </button>
        </Row>
      ) : (
        <Row label="key">
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
                placeholder="sk-… (paid by you, used by the people you pick)"
                aria-label="Workspace OpenAI API key"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              <AsciiButton type="submit" accent="cyan" disabled={!draft.trim() || busy}>
                {busy ? 'Checking' : 'Save'}
              </AsciiButton>
            </div>
          </form>
        </Row>
      )}
      {error && <p className={styles.error}>! {error}</p>}
      <Choice label="who may use it" options={['everyone', 'chosen'] as const} value={access} onChange={(v) => v && setAccess(v)} />
      {access === 'chosen' && (
        <div className={styles.members}>
          {members === null ? (
            <span className={styles.note}>loading members…</span>
          ) : (
            // The owner always may; the list is everyone else.
            members
              .filter((m) => m.uid !== ownerId)
              .map((m) => (
                <label key={m.uid} className={styles.member}>
                  <input type="checkbox" checked={allowed.includes(m.uid)} onChange={() => toggle(m.uid)} />
                  <span>{m.name}</span>
                  {m.email && <span className={styles.note}>{m.email}</span>}
                </label>
              ))
          )}
        </div>
      )}
    </>
  )
}

const OTHER = '__other'

// A model for one task: one of MODELS, or any id typed in. Checked against your key (a free call) before it's kept.
function ModelPicker({ task }: { task: AiTask }) {
  const apiKey = useAiSettings((s) => s.apiKey)
  const current = useAiSettings((s) => s.models[task])
  const setModel = useAiSettings((s) => s.setModel)
  const known = MODELS.some((m) => m.id === current)
  const [typing, setTyping] = useState(!known)
  const [draft, setDraft] = useState(known ? '' : current)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const choose = (id: string) => {
    if (!id || id === current) return
    setError(null)
    if (!apiKey) return setModel(task, id)
    setChecking(true)
    checkKey(apiKey, id)
      .then(() => setModel(task, id))
      .catch((err: Error) => setError(err.message))
      .finally(() => setChecking(false))
  }

  const info = MODELS.find((m) => m.id === current)

  return (
    <div className={styles.form}>
      <div className={styles.line}>
        <select
          className={styles.select}
          aria-label={`Model for ${task}`}
          value={typing ? OTHER : current}
          disabled={checking}
          onChange={(e) => {
            if (e.target.value === OTHER) return setTyping(true)
            setTyping(false)
            choose(e.target.value)
          }}
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.id}
            </option>
          ))}
          <option value={OTHER}>other model id…</option>
        </select>
        {checking && <span className={styles.note}>checking…</span>}
      </div>
      {typing && (
        <form
          className={styles.line}
          onSubmit={(e) => {
            e.preventDefault()
            choose(draft.trim())
          }}
        >
          <input
            className={styles.input}
            placeholder="e.g. gpt-6-sol"
            aria-label={`Model id for ${task}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
          />
          <AsciiButton type="submit" accent="cyan" disabled={!draft.trim() || checking || draft.trim() === current}>
            Use
          </AsciiButton>
        </form>
      )}
      {error ? (
        <p className={styles.error}>
          ! {error} Still using {current}.
        </p>
      ) : (
        <p className={styles.note}>{info ? info.note : `${current}, typed in`}</p>
      )}
    </div>
  )
}
