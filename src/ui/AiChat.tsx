// The assistant (D-073): an ASCII orb with eyes in the bottom-right corner of a workspace. Clicking it opens a chat
// that knows the workspace and proposes changes you accept before they're written (D-074). Your own OpenAI key (D-006).
import { AnimatePresence } from 'motion/react'
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
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
import { AiProposal } from './AiProposal'
import styles from './AiChat.module.css'
import { Appear } from './Appear'

const ORB = 56

const STARTERS = [
  'Summarize this workspace',
  'Which problems have no idea yet?',
  'Fill in the matrix notes you can',
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
  const web = useAiSettings((s) => s.web)
  const setWeb = useAiSettings((s) => s.setWeb)
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
    send(text, () => {
      const brief = workspaceBrief(ws, { view, selectedId: useCanvas.getState().selectedId })
      return { instructions: chatInstructions(brief.text, useAiSettings.getState().web), refs: brief.refs }
    })
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
              {(m.searching || m.queries?.length) && (
                <span className={styles.searched}>
                  {m.searching ? 'searching the web…' : `searched: ${m.queries!.join(' · ')}`}
                </span>
              )}
              {m.role === 'assistant' ? <Linked text={m.content} /> : m.content}
              {m.role === 'assistant' && busy && m === last && <span className={styles.caret} aria-hidden />}
              {m.citations && m.citations.length > 0 && (
                <span className={styles.sources}>
                  <span className={styles.changeKind}>sources</span>
                  {m.citations.map((c, i) => (
                    <a key={c.url} href={c.url} target="_blank" rel="noreferrer" title={c.url}>
                      {i + 1}. {c.title}
                    </a>
                  ))}
                </span>
              )}
              {m.error && <span className={styles.error}>! {m.error}</span>}
              {m.proposal && <AiProposal message={m} />}
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
        <button
          type="button"
          className={styles.web}
          aria-pressed={web}
          onClick={() => setWeb(!web)}
          title={web ? 'Web search is on: answers look things up and cite sources (about $0.01 per search on your OpenAI account)' : 'Turn on web search for research (about $0.01 per search on your OpenAI account)'}
        >
          web
        </button>
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
      <p className={styles.footnote}>
        Proposes changes; nothing is written until you apply. {web ? 'Web search on: ~$0.01 per search.' : 'Enter sends, Shift+Enter adds a line.'}
      </p>
    </>
  )
}

// Links in an answer: markdown `[title](url)` (how cited sources come back) and bare URLs, both clickable (D-076).
const LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)\]]+)/g

function Linked({ text }: { text: string }) {
  const parts: ReactNode[] = []
  let at = 0
  for (const m of text.matchAll(LINK)) {
    parts.push(text.slice(at, m.index))
    const url = m[2] ?? m[3]
    parts.push(
      <a key={m.index} href={url} target="_blank" rel="noreferrer">
        {m[1] ?? url.replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '')}
      </a>,
    )
    at = m.index + m[0].length
  }
  parts.push(text.slice(at))
  return <>{parts.map((p, i) => (typeof p === 'string' ? <Fragment key={`t${i}`}>{p}</Fragment> : p))}</>
}
