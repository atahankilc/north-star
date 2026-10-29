// Settings → the agent (S14, D-312; agent.md §4.2, §4.8; CLAUDE.md's hard rule on keys): the person's own OpenAI key
// (kept only in this browser, never shown again after saving: `sk-…abcd`), `[check]` (the key's model list, which fills
// the picker), the model (works well / not tried yet; the suggested one only pre-selected), its reasoning effort, and
// this month's usage in tokens (counts only, from this browser's usage log).
import { useState } from 'react'
import { Choice } from '../../ui/Choice'
import { Note, Row, Section } from '../../ui/Settings'
import { Select } from '../../ui/Select'
import { canChat, devStubWanted, FIT_WORDS, KNOWN_MODELS, pickerRows, reasons, SUGGESTED } from '../models'
import { listModels, type Effort } from '../openai'
import { clearUsage, readUsage, sumUsage } from '../usage'
import { EFFORTS, readKey, useAgentSettings } from './settings'
import { plainError } from './errors'
import styles from './AgentSettings.module.css'

const k = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))

export function AgentSettings() {
  return (
    <>
      <KeySection />
      <UsageSection />
      {import.meta.env.DEV && (
        <Note>
          Dev only: add <code>?agentStub=1</code> to the address (or set <code>northstar.agentStub</code> to 1) to try the agent without a key: scripted
          answers on the real tools, no OpenAI call.{devStubWanted() ? ' It is on in this tab.' : ''}
        </Note>
      )}
    </>
  )
}

function KeySection() {
  const s = useAgentSettings()
  const [draft, setDraft] = useState('')
  const [said, setSaid] = useState<{ text: string; tone?: 'error' } | null>(null)
  const [busy, setBusy] = useState(false)
  const rows = pickerRows(s.models.length ? s.models : KNOWN_MODELS.map((m) => m.id), s.model || undefined)
  const shown = s.model || SUGGESTED

  const save = () => {
    const key = draft.trim()
    if (!key) return
    s.saveKey(key)
    setDraft('')
    setSaid({ text: 'Saved in this browser. [check] asks OpenAI which models it can use.' })
  }

  const check = async () => {
    setBusy(true)
    setSaid(null)
    try {
      if (devStubWanted()) {
        s.setModels(KNOWN_MODELS.map((m) => m.id))
        setSaid({ text: 'Dev stub on: models not asked for (the known ones are listed).' })
        return
      }
      const ids = (await listModels(readKey())).filter(canChat)
      s.setModels(ids)
      setSaid({ text: `Your key works: ${ids.length} model${ids.length === 1 ? '' : 's'} it can use for the agent.` })
    } catch (e) {
      setSaid({ text: plainError((e as Error)?.message ?? String(e)).text, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section
      label="your key"
      note={
        <p>
          Your key is stored only in this browser (its local storage) and goes only to OpenAI, with each request the agent makes. It is never saved
          in the workspace, never sent to North Star or anyone else, and never shown again here. You pay OpenAI for what you use; the chat shows the
          tokens of each answer.
        </p>
      }
    >
      <Row label="openai key" hint={s.hasKey ? 'Saved in this browser.' : 'Paste a key from platform.openai.com → API keys.'}>
        {s.hasKey ? (
          <>
            <span className={styles.hint} aria-label="your key, shortened">
              {s.hint}
            </span>
            <button className={styles.action} data-tone="primary" onClick={() => void check()} disabled={busy}>
              {busy ? 'checking' : 'check'}
            </button>
            <button className={styles.action} data-tone="danger" onClick={() => (s.removeKey(), setSaid({ text: 'Removed from this browser.' }))}>
              remove
            </button>
          </>
        ) : (
          <form
            className={styles.keyForm}
            onSubmit={(e) => {
              e.preventDefault()
              save()
            }}
          >
            <input
              className={styles.input}
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-…"
              aria-label="your OpenAI key"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button className={styles.action} data-tone="primary" type="submit" disabled={!draft.trim()}>
              save
            </button>
          </form>
        )}
      </Row>
      {said && (
        <p className={styles.said} data-tone={said.tone}>
          {said.tone === 'error' ? '! ' : ''}
          {said.text}
        </p>
      )}
      <Row label="model" hint={s.model ? `${FIT_WORDS[rows.find((r) => r.id === s.model)?.fit ?? 'unknown']}. Each chat can switch it in its header.` : `Suggested: ${SUGGESTED}. Pick one to keep it; each chat can switch it.`}>
        <Select
          ariaLabel="model"
          className={styles.select}
          value={shown}
          options={rows.map((r) => ({ value: r.id, label: <ModelRow id={r.id} words={r.fitWords} suggested={!s.model && r.id === SUGGESTED} /> }))}
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
          <button className={styles.action} onClick={() => (clearUsage(), redraw((n) => n + 1))}>
            clear
          </button>
        )}
      </Row>
    </Section>
  )
}
