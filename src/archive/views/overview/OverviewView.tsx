// /workspaces/:wid/overview (D-144): the workspace on one screen, read for what it means. What we're building, where the
// evidence is strong and where it's missing, the white space no competitor covers, the riskiest bets, what to do next
// and what looks off. Everything links to where it can be acted on; a next step can start the assistant's mode for it.
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { itemPath, workspacePath } from '../../app/paths'
import { useChat } from '../../ai/chat'
import { Appear } from '../../ui/Appear'
import { BOARD_KINDS, TYPE_ACCENT } from '../canvas/boardKinds'
import { Sure } from '../priorities/Sure'
import { useWs } from '../workspace/context'
import { useViewer } from '../workspace/viewerLock'
import styles from './OverviewView.module.css'
import { overviewOf, type Card } from './reading'

const VALIDATION_TONE: Record<string, string> = {
  validated: 'var(--accent-green)',
  testing: 'var(--accent-yellow)',
  invalidated: 'var(--accent-magenta)',
  hypothesis: 'var(--fg-dim)',
}

export function OverviewView() {
  const ws = useWs()
  const o = useMemo(() => overviewOf(ws), [ws])
  const navigate = useNavigate()
  const viewer = useViewer((s) => s.viewer)
  const empty = o.counts.customers + o.counts.problems + o.counts.ideas + o.counts.features + o.counts.competitors === 0
  const go = (view?: string) => navigate(view === 'board' || !view ? workspacePath(ws.wid) : workspacePath(ws.wid, view as 'matrix'))

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>{ws.workspace.name}</h1>
        <p className={styles.about}>{ws.workspace.description || 'What are we building? Say it in Settings → general, or in the board’s project block.'}</p>
        <p className={styles.counts}>
          {[
            [o.counts.customers, 'customer'],
            [o.counts.problems, 'problem'],
            [o.counts.ideas, 'idea'],
            [o.counts.features, 'feature'],
            [o.counts.competitors, 'competitor'],
            [o.counts.evidence, 'piece of evidence'],
          ]
            .map(([k, w]) => `${k} ${k === 1 ? w : w === 'piece of evidence' ? 'pieces of evidence' : `${w}s`}`)
            .join(' · ')}
        </p>
      </header>

      {empty ? (
        <p className={styles.hint}>
          Nothing here yet. <Link to={workspacePath(ws.wid)}>Start on the board</Link>: who it's for, what hurts, what we'd build.
        </p>
      ) : (
        <div className={styles.grid}>
          <Appear className={styles.frame}>
            <section className={styles.block} aria-label="Next steps">
              <h2 className={styles.label}>next</h2>
              <ol className={styles.steps}>
                {o.steps.map((s) => (
                  <li key={s.text}>
                    <span className={styles.stepText}>{s.text}</span>
                    <span className={styles.why}>{s.why}</span>
                    {s.mode && !viewer ? (
                      <button className={styles.small} onClick={() => useChat.getState().ask(`/${s.mode} `)}>
                        ask the assistant: /{s.mode}
                      </button>
                    ) : s.view ? (
                      <button className={styles.small} onClick={() => go(s.view)}>
                        open {s.view}
                      </button>
                    ) : null}
                  </li>
                ))}
                {!o.steps.length && <li className={styles.why}>Nothing pressing: keep testing what the board rests on.</li>}
              </ol>
            </section>
          </Appear>

          <Appear className={styles.frame}>
            <section className={styles.block} aria-label="Evidence">
              <h2 className={styles.label}>on solid ground</h2>
              <Cards wid={ws.wid} list={o.strongest} empty="Nothing validated or backed by evidence yet." />
              <h2 className={styles.label}>still a guess</h2>
              <Cards wid={ws.wid} list={o.weakest} empty="Everything has evidence behind it." />
            </section>
          </Appear>

          <Appear className={styles.frame}>
            <section className={styles.block} aria-label="Riskiest bets">
              <h2 className={styles.label}>riskiest bets</h2>
              <span className={styles.why}>High impact or P1, resting on little.</span>
              <ul className={styles.list}>
                {o.bets.map((b) => (
                  <li key={b.id}>
                    <Link className={styles.item} to={itemPath(ws.wid, b.id)} style={{ ['--tone' as string]: TYPE_ACCENT[b.pkg ? 'package' : 'feature'] }}>
                      {b.title}
                    </Link>{' '}
                    <Sure level={b.level} />
                    {b.guesses.length > 0 && <span className={styles.why}>rests on guesses: {b.guesses.join(', ')}</span>}
                  </li>
                ))}
                {!o.bets.length && <li className={styles.why}>No high-impact feature rests on guesses.</li>}
              </ul>
              <button className={styles.small} onClick={() => go('priorities')}>
                open priorities
              </button>
            </section>
          </Appear>

          <Appear className={styles.frame}>
            <section className={styles.block} aria-label="White space">
              <h2 className={styles.label}>white space</h2>
              <span className={styles.why}>What no competitor meets: where we can stand out.</span>
              <ul className={styles.list}>
                {o.gaps.map((g) => (
                  <li key={g.id}>
                    <Link className={styles.item} to={itemPath(ws.wid, g.id)} style={{ ['--tone' as string]: TYPE_ACCENT.feature }}>
                      {g.title}
                    </Link>
                    <span className={styles.open}>◇ {g.open.join(' · ')}</span>
                  </li>
                ))}
                {!o.gaps.length && (
                  <li className={styles.why}>
                    {o.criteria.features ? 'Every criterion is met by someone.' : 'Give features criteria and score the matrix to find it.'}
                  </li>
                )}
              </ul>
              <button className={styles.small} onClick={() => go('matrix')}>
                open matrix
              </button>
            </section>
          </Appear>

          {o.warnings.length > 0 && (
            <Appear className={styles.frame}>
              <section className={styles.block} aria-label="Worth a look">
                <h2 className={styles.label}>worth a look</h2>
                <ul className={styles.list}>
                  {o.warnings.map((w) => (
                    <li key={w.text}>
                      <span className={styles.warn}>!</span> {w.text}{' '}
                      {w.view && (
                        <button className={styles.small} onClick={() => go(w.view)}>
                          {w.view}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            </Appear>
          )}
        </div>
      )}
    </main>
  )
}

function Cards({ wid, list, empty }: { wid: string; list: Card[]; empty: string }) {
  if (!list.length) return <p className={styles.why}>{empty}</p>
  return (
    <ul className={styles.list}>
      {list.map((c) => (
        <li key={c.id}>
          <Link className={styles.item} to={itemPath(wid, c.id)} style={{ ['--tone' as string]: TYPE_ACCENT[c.type] }}>
            {c.title}
          </Link>{' '}
          <span className={styles.kind}>{BOARD_KINDS[c.type].label}</span>{' '}
          {c.validation && <span style={{ color: VALIDATION_TONE[c.validation] }}>{c.validation}</span>}{' '}
          {c.supports + c.contradicts > 0 && (
            <span className={styles.why}>
              +{c.supports} −{c.contradicts}
            </span>
          )}
          {c.warn && <span className={styles.warnText}> ! {c.warn}</span>}
        </li>
      ))}
    </ul>
  )
}
