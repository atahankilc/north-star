// The threads (D-166): every conversation in the workspace in one place, opened from the threads tab on the screen's
// foot. Two columns on the ground under the main screen (D-393, EdgeColumn, foundation/sheet.ts): the list on the left,
// beside the HUD's rail (people and what they say are the left's); the conversation on the right, where a thing's panel
// is (it's about a thing). The list: a header with views as tabs (all · new · mentions · resolved, D-344), then one row
// per thread, newest first: what it's on, who wrote last and how it began, when, how many messages, and the plane it's
// on when that isn't the open one (D-168: going there switches to it); new ones (someone else wrote since you last read
// it) lit magenta, `@` where you're mentioned. The two work apart (D-199): a chip on the canvas opens only its
// conversation, `all threads` there opens the list; closing the list leaves the conversation, and the other way round.
// Each is uncovered by the main screen drawing back, and covered as it comes back (EdgeColumn, D-395).
import { useMemo, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import type { WithId } from '../../../data/hooks'
import type { Thread } from '../../../data/model'
import { isNew, markSeen, useReads } from '../../../data/threads'
import { ago } from '../../../ui/foundation/ago'
import { closeThread, CommentIcon, myUid, ThreadPanel, toggleInbox, useThreadView } from './Threads'
import { Button } from '../../../ui/primitives/Button'
import { ButtonGroup } from '../../../ui/primitives/ButtonGroup'
import { Tabs } from '../../../ui/primitives/Tabs'
import { EdgeColumn } from '../../../ui/patterns/EdgeColumn'
import { SHEET_MIN_PX } from '../../../ui/foundation/feel'
import { useWindowWidth } from '../../../ui/foundation/useWindowWidth'
import { tokenPx } from '../../../styles/cssToken'
import styles from './Threads.module.css'
import { CloseIcon } from '../../../ui/primitives/hudIcons'

type View = 'all' | 'new' | 'mentions' | 'resolved'
// The threads panel's scope for the canvas shown (D-302's session 4), beside a plane's id (D-193).
const THIS_CANVAS = '#canvas'

type Props = {
  wid: string
  threads: WithId<Thread>[]
  // Whether a thread is inside a plane (default: made there; D-281: also on a card brought there).
  inside?: (t: WithId<Thread>, plane: string) => boolean
  titleOf: (t: Pick<Thread, 'on' | 'targetId'>) => string
  // Takes the board to a thread (on its plane, D-168) and opens it.
  onGo: (t: WithId<Thread>) => void
  // The plane each thread is seen on, by name, when the workspace has planes; and the open one's (D-168).
  whereOf?: (t: WithId<Thread>) => string | null
  here?: string
  // What it was on was deleted (D-171).
  goneOf?: (t: WithId<Thread>) => boolean
  // A scope's name (D-193): the plane whose console opened the panel.
  scopeName?: (id: string) => string
  // With several canvases (D-302's session 4): the one shown, and whether a thread is on it (`on this canvas`).
  canvasScope?: { id: string; name: string; has: (t: WithId<Thread>) => boolean }
  // The thread half (D-197): owners delete any thread; the target in its header shows it where it is.
  isOwner: boolean
  onShow: (t: WithId<Thread>) => void
}

export function ThreadInbox({ wid, threads: all, inside, titleOf, onGo, whereOf, here, goneOf, scopeName, canvasScope, isOwner, onShow }: Props) {
  const listOpen = useThreadView((s) => s.inbox)
  // Only what's inside a plane when its console opened the panel (D-193, D-195); the plane's own conversation isn't
  // inside it, it's on the canvas.
  const scope = useThreadView((s) => s.scope)
  const onCanvas = scope === THIS_CANVAS && !!canvasScope
  const threads = useMemo(
    () => (onCanvas ? all.filter(canvasScope!.has) : scope && scope !== THIS_CANVAS ? all.filter((t) => (inside ? inside(t, scope) : t.planeId === scope)) : all),
    // `canvasScope.has` reads the canvas shown, which this is drawn again for (by id: two canvases may share a name).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, scope, inside, onCanvas, canvasScope?.id],
  )
  const openId = useThreadView((s) => s.openId)
  const draft = useThreadView((s) => s.draft)
  const current = all.find((t) => t.id === openId) ?? null
  const convo = current ? { thread: current, draft: null } : draft ? { thread: null, draft } : null
  // A window too narrow for the list, the main screen and a conversation: the list gives way while one is open, and
  // the conversation's `all threads` brings it back by closing itself (D-393).
  const narrow = useWindowWidth() < tokenPx('--sheet-rail-w') + tokenPx('--size-md') + tokenPx('--panel-w') + SHEET_MIN_PX
  const listShown = listOpen && !(narrow && convo)
  const me = myUid()
  const seen = useReads(wid, me || null).data?.seen
  const [view, setView] = useState<View>('all')
  const sorted = useMemo(() => [...threads].sort((a, b) => b.lastAt - a.lastAt), [threads])
  const fresh = (t: WithId<Thread>) => isNew(t, seen, t.id, me)
  const mentioned = (t: WithId<Thread>) => !!t.mentions?.includes(me)
  const counts = {
    all: sorted.filter((t) => !t.resolved).length,
    new: sorted.filter((t) => !t.resolved && fresh(t)).length,
    mentions: sorted.filter((t) => mentioned(t)).length,
    resolved: sorted.filter((t) => t.resolved).length,
  }
  const rows = sorted.filter((t) =>
    view === 'resolved' ? t.resolved : view === 'mentions' ? mentioned(t) : !t.resolved && (view === 'all' || fresh(t)),
  )
  const markAll = () => sorted.filter(fresh).forEach((t) => void markSeen(wid, t.id, t.lastAt))

  return (
    <>
      <AnimatePresence>
        {listShown && (
          <EdgeColumn
            key="list"
            side="left"
            // Beside the HUD's tools, which keep their rail of ground (D-389).
            offset="var(--sheet-rail-w)"
            width="var(--threads-list-w)"
            label="Threads"
            // Escape closes it, unless a conversation is open (that closes first): the one Escape stack (D-359).
            onClose={() => toggleInbox(false)}
            escape={!openId && !draft}
            className={styles.list}
            data-learn="threads"
            data-off-space
            data-viewer-ok
          >
      <header className={styles.head}>
        <span className={styles.title}>threads</span>
        <ButtonGroup className={styles.actions}>
          {counts.new > 0 && (
            <Button onClick={markAll}>
              mark all read
            </Button>
          )}
          <Button icon aria-label="Close threads" title="close" onClick={() => toggleInbox(false)}>
            <CloseIcon />
          </Button>
        </ButtonGroup>
      </header>
      {/* What you're looking at, always said (D-195): the whole workspace, or what's inside one plane. */}
      {/* With several canvases (D-302's session 4), the one shown too: `on this canvas`. */}
      <div className={styles.scope} data-scoped={scope && (scope !== THIS_CANVAS || onCanvas) ? true : undefined}>
        {onCanvas ? (
          <>
            <span>
              on <b>{canvasScope!.name}</b>
            </span>
            <Button onClick={() => useThreadView.setState({ scope: null })}>
              whole workspace
            </Button>
          </>
        ) : scope && scope !== THIS_CANVAS ? (
          <>
            <span>
              inside <b>{scopeName?.(scope) ?? 'a plane'}</b>
            </span>
            <Button onClick={() => useThreadView.setState({ scope: null })}>
              whole workspace
            </Button>
          </>
        ) : (
          <>
            <span>whole workspace</span>
            {canvasScope && (
              <Button onClick={() => useThreadView.setState({ scope: THIS_CANVAS })}>
                on this canvas
              </Button>
            )}
          </>
        )}
      </div>
      <nav className={styles.views}>
        <Tabs<View>
          label="Which threads"
          value={view}
          onChange={setView}
          options={(['all', 'new', 'mentions', 'resolved'] as const).map((v) => ({
            value: v,
            label: v,
            count: counts[v] > 0 ? <span className={v === 'new' ? styles.lit : undefined}>{counts[v]}</span> : undefined,
          }))}
        />
      </nav>
      <ol className={styles.rows}>
        {rows.length === 0 && (
          <li className={styles.lead}>
            {view === 'all'
              ? 'No open threads. Right-click anything → comment.'
              : view === 'new'
                ? 'Nothing new: you have read everything.'
                : view === 'mentions'
                  ? 'Nobody has mentioned you yet.'
                  : 'No resolved threads.'}
          </li>
        )}
        {rows.map((t) => (
          <li key={t.id}>
            <button /* kit-ok: a thread's whole row (mark, title, when, last words) that opens it */ className={styles.row} data-new={fresh(t) || undefined} data-open={t.id === openId || undefined} onClick={() => onGo(t)}>
              <span className={styles.rowHead}>
                <span className={styles.rowMark} aria-hidden>
                  {fresh(t) ? (mentioned(t) ? '@' : '●') : t.resolved ? '✓' : <CommentIcon size={11} />}
                </span>
                <span className={styles.rowTitle}>{titleOf(t)}</span>
                <span className={styles.when}>{ago(t.lastAt)}</span>
              </span>
              <span className={styles.rowText}>
                <b>{t.lastName ?? t.name}</b> {t.lastText ?? ''}
              </span>
              <span className={styles.rowMeta}>
                {t.count} message{t.count === 1 ? '' : 's'} · started by {t.name}
                {goneOf?.(t) && <span className={styles.rowGone}> · what it was on was deleted</span>}
                {/* Another plane than the open one: going there switches to it (D-168). */}
                {(() => {
                  const where = whereOf?.(t)
                  return where && where !== here ? <span className={styles.rowPlane}> · on {where} ↗</span> : null
                })()}
              </span>
            </button>
          </li>
        ))}
      </ol>
          </EdgeColumn>
        )}
      </AnimatePresence>
      {/* The conversation picked in the list or from a chip, or one being started (D-197, D-199): on the right, where a
          thing's panel is; over that panel while it's open, and closing it shows the panel again. */}
      <AnimatePresence>
        {convo && (
          <EdgeColumn key="convo" label={`Thread: ${titleOf(convo.thread ?? convo.draft!)}`} escape={false} className={styles.convo} data-learn="thread-column" data-off-space data-viewer-ok>
            <ThreadPanel
              key={convo.thread?.id ?? 'draft'}
              wid={wid}
              thread={convo.thread}
              draft={convo.draft}
              title={titleOf(convo.thread ?? convo.draft!)}
              isOwner={isOwner}
              where={convo.thread ? (whereOf?.(convo.thread) ?? undefined) : undefined}
              onShow={convo.thread ? () => onShow(convo.thread!) : undefined}
              onList={listShown ? undefined : () => (toggleInbox(true), narrow && closeThread())}
            />
          </EdgeColumn>
        )}
      </AnimatePresence>
    </>
  )
}
