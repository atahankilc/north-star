// The threads (D-166): every conversation in the workspace in one place, opened from the threads tool in the
// HUD's corner (D-402). Its look since D-405: no views to pick; what's new to you stands on top under a magenta `NEW`
// rule, each row with who wrote last and how it began; under it the read ones, one line each, under the place they're
// on; the resolved ones behind `resolved · N` at the foot. Two columns on the ground under the main screen (D-393, EdgeColumn, foundation/sheet.ts): the list on the left,
// beside the HUD's rail (people and what they say are the left's); the conversation on the right, where a thing's panel
// is (it's about a thing). The list (D-398): one head (`Threads`, what it shows, `mark all read`, `×`), the views as
// tabs under it (all · new · @you · done, D-344), then the threads under the name of the place they're on
// (`02 PRODUCT ── 1`, the place with the newest first, D-168: going to one switches to its place). A row leads with the
// thing: its kind as a badge in its colour (D-414), its name; under it who wrote last (in their colour) and how it began, when, how
// many messages. New ones (someone else wrote since you last read it) carry a magenta lamp and count, `@` where you're
// mentioned. The two work apart (D-199): a chip on the canvas opens only its conversation, `all threads` there opens the
// list; closing the list leaves the conversation, and the other way round. Each is uncovered by the main screen drawing
// back, and covered as it comes back (EdgeColumn, D-395).
import { useMemo, useState, type CSSProperties } from 'react'
import { AnimatePresence } from 'motion/react'
import type { WithId } from '../../../data/hooks'
import type { Thread } from '../../../data/model'
import { isNew, markSeen, useReads } from '../../../data/threads'
import { ago } from '../../../ui/foundation/ago'
import { closeThread, CommentIcon, myUid, ThreadPanel, toggleInbox, usePersonColor, useThreadView, type ThreadThing } from './Threads'
import { Button } from '../../../ui/primitives/Button'
import { ButtonGroup } from '../../../ui/primitives/ButtonGroup'
import { Rule } from '../../../ui/primitives/Rule'
import { Label } from '../../../ui/primitives/Label'
import { Select } from '../../../ui/patterns/Select'
import { EdgeColumn } from '../../../ui/patterns/EdgeColumn'
import { createPortal } from 'react-dom'
import { DragLine } from '../../../ui/primitives/DragLine'
import { closePlace, dragWidth, setPage, usePlace } from '../places/placeStore'
import { usePageHost } from '../places/pageHost'
import { tokenPx } from '../../../styles/cssToken'
import styles from './Threads.module.css'
import { CloseIcon } from '../../../ui/primitives/hudIcons'
import { leadingNumber } from '../../../model/words'
import { TypeBadge } from '../cards/TypeBadge'

// The threads panel's scope for the canvas shown (D-302's session 4), beside a plane's id (D-193).
const THIS_CANVAS = '#canvas'

// A row has room for one name: the first.
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name

type Props = {
  wid: string
  threads: WithId<Thread>[]
  // Whether a thread is inside a plane (default: made there; D-281: also on a card brought there).
  inside?: (t: WithId<Thread>, plane: string) => boolean
  titleOf: (t: Pick<Thread, 'on' | 'targetId'>) => string
  // What a thread is on, apart: its kind, name and colour (D-398).
  thingOf: (t: Pick<Thread, 'on' | 'targetId'>) => ThreadThing
  // Takes the board to a thread (on its plane, D-168) and opens it.
  onGo: (t: WithId<Thread>) => void
  // The place each thread is seen on, by name (D-168): its rows stand under it.
  whereOf?: (t: WithId<Thread>) => string | null
  // A scope's name (D-193): the plane whose console opened the panel.
  scopeName?: (id: string) => string
  // With several canvases (D-302's session 4): the one shown, and whether a thread is on it (`on this canvas`).
  canvasScope?: { id: string; name: string; has: (t: WithId<Thread>) => boolean }
  // The thread half (D-197): owners delete any thread; the target in its header shows it where it is.
  isOwner: boolean
  onShow: (t: WithId<Thread>) => void
}

export function ThreadInbox({ wid, threads: all, inside, titleOf, thingOf, onGo, whereOf, scopeName, canvasScope, isOwner, onShow }: Props) {
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
  // Talk as a place (D-412): beside the canvas one column on the left, the conversation in the list's place; as the
  // page, the list and the conversation side by side in the page's host.
  const asPage = usePlace((s) => s.open === 'talk' && s.page)
  const placeWidth = usePlace((s) => s.width)
  const host = usePageHost((s) => s.el)
  const me = myUid()
  const seen = useReads(wid, me || null).data?.seen
  // The resolved ones, behind a word at the list's foot (D-405), instead of the open ones.
  const [done, setDone] = useState(false)
  const sorted = useMemo(() => [...threads].sort((a, b) => b.lastAt - a.lastAt), [threads])
  const fresh = (t: WithId<Thread>) => isNew(t, seen, t.id, me)
  const mentioned = (t: WithId<Thread>) => !!t.mentions?.includes(me)
  const open = sorted.filter((t) => !t.resolved)
  const newRows = done ? [] : open.filter(fresh)
  const rows = done ? sorted.filter((t) => t.resolved) : open.filter((t) => !fresh(t))
  const counts = { new: newRows.length, resolved: sorted.length - open.length }
  const markAll = () => newRows.forEach((t) => void markSeen(wid, t.id, t.lastAt))
  const colorOf = usePersonColor()
  // Under the place they're on, in the list's order: the place with the newest thread first. A card on more planes
  // (`01 Lunch +1`) stands under the one it's seen on.
  const groups = useMemo(() => {
    const out: { where: string; rows: WithId<Thread>[] }[] = []
    for (const t of rows) {
      const where = (whereOf?.(t) ?? '').replace(/ \+\d+$/, '')
      const g = out.find((x) => x.where === where)
      if (g) g.rows.push(t)
      else out.push({ where, rows: [t] })
    }
    return out
    // `whereOf` is made anew each draw; it reads what `rows` came from.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])
  // One thread's row (D-398): the thing first, when; `said`, under it who wrote last and how it began (what's new, D-405).
  const rowOf = (t: WithId<Thread>, said: boolean) => {
                        const thing = thingOf(t)
                        const isFresh = fresh(t)
                        return (
                          <li key={t.id}>
                            <button /* kit-ok: a thread's whole row (the thing, when, the last words) that opens it */
                              className={styles.row}
                              style={thing.tone ? ({ '--tone': thing.tone } as CSSProperties) : undefined}
                              data-new={isFresh || undefined}
                              data-said={said || undefined}
                              data-open={t.id === openId || undefined}
                              onClick={() => onGo(t)}
                            >
                              <span className={styles.rowHead}>
                                {thing.tone && !thing.gone ? (
                                  <TypeBadge kind={thing.kind} tone={thing.tone} className={styles.rowBadge} />
                                ) : (
                                  <Label className={styles.rowKind}>{thing.kind}</Label>
                                )}
                                <span className={styles.rowTitle} data-gone={thing.gone || undefined}>
                                  {t.resolved ? '✓ ' : ''}
                                  {thing.gone ? 'what it was on was deleted' : thing.name || 'untitled'}
                                </span>
                                {isFresh && <span className={styles.rowLamp} aria-label="new" />}
                                <span className={styles.when}>{ago(t.lastAt)}</span>
                              </span>
                              {said && (
                              <span className={styles.rowSaid}>
                                <span className={styles.rowWho} style={{ color: colorOf(t.lastUid ?? t.uid) }}>
                                  {firstName(t.lastName ?? t.name)}
                                </span>
                                <span className={styles.rowText}>{t.lastText ?? ''}</span>
                                <span className={styles.rowCount}>
                                  {isFresh && mentioned(t) ? <span>@</span> : <CommentIcon size={11} />}
                                  {t.count}
                                </span>
                              </span>
                              )}
                            </button>
                          </li>
                        )
  }

  // What the list shows (D-195): the whole workspace, this canvas (with several, D-302), or what's inside the plane whose
  // console opened it. One picker beside the title; plain words (`everywhere`) while there's nothing to pick.
  const planeScope = scope && scope !== THIS_CANVAS ? scope : null
  const scopes = [
    // The finder's words for the same choice (D-305), short enough to stand whole beside `mark all read`.
    { value: 'all', label: 'everywhere' },
    ...(canvasScope ? [{ value: THIS_CANVAS, label: 'this canvas' }] : []),
    ...(planeScope ? [{ value: planeScope, label: `in ${(scopeName?.(planeScope) ?? 'a plane').replace(/^"|"$/g, '')}` }] : []),
  ]

  const fullButton = (
    <Button onClick={() => setPage(!asPage)} title={asPage ? 'beside the canvas again' : "as the page, in the canvas's place"}>
      {asPage ? 'beside the canvas' : 'full'}
    </Button>
  )
  const list = (
    <>
            <header className={styles.listHead}>
              <span className={styles.listTitle}>Threads</span>
              {scopes.length > 1 ? (
                <Select
                  ariaLabel="Which threads the list shows"
                  className={styles.scopePick}
                  value={onCanvas ? THIS_CANVAS : (planeScope ?? 'all')}
                  options={scopes}
                  onChange={(v) => useThreadView.setState({ scope: v === 'all' ? null : v })}
                />
              ) : (
                <span className={styles.scope}>everywhere</span>
              )}
              <ButtonGroup className={styles.actions}>
                {counts.new > 0 && <Button onClick={markAll}>mark all read</Button>}
                {fullButton}
                <Button icon aria-label="Close threads" title="close" onClick={closePlace}>
                  <CloseIcon />
                </Button>
              </ButtonGroup>
            </header>
            <ol className={styles.rows}>
              {rows.length === 0 && newRows.length === 0 && (
                <li className={styles.lead}>{done ? 'No resolved threads.' : 'No open threads. Right-click anything → comment.'}</li>
              )}
              {newRows.length > 0 && (
                <li>
                  <Rule as="div" className={styles.fresh} name="NEW" count={newRows.length} countAt="end" />
                  <ol className={styles.group}>{newRows.map((t) => rowOf(t, true))}</ol>
                </li>
              )}
              {groups.map((g) => {
                const numbered = leadingNumber(g.where)
                return (
                  <li key={g.where}>
                    {g.where && <Rule as="div" className={styles.place} n={numbered?.num} name={numbered?.rest || g.where} count={g.rows.length} countAt="end" />}
                    <ol className={styles.group}>
                      {g.rows.map((t) => rowOf(t, false))}
                    </ol>
                  </li>
                )
              })}
              {(counts.resolved > 0 || done) && (
                <li className={styles.doneFoot}>
                  <Button onClick={() => setDone(!done)}>{done ? '‹ open threads' : `resolved · ${counts.resolved}`}</Button>
                </li>
              )}
            </ol>
    </>
  )
  const panel = convo && (
    <ThreadPanel
      key={convo.thread?.id ?? 'draft'}
      wid={wid}
      thread={convo.thread}
      draft={convo.draft}
      title={titleOf(convo.thread ?? convo.draft!)}
      thing={thingOf(convo.thread ?? convo.draft!)}
      isOwner={isOwner}
      where={convo.thread ? (whereOf?.(convo.thread) ?? undefined) : undefined}
      onShow={convo.thread ? () => onShow(convo.thread!) : undefined}
      // Beside the canvas it's in the list's place: back to the list. As the page the list is beside it.
      onList={asPage ? undefined : () => (closeThread(), toggleInbox(true))}
      onClose={asPage ? closeThread : closePlace}
    />
  )

  if (asPage)
    return host
      ? createPortal( // kit-ok: Talk as the page (D-412) draws into the page's host in the main sheet
          <div className={styles.talkPage}>
            <div className={styles.list} data-learn="threads" data-viewer-ok>
              {list}
            </div>
            <div className={styles.convo} data-learn="thread-column" data-viewer-ok>
              {panel ?? <p className={styles.lead}>Pick a thread.</p>}
            </div>
          </div>,
          host,
        )
      : null

  return (
    <AnimatePresence>
      {(listOpen || convo) && (
        <EdgeColumn
          key="talk"
          side="left"
          // Beside the HUD's tools, which keep their rail of ground (D-389).
          offset="var(--sheet-rail-w)"
          width={placeWidth ? `${placeWidth}px` : 'var(--panel-w)'}
          label={convo ? `Thread: ${titleOf(convo.thread ?? convo.draft!)}` : 'Threads'}
          // Escape closes the list; a conversation's own Escape closes it first (the one Escape stack, D-359).
          onClose={closePlace}
          escape={!convo}
          className={convo ? styles.convo : styles.list}
          data-learn={convo ? 'thread-column' : 'threads'}
          data-off-space
          data-viewer-ok
        >
          <DragLine at="right" label="Talk's width" onDrag={(e) => dragWidth(tokenPx('--sheet-rail-w'), e.clientX)} />
          {panel ?? list}
        </EdgeColumn>
      )}
    </AnimatePresence>
  )
}
