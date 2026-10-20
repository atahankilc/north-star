// Settings → assistant → keys, the model parts (D-104). Models belong to the key that pays:
// - "in this workspace": which key your calls here go on, and the model each task ends up with, and why;
// - your key's models: a default per task (only you, this browser) and, inside a workspace, its own overrides;
// - the workspace key's models: owners pick one per task and which others members may switch to; members pick within that.
import { useState } from 'react'
import { checkKey } from '../ai/openai'
import { modelChoices, ORIGIN_LABEL, ownersModel, useModels, workspaceModels } from '../ai/models'
import { AI_TASKS, MODELS, TASK_LABEL, useAiSettings, type AiTask } from '../ai/settings'
import { checkWorkspaceModel, setWorkspaceModels, type AiConfig, type KeySource } from '../data/ai'
import { AsciiButton } from './AsciiButton'
import { Choice } from './Choice'
import { Select } from './Select'
import { Note, Row, Section } from './Settings'
import styles from './AiSettings.module.css'

const TASK_HINT: Record<AiTask, string> = {
  chat: 'Questions, proposals, write-ups.',
  research: 'Messages sent with [web] on.',
  deep: '/research: its plan, researchers and report.',
}
const KEY_LABEL: Record<KeySource, string> = { own: 'your key', workspace: 'the workspace key' }

// Which key pays here and what each task runs on, with who decided. `sources`: the keys you may use here.
export function InThisWorkspace({ wid, name, source, sources, config, onPick }: {
  wid: string
  name: string
  source: KeySource | null
  sources: KeySource[]
  config: AiConfig | null
  onPick: (s: KeySource) => void
}) {
  const models = useModels(wid, source, config)
  return (
    <Section
      label={`in ${name}`}
      note="Each key has its own models, set below. The chat's header can switch the model for one conversation; that never changes these."
    >
      <Row label="calls go on" hint={sources.length > 1 ? 'Pick which key pays for your calls here.' : source ? 'The only key you can use here.' : 'Add your key below, or ask an owner for the workspace key.'}>
        {sources.length > 1 ? (
          <Choice label="calls go on" bare options={sources} value={source ?? undefined} onChange={(v) => v && onPick(v)} />
        ) : (
          <span>{source ? KEY_LABEL[source] : 'no key yet'}</span>
        )}
      </Row>
      {models &&
        AI_TASKS.map((t) => (
          <Row key={t} label={TASK_LABEL[t]} hint={TASK_HINT[t]}>
            <span className={styles.key}>{models[t].model}</span>
            <span className={styles.note}>{ORIGIN_LABEL[models[t].origin]}</span>
          </Row>
        ))}
    </Section>
  )
}

// Your own key's models: the default everywhere, or (in a workspace) this workspace's own.
export function OwnKeyModels({ wid, name }: { wid: string | null; name: string | null }) {
  const apiKey = useAiSettings((s) => s.apiKey)
  const own = useAiSettings((s) => s.ownModels)
  const setOwn = useAiSettings((s) => s.setOwnModel)
  const [scope, setScope] = useState<'everywhere' | 'here'>(wid && Object.keys(own.byWorkspace[wid] ?? {}).length ? 'here' : 'everywhere')
  const here = scope === 'here' && wid
  const check = apiKey ? (id: string) => checkKey(apiKey, id) : undefined

  return (
    <Section
      label="your key's models"
      note={
        !apiKey
          ? "You haven't added a key yet; these apply once you do."
          : here
            ? `Only in ${name}, only you, in this browser. "same as default" follows your default.`
            : 'Only you, in this browser, wherever you use your own key (unless a workspace has its own). Checked against your key before they are kept.'
      }
    >
      {wid && (
        <Row label="set for" hint="Your default, or different models for this workspace only.">
          <Choice
            label="set for"
            bare
            options={['everywhere', 'here'] as const}
            value={scope}
            onChange={(v) => v && setScope(v)}
          />
          {scope === 'here' && <span className={styles.note}>{name}</span>}
        </Row>
      )}
      {AI_TASKS.map((t) => (
        <Row key={t} label={TASK_LABEL[t]} hint={TASK_HINT[t]}>
          <ModelField
            ariaLabel={`Your key's model for ${TASK_LABEL[t]}${here ? ` in ${name}` : ''}`}
            value={here ? (own.byWorkspace[wid]?.[t] ?? '') : own.default[t]}
            base={here ? own.default[t] : undefined}
            choices={modelChoices('own', null, [own.default[t], ...(wid ? [own.byWorkspace[wid]?.[t] ?? ''] : [])].filter(Boolean))}
            allowOther
            check={check}
            onPick={(id) => setOwn(t, id, here ? wid : null)}
          />
        </Row>
      ))}
    </Section>
  )
}

// The workspace key's models: owners choose (checked by the server against the key); members pick within the list.
export function WorkspaceKeyModels({ wid, config, isOwner, usable }: { wid: string; config: AiConfig | null; isOwner: boolean; usable: boolean }) {
  const choice = useAiSettings((s) => s.wsChoice[wid])
  const setChoice = useAiSettings((s) => s.setWsChoice)
  const [error, setError] = useState<string | null>(null)
  const allowed = workspaceModels(config)
  const extras = config?.allowedModels ?? []
  const save = (patch: Parameters<typeof setWorkspaceModels>[1]) => {
    setError(null)
    setWorkspaceModels(wid, patch).catch((e: Error) => setError(e.message))
  }
  const check = config?.hasKey ? (id: string) => checkWorkspaceModel(wid, id) : undefined

  if (!isOwner) {
    return (
      <Section
        label="workspace key's models"
        note={
          usable
            ? "Set by the owners for everyone on the workspace key. Where they allow more than one, your pick is kept for you, in this browser."
            : "Set by the owners. You can't use the workspace key yet."
        }
      >
        {AI_TASKS.map((t) => (
          <Row key={t} label={TASK_LABEL[t]} hint={TASK_HINT[t]}>
            {usable && allowed.length > 1 ? (
              <ModelField
                ariaLabel={`Your model for ${TASK_LABEL[t]} on the workspace key`}
                value={choice?.[t] && allowed.includes(choice[t]!) ? choice[t]! : ''}
                base={ownersModel(config, t)}
                baseLabel="the owners' pick"
                choices={allowed}
                onPick={(id) => setChoice(wid, t, id)}
              />
            ) : (
              <span className={styles.key}>{ownersModel(config, t)}</span>
            )}
          </Row>
        ))}
      </Section>
    )
  }

  const toggle = (id: string) => save({ allowedModels: extras.includes(id) ? extras.filter((m) => m !== id) : [...extras, id] })
  const offered = [...new Set([...MODELS.map((m) => m.id), ...extras])]
  return (
    <Section
      label="workspace key's models"
      note="For everyone on the workspace key, owners included. The server refuses any model not listed here, so nobody runs up the bill with another. Each call's model is in usage."
    >
      {AI_TASKS.map((t) => (
        <Row key={t} label={TASK_LABEL[t]} hint={TASK_HINT[t]}>
          <ModelField
            ariaLabel={`Workspace key's model for ${TASK_LABEL[t]}`}
            value={ownersModel(config, t)}
            choices={[...new Set([...MODELS.map((m) => m.id), ownersModel(config, t)])]}
            allowOther
            check={check}
            onPick={(id) => save({ models: { ...config?.models, [t]: id } })}
          />
        </Row>
      ))}
      <Row label="members may also use" hint="Others they can switch to, here or in a chat. The picks above are always allowed.">
        <div className={styles.members}>
          {offered.map((id) => {
            const picked = AI_TASKS.some((t) => ownersModel(config, t) === id)
            return (
              <label key={id} className={styles.member}>
                <input type="checkbox" checked={picked || extras.includes(id)} disabled={picked} onChange={() => toggle(id)} />
                <span>{id}</span>
                {picked && <span className={styles.note}>picked above</span>}
              </label>
            )
          })}
        </div>
      </Row>
      {error && <Note tone="error">! {error}</Note>}
    </Section>
  )
}

const OTHER = '__other'
const BASE = '__base'

// One model: a list, optionally "same as <base>" ('' = follow it) and "other model id…". A new pick is checked first
// when `check` is given (a free call); until it passes the old one stays.
function ModelField({ ariaLabel, value, base, baseLabel = 'same as default', choices, allowOther, check, onPick }: {
  ariaLabel: string
  value: string
  base?: string
  baseLabel?: string
  choices: string[]
  allowOther?: boolean
  check?: (id: string) => Promise<unknown>
  onPick: (id: string) => void
}) {
  const known = !value || choices.includes(value)
  const [typing, setTyping] = useState(false)
  const [draft, setDraft] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const shown = value || base || ''

  const choose = (id: string) => {
    if (id === value) return
    setError(null)
    // Following the base needs no check.
    if (!id || !check) return onPick(id)
    setChecking(true)
    check(id)
      .then(() => onPick(id))
      .catch((e: Error) => setError(e.message))
      .finally(() => setChecking(false))
  }
  const info = MODELS.find((m) => m.id === shown)

  return (
    <div className={styles.form}>
      <div className={styles.line}>
        <Select
          className={styles.select}
          ariaLabel={ariaLabel}
          value={typing ? OTHER : value ? value : BASE}
          disabled={checking}
          options={[
            ...(base !== undefined ? [{ value: BASE, label: `${baseLabel} (${base})` }] : []),
            // The base is offered once, as "same as …".
            ...choices.filter((id) => id !== base).map((id) => ({ value: id, label: id })),
            ...(known ? [] : [{ value, label: value }]),
            ...(allowOther ? [{ value: OTHER, label: 'other model id…' }] : []),
          ]}
          onChange={(v) => {
            if (v === OTHER) return setTyping(true)
            setTyping(false)
            choose(v === BASE ? '' : v)
          }}
        />
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
            aria-label={`${ariaLabel}: model id`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
          />
          <AsciiButton type="submit" accent="cyan" disabled={!draft.trim() || checking || draft.trim() === value}>
            use
          </AsciiButton>
        </form>
      )}
      {error ? (
        <p className={styles.error}>
          ! {error} Still using {shown}.
        </p>
      ) : (
        <p className={styles.note}>{info ? info.note : shown ? `${shown}, typed in` : ''}</p>
      )}
    </div>
  )
}
