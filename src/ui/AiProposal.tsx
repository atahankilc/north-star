// Changes the assistant proposed (D-074), as a checklist under its answer. Everything valid starts checked;
// unchecking a new item unchecks what depends on it. Apply writes the checked rows as one undo step.
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChat, type ChatMessage } from '../ai/chat'
import { stillValid, toWrites, type Change } from '../ai/tools'
import { itemPath } from '../app/paths'
import { applyAssistantChanges } from '../data/assistant'
import { TYPE_ACCENT } from '../views/canvas/boardKinds'
import { useWs } from '../views/workspace/context'
import styles from './AiChat.module.css'

const keyOf = (c: Change) => (['add_card', 'add_competitor', 'add_competitor_feature'].includes(c.raw.op) && typeof c.raw.key === 'string' ? c.raw.key.trim() : '')

export function AiProposal({ message }: { message: ChatMessage }) {
  const ws = useWs()
  const navigate = useNavigate()
  const decide = useChat((s) => s.decide)
  const proposal = message.proposal!
  const refs = message.refs!
  const state = message.proposalState ?? { status: 'pending' }
  const pending = state.status === 'pending'
  const [unchecked, setUnchecked] = useState<Set<number>>(() => new Set())
  const [error, setError] = useState('')
  const [firstNew, setFirstNew] = useState<string | null>(null)
  // Frozen once applied: the rows that went in.
  const applied = useMemo(() => new Set(state.rows ?? []), [state.rows])

  // Live against the workspace while undecided: an item deleted since the proposal disables the rows that point at it.
  const problems = useMemo(
    () => new Map(proposal.changes.map((c) => [c.n, pending ? stillValid(c, ws, refs) : undefined])),
    [proposal, ws, refs, pending],
  )

  // A row is on when checked, valid, every new item it needs is on, and no delete of an item it uses is on
  // (repeated until nothing changes: chains).
  const on = useMemo(() => {
    if (!pending) return applied
    const live = new Set(proposal.changes.filter((c) => !unchecked.has(c.n) && !problems.get(c.n)).map((c) => c.n))
    for (let changed = true; changed; ) {
      changed = false
      const keys = new Set(proposal.changes.filter((c) => live.has(c.n)).map(keyOf).filter(Boolean))
      for (const c of proposal.changes) {
        if (live.has(c.n) && (c.needs.some((k) => !keys.has(k)) || c.clashes.some((d) => live.has(d)))) {
          live.delete(c.n)
          changed = true
        }
      }
    }
    return live
  }, [proposal, unchecked, problems, pending, applied])

  const toggle = (n: number) =>
    setUnchecked((u) => {
      const next = new Set(u)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })

  const apply = () => {
    const accepted = proposal.changes.filter((c) => on.has(c.n))
    if (!accepted.length) return
    setError('')
    let writes
    try {
      writes = toWrites(accepted, ws, refs)
    } catch {
      setError("Couldn't read these changes. Ask again?")
      return
    }
    decide(message.id, { status: 'applied', applied: accepted.length, rows: accepted.map((c) => c.n) })
    // The writes show at once (local cache); the promise settles when the server has them.
    applyAssistantChanges(ws.wid, writes)
      .then((ids) => {
        const card = accepted.find((c) => c.raw.op === 'add_card' || c.raw.op === 'add_competitor')
        if (card) setFirstNew(ids[keyOf(card)] ?? null)
      })
      .catch(() => {
        decide(message.id, { status: 'pending' })
        setError("The workspace refused these changes; nothing was written.")
      })
  }

  const count = on.size

  return (
    <div className={styles.proposal} data-status={state.status}>
      <p className={styles.proposalHead}>
        <span className={styles.kicker}>proposed</span> {proposal.summary}
      </p>
      {proposal.changes.length === 0 ? (
        <p className={styles.fine}>No usable changes came back.</p>
      ) : (
        <ul className={styles.changes}>
          {proposal.changes.map((c) => {
            const problem = problems.get(c.n)
            const blocked = pending && !problem && !unchecked.has(c.n) && !on.has(c.n)
            return (
              <li key={c.n} className={styles.change} data-off={!on.has(c.n) || undefined} data-removes={c.removes || undefined}>
                <label>
                  <input
                    type="checkbox"
                    checked={on.has(c.n)}
                    disabled={!pending || Boolean(problem) || blocked}
                    onChange={() => toggle(c.n)}
                  />
                  <span className={styles.sign} style={c.tone && !c.removes ? { color: TYPE_ACCENT[c.tone] } : undefined}>
                    {c.sign}
                  </span>
                  <span className={styles.changeBody}>
                    <span className={styles.changeKind}>{c.kind}</span> <span className={styles.changeText}>{c.text}</span>
                    {c.detail && <span className={styles.changeDetail}>{c.detail}</span>}
                    {(problem || blocked) && (
                      <span className={styles.changeProblem}>
                        {problem ?? (c.clashes.some((d) => on.has(d)) ? 'uses an item deleted here' : 'needs an unchecked item')}
                      </span>
                    )}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      )}
      {error && <span className={styles.error}>! {error}</span>}
      <div className={styles.proposalActions}>
        {pending ? (
          <>
            <button className={styles.send} onClick={apply} disabled={count === 0}>
              apply {count}
            </button>
            <button className={styles.action} onClick={() => decide(message.id, { status: 'discarded' })}>
              discard
            </button>
          </>
        ) : state.status === 'applied' ? (
          <>
            <span className={styles.fine}>
              applied {state.applied} · undo with ⌘Z / Ctrl+Z
            </span>
            {firstNew && (
              <button className={styles.action} onClick={() => navigate(itemPath(ws.wid, firstNew))}>
                show
              </button>
            )}
          </>
        ) : (
          <span className={styles.fine}>discarded</span>
        )}
      </div>
    </div>
  )
}
