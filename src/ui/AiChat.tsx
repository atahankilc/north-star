// The assistant (D-073): an ASCII orb with eyes in the bottom-right corner of a workspace. Clicking it opens a chat
// that knows the workspace (read only for now; tools that change it come in Phase 4.2). Your own OpenAI key (D-006).
import { AnimatePresence } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { useChat } from '../ai/chat'
import { workspaceBrief } from '../ai/context'
import { chatInstructions } from '../ai/prompts/chat'
import { useAiSettings } from '../ai/settings'
import { workspacePath } from '../app/paths'
import { useCanvas } from '../state/canvasStore'
import { useWs } from '../views/workspace/context'
import { AiKeyForm, KEY_PRIVACY } from './AiSettings'
import { AiOrb, type OrbMood } from './AiOrb'
import styles from './AiChat.module.css'
import { Appear } from './Appear'

const ORB = 56

const STARTERS = [
  'Summarize this workspace',
  'Which problems have no idea yet?',
  'Where do we stand out against competitors?',
]

export function AiChat() {
  const { wid } = useWs()
  const open = useChat((s) => s.open)
  const setOpen = useChat((s) => s.setOpen)
  const busy = useChat((s) => s.busy)
  const enter = useChat((s) => s.enter)
  const [hover, setHover] = useState(false)
  useEffect(() => enter(wid), [enter, wid])

  const mood: OrbMood = busy ? 'thinking' : open ? 'open' : hover ? 'hover' : 'idle'

  return (
    <div className={styles.dock}>
      <AnimatePresence>{open && <ChatPanel key="chat" onClose={() => setOpen(false)} />}</AnimatePresence>
      <button
        className={styles.orb}
        data-open={open || undefined}
        onClick={() => setOpen(!open)}
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
        aria-expanded={open}
        aria-label={open ? 'Close the assistant' : 'Ask the assistant'}
        title="Assistant"
      >
        <AiOrb size={ORB} mood={mood} />
      </button>
    </div>
  )
}

function ChatPanel({ onClose }: { onClose: () => void }) {
  const apiKey = useAiSettings((s) => s.apiKey)
  const model = useAiSettings((s) => s.model)
  const messages = useChat((s) => s.messages)
  const clear = useChat((s) => s.clear)

  // Escape closes the chat, not the selection behind it.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    e.stopPropagation()
    onClose()
  }

  return (
    <Appear as="section" className={styles.panel} aria-label="Assistant" onKeyDown={onKeyDown}>
      <header className={styles.head}>
        <span className={styles.kicker}>assistant</span>
        <span className={styles.model}>{model}</span>
        <span className={styles.headActions}>
          {messages.length > 0 && (
            <button className={styles.action} onClick={clear}>
              clear
            </button>
          )}
          <button className={styles.close} onClick={onClose} aria-label="Close the assistant">
            [×]
          </button>
        </span>
      </header>
      {apiKey ? <Conversation /> : <NoKey />}
    </Appear>
  )
}

function NoKey() {
  return (
    <div className={styles.noKey}>
      <p className={styles.lead}>Paste your OpenAI API key to talk to the assistant.</p>
      <AiKeyForm />
      <p className={styles.fine}>
        {KEY_PRIVACY} Get one at{' '}
        <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">
          platform.openai.com/api-keys
        </a>
        ; change it later in Settings → ai.
      </p>
    </div>
  )
}

function Conversation() {
  const ws = useWs()
  const messages = useChat((s) => s.messages)
  const busy = useChat((s) => s.busy)
  const send = useChat((s) => s.send)
  const stop = useChat((s) => s.stop)
  const path = useLocation().pathname
  const [draft, setDraft] = useState('')
  const input = useRef<HTMLTextAreaElement>(null)
  const log = useRef<HTMLOListElement>(null)
  const stick = useRef(true)

  useEffect(() => input.current?.focus(), [])

  // Follow the answer as it streams in, unless you've scrolled up to read.
  useLayoutEffect(() => {
    const el = log.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [messages])

  // Grow with the text, up to a few lines.
  useLayoutEffect(() => {
    const el = input.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`
  }, [draft])

  const ask = (text: string) => {
    if (!text.trim() || busy) return
    const view = path.slice(workspacePath(ws.wid).length).replace(/^\//, '').split('/')[0] || 'board'
    // Built when sent, so it sees the board as it is now.
    send(text, () => chatInstructions(workspaceBrief(ws, { view, selectedId: useCanvas.getState().selectedId })))
    setDraft('')
    stick.current = true
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    ask(draft)
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      ask(draft)
    }
  }

  const last = messages[messages.length - 1]

  return (
    <>
      <ol
        ref={log}
        className={styles.log}
        aria-live="polite"
        onScroll={(e) => {
          const el = e.currentTarget
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
        }}
      >
        {messages.length === 0 && (
          <li className={styles.empty}>
            <p className={styles.lead}>Ask about this workspace: what's missing, what to build next, how you compare.</p>
            <div className={styles.starters}>
              {STARTERS.map((s) => (
                <button key={s} className={styles.starter} onClick={() => ask(s)}>
                  {s}
                </button>
              ))}
            </div>
          </li>
        )}
        {messages.map((m) => (
          <li key={m.id} className={styles.message} data-role={m.role}>
            <span className={styles.who}>{m.role === 'user' ? 'you' : 'ai'}</span>
            <span className={styles.text}>
              {m.content}
              {m.role === 'assistant' && busy && m === last && <span className={styles.caret} aria-hidden />}
              {m.error && <span className={styles.error}>! {m.error}</span>}
            </span>
          </li>
        ))}
      </ol>
      <form className={styles.composer} onSubmit={submit}>
        <textarea
          ref={input}
          className={styles.input}
          rows={1}
          placeholder="Ask anything…"
          aria-label="Message the assistant"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
        />
        {busy ? (
          <button type="button" className={styles.send} onClick={stop}>
            stop
          </button>
        ) : (
          <button type="submit" className={styles.send} disabled={!draft.trim()}>
            send
          </button>
        )}
      </form>
      <p className={styles.footnote}>Reads this workspace; can't change it yet. Enter sends, Shift+Enter adds a line.</p>
    </>
  )
}
