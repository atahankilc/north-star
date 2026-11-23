// Settings → workspace → agent key (D-079, D-427): an OpenAI key the owners give the workspace, so members they allow use
// the agent without a key of their own. Owners save it (checked with OpenAI, then kept only encrypted on the server: no
// browser sees it again, not even theirs; `sk-…abcd` is all that's shown), replace or remove it, say who may use it
// (owners always, viewers never: D-098, D-318) and which models it runs. Everyone else reads whether they may.
// Laid out as every settings page (D-404): numbered groups, a setting's control at its row's right edge.
import { useState, type FormEvent } from 'react'
import { useAuth } from '../../../data/auth'
import type { Role } from '../../../data/model'
import { roleOf, useMembers } from '../../../data/workspaces'
import { mayUseWorkspaceKey, setKeyAccess, setKeyModels, setWorkspaceKey, useAiConfig, type AiConfig, type KeyAccess } from '../../../data/workspaceKey'
import { FIT_WORDS, KNOWN_MODELS, SUGGESTED } from '../../../agent/models'
import { Button } from '../../../ui/primitives/Button'
import { ButtonGroup } from '../../../ui/primitives/ButtonGroup'
import { Checkbox } from '../../../ui/primitives/Checkbox'
import { Choice } from '../../../ui/primitives/Choice'
import { Field } from '../../../ui/primitives/Field'
import { Note, Row, Section } from '../../../ui/patterns/Settings'
import type { WorkspaceCtx } from '../canvas/context'
import styles from './WorkspaceKeySettings.module.css'

type Props = { wid: string; workspace: WorkspaceCtx['workspace'] }

export function WorkspaceKeySettings({ wid, workspace }: Props) {
  const { user } = useAuth()
  const config = useAiConfig(wid).data
  const members = useMembers(wid).data
  const names = new Map(members.map((m) => [m.id, m.name]))
  return <WorkspaceKeyView wid={wid} workspace={workspace} me={user?.id} config={config} names={names} />
}

const OPENAI_MODELS = KNOWN_MODELS.filter((m) => m.provider === 'openai')
const ACCESS: readonly KeyAccess[] = ['everyone', 'chosen']

// The page itself, on what it's given (the gallery draws it on made-up config).
export function WorkspaceKeyView({ wid, workspace, me, config, names }: Props & { me: string | undefined; config: AiConfig | null; names: Map<string, string> }) {
  const role: Role | null = roleOf(workspace, me)
  const owner = role === 'owner'
  const [said, setSaid] = useState<{ text: string; tone?: 'error' } | null>(null)
  const [busy, setBusy] = useState(false)
  const [replacing, setReplacing] = useState(false)
  const has = !!config?.hasKey

  const run = async (what: () => Promise<unknown>, done: string) => {
    setBusy(true)
    setSaid(null)
    try {
      await what()
      setSaid({ text: done })
    } catch (e) {
      setSaid({ text: (e as Error)?.message ?? String(e), tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  if (!owner) {
    const may = mayUseWorkspaceKey(config, me, role)
    return (
      <Section>
        <Row label="agent key" hint="An OpenAI key the owners give the workspace. Your own key, if you saved one, always goes first.">
          <span className={styles.state}>
            {!has
              ? 'none: an owner can add one'
              : may
                ? 'yours to use: the agent takes it when you have no OpenAI key of your own'
                : role === 'viewer'
                  ? 'viewers use their own key'
                  : "the owners haven't let you use it"}
          </span>
        </Row>
      </Section>
    )
  }

  const editors = Object.entries(workspace.roles ?? {})
    .filter(([uid, r]) => r === 'editor' && workspace.memberIds.includes(uid))
    .map(([uid]) => uid)
  const access = config?.access ?? 'chosen'
  const allowed = config?.allowed ?? []
  const models = config?.allowedModels ?? []

  return (
    <>
      <Section
        n={1}
        label="key"
        note="One OpenAI key for everyone's agent, paid by whoever owns the key. It's sent once to North Star's server and kept there encrypted: no browser sees it again, not even yours."
      >
        <Row label="OpenAI key" wide={!has || replacing} hint={has && !replacing ? 'Kept encrypted on the server.' : 'From platform.openai.com → API keys. OpenAI checks it before it is kept.'}>
          {has && !replacing ? (
            <>
              <span className={styles.hint} aria-label="the workspace's key, shortened">
                {config?.keyHint}
              </span>
              <ButtonGroup>
                <Button onClick={() => setReplacing(true)} disabled={busy}>
                  replace
                </Button>
                <Button tone="danger" disabled={busy} onClick={() => void run(() => setWorkspaceKey(wid, null), 'Removed: nobody uses the workspace key now.')}>
                  remove
                </Button>
              </ButtonGroup>
            </>
          ) : (
            <KeyForm
              busy={busy}
              onCancel={replacing ? () => setReplacing(false) : undefined}
              onSave={(key) =>
                void run(async () => {
                  await setWorkspaceKey(wid, key, models.length ? undefined : [SUGGESTED])
                  setReplacing(false)
                }, 'Saved. Choose below who may use it.')
              }
            />
          )}
        </Row>
        {said && <Note tone={said.tone}>{said.tone === 'error' ? `! ${said.text}` : said.text}</Note>}
      </Section>
      {has && (
        <>
          <Section n={2} label="who" note="Owners always use it; viewers never do (they use their own key).">
            <Row label="editors" hint={access === 'everyone' ? 'Every editor, now and later.' : 'Only the editors ticked.'}>
              <Choice label="who may use the key" bare options={ACCESS} value={access} onChange={(a: KeyAccess) => void setKeyAccess(wid, a, allowed)} />
            </Row>
            {access === 'chosen' &&
              (editors.length ? (
                editors.map((uid) => (
                  <Row key={uid} label={names.get(uid) ?? 'someone'}>
                    <Checkbox
                      aria-label={`let ${names.get(uid) ?? 'them'} use the key`}
                      checked={allowed.includes(uid)}
                      onChange={(on) => void setKeyAccess(wid, access, on ? [...allowed, uid] : allowed.filter((x) => x !== uid))}
                    />
                  </Row>
                ))
              ) : (
                <Note>No editors yet: make someone an editor in people.</Note>
              ))}
          </Section>
          <Section n={3} label="models" note="The models the workspace key runs. A model not ticked is refused, so nobody spends on one you didn't choose.">
            {OPENAI_MODELS.map((m) => (
              <Row key={m.id} label={m.id} hint={`${FIT_WORDS[m.fit]}${m.id === SUGGESTED ? ' · suggested' : ''}`}>
                <Checkbox
                  aria-label={`run ${m.id} on the workspace key`}
                  checked={models.includes(m.id)}
                  onChange={(on) => void setKeyModels(wid, on ? [...models, m.id] : models.filter((x) => x !== m.id))}
                />
              </Row>
            ))}
          </Section>
        </>
      )}
    </>
  )
}

function KeyForm({ busy, onSave, onCancel }: { busy: boolean; onSave: (key: string) => void; onCancel?: () => void }) {
  const [draft, setDraft] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (draft.trim()) onSave(draft.trim())
  }
  return (
    <form className={styles.keyForm} onSubmit={submit}>
      <Field className={styles.input} type="password" autoComplete="off" spellCheck={false} placeholder="sk-…" label="the workspace's OpenAI key" value={draft} onChange={setDraft} />
      <ButtonGroup>
        {onCancel && (
          <Button type="button" onClick={onCancel}>
            cancel
          </Button>
        )}
        <Button tone="main" type="submit" disabled={!draft.trim() || busy}>
          {busy ? 'checking' : 'save'}
        </Button>
      </ButtonGroup>
    </form>
  )
}
