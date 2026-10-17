// The assistant's settings (D-073): your OpenAI key (only in this browser, D-006) and the model.
// The key form also shows inside the chat panel when no key is set.
import { useState, type FormEvent } from 'react'
import { checkKey } from '../ai/openai'
import { maskKey, useAiSettings } from '../ai/settings'
import { AsciiButton } from './AsciiButton'
import styles from './AiSettings.module.css'
import { Row, Section } from './Settings'

export const KEY_PRIVACY =
  'Kept only in this browser and sent only to OpenAI, never to North Star or your collaborators. Each person uses their own key.'

export function AiKeyForm({ onSaved }: { onSaved?: () => void }) {
  const model = useAiSettings((s) => s.model)
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

export function AiSettingsPage() {
  const apiKey = useAiSettings((s) => s.apiKey)
  const model = useAiSettings((s) => s.model)
  const setKey = useAiSettings((s) => s.setKey)
  const [replacing, setReplacing] = useState(false)

  return (
    <>
      <Section label="openai key">
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
      <Section label="model">
        <Row label="model">{model}</Row>
        <p className={styles.note}>
          OpenAI's cheapest current model, billed to your key (about $0.10 per million tokens read). Picking a model per
          task comes with the assistant's tools.
        </p>
      </Section>
      <Section label="what it sees">
        <p className={styles.note}>
          When you ask something, the workspace you're in (cards, links, competitors, the matrix) goes to OpenAI with your
          question. The chat stays in this tab and is gone when you reload. It can't change anything yet.
        </p>
      </Section>
    </>
  )
}
