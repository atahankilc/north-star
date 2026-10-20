// The assistant's usage log (D-079): every call's time, task, tools, model, tokens and an estimated cost; never what
// was said. You see your own calls on either key; the owner also sees everyone's calls on the workspace key.
import { useContext, useMemo, useState } from 'react'
import { estimateCost, PRICES_AS_OF } from '../ai/prices'
import { useUsageCalls, useUsageMonth, type AiUsage, type UsageShow } from '../data/ai'
import { useAuth } from '../data/auth'
import { isOwnerOf } from '../data/workspaces'
import { Loading } from './Loading'
import type { WithId } from '../data/hooks'
import { WorkspaceContext } from '../views/workspace/context'
import styles from './AiUsage.module.css'
import { Choice } from './Choice'
import { Note, Row, Section } from './Settings'

const SHOW: readonly UsageShow[] = ['all', 'workspace', 'own']

const tokens = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))
const money = (n: number | null) => (n === null ? '?' : n === 0 ? '$0' : n < 0.0001 ? '<$0.0001' : `$${n < 0.1 ? n.toFixed(4) : n.toFixed(2)}`)
const when = (at: number) =>
  new Date(at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

type Totals = { calls: number; input: number; output: number; searches: number; cost: number; unpriced: number }

function total(entries: AiUsage[]): Totals {
  const t: Totals = { calls: 0, input: 0, output: 0, searches: 0, cost: 0, unpriced: 0 }
  for (const e of entries) {
    t.calls++
    t.input += e.inputTokens
    t.output += e.outputTokens
    t.searches += e.webSearches
    const c = estimateCost(e)
    if (c === null) t.unpriced++
    else t.cost += c
  }
  return t
}

export function AiUsagePage() {
  const ws = useContext(WorkspaceContext)
  if (!ws) {
    return (
      <Section label="usage" note="Open a workspace to see what the assistant used there." />
    )
  }
  return <Usage wid={ws.wid} isOwner={isOwnerOf(ws.workspace, useAuth().user?.id)} />
}

// D-098: nothing here loads with the workspace. The month's totals are fetched once when this page opens; the calls
// below come a page at a time.
function Usage({ wid, isOwner }: { wid: string; isOwner: boolean }) {
  const { user } = useAuth()
  const [show, setShow] = useState<UsageShow>('all')
  const monthStart = useMemo(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime()
  }, [])
  const month = useUsageMonth(wid, isOwner, monthStart)
  const calls = useUsageCalls(wid, isOwner, show)
  const mine = month.mine
  const shared = month.shared

  // The owner's view of the workspace key, person by person.
  const people = useMemo(() => {
    const by = new Map<string, { name: string; entries: AiUsage[] }>()
    for (const e of shared) {
      const p = by.get(e.uid) ?? { name: e.name, entries: [] }
      p.entries.push(e)
      by.set(e.uid, p)
    }
    return [...by.entries()].map(([uid, p]) => ({ uid, name: p.name, ...total(p.entries) })).sort((a, b) => b.cost - a.cost)
  }, [shared])


  return (
    <>
      <Section label="this month">
        {month.isLoading ? (
          <Loading label="adding up this month…" />
        ) : month.error ? (
          <Note tone="error">! Couldn&apos;t add up this month.</Note>
        ) : (
          <div className={styles.cards}>
            <Card label="you, own key" t={total(mine.filter((e) => e.keySource === 'own'))} />
            <Card label="you, workspace key" t={total(mine.filter((e) => e.keySource === 'workspace'))} />
            {isOwner && <Card label="workspace key, everyone" t={total(shared)} accent />}
          </div>
        )}
      </Section>

      {isOwner && (
        <Section label="workspace key by person">
          {month.isLoading ? (
            <Loading label="loading…" />
          ) : people.length === 0 ? (
            <Note>Nobody has used the workspace key this month.</Note>
          ) : (
            <div className={styles.table} role="table" aria-label="Workspace key use by person">
              <div className={styles.head} role="row">
                <span role="columnheader">who</span>
                <span role="columnheader">calls</span>
                <span role="columnheader">tokens in / out</span>
                <span role="columnheader">searches</span>
                <span role="columnheader">≈ cost</span>
              </div>
              {people.map((p) => (
                <div key={p.uid} className={styles.row} role="row">
                  <span role="cell">{p.name}</span>
                  <span role="cell">{p.calls}</span>
                  <span role="cell">
                    {tokens(p.input)} / {tokens(p.output)}
                  </span>
                  <span role="cell">{p.searches}</span>
                  <span role="cell">{money(p.cost)}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      <Section
        label="calls"
        note={`Tokens are exactly what OpenAI reported. Costs are estimates from OpenAI's prices on ${PRICES_AS_OF}; your OpenAI dashboard has the real bill. Messages themselves are never logged.`}
      >
        <Row label="show" hint="Newest first, 20 at a time.">
          <Choice label="key" bare options={SHOW} value={show} onChange={(v) => setShow(v ?? 'all')} />
        </Row>
        {calls.error ? (
          <Note tone="error">! Couldn&apos;t load the log.</Note>
        ) : calls.isLoading ? (
          <Loading label="loading calls…" />
        ) : calls.data.length === 0 ? (
          <Note>No calls yet.</Note>
        ) : (
          <ol className={styles.calls}>
            {calls.data.map((e) => (
              <Call key={e.id} e={e} showWho={isOwner && e.uid !== user?.id} />
            ))}
          </ol>
        )}
        {calls.hasMore && (
          <div>
            <button className={styles.more} onClick={calls.more} disabled={calls.loadingMore}>
              {calls.loadingMore ? 'loading…' : 'show more'}
            </button>
          </div>
        )}
      </Section>
    </>
  )
}

function Card({ label, t, accent }: { label: string; t: Totals; accent?: boolean }) {
  return (
    <div className={styles.card} data-accent={accent || undefined}>
      <span className={styles.cardLabel}>{label}</span>
      <span className={styles.cardValue}>≈ {money(t.cost)}</span>
      <span className={styles.cardDetail}>
        {t.calls} call{t.calls === 1 ? '' : 's'} · {tokens(t.input)} in · {tokens(t.output)} out
        {t.searches ? ` · ${t.searches} search${t.searches === 1 ? '' : 'es'}` : ''}
        {t.unpriced ? ` · ${t.unpriced} unpriced` : ''}
      </span>
    </div>
  )
}

function Call({ e, showWho }: { e: WithId<AiUsage>; showWho: boolean }) {
  const tools = e.tools.length ? e.tools.join(', ') : 'answer'
  return (
    <li className={styles.call} data-status={e.status}>
      <span className={styles.callTime}>{when(e.at)}</span>
      <span className={styles.callMain}>
        {showWho && <span className={styles.callWho}>{e.name} · </span>}
        <span className={styles.callKey} data-key={e.keySource}>
          {e.keySource === 'workspace' ? 'workspace key' : 'own key'}
        </span>{' '}
        · {e.task} · {tools} · {e.model}
        {e.status !== 'done' && <span className={styles.callStatus}> · {e.status}</span>}
      </span>
      <span className={styles.callNums}>
        {tokens(e.inputTokens)} / {tokens(e.outputTokens)}
        {e.webSearches ? ` · ${e.webSearches}⌕` : ''} · {money(estimateCost(e))}
      </span>
    </li>
  )
}
