// Comment threads (D-159, D-165–D-171; on the canvas and in planes, D-192). A thread is pinned to a card, a piece of
// text, or a spot, in a space (the canvas or a plane); its pin sits at the thing's top-right corner: a small framed mono
// chip at the screen's own size, the comment mark and a count (D-167), magenta when someone wrote in it since you last
// read it, `@` when they mentioned you (D-166). Clicking a pin opens the thread beside it, set like the assistant's chat:
// who wrote each message (full name) and when, the text, a `>` prompt (Enter sends, shift+Enter a new line, `@`
// suggests the workspace's people), resolve or reopen. Only a message's writer edits or deletes it. Resolved threads
// leave the canvas; every thread is in the threads panel (ThreadInbox.tsx). Anyone in the workspace comments, viewers too.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { create } from 'zustand'
import type { WithId } from '../../data/hooks'
import { firebase } from '../../data/firebase'
import { MESSAGE_MAX, type Member, type Thread, type ThreadMessage } from '../../data/model'
import {
  deleteMessage,
  deleteThread,
  editMessage,
  isNew,
  markSeen,
  reply,
  setResolved,
  startThread,
  useMembers,
  useMessages,
  useReads,
  type NewThread,
} from '../../data/threads'
import { useHistory } from '../../data/history'
import { ago } from '../../ui/ago'
import styles from './Threads.module.css'

type ThreadView = {
  // Pins shown (`c`); only threads with something new (D-166); resolved ones too.
  show: boolean
  newOnly: boolean
  resolvedToo: boolean
  // The thread open beside its pin, or one being started (no messages yet).
  openId: string | null
  draft: NewThread | null
  // The threads panel (D-166), on the left beside the side nav.
  inbox: boolean
}

export const useThreadView = create<ThreadView>(() => ({ show: true, newOnly: false, resolvedToo: false, openId: null, draft: null, inbox: false }))
export const toggleThreadPins = () => useThreadView.setState((s) => ({ show: !s.show }))
export const openThread = (id: string) => useThreadView.setState({ openId: id, draft: null })
export const startComment = (draft: NewThread) => useThreadView.setState({ draft, openId: null, show: true })
export const closeThread = () => useThreadView.setState({ openId: null, draft: null })
export const toggleInbox = (on?: boolean) => useThreadView.setState((s) => ({ inbox: on ?? !s.inbox }))

export const myUid = () => firebase?.auth.currentUser?.uid ?? ''

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

// A thread with where its pin goes, in its space's px; `gone` when what it was on was deleted (no pin then, D-171).
export type PinnedThread = { thread: WithId<Thread>; at: [number, number]; gone: boolean }

// A space's pins, inside its world (so they sit on what they're on), each scaled back to the screen's size.
export function ThreadPins({ wid, pins, zoom }: { wid: string; pins: PinnedThread[]; zoom: number }) {
  const { show, newOnly, resolvedToo, openId } = useThreadView()
  const me = myUid()
  const seen = useReads(wid, me || null).data?.seen
  if (!show) return null
  return (
    <>
      {pins
        .filter(({ thread: t, gone }) => !gone && (t.id === openId || ((!t.resolved || resolvedToo) && (!newOnly || isNew(t, seen, t.id, me)))))
        .map(({ thread: t, at }) => {
          const fresh = isNew(t, seen, t.id, me)
          const mentioned = fresh && !!t.mentions?.includes(me)
          return (
            <div key={t.id} className={styles.pinAt} style={{ left: at[0], top: at[1], transform: `scale(${1 / zoom})` }}>
              <button
                className={styles.pin}
                data-open={t.id === openId || undefined}
                data-new={fresh || undefined}
                data-resolved={t.resolved || undefined}
                title={`${t.count} message${t.count === 1 ? '' : 's'}${fresh ? ', new for you' : ''}`}
                aria-label={`Thread, ${t.count} messages${fresh ? ', new' : ''}`}
                onPointerDown={(e) => e.stopPropagation()}
                onContextMenu={(e) => e.stopPropagation()}
                onClick={() => (t.id === openId ? closeThread() : openThread(t.id))}
              >
                {mentioned ? (
                  <span className={styles.mark} aria-hidden>
                    @
                  </span>
                ) : t.resolved ? (
                  <span className={styles.mark} aria-hidden>
                    ✓
                  </span>
                ) : (
                  <CommentIcon size={11} />
                )}
                {t.count}
              </button>
            </div>
          )
        })}
    </>
  )
}

type OpenProps = {
  wid: string
  // Where the open thread (or the one being started) is on screen, px from the canvas's corner; null = not here.
  at: [number, number] | null
  title: string
  thread: WithId<Thread> | null
  // Owners delete any thread (D-166).
  isOwner: boolean
}

// The open thread, at its pin on screen.
export function OpenThread({ wid, at, title, thread, isOwner }: OpenProps) {
  const draft = useThreadView((s) => s.draft)
  if ((!thread && !draft) || !at) return null
  return (
    <div className={styles.openAt} style={{ left: at[0], top: at[1] }}>
      <ThreadPanel key={thread?.id ?? 'draft'} wid={wid} thread={thread} draft={draft} title={title} isOwner={isOwner} />
    </div>
  )
}

// `@` in a field (D-166): the word being typed after it, if the caret is right after it.
const MENTION_AT = /(^|\s)@([\p{L}\p{N}._ -]{0,30})$/u
const pickedIn = (text: string, picked: Map<string, string>) => [...picked].filter(([, name]) => text.includes(`@${name}`)).map(([uid]) => uid)

function ThreadPanel({ wid, thread, draft, title, isOwner }: { wid: string; thread: WithId<Thread> | null; draft: NewThread | null; title: string; isOwner: boolean }) {
  const messages = useMessages(wid, thread?.id ?? null)
  const members = useMembers(wid).data
  const reads = useReads(wid, myUid() || null).data
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  // People picked from `@` while typing: uid → name.
  const picked = useRef(new Map<string, string>())
  const [suggest, setSuggest] = useState<{ q: string; at: number } | null>(null)
  const [hi, setHi] = useState(0)
  const panel = useRef<HTMLDivElement>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  const list = useRef<HTMLOListElement>(null)
  const me = myUid()

  // Beside the pin; flipped to its left where it would run off the window.
  useLayoutEffect(() => {
    const el = panel.current
    if (!el) return
    el.dataset.flip = el.getBoundingClientRect().right > window.innerWidth - 8 ? 'left' : ''
  })
  // The reply field takes the keys as it opens.
  useEffect(() => {
    let frames = 10
    const go = () => {
      if (field.current?.isConnected) field.current.focus({ preventScroll: true })
      else if (frames-- > 0) requestAnimationFrame(go)
    }
    go()
  }, [thread?.id])
  // The newest message in view.
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight
  }, [messages.data.length])
  // Open is read: what's in it now counts as seen (D-166).
  useEffect(() => {
    if (thread && (reads?.seen?.[thread.id] ?? 0) < thread.lastAt) void markSeen(wid, thread.id, thread.lastAt)
  }, [wid, thread, reads])
  // Escape closes it (or the suggestions first).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !suggest && closeThread()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [suggest])

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
    setHi(0)
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

  const resolved = !!thread?.resolved
  // Owners, or whoever started it while nobody answered (D-166).
  const mayDeleteThread = !!thread && (isOwner || (thread.uid === me && thread.count <= 1))

  return (
    <div
      ref={panel}
      className={styles.panel}
      role="dialog"
      aria-label={`Thread on ${title}`}
      data-viewer-ok
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
      {/* As the assistant's chat (D-081): what it's on, faint; actions in brackets; [×]. */}
      <header className={styles.head}>
        <span className={styles.title} title={title}>
          {resolved ? '✓ ' : ''}
          {title}
        </span>
        <span className={styles.actions}>
          {thread && (
            <button className={styles.action} onClick={() => setResolved(wid, thread.id, !resolved).catch(fail)}>
              {resolved ? 'reopen' : 'resolve'}
            </button>
          )}
          {mayDeleteThread && (
            <button className={styles.action} data-tone="danger" onClick={() => thread && deleteThread(wid, thread.id).then(closeThread, fail)}>
              delete
            </button>
          )}
          <button className={styles.close} aria-label="Close thread" onClick={closeThread}>
            [×]
          </button>
        </span>
      </header>
      <ol ref={list} className={styles.log}>
        {!thread && <li className={styles.lead}>Start a thread here: everyone in the workspace sees it, viewers too. @ mentions someone.</li>}
        {thread && messages.isLoading && <li className={styles.lead}>Loading</li>}
        {messages.data.map((m: WithId<ThreadMessage>) => (
          <li key={m.id} className={styles.msg} data-mine={m.uid === me || undefined}>
            <div className={styles.who}>
              <span className={styles.name}>{m.name}</span>
              <span className={styles.when}>
                {ago(m.createdAt)}
                {m.editedAt && ' · edited'}
              </span>
              {/* Only its writer edits or deletes a message (D-166). */}
              {m.uid === me && editing?.id !== m.id && (
                <span className={styles.msgActions}>
                  <button className={styles.action} onClick={() => setEditing({ id: m.id, text: m.text })}>
                    edit
                  </button>
                  <button
                    className={styles.action}
                    data-tone="danger"
                    onClick={() => thread && deleteMessage(wid, thread.id, m.id, messages.data.length === 1).then(() => messages.data.length === 1 && closeThread(), fail)}
                  >
                    delete
                  </button>
                </span>
              )}
            </div>
            {editing?.id === m.id ? (
              <textarea
                className={styles.editField}
                value={editing.text}
                maxLength={MESSAGE_MAX}
                autoFocus
                aria-label="Edit your message"
                onChange={(e) => setEditing({ id: m.id, text: e.target.value })}
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
          </li>
        ))}
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
            <ul className={styles.suggest} role="listbox" aria-label="Mention someone">
              {matches.map((m, i) => (
                <li key={m.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === hi}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => pick(m)}
                  >
                    @{m.name}
                    {m.email && <span>{m.email}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className={styles.promptLine}>
            <span className={styles.ps} aria-hidden>
              &gt;
            </span>
            <textarea
              ref={field}
              className={styles.input}
              value={text}
              rows={1}
              maxLength={MESSAGE_MAX}
              placeholder={thread ? 'reply · @ mentions' : 'say something · @ mentions'}
              aria-label={thread ? 'Reply' : 'First message'}
              disabled={busy}
              onChange={(e) => {
                onType(e.target.value, e.target.selectionStart)
                e.target.style.height = '0px'
                e.target.style.height = `${e.target.scrollHeight}px`
              }}
              onKeyDown={(e) => {
                if (suggest && matches.length) {
                  if (e.key === 'ArrowDown') return (e.preventDefault(), setHi((hi + 1) % matches.length))
                  if (e.key === 'ArrowUp') return (e.preventDefault(), setHi((hi - 1 + matches.length) % matches.length))
                  if (e.key === 'Enter' || e.key === 'Tab') return (e.preventDefault(), pick(matches[hi]))
                  if (e.key === 'Escape') return (e.preventDefault(), setSuggest(null))
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
                if (e.key === 'Escape') closeThread()
              }}
            />
          </div>
          <div className={styles.bar}>
            <span className={styles.footnote}>enter sends · shift+enter: new line · @: mention</span>
            <button type="submit" className={styles.send} disabled={!text.trim() || busy}>
              send
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

// `@Full Name` of someone in the workspace, or any `@word`, stands out (D-166).
export function withMentions(text: string, names: string[]) {
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
