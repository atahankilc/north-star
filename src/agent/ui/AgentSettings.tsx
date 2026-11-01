// Settings → the agent (S14, D-312, D-329; agent.md §4.2, §4.8; CLAUDE.md's hard rule on keys): the person's own keys,
// OpenAI's and Anthropic's, either or both (each kept only in this browser, never shown again after saving: `sk-…abcd`),
// `[check]` (each key's model list, which fills the picker), the model (works well / not tried yet; the suggested one only pre-selected), its reasoning effort, and
// this month's usage in tokens (counts only, from this browser's usage log).
import { useState } from 'react'
import { Choice } from '../../ui/primitives/Choice'
import { Note, Row, Section } from '../../ui/patterns/Settings'
import { Select } from '../../ui/primitives/Select'
import { canChat, claudeId, devStubWanted, FIT_WORDS, KNOWN_MODELS, pickerRows, reasons, type ProviderId } from '../models'
import { listModels, type Effort } from '../openai'
import { clearUsage, readUsage, sumUsage } from '../usage'
import { EFFORTS, pickable, readKey, suggested, useAgentSettings } from './settings'
import { plainError } from './errors'
import styles from './AgentSettings.module.css'
import { Button } from '../../ui/primitives/Button'
import { ButtonGroup } from '../../ui/primitives/ButtonGroup'
import { Field } from '../../ui/primitives/Field'

const k = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))

export function AgentSettings() {
  return (
    <>
      <KeySection />
      <UsageSection />
      {import.meta.env.DEV && (
        <Note>
          Dev only: add <code>?agentStub=1</code> to the address (or set <code>northstar.agentStub</code> to 1) to try the agent without a key: scripted
          answers on the real tools, no provider called.{devStubWanted() ? ' It is on in this tab.' : ''}
        </Note>
      )}
    </>
  )
}

// One provider's key: pasted once, kept in this browser, shown only as `sk-…abcd`; [check] asks that provider which
// models the key can use (they fill the picker).
const PROVIDERS = {
  openai: { label: 'openai key', name: 'OpenAI', where: 'Paste a key from platform.openai.com → API keys.', placeholder: 'sk-…' },
  anthropic: {
    label: 'claude key',
    name: 'Anthropic',
    where: 'Paste a key from platform.claude.com → API keys.',
    placeholder: 'sk-ant-…',
  },
} as const

// Anthropic's article on the plans' monthly API credits (D-329): linked, so the rules live on their page, not here.
const CLAUDE_CREDITS = 'https://support.claude.com/en/articles/17154008-monthly-api-credits-for-max-ultra-and-team-plans'

function KeyRow({ provider, onSaid }: { provider: ProviderId; onSaid: (s: { text: string; tone?: 'error' } | null) => void }) {
  const s = useAgentSettings()
  const p = PROVIDERS[provider]
  const has = provider === 'anthropic' ? s.hasClaudeKey : s.hasKey
  const hint = provider === 'anthropic' ? s.claudeHint : s.hint
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const save = () => {
    const key = draft.trim()
    if (!key) return
    s.saveKey(key, provider)
    setDraft('')
    onSaid({ text: `Saved in this browser. [check] asks ${p.name} which models it can use.` })
  }

  const check = async () => {
    setBusy(true)
    onSaid(null)
    try {
      if (devStubWanted()) {
        const known = KNOWN_MODELS.filter((m) => m.provider === provider).map((m) => m.id)
        if (provider === 'anthropic') s.setClaudeModels(known)
        else s.setModels(known)
        onSaid({ text: 'Dev stub on: models not asked for (the known ones are listed).' })
        return
      }
      let ids: string[]
      if (provider === 'anthropic') {
        const { listClaudeModels } = await import('../anthropic')
        ids = (await listClaudeModels(readKey('anthropic'))).map(claudeId).filter(canChat)
        s.setClaudeModels(ids)
      } else {
        ids = (await listModels(readKey())).filter(canChat)
        s.setModels(ids)
      }
      onSaid({ text: `Your ${p.name} key works: ${ids.length} model${ids.length === 1 ? '' : 's'} it can use for the agent.` })
    } catch (e) {
      onSaid({ text: plainError((e as Error)?.message ?? String(e)).text, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Row
      label={p.label}
      hint={
        has ? (
          'Saved in this browser.'
        ) : provider === 'anthropic' ? (
          <>
            {p.where} A Max, Ultra or Team plan&apos;s monthly API credits pay for it when the key comes from the Console organisation linked to
            the plan (
            <a href={CLAUDE_CREDITS} target="_blank" rel="noreferrer">
              how
            </a>
            ).
          </>
        ) : (
          p.where
        )
      }
    >
      {has ? (
        <>
          <span className={styles.hint} aria-label={`your ${p.name} key, shortened`}>
            {hint}
          </span>
          <ButtonGroup>
            <Button onClick={() => void check()} disabled={busy}>
              {busy ? 'checking' : 'check'}
            </Button>
            <Button tone="danger" onClick={() => (s.removeKey(provider), onSaid({ text: 'Removed from this browser.' }))}>
              remove
            </Button>
          </ButtonGroup>
        </>
      ) : (
        <form
          className={styles.keyForm}
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <Field
            className={styles.input}
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={p.placeholder}
            label={`your ${p.name} key`}
            value={draft}
            onChange={setDraft}
          />
          <Button tone="primary" type="submit" disabled={!draft.trim()}>
            save
          </Button>
        </form>
      )}
    </Row>
  )
}

function KeySection() {
  const s = useAgentSettings()
  const [said, setSaid] = useState<{ text: string; tone?: 'error' } | null>(null)
  const suggest = suggested(s)
  const rows = pickerRows(pickable(s), s.model || undefined, suggest)
  const shown = s.model || suggest

  return (
    <Section
      label="your keys"
      note={
        <p>
          Your keys are stored only in this browser (its local storage). Each goes only to its own provider (OpenAI or Anthropic), with each request
          the agent makes on one of its models. They are never saved in the workspace, never sent to North Star or anyone else, and never shown
          again here. You pay the provider for what you use; the chat shows the tokens of each answer. One key is enough.
        </p>
      }
    >
      <KeyRow provider="openai" onSaid={setSaid} />
      <KeyRow provider="anthropic" onSaid={setSaid} />
      {said && (
        <p className={styles.said} data-tone={said.tone}>
          {said.tone === 'error' ? '! ' : ''}
          {said.text}
        </p>
      )}
      <Row label="model" hint={s.model ? `${FIT_WORDS[rows.find((r) => r.id === s.model)?.fit ?? 'unknown']}. Each chat can switch it in its header.` : `Suggested: ${suggest}. Pick one to keep it; each chat can switch it.`}>
        <Select
          ariaLabel="model"
          value={shown}
          options={rows.map((r) => ({ value: r.id, label: <ModelRow id={r.id} words={r.fitWords} suggested={!s.model && r.id === suggest} /> }))}
          onChange={(v) => s.setModel(v)}
        />
      </Row>
      {reasons(shown) && (
        <Row label="reasoning" hint="How hard the model thinks before answering. Medium is a good start; high is slower and uses more tokens.">
          <Choice label="reasoning" bare options={EFFORTS} value={s.effort} onChange={(e: Effort) => s.setEffort(e)} />
        </Row>
      )}
      <Row label="keys" hint="⌘J opens or folds the agent; / opens it when nothing has the keyboard. On Windows and Linux it's Ctrl+J, which in a workspace takes the place of the browser's Downloads shortcut.">
        <span className={styles.usage}>⌘J · /</span>
      </Row>
    </Section>
  )
}

function ModelRow({ id, words, suggested }: { id: string; words: string; suggested: boolean }) {
  return (
    <span className={styles.modelRow}>
      {id}
      <span className={styles.fit}>
        {words}
        {suggested ? ' · suggested' : ''}
      </span>
    </span>
  )
}

function UsageSection() {
  const [, redraw] = useState(0)
  const now = new Date()
  const since = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const u = sumUsage(readUsage(), since)
  return (
    <Section label="usage" note="Counts only, kept in this browser: never your messages, the workspace's content or your key.">
      <Row label="this month" hint={`Since ${new Date(since).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}.`}>
        <span className={styles.usage}>
          {u.answers} answer{u.answers === 1 ? '' : 's'} · {k(u.input)} in{u.cached ? ` (${k(u.cached)} cached)` : ''} · {k(u.output)} out
        </span>
        {u.answers > 0 && (
          <Button onClick={() => (clearUsage(), redraw((n) => n + 1))}>
            clear
          </Button>
        )}
      </Row>
    </Section>
  )
}
