// Talk (D-435; D-166, D-412): every conversation in the workspace, the threads on things and the channels. Opened from the
// HUD's Talk, a chip on the canvas or the finder.
// - Beside the canvas, a column: the list, two lines a row (what it's on, when; who wrote last and what), what's new on
//   top, then the channels, then what's said on the canvas, the resolved ones behind a word at the foot. A conversation
//   opens in the column; the list goes down to a rail on its left (a glyph each, a magenta dot on what's new), so
//   another is one press away.
// - As the page, three parts: the list, the conversation at a reading width, and what it's about (ThreadAside).
// New (someone else wrote since you last read it): bright, a magenta lamp; the one you open from NEW stays there until
// you open another. Find is behind its tool in the head.
import { useMemo, useState } from 'react'
import { create } from 'zustand'
import type { WithId } from '../../../data/hooks'
import type { Thread } from '../../../data/model'
import { isNew, markSeen, useReads } from '../../../data/threads'
import { ago } from '../../../ui/foundation/ago'
import { closeThread, openThread, startComment, myUid, ThreadGlyph, ThreadPanel, toggleInbox, useThreadView, type ThreadThing } from './Threads'
import { ThreadAside } from './ThreadAside'
import { Button } from '../../../ui/primitives/Button'
import { Rule } from '../../../ui/primitives/Rule'
import { AddField } from '../../../ui/primitives/AddField'
import { Empty } from '../../../ui/primitives/Empty'
import { FindIcon, ListIcon, PlusIcon } from '../../../ui/primitives/hudIcons'
import { stopCanvas } from '../../../ui/foundation/canvasGuard'
import { AnimatePresence } from 'motion/react'
import { Select } from '../../../ui/patterns/Select'
import { EdgeColumn } from '../../../ui/patterns/EdgeColumn'
import { createPortal } from 'react-dom'
import { DragLine } from '../../../ui/primitives/DragLine'
import { PlaceFind, PlaceHead } from '../places/Places'
import { closePlace, dragWidth, setPage, usePlace } from '../places/placeStore'
import { usePageHost } from '../places/pageHost'
import { tokenPx } from '../../../styles/cssToken'
import styles from './Threads.module.css'
import { firstName } from '../../../model/words'
import { cardRefsAsText } from '../../../model/cardRefs'
import { agentUi } from '../../../agent/ui'
import { CHANNEL_NAME_MAX } from '../../../model/limits'

// The threads panel's scope for the canvas shown (D-302's session 4), beside a plane's id (D-193).
const THIS_CANVAS = '#canvas'
// A new channel's name while it's typed; `newChannel()` (Talk's page tool) opens the field.
const useChannelNaming = create<{ name: string | null }>(() => ({ name: null }))
export const newChannel = () => useChannelNaming.setState({ name: '' })
// A channel's space (D-416): Talk's own, no plane or canvas.
const TALK = 'talk'
// What's typed for a channel's name, as the rules take it: lowercase words joined by `-`, at most 40.
const channelName = (typed: string) =>
  typed.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, CHANNEL_NAME_MAX)

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
  // Channels (D-416) stand apart, in every scope, by name; the rest by when they were last written in.
  const channels = useMemo(() => all.filter((t) => t.on === 'channel').sort((a, b) => a.targetId.localeCompare(b.targetId)), [all])
  // What's typed in Talk's find (D-419): a thread or channel whose thing, last words or last writer have it.
  const [q, setQ] = useState('')
  const found = (t: WithId<Thread>) => {
    const k = q.trim().toLowerCase()
    if (!k) return true
    return [thingOf(t).name, t.lastText && cardRefsAsText(t.lastText), t.lastName, t.targetId].some((x) => x?.toLowerCase().includes(k))
  }
  const sorted = useMemo(() => threads.filter((t) => t.on !== 'channel').sort((a, b) => b.lastAt - a.lastAt), [threads])
  // A new channel's name being typed (D-416); Talk's page tool starts it too (D-419).
  const naming = useChannelNaming((s) => s.name)
  const setNaming = (name: string | null) => useChannelNaming.setState({ name })
  const startNaming = () => setNaming('')
  const makeChannel = (typed: string) => {
    const name = channelName(typed)
    setNaming(null)
    if (!name) return
    const had = channels.find((c) => c.targetId === name)
    if (had) return openThread(had.id)
    startComment({ on: 'channel', targetId: name, planeId: TALK, at: [0, 0] })
  }
  const fresh = (t: WithId<Thread>) => isNew(t, seen, t.id, me)
  const mentioned = (t: WithId<Thread>) => !!t.mentions?.includes(me)
  // The one opened from NEW stays there while it's open: a row never jumps from under the pointer.
  const [kept, setKept] = useState<string | null>(null)
  const open = (t: WithId<Thread>) => (setKept(fresh(t) || t.id === kept ? t.id : null), onGo(t))
  const inNew = (t: WithId<Thread>) => fresh(t) || (t.id === kept && t.id === openId)
  const shownChannels = channels.filter(found)
  const shownThings = sorted.filter((t) => !t.resolved && found(t))
  const resolvedOnes = sorted.filter((t) => t.resolved && found(t))
  const newOnes = [...shownChannels, ...shownThings].filter(inNew).sort((a, b) => b.lastAt - a.lastAt)
  const markAll = () => (setKept(null), newOnes.forEach((t) => void markSeen(wid, t.id, t.lastAt)))
  const nothing = !all.length && naming === null
  // Find, behind its tool in the head; what's typed is dropped as it's put away.
  const [finding, setFinding] = useState(false)
  const endFind = () => (setFinding(false), setQ(''))

  // A conversation's row: its glyph; what it's on and when; who wrote last and what, a lamp when it's new.
  const rowOf = (t: WithId<Thread>) => {
    const thing = thingOf(t)
    const isFresh = fresh(t)
    const place = whereOf?.(t)
    return (
      <li key={t.id}>
        <button /* kit-ok: a conversation's whole row that opens it */
          className={styles.row}
          data-new={isFresh || undefined}
          data-open={t.id === openId || undefined}
          title={t.on === 'channel' ? undefined : [thing.kind, place && `on ${place}`].filter(Boolean).join(' · ')}
          onClick={() => open(t)}
        >
          <ThreadGlyph thing={thing} channel={t.on === 'channel'} />
          <span className={styles.rowTitle} data-gone={thing.gone || undefined}>
            {t.resolved ? '✓ ' : ''}
            {thing.gone ? 'what it was on was deleted' : thing.name || 'untitled'}
          </span>
          <span className={styles.when}>{ago(t.lastAt)}</span>
          <span className={styles.rowText}>
            {(t.lastUid ?? t.uid) === me ? 'You' : firstName(t.lastName ?? t.name)}: {cardRefsAsText(t.lastText ?? '')}
          </span>
          {isFresh && (mentioned(t) ? <span className={styles.rowAt} aria-label="you're mentioned">@</span> : <span className={styles.rowLamp} aria-label="new" />)}
        </button>
      </li>
    )
  }

  // What the list shows (D-195): the whole workspace, this canvas (with several, D-302), or what's inside the plane whose
  // console opened it. One picker beside the title; plain words (`everywhere`) while there's nothing to pick.
  const planeScope = scope && scope !== THIS_CANVAS ? scope : null
  const scopes = [
    // The finder's words for the same choice (D-305).
    { value: 'all', label: 'everywhere' },
    ...(canvasScope ? [{ value: THIS_CANVAS, label: 'this canvas' }] : []),
    ...(planeScope ? [{ value: planeScope, label: `in ${(scopeName?.(planeScope) ?? 'a plane').replace(/^"|"$/g, '')}` }] : []),
  ]

  const listHead = (
            <PlaceHead
              place="talk"
              after={
                scopes.length > 1 ? (
                  <Select
                    ariaLabel="Which threads the list shows"
                    className={styles.scopePick}
                    value={onCanvas ? THIS_CANVAS : (planeScope ?? 'all')}
                    options={scopes}
                    onChange={(v) => useThreadView.setState({ scope: v === 'all' ? null : v })}
                  />
                ) : undefined
              }
              tools={
                <>
                  {!nothing && (
                    <Button icon pressed={finding} aria-label="find in Talk" title="find in Talk" onClick={() => (finding ? endFind() : setFinding(true))}>
                      <FindIcon />
                    </Button>
                  )}
                  <Button icon aria-label="new channel" title="new channel" onClick={startNaming}>
                    <PlusIcon />
                  </Button>
                </>
              }
            />
  )
  const list = (
    <>
      {finding && <PlaceFind value={q} onChange={setQ} label="Find in Talk" onClose={endFind} />}
      {naming !== null && (
        <div className={styles.naming}>
          <AddField value={naming} onChange={setNaming} onAdd={makeChannel} onClose={() => setNaming(null)} label="A new channel's name" placeholder="name, e.g. pilot" maxLength={CHANNEL_NAME_MAX} />
        </div>
      )}
      {nothing ? (
        <div className={styles.empty}>
          <h3 className={styles.emptyTitle}>Nothing said yet.</h3>
          <p>A channel is talk that isn't about one thing. To say something about a thing, right-click it on the canvas and pick comment.</p>
          <Button tone="primary" onClick={startNaming}>
            start a channel
          </Button>
        </div>
      ) : (
        <ol className={styles.rows}>
          {q.trim() !== '' && !newOnes.length && !shownChannels.length && !shownThings.length && !resolvedOnes.length && <li className={styles.lead}>Nothing found.</li>}
          {newOnes.length > 0 && (
            <li>
              <div className={styles.newHead}>
                <Rule as="div" className={styles.fresh} name="NEW" />
                <Button onClick={markAll}>mark all read</Button>
              </div>
              <ol className={styles.group}>{newOnes.map(rowOf)}</ol>
            </li>
          )}
          {(shownChannels.some((t) => !inNew(t)) || (!channels.length && !q)) && (
            <li>
              <Rule as="div" className={styles.place} name="CHANNELS" add={channels.length ? undefined : { label: 'channel', onClick: startNaming }} />
              <ol className={styles.group}>{shownChannels.filter((t) => !inNew(t)).map(rowOf)}</ol>
            </li>
          )}
          {shownThings.some((t) => !inNew(t)) && (
            <li>
              <Rule as="div" className={styles.place} name="ON THE CANVAS" />
              <ol className={styles.group}>{shownThings.filter((t) => !inNew(t)).map(rowOf)}</ol>
            </li>
          )}
          {resolvedOnes.length > 0 && (
            <li>
              <div className={styles.doneFoot}>
                <Button aria-expanded={done} onClick={() => setDone(!done)}>{`${done ? '▾' : '▸'} resolved · ${resolvedOnes.length}`}</Button>
              </div>
              {done && <ol className={styles.group}>{resolvedOnes.map(rowOf)}</ol>}
            </li>
          )}
        </ol>
      )}
    </>
  )
  const thing = convo && thingOf(convo.thread ?? convo.draft!)
  const onChannel = (convo?.thread?.on ?? convo?.draft?.on) === 'channel'
  const where = convo?.thread && !onChannel ? (whereOf?.(convo.thread) ?? undefined) : undefined
  // Shown on the canvas: from the page, Talk goes beside it first.
  const show = convo?.thread && !onChannel ? () => (setPage(false), onShow(convo.thread!)) : undefined
  // A card named in a message (D-436): shown on the canvas, from the page beside it first.
  const showCard = (id: string) => (setPage(false), void agentUi.goTo(id))
  const panel = convo && thing && (
    <ThreadPanel key={convo.thread?.id ?? 'draft'} wid={wid} thread={convo.thread} draft={convo.draft} title={titleOf(convo.thread ?? convo.draft!)} thing={thing} isOwner={isOwner} where={where} onShow={show} wide={asPage} onCard={showCard} />
  )
  // The list as a rail beside the open conversation: the channels, then what's said on the canvas, each its glyph.
  const railOf = (t: WithId<Thread>) => (
    <li key={t.id}>
      <button /* kit-ok: a conversation's glyph on the rail that opens it */ className={styles.railItem} data-open={t.id === openId || undefined} data-new={fresh(t) || undefined} title={thingOf(t).name} aria-label={`${thingOf(t).name}${fresh(t) ? ', new' : ''}`} onClick={() => open(t)}>
        <ThreadGlyph thing={thingOf(t)} channel={t.on === 'channel'} />
      </button>
    </li>
  )
  const openThings = threads.filter((t) => t.on !== 'channel' && (!t.resolved || t.id === openId)).sort((a, b) => b.lastAt - a.lastAt)

  if (asPage)
    return host
      ? createPortal( // kit-ok: Talk as the page (D-412) draws into the page's host in the main sheet
          // Drawn from the canvas, so a press in it bubbles to the canvas (React's tree, not the page's): stopped here, as a
          // docked column does. Without it the canvas took the pointer to pan, and no press in here ever became a click.
          <div className={styles.talkPage} {...stopCanvas}>
            <div className={styles.list} data-learn="threads" data-viewer-ok>
              {listHead}
              {list}
            </div>
            <div className={styles.convo} data-learn="thread-column" data-viewer-ok>
              {panel ?? (
                <div className={styles.pick}>
                  <Empty>{nothing ? 'What is said in this workspace is read here.' : 'Pick a conversation.'}</Empty>
                </div>
              )}
            </div>
            {convo && thing && <ThreadAside wid={wid} thread={convo.thread} thing={thing} where={where} channel={onChannel} onShow={show} />}
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
          label={convo ? `Thread: ${titleOf(convo.thread ?? convo.draft!)}` : 'Talk'}
          // Escape closes the list; a conversation's own Escape closes it first (the one Escape stack, D-359).
          onClose={closePlace}
          escape={!convo}
          className={convo ? styles.convo : styles.list}
          data-learn={convo ? 'thread-column' : 'threads'}
          data-off-space
          data-viewer-ok
        >
          <DragLine at="right" label="Talk's width" onDrag={(e) => dragWidth(tokenPx('--sheet-rail-w'), e.clientX)} />
          {listHead}
          {panel && !finding && naming === null ? (
            <div className={styles.beside}>
              <nav className={styles.rail} aria-label="Conversations" data-scrollbar="none">
                <Button icon aria-label="all conversations" title="all conversations" onClick={() => (toggleInbox(true), closeThread())}>
                  <ListIcon />
                </Button>
                {channels.length > 0 && <ol className={styles.railGroup}>{channels.map(railOf)}</ol>}
                {openThings.length > 0 && <ol className={styles.railGroup}>{openThings.map(railOf)}</ol>}
              </nav>
              {panel}
            </div>
          ) : (
            list
          )}
        </EdgeColumn>
      )}
    </AnimatePresence>
  )
}
