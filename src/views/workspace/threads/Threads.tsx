// Comment threads (D-159, D-165–D-171; on the canvas and in planes, D-192; on components only, D-193). A thread is on a
// plane, a card or a piece of text, started from its right-click menu; its chip sits under the component's bottom-right
// corner like a plane's console, at the screen's own size: the comment mark and a count (D-167), magenta when someone
// wrote in it since you last read it, `@` when they mentioned you (D-166). Clicking it opens the conversation in Talk
// (ThreadInbox.tsx), nothing on the canvas itself (D-199). Enter sends, shift+Enter a new line, `@` suggests the
// workspace's people; resolve or reopen. Only a message's writer edits or deletes it. Resolved threads leave the canvas.
// Anyone in the workspace comments, viewers too. A `NEW` line stands over the first message you hadn't read when it
// opened; across days, each day's name and the clock instead of how long ago.
import { Fragment, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import type { WithId } from '../../../data/hooks'
import { firebase } from '../../../data/firebase'
import { MESSAGE_MAX, type Member, type Thread, type ThreadMessage } from '../../../data/model'
import {
  deleteMessage,
  deleteThread,
  editMessage,
  isNew,
  markSeen,
  reply,
  setResolved,
  startThread,
  useMessages,
  useReads,
  demoThreads,
  type NewThread,
} from '../../../data/threads'
import { useHistory } from '../../../data/history'
import { useWorkspaceMembers } from '../../../data/workspaces'
import { useWs, WorkspaceContext } from '../canvas/context'
import { isOnPlane, type Card } from '../../../data/cards'
import { ago } from '../../../ui/foundation/ago'
import { useEscapeLayer } from '../../../ui/foundation/useEscapeLayer'
import { usePromptPick } from '../../../ui/foundation/usePromptPick'
import { useStickToBottom } from '../../../ui/foundation/useStickToBottom'
import { Button } from '../../../ui/primitives/Button'
import { ButtonGroup } from '../../../ui/primitives/ButtonGroup'
import { HazardConfirm } from '../../../ui/patterns/HazardConfirm'
import { Field } from '../../../ui/primitives/Field'
import { PromptList } from '../../../ui/patterns/PromptList'
import { PromptField } from '../../../ui/primitives/PromptField'
import styles from './Threads.module.css'
import { BinIcon, CheckIcon, EditIcon, SendIcon, TargetIcon } from '../../../ui/primitives/hudIcons'
import { nameLetters, plural } from '../../../model/words'
import { Avatar } from '../../../ui/primitives/Avatar'
import { Label } from '../../../ui/primitives/Label'
import { presenceColor, usePresence } from '../../../data/presence'
import { useThemeAccent } from '../../../state/theme'
import { CardFace } from '../cards/CardFace'
import { TypeBadge } from '../cards/TypeBadge'

// Talk's own store (which thread is open, the list, the pins) lives in threadView.ts, apart from this big file, so the
// places' store can read it without an import cycle (D-422).
import { closeThread, openThread, startComment, toggleInbox, toggleThreadPins, useThreadView } from './threadView'
export { closeThread, openThread, startComment, toggleInbox, toggleThreadPins, useThreadView }

// Without Firebase (the onboarding's demo realm) the scene's made-up you, else nobody.
export const myUid = () => (firebase ? (firebase.auth.currentUser?.uid ?? '') : demoThreads.me)

// What a thread is on, apart (D-398): its kind (`feature`, `plane`, `task`), its name, its colour (a card's or a
// piece's; none: quiet), and whether it's gone.
export type ThreadThing = { kind: string; name: string; tone?: string; gone?: boolean }

// A person's colour in the threads (D-398): the one they have here now (D-067), else their own (as the workspaces page
// names them, D-390), in the theme's shade.
export function usePersonColor() {
  const peers = usePresence((s) => s.peers)
  const mine = usePresence((s) => s.myColor)
  const accent = useThemeAccent()
  const me = myUid()
  return (uid: string) => accent((uid === me ? mine : peers.find((p) => p.uid === uid)?.color) ?? presenceColor(uid))
}

// What a conversation is on, as a glyph (D-435): its name's first letters in its kind's colour; a channel's in a circle.
export function ThreadGlyph({ thing, channel }: { thing: ThreadThing; channel?: boolean }) {
  return (
    <span className={styles.glyph} data-channel={channel || undefined} style={thing.tone ? ({ '--tone': thing.tone } as CSSProperties) : undefined} title={channel ? undefined : thing.kind} aria-hidden>
      {nameLetters(thing.name || thing.kind)}
    </span>
  )
}

// The comment mark (D-167), on the pins and the threads button: a square speech bubble, its tail at the bottom left,
// three square dots inside, drawn like the toolbar's other icons (square corners, 1.5 stroke on a 16 grid).
export function CommentIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden className={styles.icon}>
      <path d="M1.75 2.25h12.5v9h-7.5l-3.5 3v-3h-1.5z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="miter" />
      <rect x="4.25" y="6" width="1.75" height="1.75" fill="currentColor" />
      <rect x="7.125" y="6" width="1.75" height="1.75" fill="currentColor" />
      <rect x="10" y="6" width="1.75" height="1.75" fill="currentColor" />
    </svg>
  )
}

// Whether a thread is inside a plane: made there, or on a card that's on it, brought from another plane too (D-281).
export const threadIn = (t: Pick<Thread, 'planeId' | 'on' | 'targetId'>, plane: string, cards: Pick<Card, 'id' | 'pieceId' | 'planes'>[]) => {
  if (t.planeId === plane) return true
  const c = t.on === 'card' ? cards.find((x) => x.id === t.targetId) : undefined
  return !!c && isOnPlane(c, plane)
}

// The conversation on a component (D-193): its newest unresolved thread. One at a time: commenting again opens it.
// Looked up in a map made once per threads list, not a filter and sort over every thread per item per draw.
const openByTarget = new WeakMap<readonly WithId<Thread>[], Map<string, WithId<Thread>>>()
function threadsByTarget(threads: readonly WithId<Thread>[]) {
  let m = openByTarget.get(threads)
  if (!m) {
    m = new Map()
    for (const t of threads) {
      if (t.resolved || t.on === 'channel') continue
      const had = m.get(t.targetId)
      if (!had || t.lastAt > had.lastAt) m.set(t.targetId, t)
    }
    openByTarget.set(threads, m)
  }
  return m
}
export const threadOn = (threads: readonly WithId<Thread>[], id: string) => threadsByTarget(threads).get(id) ?? null

// A component's own thread, read so the component draws again only when that thread changes, not on every message
// anywhere in the workspace (D-287); null while `id` is null (not live).
export function useThreadOn(id: string | null): WithId<Thread> | null {
  const store = useContext(WorkspaceContext)
  if (!store) throw new Error('useThreadOn() outside a workspace route')
  const get = useCallback(() => (id ? threadOn(store.get().threads, id) : null), [store, id])
  return useSyncExternalStore(store.subscribe, get, get)
}

// A component's comments (D-193): under its bottom-right corner, set like a plane's console, at the screen's size: the
// comment mark and how many messages, magenta when someone wrote since you last read it, `@` when they mentioned you.
// A click opens its thread in the threads panel (D-199). `c` hides them.
export function ThreadChip({ wid, thread, zoom }: { wid: string; thread: WithId<Thread> | null; zoom: number }) {
  const show = useThreadView((s) => s.show)
  // Only a component with a thread reads what you've seen: a read mark draws its chips, not every card's.
  return thread && show ? <ChipOf wid={wid} thread={thread} zoom={zoom} /> : null
}

function ChipOf({ wid, thread, zoom }: { wid: string; thread: WithId<Thread>; zoom: number }) {
  const openId = useThreadView((s) => s.openId)
  const me = myUid()
  const seen = useReads(wid, me || null).data?.seen
  const fresh = isNew(thread, seen, thread.id, me)
  const mentioned = fresh && !!thread.mentions?.includes(me)
  return (
    <span className={styles.chipAt} data-screen-sized style={{ transform: `scale(${1 / zoom})` }}>
      <button /* kit-ok: a thread's chip on the canvas, under its component's corner (D-192) */
        className={styles.chip}
        data-open={thread.id === openId || undefined}
        data-new={fresh || undefined}
        title={`${plural(thread.count, 'message')}${fresh ? ', new for you' : ''}`}
        aria-label={`Comments, ${thread.count}${fresh ? ', new' : ''}`}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onClick={() => (thread.id === openId ? closeThread() : openThread(thread.id))}
      >
        {mentioned ? <span className={styles.mark}>@</span> : <CommentIcon size={11} />}
        {thread.count}
      </button>
    </span>
  )
}

// `@` in a field (D-166): the word being typed after it, if the caret is right after it.
const MENTION_AT = /(^|\s)@([\p{L}\p{N}._ -]{0,30})$/u
const pickedIn = (text: string, picked: Map<string, string>) => [...picked].filter(([, name]) => text.includes(`@${name}`)).map(([uid]) => uid)

// A day's name over its messages (D-405): today, yesterday, else the month and the weekday (the day's number is the
// rule's own, magenta); the clock for a message's time once a thread runs over days.
const DAY_MS = 24 * 60 * 60 * 1000
const dayStart = (t: number) => new Date(t).setHours(0, 0, 0, 0)
function dayName(t: number) {
  const gone = Math.round((dayStart(Date.now()) - dayStart(t)) / DAY_MS)
  if (gone === 0) return 'TODAY'
  if (gone === 1) return 'YESTERDAY'
  const d = new Date(t)
  return `${d.toLocaleDateString('en-GB', { month: 'short' })} · ${d.toLocaleDateString('en-GB', { weekday: 'short' })}`.toUpperCase()
}
const clock = (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

type PanelProps = {
  wid: string
  thread: WithId<Thread> | null
  draft: NewThread | null
  title: string
  thing: ThreadThing
  isOwner: boolean
  // Where it is (its plane), and what shows it there (into its plane if need be).
  where?: string
  onShow?: () => void
  // Talk as the page (D-435): room for who's in it in its head, its words at a reading width.
  wide?: boolean
}

// A conversation (D-435): its head the thing it's on (its kind a badge, its name, where; a press goes there) with its
// tools at the right; its messages lines down the left, who, when, what, a run of one writer's under one name; the prompt
// a round well at its foot.
export function ThreadPanel({ wid, thread, draft, title, thing, isOwner, where, onShow, wide = false }: PanelProps) {
  const channel = (thread?.on ?? draft?.on) === 'channel'
  const messages = useMessages(wid, thread?.id ?? null)
  const members = useWorkspaceMembers(wid, useWs().workspace.memberIds)
  const reads = useReads(wid, myUid() || null).data
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  // Deleting a conversation isn't the workspace's undo's: it asks first.
  const [deleting, setDeleting] = useState(false)
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  // People picked from `@` while typing: uid → name.
  const picked = useRef(new Map<string, string>())
  const [suggest, setSuggest] = useState<{ q: string; at: number } | null>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  const list = useRef<HTMLOListElement>(null)
  const me = myUid()
  const colorOf = usePersonColor()

  // The reply field takes the keys as it opens.
  useEffect(() => {
    let frames = 10
    const go = () => {
      if (field.current?.isConnected) field.current.focus({ preventScroll: true })
      else if (frames-- > 0) requestAnimationFrame(go)
    }
    go()
  }, [thread?.id])
  // What you had read when it opened: the first message someone else wrote after it has the `NEW` line over it (D-405).
  const seenAtOpen = useRef<{ id: string; at: number } | null>(null)
  if (thread && reads && seenAtOpen.current?.id !== thread.id) seenAtOpen.current = { id: thread.id, at: reads.seen?.[thread.id] ?? 0 }
  const seenAt = thread && seenAtOpen.current?.id === thread.id ? seenAtOpen.current.at : null
  const firstNew = seenAt ? messages.data.find((m) => m.createdAt > seenAt && m.uid !== me)?.id : undefined
  // Over more than one day: each day's rule, and the clock (D-405).
  const days = messages.data.length > 0 && dayStart(messages.data[0].createdAt) !== dayStart(messages.data[messages.data.length - 1].createdAt)
  // The newest message in view, unless you scrolled up to read (then a new one doesn't pull you down); another thread
  // opens at its newest.
  const stick = useStickToBottom(list, [messages.data.length], thread?.id)
  // Open is read: what's in it now counts as seen (D-166).
  useEffect(() => {
    if (thread && (reads?.seen?.[thread.id] ?? 0) < thread.lastAt) void markSeen(wid, thread.id, thread.lastAt)
  }, [wid, thread, reads])
  // Escape closes it (the suggestions first, in the field): the one Escape stack (D-359); the list, if open, stays (D-199).
  const box = useRef<HTMLDivElement>(null)
  useEscapeLayer(closeThread, { on: !suggest, root: box })

  const names = useMemo(() => members.map((m) => m.name).filter(Boolean), [members])
  const matches = useMemo(() => {
    if (!suggest) return []
    const q = suggest.q.trim().toLowerCase()
    return members.filter((m) => m.id !== me && (!q || m.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(q)) || m.name.toLowerCase().startsWith(q))).slice(0, 6)
  }, [suggest, members, me])

  const fail = (e: unknown) => useHistory.getState().say(`Couldn't save the comment: ${(e as Error).message}`)
  const send = async () => {
    const body = text.trim()
    if (!body || busy) return
    setBusy(true)
    try {
      const mentions = pickedIn(body, picked.current)
      if (thread) await reply(wid, thread.id, body, mentions)
      else if (draft) openThread(await startThread(wid, draft, body, mentions))
      setText('')
      stick.toBottom()
      picked.current.clear()
      if (field.current) field.current.style.height = ''
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }
  const saveEdit = () => {
    if (!thread || !editing) return
    const body = editing.text.trim()
    const old = messages.data.find((m) => m.id === editing.id)
    // Mentions kept as long as their `@Name` is still there.
    const kept = (old?.mentions ?? []).filter((uid) => {
      const name = members.find((m) => m.id === uid)?.name
      return name && body.includes(`@${name}`)
    })
    if (body) editMessage(wid, thread.id, editing.id, body, [...kept, ...pickedIn(body, picked.current)]).catch(fail)
    setEditing(null)
  }

  // Typing: is the caret right after an `@word`?
  const onType = (value: string, caret: number) => {
    setText(value)
    const m = MENTION_AT.exec(value.slice(0, caret))
    setSuggest(m ? { q: m[2], at: caret - m[2].length - 1 } : null)
  }
  const pick = (m: WithId<Member>) => {
    if (!suggest) return
    const caret = field.current?.selectionStart ?? text.length
    const next = `${text.slice(0, suggest.at)}@${m.name} ${text.slice(caret)}`
    picked.current.set(m.id, m.name)
    setText(next)
    setSuggest(null)
    requestAnimationFrame(() => {
      const at = suggest.at + m.name.length + 2
      field.current?.focus()
      field.current?.setSelectionRange(at, at)
    })
  }
  // The `@` list's keys (usePromptPick): its first row again as each key is typed.
  const mention = usePromptPick(matches, !!suggest, { pick, close: () => setSuggest(null), reset: suggest })

  const resolved = !!thread?.resolved
  // Owners, or whoever wrote the one message left (D-166; firestore.rules says the same).
  const mayDeleteThread = !!thread && (isOwner || (thread.count <= 1 && (thread.uid === me || thread.lastUid === me)))

  const writers = wide ? [...new Map(messages.data.map((m) => [m.uid, m.name]))] : []

  return (
    <div
      ref={box}
      className={styles.panel}
      data-wide={wide || undefined}
      role="dialog" /* kit-ok: a conversation in Talk, docked or in its page, not a Window */
      aria-label={`Thread on ${title}`}
      data-learn="thread"
      data-viewer-ok
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <header className={styles.head}>
        {/* The thing itself (D-405), its kind a badge (D-414); a press goes there (D-220). A channel (D-416) is on nothing. */}
        <CardFace
          tone={thing.tone}
          tint={!!thing.tone && !wide}
          bare
          flat={wide || channel || !thing.tone}
          button={onShow ? true : undefined}
          label={onShow ? `Go to ${title}` : undefined}
          title={onShow ? 'show it on the canvas' : undefined}
          className={styles.thing}
          data-goes={onShow ? true : undefined}
          onClick={onShow}
          onKeyDown={(e) => onShow && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onShow())}
        >
          <h3 className={styles.title} data-gone={thing.gone || undefined}>
            {resolved ? '✓ ' : ''}
            {thing.gone ? 'what it was on was deleted' : thing.name || thing.kind}
          </h3>
          <span className={styles.where}>
            {!channel && (thing.tone && !thing.gone ? <TypeBadge kind={thing.kind} tone={thing.tone} className={styles.badge} /> : <Label>{thing.kind}</Label>)}
            <span className={styles.whereText}>{channel ? 'everyone in the workspace' : where ? `on ${where}` : thread ? '' : 'new conversation'}</span>
          </span>
        </CardFace>
        <div className={styles.actions}>
          {writers.slice(0, 5).map(([uid, name]) => (
            <Avatar key={uid} size="sm" name={name} color={colorOf(uid)} />
          ))}
          <ButtonGroup>
            {onShow && (
              <Button icon aria-label="show it on the canvas" title="show it on the canvas" onClick={onShow}>
                <TargetIcon />
              </Button>
            )}
            {/* A channel is never done: no resolve. */}
            {thread && !channel && (
              <Button icon pressed={resolved} aria-label={resolved ? 'reopen' : 'resolve'} title={resolved ? 'reopen it' : 'resolve it: off the canvas, kept in Talk'} onClick={() => setResolved(wid, thread.id, !resolved).catch(fail)}>
                <CheckIcon />
              </Button>
            )}
            {mayDeleteThread && (
              <Button icon aria-label="delete" title="delete the conversation" onClick={() => setDeleting(true)}>
                <BinIcon />
              </Button>
            )}
          </ButtonGroup>
        </div>
      </header>
      {deleting && thread && (
        <HazardConfirm
          title={`delete the conversation on ${title}?`}
          lines={[`${plural(thread.count, 'message')} ${thread.count === 1 ? 'goes' : 'go'}, for everyone.`, "It can't be undone."]}
          confirm="delete"
          onCancel={() => setDeleting(false)}
          onConfirm={() => (setDeleting(false), void deleteThread(wid, thread.id).then(closeThread, fail))}
        />
      )}
      <ol ref={list} className={styles.log} onScroll={stick.onScroll}>
        {!thread && (
          <li className={styles.lead}>
            {draft?.on === 'channel'
              ? `Your first message starts #${draft.targetId}. Everyone in the workspace sees it, viewers too. @ mentions someone.`
              : 'Start a thread here: everyone in the workspace sees it, viewers too. @ mentions someone.'}
          </li>
        )}
        {thread && messages.isLoading && <li className={styles.lead}>Loading</li>}
        {messages.data.map((m: WithId<ThreadMessage>, i) => {
          // One writer's messages in a row are one run: their circle and name once, on top; a new day or the `NEW` line
          // starts another.
          const before = messages.data[i - 1]
          const newDay = days && (!before || dayStart(before.createdAt) !== dayStart(m.createdAt))
          const follows = before?.uid === m.uid && !newDay && m.id !== firstNew
          return (
            <Fragment key={m.id}>
              {newDay && <li className={styles.day}><Label>{dayName(m.createdAt)}</Label></li>}
              {m.id === firstNew && (
                <li className={styles.newLine}>
                  <Label>new</Label>
                </li>
              )}
              <li className={styles.msg} data-mine={m.uid === me || undefined} data-follows={follows || undefined}>
                {follows ? (
                  <span className={styles.gutter} aria-hidden>
                    {clock(m.createdAt)}
                  </span>
                ) : (
                  <Avatar size="hud" name={m.name} color={colorOf(m.uid)} className={styles.face} />
                )}
                <div className={styles.said}>
                  {!follows && (
                    <div className={styles.who}>
                      <span className={styles.name} style={{ color: colorOf(m.uid) }}>
                        {m.uid === me ? 'You' : m.name}
                      </span>
                      <span className={styles.when} title={new Date(m.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}>
                        {days ? clock(m.createdAt) : ago(m.createdAt)}
                        {m.editedAt && ' · edited'}
                      </span>
                    </div>
                  )}
                  {editing?.id === m.id ? (
                    <Field
                      multiline
                      rows={1}
                      className={styles.editField}
                      value={editing.text}
                      maxLength={MESSAGE_MAX}
                      autoFocus
                      label="Edit your message"
                      onChange={(v) => setEditing({ id: m.id, text: v })}
                      onBlur={saveEdit}
                      onKeyDown={(e) => {
                        e.stopPropagation()
                        if (e.key === 'Enter' && !e.shiftKey) (e.preventDefault(), saveEdit())
                        if (e.key === 'Escape') setEditing(null)
                      }}
                    />
                  ) : (
                    <div className={styles.text}>{withMentions(m.text, names)}</div>
                  )}
                </div>
                {/* Only its writer edits or deletes a message (D-166): over its line's end while pointed at. */}
                {m.uid === me && editing?.id !== m.id && (
                  <ButtonGroup className={styles.tools}>
                    <Button icon aria-label="edit" title="edit" onClick={() => setEditing({ id: m.id, text: m.text })}>
                      <EditIcon />
                    </Button>
                    <Button
                      icon
                      tone="danger"
                      aria-label="delete this message"
                      title="delete"
                      onClick={() => thread && deleteMessage(wid, thread.id, m.id, messages.data.length === 1).then(() => messages.data.length === 1 && closeThread(), fail)}
                    >
                      <BinIcon />
                    </Button>
                  </ButtonGroup>
                )}
              </li>
            </Fragment>
          )
        })}
      </ol>
      {!resolved && (
        <form
          className={styles.composer}
          onSubmit={(e) => {
            e.preventDefault()
            void send()
          }}
        >
          {/* `@` suggests the workspace's people (D-166). */}
          {suggest && matches.length > 0 && (
            <div className={styles.suggest} onPointerDown={(e) => e.preventDefault()}>
              <PromptList
                role="listbox"
                label="Mention someone"
                entries={matches.map((m) => ({ key: m.id, label: `@${m.name}`, hint: m.email || undefined, onSelect: () => pick(m) }))}
                picked={matches[mention.at]?.id ?? null}
                q=""
                onPick={(i) => i.onSelect({ shift: false, alt: false })}
                onPoint={(k) => mention.setAt(Math.max(0, matches.findIndex((m) => m.id === k)))}
                idOf={(k) => `mention-${k}`}
              />
            </div>
          )}
          {/* A round well with `send` in it (D-398). */}
          <PromptField
            ref={field}
            className={styles.well}
            multiline
            value={text}
            maxLength={MESSAGE_MAX}
            placeholder={thread && !channel ? 'reply' : 'say something'}
            label={thread ? 'Reply' : 'First message'}
            onChange={(v) => onType(v, field.current?.selectionStart ?? v.length)}
            // Enter sends, unless it's picking a mention (the keys below take it).
            onSubmit={() => !(suggest && matches.length) && void send()}
            onKeyDown={(e) => {
              if (mention.onKey(e)) return
              if (e.key === 'Escape') closeThread()
            }}
          >
            <Button icon type="submit" tone="primary" className={styles.send} disabled={!text.trim() || busy} aria-label="send" title="send (↵)">
              <SendIcon />
            </Button>
          </PromptField>
        </form>
      )}
    </div>
  )
}

// `@Full Name` of someone in the workspace, or any `@word`, stands out (D-166).
function withMentions(text: string, names: string[]) {
  const known = [...names].sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${known.map((n) => `@${n}`).concat('@[\\p{L}\\p{N}_.-]+').join('|')})`, 'u')
  return text.split(re).map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className={styles.at}>
        {part}
      </span>
    ) : (
      part
    ),
  )
}
