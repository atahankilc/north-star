// The assistant (D-073): an ASCII orb with eyes in the bottom-right corner of a workspace. Clicking it opens the
// assistant's window, a full-height column on the right that the app makes room for (D-081); the orb glides up into its
// header and stays there as its face. The chat knows the workspace and proposes changes you accept before they're
// written (D-074). Your own OpenAI key (D-006)
// or the workspace's, if the owner set one and lets you use it (D-079).
import { AnimatePresence, motion } from 'motion/react'
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { useChat, type Step } from '../ai/chat'
import { workspaceBrief } from '../ai/context'
import { useKeySource } from '../ai/keySource'
import { chatInstructions } from '../ai/prompts/chat'
import { MODES, modeAbout, parseMode, type Mode } from '../ai/modes'
import { modelFor, useAiSettings } from '../ai/settings'
import type { KeySource } from '../data/ai'
import type { NodeType } from '../data/model'
import { workspacePath } from '../app/paths'
import { useCanvas } from '../state/canvasStore'
import { useMotion } from '../state/motion'
import { themeAccent, useTheme } from '../state/theme'
import { useWs } from '../views/workspace/context'
import { MARK_COLOR, OutsidePreview, usePreview, type Mark } from '../views/workspace/preview'
import { AiKeyForm, KEY_PRIVACY } from './AiSettings'
import { AiOrb, type OrbCue, type OrbMood } from './AiOrb'
import { glide, GLIDE_MS } from './glide'
import { AiProposal } from './AiProposal'
import styles from './AiChat.module.css'

// The orb's size: big enough for its face to read; smaller on phones.
const ORB = 88
const ORB_NARROW = 68

function useNarrow() {
  const query = '(max-width: 760px)'
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setNarrow(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return narrow
}

// The window's width: dragged by its left edge, remembered in this browser.
const WIDTH_KEY = 'north-star.ai-width'
const WIDTH = { min: 320, max: 760, initial: 420 }

function readWidth() {
  try {
    const n = Number(localStorage.getItem(WIDTH_KEY))
    return n >= WIDTH.min && n <= WIDTH.max ? n : WIDTH.initial
  } catch {
    return WIDTH.initial
  }
}

const EASE = [0.16, 1, 0.3, 1] as const
const GLIDE = { duration: GLIDE_MS / 1000, ease: EASE }

// Which side panel is open in the app, if any (an item's, or the matrix cell's): the closed orb steps aside for it.
function useSidePanel() {
  const [side, setSide] = useState<string | null>(null)
  useEffect(() => {
    const read = () => setSide(document.querySelector('[data-side-panel]')?.getAttribute('data-side-panel') ?? null)
    read()
    const watch = new MutationObserver(read)
    watch.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-side-panel'] })
    return () => watch.disconnect()
  }, [])
  return side
}

const STARTER = 'Summarize this workspace'

export function AiChat() {
  const { wid } = useWs()
  const open = useChat((s) => s.open)
  const setOpen = useChat((s) => s.setOpen)
  const busy = useChat((s) => s.busy)
  const enter = useChat((s) => s.enter)
  const [hover, setHover] = useState(false)
  const size = useNarrow() ? ORB_NARROW : ORB
  const reduced = useMotion((s) => s.reduced)
  useEffect(() => enter(wid), [enter, wid])

  // `html[data-ai-open]` gives the app its room (`--ai-w`, AiChat.module.css); the width is a variable on <html> too.
  useEffect(() => {
    const html = document.documentElement
    html.style.setProperty('--ai-width', `${readWidth()}px`)
    html.style.setProperty('--orb', `${size}px`)
  }, [size])
  // The app takes its new width at once (the board keeps its left edge, Board.tsx); the HUD's right side and side panels
  // glide over (glide.ts). Opening, the window is lifted up by the orb; closing, the app is already whole under it as it
  // goes down. Run from the store, before React renders, whoever opens or closes it.
  useEffect(() => {
    const html = document.documentElement
    html.toggleAttribute('data-ai-open', useChat.getState().open)
    const unsubscribe = useChat.subscribe((s, prev) => {
      if (s.open !== prev.open) glide(() => html.toggleAttribute('data-ai-open', s.open))
    })
    return () => {
      unsubscribe()
      html.removeAttribute('data-ai-open')
    }
  }, [])

  // A side panel shoves the closed orb aside (it glides, and gets bumped); closing it lets the orb back (relieved).
  const side = useSidePanel()
  const [cue, setCue] = useState<OrbCue | undefined>()
  const lastSide = useRef(side)
  useEffect(() => {
    if (side === lastSide.current) return
    const appeared = !!side && !lastSide.current
    const gone = !side && !!lastSide.current
    lastSide.current = side
    if (open || (!appeared && !gone)) return
    setCue((c) => ({ kind: appeared ? 'bumped' : 'free', n: (c?.n ?? 0) + 1 }))
  }, [side, open])
  const sideRoom = side ? `calc(min(${side === 'wide' ? 520 : 380}px, 100vw - 2 * var(--space-4)) + var(--space-4))` : '0px'

  // Thinking until the first words arrive, then talking while they stream in.
  const talking = useChat((s) => s.busy && !!s.messages[s.messages.length - 1]?.content)
  const mood: OrbMood = busy ? (talking ? 'talking' : 'thinking') : open ? 'open' : hover ? 'hover' : 'idle'

  return (
    // The assistant always sees the real workspace, also while the app shows its preview (D-087).
    <OutsidePreview.Provider value={true}>
      <PreviewBar />
      <AnimatePresence>{open && <AiWindow key="chat" onClose={() => setOpen(false)} />}</AnimatePresence>
      {/* One orb for both places, so its reactions carry over; `layout` glides it between the corner and the header. */}
      <motion.button
        layout={!reduced}
        transition={GLIDE}
        className={styles.orb}
        style={{ '--side-room': sideRoom } as CSSProperties}
        data-open={open || undefined}
        onClick={() => setOpen(!open)}
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
        aria-expanded={open}
        aria-label={open ? 'Close the assistant' : 'Ask the assistant'}
      >
        <AiOrb size={size} mood={mood} cue={cue} />
      </motion.button>
    </OutsidePreview.Provider>
  )
}

function AiWindow({ onClose }: { onClose: () => void }) {
  const { source, workspaceKeyExists } = useKeySource()
  const model = useAiSettings(modelFor)
  const messages = useChat((s) => s.messages)
  const clear = useChat((s) => s.clear)

  // Escape closes the chat, not the selection behind it.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    e.stopPropagation()
    onClose()
  }

  const reduced = useMotion((s) => s.reduced)

  return (
    <motion.aside
      className={styles.window}
      aria-label="Assistant"
      onKeyDown={onKeyDown}
      // Lifted up from below by the orb (which glides up to its header at the same pace), lowered the same way.
      initial={reduced ? false : { y: '100%' }}
      animate={{ y: 0 }}
      exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { y: '100%' }}
      transition={GLIDE}
    >
      <ResizeEdge />
      <header className={styles.head}>
        <span className={styles.title}>
          <span className={styles.name}>assistant</span>
          <span className={styles.model}>
            {model}
            {source && ` · ${source === 'workspace' ? 'workspace key' : 'own key'}`}
          </span>
        </span>
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
      {source ? <Conversation source={source} /> : <NoKey workspaceKeyExists={workspaceKeyExists} />}
    </motion.aside>
  )
}

// The window's left edge: drag to resize. While dragging the app follows at once (no easing).
function ResizeEdge() {
  const onPointerDown = (e: ReactPointerEvent) => {
    e.preventDefault()
    const html = document.documentElement
    html.toggleAttribute('data-ai-resizing', true)
    let width = readWidth()
    const move = (ev: PointerEvent) => {
      const max = Math.min(WIDTH.max, window.innerWidth - 360)
      width = Math.round(Math.min(max, Math.max(WIDTH.min, window.innerWidth - ev.clientX)))
      html.style.setProperty('--ai-width', `${width}px`)
    }
    const up = () => {
      html.removeAttribute('data-ai-resizing')
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      try {
        localStorage.setItem(WIDTH_KEY, String(width))
      } catch {
        // Not remembered; it still works for now.
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  return <div className={styles.edge} onPointerDown={onPointerDown} role="separator" aria-orientation="vertical" aria-label="Resize the assistant" />
}

function NoKey({ workspaceKeyExists }: { workspaceKeyExists: boolean }) {
  return (
    <div className={styles.noKey}>
      <p className={styles.lead}>
        {workspaceKeyExists
          ? "This workspace has a key, but the owner hasn't let you use it. Paste your own to talk to the assistant."
          : 'Paste your OpenAI API key to talk to the assistant.'}
      </p>
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

function Conversation({ source }: { source: KeySource }) {
  const ws = useWs()
  const messages = useChat((s) => s.messages)
  const busy = useChat((s) => s.busy)
  const send = useChat((s) => s.send)
  const stop = useChat((s) => s.stop)
  const web = useAiSettings((s) => s.web)
  const setWeb = useAiSettings((s) => s.setWeb)
  const path = useLocation().pathname
  const [draft, setDraft] = useState('')
  // The `/` menu of analysis modes (D-085): open while the draft is a bare `/word`, until Escape.
  const [pick, setPick] = useState(0)
  const [menuOff, setMenuOff] = useState(false)
  const modes = !menuOff && /^\/[a-z]*$/i.test(draft) ? MODES.filter((m) => m.id.startsWith(draft.slice(1).toLowerCase())) : []
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

  // The card selected on the board (or in Flow / Table), for modes that work on one item.
  const selectedItem = (): { type: NodeType; name: string } | null => {
    const id = useCanvas.getState().selectedId
    if (!id) return null
    const lists = [['customer', ws.customers], ['problem', ws.problems], ['idea', ws.ideas], ['feature', ws.features]] as const
    for (const [type, list] of lists) {
      const n = list.find((x) => x.id === id)
      if (n) return { type, name: n.title || 'Untitled' }
    }
    const c = ws.competitors.find((x) => x.id === id)
    return c ? { type: 'competitor', name: c.name || 'Untitled' } : null
  }

  const edit = (text: string) => {
    setDraft(text)
    setPick(0)
    setMenuOff(false)
  }

  const choose = (m: Mode) => {
    edit(`/${m.id} `)
    input.current?.focus()
  }

  const ask = (text: string) => {
    if (!text.trim() || busy) return
    const mode = parseMode(text)
    const view = path.slice(workspacePath(ws.wid).length).replace(/^\//, '').split('/')[0] || 'board'
    // Built when sent, so it sees the board as it is now.
    const prepare = () => {
      const brief = workspaceBrief(ws, { view, selectedId: useCanvas.getState().selectedId })
      return { instructions: chatInstructions(brief.text, ws.workspace.name, useAiSettings.getState().web), refs: brief.refs, source, ws }
    }
    if (mode) {
      const sel = selectedItem()
      // Shows which card a mode ran on when it took the selection.
      const on = mode.mode.target && !mode.rest && sel?.type === mode.mode.target ? ` · ${sel.name}` : ''
      send(mode.mode.ask(modeAbout(mode.mode, mode.rest, sel)), prepare, `${text.trim()}${on}`)
    }
    else send(text, prepare)
    edit('')
    stick.current = true
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    ask(draft)
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (modes.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        setPick((p) => (p + (e.key === 'ArrowDown' ? 1 : modes.length - 1)) % modes.length)
        return
      }
      if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') {
        e.preventDefault()
        choose(modes[Math.min(pick, modes.length - 1)])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setMenuOff(true)
        return
      }
    }
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
              <button className={styles.starter} onClick={() => ask(STARTER)}>
                {STARTER}
              </button>
              {MODES.map((m) => (
                <button key={m.id} className={styles.starter} onClick={() => ask(`/${m.id}`)} title={m.hint}>
                  <span className={styles.modeId}>/{m.id}</span> {m.label}
                </button>
              ))}
            </div>
            <p className={styles.fine}>Type / in the box for these any time. On a selected card, they work on that card.</p>
          </li>
        )}
        {messages.map((m) => (
          <li key={m.id} className={styles.message} data-role={m.role}>
            <span className={styles.who}>{m.role === 'user' ? 'you' : 'ai'}</span>
            <span className={styles.text}>
              {m.role === 'assistant' && <Steps steps={m.steps ?? []} thinking={!!m.thinking && busy && m === last} />}
              {m.role === 'assistant' ? <Linked text={m.content} /> : (m.shown ?? m.content)}
              {m.role === 'assistant' && busy && m === last && writing(m) && <span className={styles.caret} aria-hidden />}
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
        {modes.length > 0 && <ModeMenu modes={modes} pick={Math.min(pick, modes.length - 1)} selected={selectedItem()} onChoose={choose} />}
        <textarea
          ref={input}
          className={styles.input}
          rows={1}
          placeholder="Ask anything…"
          aria-label="Message the assistant"
          value={draft}
          onChange={(e) => edit(e.target.value)}
          onKeyDown={onKey}
        />
        <span className={styles.composerBar}>
          <button
            type="button"
            className={styles.web}
            aria-pressed={web}
            onClick={() => setWeb(!web)}
            title={web ? 'Web search is on: answers look things up and cite sources. Each search is billed.' : 'Turn on web search for research. Each search is billed.'}
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
        </span>
      </form>
      <p className={styles.footnote}>
        Proposes changes; nothing is written until you apply. {web ? 'Web search on: each search is billed.' : 'Enter sends, Shift+Enter adds a line.'}
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

// What the assistant did on the way to its answer (D-084), one line per step: the running one turns, a step that only
// partly worked gets a yellow `!`. `thinking` is the gap while a step has nothing to show yet.
const FRAMES = '▖▘▝▗'

// The caret only follows text as it streams; while it thinks or works a step, the steps say so.
const writing = (m: { thinking?: boolean; steps?: Step[] }) => !m.thinking && !m.steps?.some((s) => s.state === 'running')

function Steps({ steps, thinking }: { steps: Step[]; thinking: boolean }) {
  if (!steps.length && !thinking) return null
  return (
    <ol className={styles.steps}>
      {steps.map((s, i) => (
        <li key={i} data-state={s.state}>
          {s.state === 'running' ? <Spinner /> : <span className={styles.stepMark}>{s.state === 'warn' ? '!' : '·'}</span>}
          <span>{s.text}</span>
        </li>
      ))}
      {thinking && (
        <li data-state="running">
          <Spinner />
          <span>thinking</span>
        </li>
      )}
    </ol>
  )
}

function Spinner() {
  const reduced = useMotion((s) => s.reduced)
  const [i, setI] = useState(0)
  useEffect(() => {
    if (reduced) return
    const id = window.setInterval(() => setI((n) => (n + 1) % FRAMES.length), 120)
    return () => window.clearInterval(id)
  }, [reduced])
  return (
    <span className={styles.stepMark} aria-hidden>
      {FRAMES[i]}
    </span>
  )
}

// The `/` menu (D-085): modes matching what's typed; a mode that works on one item names the selected card when it fits.
function ModeMenu({ modes, pick, selected, onChoose }: { modes: Mode[]; pick: number; selected: { type: NodeType; name: string } | null; onChoose: (m: Mode) => void }) {
  return (
    <ul className={styles.modes} role="listbox" aria-label="Analysis modes">
      {modes.map((m, i) => (
        <li
          key={m.id}
          role="option"
          aria-selected={i === pick}
          onMouseDown={(e) => {
            e.preventDefault()
            onChoose(m)
          }}
        >
          <span className={styles.modeId}>/{m.id}</span>
          <span className={styles.modeText}>
            {m.label}
            <span className={styles.modeHint}>{m.target && selected?.type === m.target ? `on ${selected.name}` : m.hint}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

// While the preview is open (D-087): a frame around the app and a bar saying what you're looking at, with the marks'
// colours. Esc closes it. Drawn inside the app's box, so it stays clear of the assistant's window.
function PreviewBar() {
  const showing = usePreview((s) => s.ws !== null)
  const count = usePreview((s) => s.count)
  const theme = useTheme((s) => s.theme)
  const [host, setHost] = useState<Element | null>(null)
  useEffect(() => setHost(document.querySelector('[data-app]')), [])
  useEffect(() => {
    if (!showing) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopImmediatePropagation()
      usePreview.getState().close()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [showing])
  if (!showing || !host) return null
  return createPortal(
    <>
      <div className={styles.previewFrame} aria-hidden />
      <div className={styles.previewBar} role="status">
        <span className={styles.changeKind}>preview</span>
        <span>
          {count} change{count === 1 ? '' : 's'} as if applied; nothing is written yet
        </span>
        <span className={styles.previewKey}>
          {(Object.keys(MARK_COLOR) as Mark[]).map((m) => (
            <span key={m} style={{ color: themeAccent(MARK_COLOR[m], theme) }}>
              ■ {m}
            </span>
          ))}
        </span>
        <button className={styles.action} onClick={() => usePreview.getState().close()}>
          close · esc
        </button>
      </div>
    </>,
    host,
  )
}
