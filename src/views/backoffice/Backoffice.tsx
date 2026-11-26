// The backoffice (D-434, docs/specs/agent-server.md §10): North Star's key for a lab admin. `/backoffice`, its own chunk,
// for anyone else the workspaces page. Laid out as Settings (D-404): the side list, a head that stays, numbered groups.
// Read in one call (`labBoard`), again after each change and on `refresh`; every change goes through a function that asks
// for a sign-in of the last hour and writes the audit log. Money in euros at the month's rate; counts, never words.
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { WORKSPACES } from '../../app/paths'
import type { AuthUser } from '../../data/auth'
import { inviteToLab, loadBoard, setLab, setLabKey, setLabPerson, stopLabRun, useLabAdmin } from '../../data/backoffice'
import { csv, forecast, type Board, type BoardPerson } from '../../agent/labBoard'
import { microToCents } from '../../agent/money'
import { KNOWN_MODELS } from '../../agent/models'
import { useHoldCurtain } from '../../state/curtain'
import { Button } from '../../ui/primitives/Button'
import { ButtonGroup } from '../../ui/primitives/ButtonGroup'
import { Checkbox } from '../../ui/primitives/Checkbox'
import { Choice } from '../../ui/primitives/Choice'
import { CommitField } from '../../ui/primitives/CommitField'
import { Empty } from '../../ui/primitives/Empty'
import { Field } from '../../ui/primitives/Field'
import { HazardConfirm } from '../../ui/patterns/HazardConfirm'
import { Select } from '../../ui/patterns/Select'
import { Note, Row, Section } from '../../ui/patterns/Settings'
import { SideList } from '../../ui/patterns/SideList'
import styles from './Backoffice.module.css'

type Page = 'overview' | 'people' | 'runs' | 'calls' | 'key' | 'audit' | 'health'
const PAGES: { id: Page; label: string; title: string; about: string }[] = [
  { id: 'overview', label: 'overview', title: 'Overview', about: "North Star's key this month: what it cost, who used it, and the switch." },
  { id: 'people', label: 'people', title: 'People', about: 'Everyone who used it, was invited, agreed or was blocked: their month, their limit.' },
  { id: 'runs', label: 'runs', title: 'Runs', about: "The agent's runs paid by it, newest first; one still going can be stopped." },
  { id: 'calls', label: 'calls', title: 'Calls', about: 'Each model call: tokens and cost, never what was said.' },
  { id: 'key', label: 'key and limits', title: 'Key and limits', about: 'The key, its models, the limit a person and in total, who may use it.' },
  { id: 'audit', label: 'audit', title: 'Audit', about: 'Every change to it: who, when, before and after. Chained, so none can be changed quietly.' },
  { id: 'health', label: 'health', title: 'Health', about: 'What needs looking at now.' },
]

export function Backoffice({ user }: { user: AuthUser }) {
  const { loading, admin } = useLabAdmin(user.id)
  const [board, setBoard] = useState<Board | null>(null)
  const [error, setError] = useState<string | null>(null)
  const read = useCallback(() => {
    setError(null)
    return loadBoard().then(setBoard, (e: Error) => setError(e.message))
  }, [])
  useEffect(() => {
    if (admin) void read()
  }, [admin, read])
  useHoldCurtain('backoffice', loading || (admin && !board && !error))
  if (loading) return null
  if (!admin) return <Navigate to={WORKSPACES} replace />
  return <BackofficeView board={board} error={error} onRead={read} />
}

const monthName = (month: string) => new Date(`${month}-15T00:00:00Z`).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
const eurOf = (cents: number) => `€${(cents / 100).toFixed(2)}`
const when = (ms: number | null | undefined) => (ms ? new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')
const tokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))
const download = (name: string, text: string) => {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}
// What's typed as an amount: `3`, `3.50`, `€3,5`; empty: none; else not an amount.
const centsOf = (typed: string): number | null | undefined => {
  const t = typed.replace(/[€\s]/g, '').replace(',', '.')
  if (!t) return null
  return /^\d{1,7}(\.\d{1,2})?$/.test(t) ? Math.round(Number(t) * 100) : undefined
}

// The page itself, on what it's given.
export function BackofficeView({ board, error, onRead }: { board: Board | null; error: string | null; onRead: () => Promise<unknown> }) {
  const [page, setPage] = useState<Page>('overview')
  const [said, setSaid] = useState<{ text: string; tone?: 'error' } | null>(null)
  const [busy, setBusy] = useState(false)
  const [callsOf, setCallsOf] = useState<string>('')
  const current = PAGES.find((p) => p.id === page)!
  // Each change: said in words, then the board read again.
  const act = async (what: () => Promise<unknown>, done: string) => {
    setBusy(true)
    setSaid(null)
    try {
      await what()
      setSaid({ text: done })
      await onRead()
    } catch (e) {
      setSaid({ text: (e as Error)?.message ?? String(e), tone: 'error' })
    } finally {
      setBusy(false)
    }
  }
  const names = useMemo(() => new Map((board?.people ?? []).map((p) => [p.uid, p.name ?? p.email ?? p.uid])), [board])
  const who = (uid: string) => names.get(uid) ?? `${uid.slice(0, 6)}…`
  const eur = (micro: number) => eurOf(microToCents(micro, board?.rate ?? 1))
  const ctx: Ctx = { board: board!, busy, act, who, eur, showCalls: (uid) => (setCallsOf(uid), setPage('calls')) }

  return (
    <div className={styles.screen}>
      <div className={styles.box}>
        <SideList<Page> label="Backoffice" className={styles.nav} current={page} onPick={(p) => (setPage(p), setSaid(null))} groups={[{ name: 'lab key', ...(board ? { aside: monthName(board.month) } : {}), items: PAGES.map((p) => ({ id: p.id, label: p.label })) }]} />
        <div className={styles.main}>
          <header className={styles.head}>
            <div className={styles.headText}>
              <h1 className={styles.title}>{current.title}</h1>
              <p className={styles.about}>{current.about}</p>
            </div>
            <ButtonGroup>
              <Button disabled={busy} onClick={() => void act(onRead, 'Read again.')}>
                refresh
              </Button>
              <Button onClick={() => window.history.back()}>back</Button>
            </ButtonGroup>
          </header>
          <div className={styles.page} key={page}>
            {said && <Note tone={said.tone}>{said.text}</Note>}
            {error && <Note tone="error">{error}</Note>}
            {!board ? (
              !error && <Empty>Reading…</Empty>
            ) : page === 'overview' ? (
              <Overview {...ctx} />
            ) : page === 'people' ? (
              <People {...ctx} />
            ) : page === 'runs' ? (
              <Runs {...ctx} />
            ) : page === 'calls' ? (
              <Calls {...ctx} of={callsOf} setOf={setCallsOf} />
            ) : page === 'key' ? (
              <KeyAndLimits {...ctx} />
            ) : page === 'audit' ? (
              <Audit {...ctx} />
            ) : (
              <Health {...ctx} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

type Ctx = { board: Board; busy: boolean; act: (what: () => Promise<unknown>, done: string) => Promise<void>; who: (uid: string) => string; eur: (micro: number) => string; showCalls: (uid: string) => void }

// A list's rows: cells side by side, one column (`wide`) taking the room left.
function Table({ head, rows, empty, wide = 0 }: { head: string[]; rows: ReactNode[][]; empty: string; wide?: number }) {
  if (!rows.length) return <Empty>{empty}</Empty>
  return (
    <div className={styles.table} role="table" style={{ '--tpl': head.map((_, i) => (i === wide ? 'minmax(0, 1fr)' : 'auto')).join(' ') } as CSSProperties}>
      <div className={styles.tr} role="row">
        {head.map((h) => (
          <span key={h} className={styles.th} role="columnheader">
            {h}
          </span>
        ))}
      </div>
      {rows.map((r, i) => (
        <div key={i} className={styles.tr} role="row">
          {r.map((c, j) => (
            <span key={j} className={styles.td} role="cell">
              {c}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

// Shares as bars: the longest full.
function Bars({ items, eur }: { items: [string, number][]; eur: (m: number) => string }) {
  const most = Math.max(1, ...items.map(([, v]) => v))
  if (!items.length) return <Empty>Nothing yet this month.</Empty>
  return (
    <ul className={styles.bars}>
      {items.map(([k, v]) => (
        <li key={k} className={styles.bar}>
          <span className={styles.barKey}>{k}</span>
          <span className={styles.barTrack}>
            <span className={styles.barFill} style={{ '--share': v / most } as CSSProperties} />
          </span>
          <span className={styles.num}>{eur(v)}</span>
        </li>
      ))}
    </ul>
  )
}

function Overview({ board, busy, act, eur }: Ctx) {
  const [ask, setAsk] = useState(false)
  const t = board.total
  const totalCents = board.priv.totalCents
  const used = microToCents(t.spent + t.reserved, board.rate)
  const runs = board.runs.reduce<Record<string, number>>((m, r) => ((m[r.status] = (m[r.status] ?? 0) + 1), m), {})
  const refused = Object.entries(t.refused ?? {})
  return (
    <>
      <Section n={1} label="the switch">
        <Row label="North Star's key" hint={board.pub.on ? (board.pub.hasKey ? 'On: people it is open to may use it.' : 'On, but no key is set.') : 'Off: nobody uses it; a run going on stops at its next call.'}>
          {board.pub.on ? (
            <Button tone="hazard" disabled={busy} onClick={() => setAsk(true)}>
              turn it off
            </Button>
          ) : (
            <Button tone="main" disabled={busy || !board.pub.hasKey} onClick={() => void act(() => setLab({ on: true }), 'On.')}>
              turn it on
            </Button>
          )}
        </Row>
      </Section>
      <Section n={2} label="this month">
        <Row label="spent" hint={`At €1 = $${board.rate.toFixed(4)}. ${t.reserved ? `${eur(t.reserved)} held for calls under way.` : ''}`}>
          <span className={styles.big}>
            {eurOf(used)}
            {totalCents !== null && totalCents !== undefined && <span className={styles.of}> of {eurOf(totalCents)}</span>}
          </span>
        </Row>
        <Row label="by the month's end" hint="At the pace of the days gone: a guess.">
          <span className={styles.num}>{eurOf(microToCents(forecast(t.spent, new Date()), board.rate))}</span>
        </Row>
        <Row label="use">
          <span className={styles.num}>
            {board.people.filter((p) => p.calls > 0).length} people · {t.calls} calls · {board.runs.length} runs{Object.entries(runs).map(([k, n]) => ` · ${n} ${k}`).join('')}
          </span>
        </Row>
        <Row label="tokens">
          <span className={styles.num}>
            {tokens(t.input)} in ({tokens(t.cached)} cached) · {tokens(t.output)} out · {t.searches} searches
          </span>
        </Row>
        {refused.length > 0 && (
          <Row label="refused at a limit">
            <span className={styles.num}>{refused.map(([k, n]) => `${n} ${k}`).join(' · ')}</span>
          </Row>
        )}
      </Section>
      <Section n={3} label="by day">
        <Bars eur={eur} items={Object.entries(t.days ?? {}).sort(([a], [b]) => Number(a) - Number(b)).map(([d, v]) => [new Date(`${board.month}-${d.padStart(2, '0')}T12:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }), v] as [string, number])} />
      </Section>
      <Section n={4} label="by model">
        <Bars eur={eur} items={Object.entries(t.models ?? {}).map(([k, v]) => [k.replace(/_/g, '.'), v] as [string, number]).sort((a, b) => b[1] - a[1])} />
      </Section>
      {ask && (
        <HazardConfirm
          title="Turn North Star's key off?"
          lines={['Nobody can use it until it is on again; a run going on stops at its next call.', 'It goes in the audit log.']}
          confirm="turn it off"
          onCancel={() => setAsk(false)}
          onConfirm={() => {
            setAsk(false)
            void act(() => setLab({ on: false }), "Off: nobody uses North Star's key now.")
          }}
        />
      )}
    </>
  )
}

function People({ board, busy, act, eur, showCalls }: Ctx) {
  const [find, setFind] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [invite, setInvite] = useState('')
  const f = find.trim().toLowerCase()
  const list = board.people.filter((p) => !f || `${p.name ?? ''} ${p.email ?? ''} ${p.uid}`.toLowerCase().includes(f))
  const limitOf = (p: BoardPerson) => p.limitCents ?? board.pub.personCents
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (invite.trim()) void act(() => inviteToLab(invite.trim(), true).then(() => setInvite('')), `Invited ${invite.trim()}.`)
  }
  return (
    <>
      <Section n={1} label="people" count={board.people.length}>
        <Field label="find a person" placeholder="find by name or email" value={find} onChange={setFind} />
        <Table
          head={['who', 'this month', 'calls', 'last used', '']}
          empty={f ? 'Nobody by that.' : 'Nobody has used it yet.'}
          rows={list.map((p) => [
            <span key="w" className={styles.who}>
              <span>{p.name ?? p.email ?? p.uid}</span>
              <span className={styles.dim}>
                {[p.email, p.blocked && 'blocked', p.invited && 'invited', p.agreed ? 'agreed' : 'not agreed', p.limitCents !== null && 'own limit'].filter(Boolean).join(' · ')}
              </span>
            </span>,
            <span key="m" className={styles.num} data-over={microToCents(p.spent + p.reserved, board.rate) >= limitOf(p) || undefined}>
              {eur(p.spent + p.reserved)} of {eurOf(limitOf(p))}
            </span>,
            <span key="c" className={styles.num}>{p.calls}</span>,
            <span key="l" className={styles.num}>{when(p.last)}</span>,
            <Button key="o" onClick={() => setOpen(open === p.uid ? null : p.uid)}>
              {open === p.uid ? 'close' : 'change'}
            </Button>,
          ])}
        />
        {open && board.people.find((p) => p.uid === open) && <PersonPanel p={board.people.find((p) => p.uid === open)!} board={board} busy={busy} act={act} showCalls={showCalls} />}
      </Section>
      <Section n={2} label="invited" count={board.invites.length} note={board.priv.invitedOnly ? 'Only invited people may use it now (key and limits → who).' : 'Anyone signed in may use it now; the invites wait for when it is invited only again.'}>
        <form className={styles.inline} onSubmit={submit}>
          <Field className={styles.grow} label="an email to invite" type="email" placeholder="name@example.com" value={invite} onChange={setInvite} />
          <Button tone="main" type="submit" disabled={busy || !invite.trim()}>
            invite
          </Button>
        </form>
        <Table
          head={['email', '']}
          empty="Nobody invited."
          rows={board.invites.map((e) => [
            <span key="e">{e}</span>,
            <Button key="x" tone="danger" disabled={busy} onClick={() => void act(() => inviteToLab(e, false), `${e}: invite taken back.`)}>
              take back
            </Button>,
          ])}
        />
      </Section>
    </>
  )
}

// One person's standing: blocked or not, their own limit; each with why (it goes in the audit log).
function PersonPanel({ p, board, busy, act, showCalls }: { p: BoardPerson; board: Board; busy: boolean; act: Ctx['act']; showCalls: Ctx['showCalls'] }) {
  const [reason, setReason] = useState('')
  const why = reason.trim()
  return (
    <div className={styles.panel}>
      <Section>
      <Row label="why" hint={p.reason ? `Needed for each change; it goes in the audit log. Last: "${p.reason}".` : 'Needed for each change; it goes in the audit log.'}>
        <Field label="why this change" placeholder="why" value={reason} onChange={setReason} />
      </Row>
      <Row label="their limit a month" hint={`Empty: the usual, ${eurOf(board.pub.personCents)}.`}>
        <CommitField
          line
          className={styles.amount}
          label="their limit a month, in euros"
          placeholder={(board.pub.personCents / 100).toFixed(2)}
          value={p.limitCents !== null ? (p.limitCents / 100).toFixed(2) : ''}
          onSave={(typed) => {
            const c = centsOf(typed)
            if (c === undefined || c === p.limitCents) return
            if (!why) return void act(() => Promise.reject(new Error('Say why first.')), '')
            void act(() => setLabPerson(p.uid, { personCents: c }, why), c === null ? 'Back to the usual limit.' : `Their limit: ${eurOf(c)}.`)
          }}
        />
      </Row>
      <Row label={p.blocked ? 'blocked' : 'may use it'}>
        <ButtonGroup>
          <Button onClick={() => showCalls(p.uid)}>their calls</Button>
          <Button tone={p.blocked ? 'main' : 'danger'} disabled={busy || !why} onClick={() => void act(() => setLabPerson(p.uid, { blocked: !p.blocked }, why), p.blocked ? 'Free to use it again.' : 'Blocked.')}>
            {p.blocked ? 'free' : 'block'}
          </Button>
        </ButtonGroup>
      </Row>
      </Section>
    </div>
  )
}

function Runs({ board, busy, act, who, eur }: Ctx) {
  const order = (s: string) => (s === 'running' || s === 'queued' ? 0 : s === 'failed' ? 1 : 2)
  const list = [...board.runs].sort((a, b) => order(a.status) - order(b.status) || b.createdAt - a.createdAt)
  return (
    <Section n={1} label="runs" count={board.runs.length} note="Going and failed ones first.">
      <Table
        wide={3}
        head={['when', 'who', 'model', 'status', 'cost', '']}
        empty="No runs yet."
        rows={list.map((r) => [
          <span key="w" className={styles.num}>{when(r.createdAt)}</span>,
          <span key="p">{who(r.uid)}</span>,
          <span key="m" className={styles.num}>{r.model}</span>,
          <span key="s" className={styles.who}>
            <span data-status={r.status}>
              {r.status} · {r.steps} steps{r.endedAt ? ` · ${Math.round((r.endedAt - r.createdAt) / 1000)} s` : ''}
            </span>
            {r.said && <span className={styles.dim}>{r.said}</span>}
          </span>,
          <span key="c" className={styles.num}>{eur(r.cost)}</span>,
          r.status === 'running' || r.status === 'queued' ? (
            <Button key="x" tone="danger" disabled={busy} onClick={() => void act(() => stopLabRun(r.id), 'Told to stop.')}>
              stop
            </Button>
          ) : (
            <span key="x" />
          ),
        ])}
      />
    </Section>
  )
}

const STATUSES = ['all', 'done', 'open', 'stopped', 'failed'] as const
function Calls({ board, who, eur, of, setOf }: Ctx & { of: string; setOf: (uid: string) => void }) {
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('all')
  const [model, setModel] = useState('all')
  const models = ['all', ...new Set(board.calls.map((c) => c.model))]
  const list = board.calls.filter((c) => (!of || c.uid === of) && (status === 'all' || c.status === status) && (model === 'all' || c.model === model))
  const people = [{ value: '', label: 'everyone' }, ...board.people.filter((p) => p.calls > 0).map((p) => ({ value: p.uid, label: who(p.uid) }))]
  return (
    <Section n={1} label="calls" count={list.length} note={`The newest ${board.calls.length} calls. A cost marked ~ is a guess: its answer never came.`}>
      <div className={styles.inline}>
        <Select ariaLabel="whose calls" value={of} options={people} onChange={setOf} />
        <Select ariaLabel="calls by status" value={status} options={STATUSES.map((s) => ({ value: s, label: s === 'all' ? 'any status' : s }))} onChange={setStatus} />
        <Select ariaLabel="calls by model" value={model} options={models.map((m) => ({ value: m, label: m === 'all' ? 'any model' : m }))} onChange={setModel} />
        <Button
          disabled={!list.length}
          onClick={() =>
            download(
              `north-star-calls-${board.month}.csv`,
              csv(
                ['at', 'uid', 'who', 'run', 'model', 'status', 'cost_usd', 'estimated', 'input', 'cached', 'output', 'searches', 'ms', 'why'],
                list.map((c) => [new Date(c.at).toISOString(), c.uid, who(c.uid), c.run, c.model, c.status, (c.cost / 1e6).toFixed(6), !!c.estimated, c.input, c.cached, c.output, c.searches, c.ms, c.why]),
              ),
            )
          }
        >
          CSV
        </Button>
      </div>
      <Table
        wide={1}
        head={['when', 'who', 'model', 'tokens', 'cost']}
        empty="No calls."
        rows={list.map((c) => [
          <span key="w" className={styles.num}>{when(c.at)}</span>,
          <span key="p" className={styles.who}>
            <span>{who(c.uid)}</span>
            <span className={styles.dim} data-status={c.status}>
              {c.status}
              {c.why ? ` · ${c.why}` : ''}
            </span>
          </span>,
          <span key="m" className={styles.num}>{c.model}</span>,
          <span key="t" className={styles.num}>
            {tokens(c.input)} in · {tokens(c.output)} out{c.searches ? ` · ${c.searches} web` : ''}
          </span>,
          <span key="c" className={styles.num}>
            {c.estimated ? '~' : ''}
            {eur(c.cost)}
          </span>,
        ])}
      />
    </Section>
  )
}

const OPENAI = KNOWN_MODELS.filter((m) => m.provider === 'openai')
function KeyAndLimits({ board, busy, act }: Ctx) {
  const [replacing, setReplacing] = useState(false)
  const [draft, setDraft] = useState('')
  const [ask, setAsk] = useState(false)
  const has = board.pub.hasKey
  const save = (e: FormEvent) => {
    e.preventDefault()
    if (draft.trim()) void act(() => setLabKey(draft.trim()).then(() => (setDraft(''), setReplacing(false))), 'Saved: OpenAI took it.')
  }
  const models = board.pub.models
  const limit = (label: string, value: number | null | undefined, nullable: boolean, put: (c: number | null) => Promise<unknown>) => (
    <CommitField
      line
      className={styles.amount}
      label={label}
      placeholder={nullable ? 'none' : '0.00'}
      value={value !== null && value !== undefined ? (value / 100).toFixed(2) : ''}
      onSave={(typed) => {
        const c = centsOf(typed)
        if (c === undefined || c === (value ?? null) || (c === null && !nullable)) return
        void act(() => put(c), c === null ? 'No total now.' : `Now ${eurOf(c)}.`)
      }}
    />
  )
  return (
    <>
      <Section n={1} label="key" note="North Star's own OpenAI key. Sent once, checked with OpenAI, kept encrypted on the server: no browser sees it again.">
        <Row label="OpenAI key" wide={!has || replacing} hint={has && !replacing ? `Set ${when(board.priv.keySetAt)}.` : 'From the OpenAI project with its own hard limit (§11).'}>
          {has && !replacing ? (
            <>
              <span className={styles.mono}>{board.priv.keyHint}</span>
              <ButtonGroup>
                <Button disabled={busy} onClick={() => setReplacing(true)}>
                  replace
                </Button>
                <Button tone="danger" disabled={busy} onClick={() => setAsk(true)}>
                  remove
                </Button>
              </ButtonGroup>
            </>
          ) : (
            <form className={styles.inline} onSubmit={save}>
              <Field className={`${styles.mono} ${styles.grow}`} type="password" autoComplete="off" spellCheck={false} placeholder="sk-…" label="North Star's OpenAI key" value={draft} onChange={setDraft} />
              <ButtonGroup>
                {replacing && (
                  <Button type="button" onClick={() => setReplacing(false)}>
                    cancel
                  </Button>
                )}
                <Button tone="main" type="submit" disabled={busy || !draft.trim()}>
                  {busy ? 'checking' : 'save'}
                </Button>
              </ButtonGroup>
            </form>
          )}
        </Row>
      </Section>
      <Section n={2} label="limits" note="In euros a month, at the month's rate; a call is held for its worst case first, so nobody goes over.">
        <Row label="a person" hint="Each person's month; one person's own limit is set under people.">
          {limit('the limit a person a month, in euros', board.pub.personCents, false, (c) => setLab({ personCents: c! }))}
        </Row>
        <Row label="in total" hint="Everyone's month together; empty: none (the OpenAI project's own limit still holds).">
          {limit('the limit for everyone a month, in euros', board.priv.totalCents, true, (c) => setLab({ totalCents: c }))}
        </Row>
      </Section>
      <Section n={3} label="who and which">
        <Row label="who" hint={board.priv.invitedOnly ? 'Only invited people (people → invited), by the email they sign in with.' : 'Anyone signed in to North Star.'}>
          <Choice label="who may use it" bare options={['invited', 'everyone'] as const} value={board.priv.invitedOnly ? 'invited' : 'everyone'} onChange={(v) => void act(() => setLab({ invitedOnly: v === 'invited' }), v === 'invited' ? 'Invited people only.' : 'Open to everyone signed in.')} />
        </Row>
        <Row label="models" wide hint="None ticked: nobody can use it.">
          <div className={styles.checks}>
            {OPENAI.map((m) => (
              <Checkbox
                key={m.id}
                label={m.id}
                checked={models.includes(m.id)}
                disabled={busy}
                onChange={(on) => void act(() => setLab({ models: on ? [...models, m.id] : models.filter((x) => x !== m.id) }), on ? `${m.id} on.` : `${m.id} off.`)}
              />
            ))}
          </div>
        </Row>
      </Section>
      {ask && (
        <HazardConfirm
          title="Remove North Star's key?"
          lines={['Nobody can use it until a key is set again.', 'It goes in the audit log.']}
          confirm="remove the key"
          onCancel={() => setAsk(false)}
          onConfirm={() => {
            setAsk(false)
            void act(() => setLabKey(''), 'Removed.')
          }}
        />
      )}
    </>
  )
}

// An entry's fields in words, an amount in euros.
const FIELD_WORDS: Record<string, string> = { on: 'on', models: 'models', personCents: 'limit a person', totalCents: 'total', invitedOnly: 'invited only', blocked: 'blocked', uid: 'who', run: 'run', email: 'email' }
const valueOf = (k: string, x: unknown) => (/Cents$/.test(k) ? (typeof x === 'number' ? eurOf(x) : 'none') : Array.isArray(x) ? x.join(' ') || 'none' : typeof x === 'object' && x !== null ? JSON.stringify(x) : String(x))
const shown = (v: unknown, who?: (uid: string) => string) =>
  v === undefined || v === null ? '' : typeof v === 'object' ? Object.entries(v as Record<string, unknown>).map(([k, x]) => `${FIELD_WORDS[k] ?? k} ${k === 'uid' && who && typeof x === 'string' ? who(x) : valueOf(k, x)}`).join(', ') : String(v)
function Audit({ board, who }: Ctx) {
  const c = board.health.chain
  return (
    <Section n={1} label="audit" count={board.audit.length} note={c.ok ? `The chain holds (the last ${c.seen ?? 0} entries checked).` : `The chain is broken at ${c.at}: ${c.why}.`}>
      <div className={styles.inline}>
        <Button
          disabled={!board.audit.length}
          onClick={() => download(`north-star-audit-${board.month}.csv`, csv(['seq', 'at', 'what', 'by', 'from', 'to', 'reason'], board.audit.map((e) => [e.seq, new Date(e.at).toISOString(), e.what, who(e.by), shown(e.from), shown(e.to), e.reason])))}
        >
          CSV
        </Button>
      </div>
      <Table
        wide={4}
        head={['#', 'when', 'what', 'by', 'change']}
        empty="Nothing changed yet."
        rows={board.audit.map((e) => [
          <span key="n" className={styles.num}>{e.seq}</span>,
          <span key="w" className={styles.num}>{when(e.at)}</span>,
          <span key="t">{e.what.replace(/^lab key: ?/, '').split(', ').map((w) => FIELD_WORDS[w] ?? w).join(', ')}</span>,
          <span key="b">{who(e.by)}</span>,
          <span key="c" className={styles.who}>
            <span className={styles.num}>
              {shown(e.from, who)}
              {e.from !== undefined && e.to !== undefined ? ' → ' : ''}
              {shown(e.to, who)}
            </span>
            {e.reason && <span className={styles.dim}>{e.reason}</span>}
          </span>,
        ])}
      />
    </Section>
  )
}

function Health({ board }: Ctx) {
  const h = board.health
  const rows: [string, string, boolean][] = [
    ['calls under way', String(h.open), false],
    ['failed in the last hour', `${h.failedHour} of ${h.callsHour}`, h.callsHour >= 20 && h.failedHour / h.callsHour > 0.05],
    ['runs stuck past 35 minutes', String(h.stuck), h.stuck > 0],
    ['the audit chain', h.chain.ok ? 'holds' : `broken at ${h.chain.at}: ${h.chain.why}`, !h.chain.ok],
    ['the key', board.pub.hasKey ? `set ${when(board.priv.keySetAt)}` : 'none', !board.pub.hasKey && board.pub.on],
    ["the month's rate", `€1 = $${board.rate.toFixed(4)}`, false],
  ]
  return (
    <Section n={1} label="now" note="Mails to the lab at 50, 80 and 100 % of the total, and on these going wrong, come later (§10).">
      {rows.map(([label, value, bad]) => (
        <Row key={label} label={label}>
          <span className={styles.num} data-bad={bad || undefined}>
            {value}
          </span>
        </Row>
      ))}
    </Section>
  )
}
