// Comment threads on the board (D-159). A thread is pinned to something you can select on the board (a card, text, a
// section, a sticky note, a link) or to a spot; its pin sits at the thing's top-right corner (a link's chip), in the
// colour of whoever started it, with their initial and how many messages it has. Clicking a pin opens the thread
// beside it: the messages, a reply field (Enter sends, shift+Enter a new line), resolve or reopen. Resolved threads
// leave the board and stay in the footer's list. Anyone in the workspace comments, viewers too.
import { Html } from '@react-three/drei'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import type { WithId } from '../../data/hooks'
import { firebase } from '../../data/firebase'
import { MESSAGE_MAX, type Thread, type ThreadMessage } from '../../data/model'
import { presenceColor, usePresence } from '../../data/presence'
import { deleteMessage, deleteThread, editMessage, reply, setResolved, startThread, useMessages, type NewThread } from '../../data/threads'
import { useHistory } from '../../data/history'
import { useThemeAccent } from '../../state/theme'
import { ago } from './stickyNote'
import styles from './Threads.module.css'

type ThreadView = {
  // Pins on the board (the footer's switch, `c`).
  show: boolean
  // The thread open beside its pin, or one being started (no messages yet).
  openId: string | null
  draft: NewThread | null
}

export const useThreadView = create<ThreadView>(() => ({ show: true, openId: null, draft: null }))
export const toggleThreadPins = () => useThreadView.setState((s) => ({ show: !s.show }))
export const openThread = (id: string) => useThreadView.setState({ openId: id, draft: null, show: true })
export const startComment = (draft: NewThread) => useThreadView.setState({ draft, openId: null, show: true })
export const closeThread = () => useThreadView.setState({ openId: null, draft: null })

const myUid = () => firebase?.auth.currentUser?.uid ?? ''

// A person's colour: as they're shown in the workspace right now (D-067), else their own from their uid.
function useColorOf() {
  const peers = usePresence((s) => s.peers)
  const mine = usePresence((s) => s.myColor)
  const tone = useThemeAccent()
  return (uid: string) => tone(uid === myUid() && mine ? mine : (peers.find((p) => p.uid === uid)?.color ?? presenceColor(uid)))
}

const initial = (name: string) => (name.trim()[0] ?? '?').toUpperCase()

export type PinnedThread = { thread: WithId<Thread>; at: [number, number]; gone: boolean }

type LayerProps = {
  wid: string
  // Unresolved threads with where their pin goes (resolved ones only while open).
  pins: PinnedThread[]
  // Where the open thread or the one being started is, and what it's on.
  openAt: [number, number] | null
  title: string
  thread: WithId<Thread> | null
  // Owners and editors delete any thread or message.
  canEdit: boolean
}

// Inside the board's canvas: the pins, and the open thread beside its pin.
export function ThreadLayer({ wid, pins, openAt, title, thread, canEdit }: LayerProps) {
  const show = useThreadView((s) => s.show)
  const openId = useThreadView((s) => s.openId)
  const draft = useThreadView((s) => s.draft)
  const colorOf = useColorOf()
  return (
    <>
      {show &&
        pins.map(({ thread: t, at, gone }) => (
          <Html key={t.id} position={[at[0], at[1], 0.2]} zIndexRange={[12, 11]} style={{ pointerEvents: 'none' }}>
            <button
              className={styles.pin}
              data-open={t.id === openId || undefined}
              data-gone={gone || undefined}
              data-viewer-ok
              style={{ ['--tone' as string]: colorOf(t.uid) }}
              title={`${t.name}: ${t.count} message${t.count === 1 ? '' : 's'}${gone ? ' · on something removed' : ''}`}
              aria-label={`Thread by ${t.name}, ${t.count} messages`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => (t.id === openId ? closeThread() : openThread(t.id))}
            >
              {initial(t.name)}
              {t.count > 1 && <small>{t.count}</small>}
            </button>
          </Html>
        ))}
      {(thread || draft) && openAt && (
        <Html key={thread?.id ?? 'draft'} position={[openAt[0], openAt[1], 0.25]} zIndexRange={[19, 18]} style={{ pointerEvents: 'none' }}>
          <ThreadPanel wid={wid} thread={thread} draft={draft} title={title} canEdit={canEdit} />
        </Html>
      )}
    </>
  )
}

function ThreadPanel({ wid, thread, draft, title, canEdit }: { wid: string; thread: WithId<Thread> | null; draft: NewThread | null; title: string; canEdit: boolean }) {
  const messages = useMessages(wid, thread?.id ?? null)
  const colorOf = useColorOf()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const panel = useRef<HTMLDivElement>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const me = myUid()

  // Beside the pin; flipped to its left where it would run off the window.
  useLayoutEffect(() => {
    const el = panel.current
    if (!el) return
    el.dataset.flip = el.getBoundingClientRect().right > window.innerWidth - 8 ? 'left' : ''
  })
  // The reply field takes the keys as it opens (drei attaches it a moment after it renders).
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
  // Escape closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeThread()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const fail = (e: unknown) => useHistory.getState().say(`Couldn't save the comment: ${(e as Error).message}`)
  const send = async () => {
    const body = text.trim()
    if (!body || busy) return
    setBusy(true)
    try {
      if (thread) await reply(wid, thread.id, body)
      else if (draft) openThread(await startThread(wid, draft, body))
      setText('')
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }
  const saveEdit = () => {
    if (!thread || !editing) return
    const body = editing.text.trim()
    if (body) editMessage(wid, thread.id, editing.id, body).catch(fail)
    setEditing(null)
  }

  const resolved = !!thread?.resolved
  const mayDeleteThread = !!thread && (canEdit || (thread.uid === me && thread.count <= 1))

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
      <header className={styles.head}>
        <span className={styles.title}>THREAD · {title}</span>
        {thread && (
          <button className={styles.resolve} data-on={resolved || undefined} onClick={() => setResolved(wid, thread.id, !resolved).catch(fail)}>
            {resolved ? 'reopen' : '✓ resolve'}
          </button>
        )}
        <button className={styles.close} aria-label="Close thread" onClick={closeThread}>
          ×
        </button>
      </header>
      <div ref={list} className={styles.list}>
        {!thread && <p className={styles.empty}>Start a thread: everyone in the workspace sees it.</p>}
        {thread && messages.isLoading && <p className={styles.empty}>Loading</p>}
        {messages.data.map((m: WithId<ThreadMessage>) => (
          <div key={m.id} className={styles.msg} style={{ ['--tone' as string]: colorOf(m.uid) }}>
            <span className={styles.avatar} aria-hidden>
              {initial(m.name)}
            </span>
            <div className={styles.who}>
              <b>{m.name.split(/\s+/)[0]}</b>
              {ago(m.createdAt)}
              {m.editedAt && ' · edited'}
              {(m.uid === me || canEdit) && editing?.id !== m.id && (
                <span className={styles.acts}>
                  {m.uid === me && (
                    <button onClick={() => setEditing({ id: m.id, text: m.text })}>edit</button>
                  )}
                  <button
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
              <div className={styles.text}>{withMentions(m.text)}</div>
            )}
          </div>
        ))}
      </div>
      {!resolved && (
        <div className={styles.reply}>
          <textarea
            ref={field}
            value={text}
            rows={1}
            maxLength={MESSAGE_MAX}
            placeholder={thread ? 'reply…' : 'say something…'}
            aria-label={thread ? 'Reply' : 'First message'}
            disabled={busy}
            onChange={(e) => {
              setText(e.target.value)
              e.target.style.height = '0px'
              e.target.style.height = `${e.target.scrollHeight}px`
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
              if (e.key === 'Escape') closeThread()
            }}
          />
          <kbd>↵</kbd>
        </div>
      )}
      {mayDeleteThread && (
        <footer className={styles.foot}>
          <button data-tone="danger" onClick={() => thread && deleteThread(wid, thread.id).then(closeThread, fail)}>
            delete thread
          </button>
        </footer>
      )}
    </div>
  )
}

// `@name` stands out, as in a chat.
function withMentions(text: string) {
  return text.split(/(@[\p{L}\p{N}_.-]+)/u).map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className={styles.at}>
        {part}
      </span>
    ) : (
      part
    ),
  )
}
