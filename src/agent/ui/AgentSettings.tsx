// Settings → the agent (S14, D-312, D-329; agent.md §4.2, §4.8; CLAUDE.md's hard rule on keys): the person's own keys,
// OpenAI's and Anthropic's, either or both (each kept only in this browser, never shown again after saving: `sk-…abcd`),
// `[check]` (each key's model list, which fills the picker), the model (works well / not tried yet; the suggested one only pre-selected), its reasoning effort, and
// this month's usage in tokens (counts only, from this browser's usage log). Three groups (D-404): keys, model, usage;
// the agent's keys (⌘J, /) are told in its lesson and `?`, not here (D-344).
import { useEffect, useState } from 'react'
import { useAuth } from '../../data/auth'
import { Choice } from '../../ui/primitives/Choice'
import { Note, Row, Section } from '../../ui/patterns/Settings'
import { Select } from '../../ui/patterns/Select'
import { canChat, claudeId, devStubWanted, FIT_WORDS, KNOWN_MODELS, pickerRows, reasons, type ProviderId } from '../models'
import { listModels, type Effort } from '../openai'
import { clearUsage, readUsage, sumUsage } from '../usage'
import { EFFORTS, PAYS, pickable, readKey, suggested, useAgentSettings, type Pay } from './settings'
import { plainError } from './errors'
import styles from './AgentSettings.module.css'
import { Button } from '../../ui/primitives/Button'
import { ButtonGroup } from '../../ui/primitives/ButtonGroup'
import { Field } from '../../ui/primitives/Field'
import { plural } from '../../model/words'
import { agreeToLab, keepKeyInAccount, labStatusOf, serverAgentOn, watchAccountKeys } from '../../data/agentServer'

const k = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))

export function AgentSettings() {
  return (
    <>
      <KeySection />
      {serverAgentOn() && <PaySection />}
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
  openai: { label: 'OpenAI key', name: 'OpenAI', where: 'From platform.openai.com → API keys.', placeholder: 'sk-…' },
  anthropic: {
    label: 'Claude key',
    name: 'Anthropic',
    where: 'From platform.claude.com → API keys.',
    placeholder: 'sk-ant-…',
  },
} as const

// Anthropic's article on the plans' monthly API credits (D-329): linked, so the rules live on their page, not here.
const CLAUDE_CREDITS = 'https://support.claude.com/en/articles/17154008-monthly-api-credits-for-max-ultra-and-team-plans'

// Where a key is kept when the agent works on the server (D-434): asked when it's saved.
type KeptWhere = 'this browser' | 'my account'
const WHERE: readonly KeptWhere[] = ['this browser', 'my account']
const WHERE_WORDS: Record<KeptWhere, string> = {
  'this browser': 'Sent with each message and deleted when the answer is done.',
  'my account': "Kept encrypted on North Star's server. Works on all your devices.",
}

function KeyRow({ provider, onSaid }: { provider: ProviderId; onSaid: (s: { text: string; tone?: 'error' } | null) => void }) {
  const s = useAgentSettings()
  const p = PROVIDERS[provider]
  const local = provider === 'anthropic' ? s.hasClaudeKey : s.hasKey
  const kept = serverAgentOn() ? s.account[provider] : undefined
  const has = local || !!kept
  const hint = local ? (provider === 'anthropic' ? s.claudeHint : s.hint) : (kept?.hint ?? '')
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [where, setWhere] = useState<KeptWhere>('this browser')

  const save = () => {
    const key = draft.trim()
    if (!key) return
    if (serverAgentOn() && where === 'my account') {
      setBusy(true)
      onSaid(null)
      void keepKeyInAccount(provider, key).then(
        () => (setDraft(''), onSaid({ text: `Kept in your account. ${p.name} accepted it.` })),
        (e) => onSaid({ text: plainError((e as Error)?.message ?? String(e)).text, tone: 'error' }),
      ).finally(() => setBusy(false))
      return
    }
    s.saveKey(key, provider)
    setDraft('')
    onSaid({ text: `Saved in this browser. [check] asks ${p.name} which models it can use.` })
  }
  const remove = () => {
    if (local) return s.removeKey(provider), onSaid({ text: 'Removed from this browser.' })
    setBusy(true)
    void keepKeyInAccount(provider, null).then(
      () => onSaid({ text: 'Removed from your account.' }),
      (e) => onSaid({ text: plainError((e as Error)?.message ?? String(e)).text, tone: 'error' }),
    ).finally(() => setBusy(false))
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
      onSaid({ text: `Your ${p.name} key works: ${plural(ids.length, 'model')} it can use for the agent.` })
    } catch (e) {
      onSaid({ text: plainError((e as Error)?.message ?? String(e)).text, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Row
      wide={!has}
      label={p.label}
      hint={
        has ? (
          local ? 'Saved in this browser.' : 'Kept in your account.'
        ) : serverAgentOn() ? (
          WHERE_WORDS[where]
        ) : provider === 'anthropic' ? (
          <>
            {p.where} A Max, Ultra or Team plan can pay for it (
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
            {local && (
              <Button onClick={() => void check()} disabled={busy}>
                {busy ? 'checking' : 'check'}
              </Button>
            )}
            <Button tone="danger" disabled={busy} onClick={remove}>
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
          {serverAgentOn() && <Choice label="keep it in" bare options={WHERE} value={where} onChange={(w: KeptWhere) => setWhere(w)} />}
          <Button tone="main" type="submit" disabled={!draft.trim() || busy}>
            {busy ? 'checking' : 'save'}
          </Button>
        </form>
      )}
    </Row>
  )
}

function KeySection() {
  const s = useAgentSettings()
  // The keys kept in their account (D-434), live while this page is open (the agent's panel needn't be).
  const uid = useAuth().user?.id
  useEffect(() => (uid && serverAgentOn() ? watchAccountKeys(uid, (a) => useAgentSettings.getState().setAccount(a)) : undefined), [uid])
  const [said, setSaid] = useState<{ text: string; tone?: 'error' } | null>(null)
  const suggest = suggested(s)
  const rows = pickerRows(pickable(s), s.model || undefined, suggest)
  const shown = s.model || suggest

  return (
    <>
      <Section
        n={1}
        label="keys"
        note={
          serverAgentOn()
            ? "The agent works on North Star's server, so your key goes there: with each message only, or kept in your account, as you choose. Never shown again, never logged. You pay the provider for what you use; set a spending limit on the key there. With no key of your own, the agent uses the workspace's key if its owners let you."
            : "Keys stay in this browser and go only to their own provider, never to the workspace or to North Star. You pay the provider for what you use. One key is enough; with none, the agent uses the workspace's key if its owners let you (workspace → agent key)."
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
      </Section>
      <Section n={2} label="model">
        <Row label="model" hint={s.model ? `${FIT_WORDS[rows.find((r) => r.id === s.model)?.fit ?? 'unknown']}. Each chat can switch it in its header.` : `Suggested: ${suggest}. Pick one to keep it; each chat can switch it.`}>
          <Select
            wide
            ariaLabel="model"
            value={shown}
            options={rows.map((r) => ({ value: r.id, label: <ModelRow id={r.id} words={r.fitWords} suggested={!s.model && r.id === suggest} /> }))}
            onChange={(v) => s.setModel(v)}
          />
        </Row>
        {reasons(shown) && (
          <Row label="reasoning" hint="How hard the model thinks before answering. High is slower and uses more tokens.">
            <Choice label="reasoning" bare options={EFFORTS} value={s.effort} onChange={(e: Effort) => s.setEffort(e)} />
          </Row>
        )}
      </Section>
    </>
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

// Who pays (D-434): the person's choice for new chats (each chat can switch it at its foot), and North Star's own key: whether
// it's open to them, this month's use of their limit, and, before its first use, how it works and their yes.
const PAY_LABEL: Record<Pay, string> = { auto: 'auto', own: 'my key', workspace: 'workspace', lab: 'North Star' }
const LAB_WORDS = {
  off: "Not open now.",
  'not invited': 'Open to invited people for now.',
  blocked: "Not open to you. Write to us from atem-lab.com/contact if that's a mistake.",
} as const

function PaySection() {
  const pay = useAgentSettings((x) => x.pay)
  const lab = useAgentSettings((x) => x.lab)
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState<string | null>(null)
  useEffect(() => void labStatusOf().then((l) => useAgentSettings.getState().setLab(l), () => {}), [])
  const agree = () => {
    setBusy(true)
    void agreeToLab()
      .then(() => labStatusOf())
      .then((l) => (useAgentSettings.getState().setLab(l), setSaid("Thanks. North Star's key is yours to use.")), (e) => setSaid(plainError((e as Error)?.message ?? String(e)).text))
      .finally(() => setBusy(false))
  }
  const eur = (c: number) => `€${(c / 100).toFixed(2)}`
  return (
    <Section n={3} label="who pays">
      <Row label="new chats" hint="Auto: your own key, else the workspace's when its owners let you, else North Star's. Each chat can switch it by its prompt.">
        <Select ariaLabel="who pays for new chats" value={pay} options={PAYS.map((p) => ({ value: p, label: PAY_LABEL[p] }))} onChange={(p) => useAgentSettings.getState().setPay(p as Pay)} />
      </Row>
      <Row
        label="North Star's key"
        wide={lab?.state === 'open' && !lab.agreed}
        hint={
          !lab ? 'Asking…' : lab.state !== 'open' ? LAB_WORDS[lab.state] : lab.agreed ? `${eur(lab.usedCents)} of ${eur(lab.limitCents)} this month. It starts again on ${lab.resets}. Models: ${lab.models.join(', ')}.` : (
            <>
              A free allowance of {eur(lab.limitCents)} a month, paid by North Star. Your requests and the workspace content they need go through North
              Star's server to OpenAI; we keep counts and cost, never your words; OpenAI keeps abuse logs for 30 days. It can change or stop.{' '}
              <a href="https://atem-lab.com/privacy" target="_blank" rel="noreferrer">
                Privacy
              </a>
            </>
          )
        }
      >
        {lab?.state === 'open' && !lab.agreed ? (
          <Button tone="main" disabled={busy} onClick={agree}>
            {busy ? 'saving' : 'I agree, use it'}
          </Button>
        ) : (
          <span className={styles.usage}>{lab?.state === 'open' ? 'yours to use' : ''}</span>
        )}
      </Row>
      {said && <Note>{said}</Note>}
    </Section>
  )
}

function UsageSection() {
  const [, redraw] = useState(0)
  const now = new Date()
  const since = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const u = sumUsage(readUsage(), since)
  return (
    <Section n={serverAgentOn() ? 4 : 3} label="usage">
      <Row label="this month" hint={`Since ${new Date(since).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}. Counts only, kept in this browser: never your messages or your key.`}>
        <span className={styles.usage}>
          {plural(u.answers, 'answer')} · {k(u.input)} in{u.cached ? ` (${k(u.cached)} cached)` : ''} · {k(u.output)} out
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
