// The assistant (D-073): an ASCII orb with eyes in the bottom-right corner of a workspace. Clicking it opens the chat
// (D-095): an empty chat is a small box that rises from below and lifts the orb onto its top edge; with the first message
// it grows into a tall column on the right that the app makes room for (D-081), and the orb drops behind its edge and
// peeks over it (perch.ts). It reads like a terminal (D-094). When a preview or a report opens, the column crosses to the
// left and the stage takes the right (stageMotion.ts). The chat knows the workspace and proposes changes you accept before they're
// written (D-074). Your own OpenAI key (D-006)
// or the workspace's, if the owner set one and lets you use it (D-079).
import { AnimatePresence, motion } from 'motion/react'
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useChat, type ChatMessage, type Step } from '../ai/chat'
import { workspaceBrief } from '../ai/context'
import { useKeySource } from '../ai/keySource'
import { chatInstructions } from '../ai/prompts/chat'
import { MODES, modeAbout, parseMode, type Mode } from '../ai/modes'
import type { Research } from '../ai/research'
import { useAiSettings } from '../ai/settings'
import { modelIds, useModels } from '../ai/models'
import { ModelSwitch } from './ModelSwitch'
import type { KeySource } from '../data/ai'
import { firebase } from '../data/firebase'
import { useRecentReports, useReport, useReportSummary } from '../data/reports'
import type { NodeType } from '../data/model'
import { reportPath, workspacePath } from '../app/paths'
import { useCanvas } from '../state/canvasStore'
import { isReducedMotion, useMotion } from '../state/motion'
import { useWs } from '../views/workspace/context'
import { TYPE_LABELS, useNodeIndex, type NodeInfo } from '../views/workspace/nodeIndex'
import { TYPE_ACCENT } from '../views/canvas/boardKinds'
import { MARK_SIGN, MARK_VAR, OutsidePreview, usePreview, type Mark } from '../views/workspace/preview'
import { stepBy } from '../views/workspace/previewNav'
import { goToSection } from '../views/workspace/reportNav'
import { unlightSection, usePreviewFocus, useReportFocus, useStage } from '../views/workspace/stage'
import { lockApp } from '../views/workspace/previewLock'
import { AiKeyForm, KEY_PRIVACY } from './AiSettings'
import { AiOrb, type OrbCue, type OrbMood } from './AiOrb'
import { glide } from './glide'
import { morph, usePerch, type PerchCue } from './perch'
import { useStageMotion } from './stageMotion'
import { AiProposal, BoxHead } from './AiProposal'
import { ReportView } from './ReportView'
import { BarButton, Part, Rule, StageBox, Stepper, stageBoxStyles } from './StageBox'
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

// The small box growing into the tall column (and back, on clear).
const GROW_MS = 650
const GROW_EASE = 'cubic-bezier(0.33, 1, 0.68, 1)'
// A phone's chat shrinking to its header beside the stage, and back (D-114).
const FACE_MS = 450
// The window sliding up on open and down on close: as gentle as the growth, so you see it travel.
const SLIDE = { duration: 0.6, ease: [0.33, 1, 0.68, 1] as const }

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

export function AiChat() {
  const { wid } = useWs()
  const open = useChat((s) => s.open)
  const setOpen = useChat((s) => s.setOpen)
  const busy = useChat((s) => s.busy)
  const enter = useChat((s) => s.enter)
  const [hover, setHover] = useState(false)
  const narrow = useNarrow()
  const size = narrow ? ORB_NARROW : ORB
  useEffect(() => enter(wid), [enter, wid])
  useStageMotion()
  // Tall once there's a conversation, or something on the stage beside it; empty, it's the small box (D-095).
  const talked = useChat((s) => s.messages.length > 0)
  const staged = useStage((s) => s.preview !== null || s.reportId !== null)
  const tall = open && (talked || staged)

  // On a phone the chat covers the screen, so beside a stage it switches between the two (D-114): something new on the
  // stage shows it, and the chat shrinks to its header along the bottom (`html[data-ai-face]`), the orb on its edge.
  const stagedAs = useStage((s) => (s.preview ? `preview:${s.preview.messageId}` : s.reportId ? `report:${s.reportId}` : null))
  const [face, setFace] = useState<Face>('chat')
  useEffect(() => setFace(stagedAs ? 'stage' : 'chat'), [stagedAs])
  const switchable = narrow && open && stagedAs !== null
  useLayoutEffect(() => {
    const html = document.documentElement
    const on = switchable && face === 'stage'
    if (html.hasAttribute('data-ai-face') === on) return
    morph(document.querySelector('[data-ai-window]'), () => html.toggleAttribute('data-ai-face', on), FACE_MS, GROW_EASE)
  }, [switchable, face])

  // `html[data-ai-open]` gives the app its room (`--ai-w`, AiChat.module.css) while the chat is tall; the width is a
  // variable on <html> too.
  useEffect(() => {
    const html = document.documentElement
    html.style.setProperty('--ai-width', `${readWidth()}px`)
    html.style.setProperty('--orb', `${size}px`)
  }, [size])
  // The app takes its new width at once (the board keeps its left edge, Board.tsx); the HUD's right side and side panels
  // glide over (glide.ts), and the box grows into the column (or shrinks back) by its edges, so its text never stretches.
  // Opening or closing tall, the window slides up or down on its own (AiWindow, which keeps its tall shape while it goes)
  // and the app is whole under it at once.
  const wasTall = useRef(tall)
  const wasOpen = useRef(open)
  // The window as it was last drawn (recorded below, after this): by the time this runs, the render that makes it tall
  // or small has already resized it.
  const lastBox = useRef<DOMRect | null>(null)
  useLayoutEffect(() => {
    const html = document.documentElement
    // The small box over the app: side panels end above it and its orb (AiChat.module.css).
    html.toggleAttribute('data-ai-small', open && !tall)
    const toggle = () => html.toggleAttribute('data-ai-open', tall)
    const grew = tall !== wasTall.current
    const stayedOpen = open && wasOpen.current
    wasTall.current = tall
    wasOpen.current = open
    if (!grew) {
      toggle()
      return
    }
    // Growing or shrinking while open, the box moves by its edges; opening or closing tall, the window slides on its own.
    // Either way the app's side panels and the HUD's right side glide to their new place.
    if (!stayedOpen) {
      glide(toggle)
      return
    }
    glide(() => morph(document.querySelector('[data-ai-window]'), toggle, GROW_MS, GROW_EASE, lastBox.current))
    if (tall) setCue((c) => ({ kind: 'fall', n: (c?.n ?? 0) + 1 }))
  }, [tall, open])
  useLayoutEffect(() => {
    lastBox.current = document.querySelector('[data-ai-window]')?.getBoundingClientRect() ?? null
  })
  useEffect(
    () => () => {
      document.documentElement.removeAttribute('data-ai-open')
      document.documentElement.removeAttribute('data-ai-small')
      document.documentElement.removeAttribute('data-ai-face')
    },
    [],
  )

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

  // On the box's edge while open (perch.ts): lifted (startled), swept along when the column crosses (shaken, composed).
  const orb = useRef<HTMLButtonElement>(null)
  const perchCue = useCallback((kind: PerchCue) => setCue((c) => ({ kind, n: (c?.n ?? 0) + 1 })), [])
  usePerch(orb, open, tall, perchCue)

  // Thinking until the first words arrive, then talking while they stream in.
  const talking = useChat((s) => s.busy && !!s.messages[s.messages.length - 1]?.content)
  const mood: OrbMood = busy ? (talking ? 'talking' : 'thinking') : open ? 'open' : hover ? 'hover' : 'idle'

  return (
    // The assistant always sees the real workspace, also while the app shows its preview (D-087).
    <OutsidePreview.Provider value={true}>
      <PreviewBar />
      <ReportView />
      <AnimatePresence>{open && <AiWindow key="chat" tall={tall} face={switchable ? face : null} stage={stagedAs?.split(':')[0] ?? ''} onFace={setFace} onClose={() => setOpen(false)} />}</AnimatePresence>
      {/* One orb, in its corner or on the chat's edge, so its reactions carry over. */}
      <button
        ref={orb}
        className={styles.orb}
        data-ai-orb
        style={{ '--side-room': sideRoom } as CSSProperties}
        data-open={open || undefined}
        // Bigger on the tall chat, where it peeks over the edge (D-095).
        data-tall={tall || undefined}
        onClick={() => setOpen(!open)}
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
        aria-expanded={open}
        aria-label={open ? 'Close the assistant' : 'Ask the assistant'}
      >
        <AiOrb size={size} mood={mood} cue={cue} peek={tall} />
      </button>
    </OutsidePreview.Provider>
  )
}

type Face = 'chat' | 'stage'

function AiWindow({ tall, face, stage, onFace, onClose }: { tall: boolean; face: Face | null; stage: string; onFace: (f: Face) => void; onClose: () => void }) {
  const { source, workspaceKeyExists, config } = useKeySource()
  const messages = useChat((s) => s.messages)
  const clear = useChat((s) => s.clear)

  // Escape closes the chat, not the selection behind it.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    e.stopPropagation()
    onClose()
  }

  const reduced = useMotion((s) => s.reduced)
  // The small box's height, for the side panels that end above it.
  const box = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = box.current
    if (!el || tall) return
    const html = document.documentElement
    const watch = new ResizeObserver(() => html.style.setProperty('--ai-small-h', `${el.offsetHeight}px`))
    watch.observe(el)
    return () => watch.disconnect()
  }, [tall])
  // The header's height: all that's left of the chat while a phone shows the stage, which ends above it.
  const head = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = head.current
    if (!el) return
    const watch = new ResizeObserver(() => document.documentElement.style.setProperty('--ai-head-h', `${el.offsetHeight}px`))
    watch.observe(el)
    return () => watch.disconnect()
  }, [])

  return (
    // Rises from below (lifting the orb onto its edge, perch.ts) and goes back down on close.
    <motion.aside
      ref={box}
      className={styles.window}
      aria-label="Assistant"
      onKeyDown={onKeyDown}
      data-ai-window
      data-tall={tall || undefined}
      initial={reduced ? false : { y: '115%' }}
      animate={{ y: 0 }}
      exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { y: '115%' }}
      transition={SLIDE}
    >
      {tall && <ResizeEdge />}
      {/* No title: the orb on its edge says what this is. The model in use, and the two things you do to the chat. */}
      <header ref={head} className={styles.head}>
        {face && (
          <span className={styles.faces} role="tablist" aria-label="Show">
            <button role="tab" aria-selected={face === 'chat'} onClick={() => onFace('chat')}>
              chat
            </button>
            <button role="tab" aria-selected={face === 'stage'} onClick={() => onFace('stage')}>
              {stage}
            </button>
          </span>
        )}
        {/* The model in use and which key pays; click to switch it for this chat (D-104). */}
        {face !== 'stage' && <ModelSwitch source={source} config={config} />}
        <span className={styles.headActions}>
          {messages.length > 0 && face !== 'stage' && (
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

// The window's inner edge (left, or right while it's beside a stage): drag to resize. While dragging the app follows at once (no easing).
function ResizeEdge() {
  const onPointerDown = (e: ReactPointerEvent) => {
    e.preventDefault()
    const html = document.documentElement
    html.toggleAttribute('data-ai-resizing', true)
    let width = readWidth()
    const move = (ev: PointerEvent) => {
      const max = Math.min(WIDTH.max, window.innerWidth - 360)
      // On the left beside a stage (D-094) the edge is the window's right one.
      const from = html.hasAttribute('data-ai-left') ? ev.clientX : window.innerWidth - ev.clientX
      width = Math.round(Math.min(max, Math.max(WIDTH.min, from)))
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
        ; change it later in Settings → assistant → keys.
      </p>
    </div>
  )
}

function Conversation({ source }: { source: KeySource }) {
  const ws = useWs()
  // The newest reports for the brief (D-090), loaded only while the chat is open (D-098).
  const recentReports = useRecentReports(ws.wid, firebase?.auth.currentUser?.uid, true)
  // The model per task for this key, workspace and chat (D-104).
  const models = useModels(ws.wid, source, useKeySource().config)
  const messages = useChat((s) => s.messages)
  // The report open goes into the brief in full (D-099): the one on the stage, else the reports tab's page; the saved
  // copy, else the chat's own.
  const location = useLocation()
  const pageReport = location.pathname.endsWith('/reports') ? new URLSearchParams(location.search).get('report') : null
  const openId = useChat((s) => s.reportOpen) ?? pageReport
  const openSaved = useReport(ws.wid, openId).report
  const openChat = messages.find((m) => m.reportId === openId)?.report
  const openReport = openId && (openSaved ?? openChat) ? { id: openId, report: (openSaved ?? openChat)!, saved: !!openSaved } : null
  const busy = useChat((s) => s.busy)
  const send = useChat((s) => s.send)
  const research = useChat((s) => s.research)
  const runResearch = useChat((s) => s.runResearch)
  const stop = useChat((s) => s.stop)
  const web = useAiSettings((s) => s.web)
  const setWeb = useAiSettings((s) => s.setWeb)
  const path = location.pathname
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

  // Built when sent, so it sees the board as it is now. `web`: the prompt's research rules (deep research always has them).
  const prepareAt = (view: string, web: boolean) => {
    const { selectedId, selection } = useCanvas.getState()
    const brief = workspaceBrief(ws, { view, selectedId, selection }, recentReports, openReport)
    return { instructions: chatInstructions(brief.text, ws.workspace.name, web), refs: brief.refs, reports: brief.reports, source, ws, models: modelIds(models!) }
  }
  const currentView = () => path.slice(workspacePath(ws.wid).length).replace(/^\//, '').split('/')[0] || 'board'

  const ask = (text: string) => {
    if (!text.trim() || busy) return
    const mode = parseMode(text)
    const view = currentView()
    if (mode?.mode.deep) research(mode.rest, () => prepareAt(view, true), text.trim())
    else if (mode) {
      const prepare = () => prepareAt(view, useAiSettings.getState().web)
      const sel = selectedItem()
      // Shows which card (or open report, D-099) a mode ran on when it took it.
      const title = openReport?.report.title ?? null
      const on = mode.mode.target && !mode.rest && sel?.type === mode.mode.target ? ` · ${sel.name}` : mode.mode.report && !mode.rest && title ? ` · ${title}` : ''
      send(mode.mode.ask(modeAbout(mode.mode, mode.rest, sel, title)), prepare, `${text.trim()}${on}`)
    }
    else send(text, () => prepareAt(view, useAiSettings.getState().web))
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
        {/* A terminal's log (D-094): your messages are `>` prompt lines, the answers sit under them. */}
        {messages.length === 0 && (
          <li className={styles.empty}>
            {/* Just the invitation: the commands are a `/` away (D-095), so they aren't listed here. */}
            <p className={styles.lead}>Ask about this workspace: what's missing, what to build next, how you compare.</p>
            <p className={styles.fine}>Type / for commands. Open a card and the assistant works on it; the line above the prompt says which.</p>
          </li>
        )}
        {messages.map((m) => (
          <li key={m.id} className={styles.message} data-role={m.role}>
            {m.role === 'user' && (
              <span className={styles.ps} aria-label="you">
                &gt;
              </span>
            )}
            <span className={styles.text}>
              {m.role === 'assistant' && <Steps message={m} live={busy && m === last} />}
              {m.role === 'assistant' ? <Rich text={m.content} /> : (m.shown ?? m.content)}
              {m.role === 'assistant' && busy && m === last && writing(m) && <span className={styles.caret} aria-hidden />}
              {/* A research report lists its sources on the report screen (D-089). */}
              {!(m.report && m.research) && m.citations && m.citations.length > 0 && (
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
              {m.research && <ResearchPlan message={m} onRun={() => runResearch(m.id, () => prepareAt(currentView(), true))} />}
              {!m.research && m.report && <ReportCard message={m} />}
              {m.proposal && <AiProposal message={m} />}
            </span>
          </li>
        ))}
      </ol>
      <form className={styles.composer} onSubmit={submit}>
        <ModeMenu modes={modes} pick={Math.min(pick, modes.length - 1)} selected={selectedItem()} openReport={openReport?.report.title ?? null} onChoose={choose} />
        <Scope report={openReport?.report.title ?? null} />
        <span className={styles.promptLine}>
          <span className={styles.ps} aria-hidden>
            &gt;
          </span>
          <textarea
            ref={input}
            className={styles.input}
            rows={1}
            placeholder="ask anything, / for modes"
            aria-label="Message the assistant"
            value={draft}
            onChange={(e) => edit(e.target.value)}
            onKeyDown={onKey}
          />
        </span>
        <span className={styles.composerBar}>
          <span className={styles.footnote}>{web ? 'web on · each search is billed' : 'enter sends · shift+enter: new line'}</span>
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
    </>
  )
}

// What the next message works on, always above the prompt: the card whose panel is open (the brief marks it as
// "this"), the cards selected together, the report being read, or else the whole workspace.
function Scope({ report }: { report: string | null }) {
  const ws = useWs()
  const index = useNodeIndex()
  const selectedId = useCanvas((s) => s.selectedId)
  const selection = useCanvas((s) => s.selection)
  const items = selection.map((id) => index.get(id)).filter((n): n is NodeInfo => !!n && n.type !== 'competitorFeature')
  const one = selectedId ? index.get(selectedId) : undefined
  let tone = 'var(--fg-dim)'
  let kind: string
  let name: string
  let hint: string
  if (items.length > 1) {
    kind = `${items.length} cards`
    name = items.map((n) => n.title).join(', ')
    tone = 'var(--accent-cyan)'
    hint = 'the selected cards'
  } else if (one && one.type !== 'competitorFeature') {
    kind = TYPE_LABELS[one.type]
    name = one.title
    tone = TYPE_ACCENT[one.type]
    hint = 'this card, with the rest of the workspace for context'
  } else if (report) {
    kind = 'report'
    name = report
    tone = 'var(--accent-cyan)'
    hint = 'the open report, with the workspace for context'
  } else {
    const count = ws.customers.length + ws.problems.length + ws.ideas.length + ws.features.length + ws.competitors.length
    kind = 'whole workspace'
    name = `${count} ${count === 1 ? 'item' : 'items'}`
    hint = 'open a card to focus on it'
  }
  const focused = kind !== 'whole workspace'
  return (
    <span className={styles.scope} data-focused={focused || undefined} style={{ ['--tone' as string]: tone }} title={`The assistant works on ${hint}.`}>
      <span className={styles.scopeLabel}>working on</span>
      <span className={styles.scopeKind}>{kind}</span>
      <span className={styles.scopeName}>{name}</span>
    </span>
  )
}

// Links in an answer: markdown `[title](url)` (how cited sources come back) and bare URLs, both clickable (D-076).
const LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)\]]+)/g

// An answer's text (D-089): `- ` lines as a list with a hanging indent, `**bold**`, and links (Linked). Nothing else of
// Markdown, so text that happens to contain `#` or `_` reads as written.
function Rich({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, i) => {
        const item = /^\s*[-*•] (.*)$/.exec(line)
        if (item)
          return (
            <span key={i} className={styles.bullet}>
              <Bold text={item[1]} />
            </span>
          )
        return (
          <Fragment key={i}>
            <Bold text={line} />
            {i < lines.length - 1 && !/^\s*[-*•] /.test(lines[i + 1]) ? '\n' : ''}
          </Fragment>
        )
      })}
    </>
  )
}

function Bold({ text }: { text: string }) {
  const parts = text.split(/\*\*([^*]+)\*\*/g)
  return <>{parts.map((p, i) => (i % 2 ? <strong key={i}>{p}</strong> : <Linked key={i} text={p} />))}</>
}

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
// partly worked gets a yellow `!`. While it works it's a live log with each step's time, and a last line for what it's
// doing with nothing to show yet: thinking, then writing the answer. Once the answer is done the log folds into one
// line (`▸ 3 steps · 4.7s`) that opens it again (D-114).
const FRAMES = '▖▘▝▗'

// The caret only follows text as it streams; while it thinks or works a step, the steps say so.
const writing = (m: { thinking?: boolean; steps?: Step[] }) => !m.thinking && !m.steps?.some((s) => s.state === 'running')

// 0.4s, 12s, 1m 05s.
function took(ms: number) {
  const s = Math.max(0, ms) / 1000
  if (s < 10) return `${s.toFixed(1)}s`
  if (s < 60) return `${Math.floor(s)}s`
  return `${Math.floor(s / 60)}m ${String(Math.floor(s % 60)).padStart(2, '0')}s`
}

// The clock for running times: ticks while `on`, every tenth of a second (every second under reduced motion).
function useNow(on: boolean) {
  const reduced = useMotion((s) => s.reduced)
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!on) return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), reduced ? 1000 : 100)
    return () => window.clearInterval(id)
  }, [on, reduced])
  return now
}

function Steps({ message: m, live }: { message: ChatMessage; live: boolean }) {
  const steps = m.steps ?? []
  const now = useNow(live)
  const [unfolded, setUnfolded] = useState(false)
  // Thinking until words come, then writing them; nothing while a step runs (it says what's going on).
  const doing = !live ? null : m.thinking ? 'thinking' : writing(m) && m.content ? 'writing the answer' : null
  if (!steps.length && !doing) return null
  // The last line's time runs from where the steps left off.
  const mark = Math.max(m.runAt ?? now, ...steps.map((s) => s.t1 ?? 0))
  const warned = steps.filter((s) => s.state === 'warn').length
  const folded = !live && !unfolded
  const list = (
    <ol className={styles.steps}>
      {steps.map((s, i) => (
        <li key={i} data-state={s.state}>
          {s.state === 'running' ? <Spinner /> : <span className={styles.stepMark}>{s.state === 'warn' ? '!' : '✓'}</span>}
          <span className={styles.stepText}>{s.text}</span>
          {s.t0 !== undefined && <span className={styles.stepTime}>{took((s.t1 ?? now) - s.t0)}</span>}
        </li>
      ))}
      {doing && (
        <li data-state="running">
          <Spinner />
          <span className={styles.stepText}>{doing}</span>
          {m.runAt !== undefined && <span className={styles.stepTime}>{took(now - mark)}</span>}
        </li>
      )}
    </ol>
  )
  if (live) return list
  return (
    <div className={styles.stepsFold}>
      <button className={styles.stepsLine} aria-expanded={!folded} onClick={() => setUnfolded(!unfolded)}>
        <span className={styles.stepMark}>{folded ? '▸' : '▾'}</span>
        <span>
          {steps.length} step{steps.length === 1 ? '' : 's'}
          {warned > 0 && <span className={styles.stepsWarn}> · {warned} partly worked</span>}
          {m.took !== undefined && ` · ${took(m.took)}`}
        </span>
      </button>
      <Unfold open={!folded}>{list}</Unfold>
    </div>
  )
}

// Opens and shuts by its height, like the `/` menu.
function Unfold({ open, children }: { open: boolean; children: ReactNode }) {
  const inner = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)
  useLayoutEffect(() => {
    const el = inner.current
    if (!el) return
    const measure = () => setHeight(el.offsetHeight)
    measure()
    const watch = new ResizeObserver(measure)
    watch.observe(el)
    return () => watch.disconnect()
  }, [])
  return (
    <div className={styles.unfold} style={{ height: open ? height : 0 }} aria-hidden={!open || undefined}>
      <div ref={inner}>{children}</div>
    </div>
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
// It opens and closes by its height (and so the box around it grows and shrinks with it instead of jumping, D-095);
// closing, it keeps showing what it last listed until it's shut.
function ModeMenu({
  modes,
  pick,
  selected,
  openReport,
  onChoose,
}: {
  modes: Mode[]
  pick: number
  selected: { type: NodeType; name: string } | null
  openReport: string | null
  onChoose: (m: Mode) => void
}) {
  const inner = useRef<HTMLUListElement>(null)
  const [height, setHeight] = useState(0)
  const shown = useRef(modes)
  if (modes.length) shown.current = modes
  const open = modes.length > 0
  useLayoutEffect(() => {
    const el = inner.current
    if (!el) return
    const measure = () => setHeight(el.offsetHeight)
    measure()
    const watch = new ResizeObserver(measure)
    watch.observe(el)
    return () => watch.disconnect()
  }, [])
  return (
    <div className={styles.modesBox} style={{ height: open ? height : 0 }} aria-hidden={!open || undefined}>
      <ul ref={inner} className={styles.modes} role="listbox" aria-label="Analysis modes">
        {shown.current.map((m, i) => (
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
            <span className={styles.modeHint}>{m.target && selected?.type === m.target ? `on ${selected.name}` : m.report && openReport ? `on ${openReport}` : m.hint}</span>
          </span>
        </li>
        ))}
      </ul>
    </div>
  )
}

// While the preview is open (D-087, D-096): the stage is one box, like the chat's own boxes, with its title written into
// its top edge: what you're looking at and how many of each change, this workspace's views, a stepper through the
// checklist's rows (‹ n/N ›, or n and p) and esc. Drawn inside the app's box, so it stays clear of the assistant's window.
function PreviewBar() {
  // What's on the stage (D-094), which trails what was asked for while the app makes way.
  const showing = useStage((s) => s.preview !== null)
  const wid = useStage((s) => s.preview?.ws.wid)
  const count = useStage((s) => s.preview?.count ?? 0)
  const marks = useStage((s) => s.preview?.marks)
  // A competitor's own features go with it but never show on their own: count what you can see.
  const hidden = useStage((s) => s.preview?.ws.competitorFeatures)
  const steps = useStage((s) => s.preview?.steps.length ?? 0)
  const step = usePreviewFocus((f) => f.step)
  const [host, setHost] = useState<Element | null>(null)
  useEffect(() => setHost(document.querySelector('[data-app]')), [])
  // The app becomes a bare preview screen meanwhile: no HUD, filters or tools, nothing editable (previewLock.ts).
  useEffect(() => (showing && host instanceof HTMLElement ? lockApp(host) : undefined), [showing, host])
  useEffect(() => {
    if (!showing) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopImmediatePropagation()
        usePreview.getState().close()
        return
      }
      // n / p step through the changes, unless you're typing (the chat's prompt stays live beside the stage).
      const t = e.target as HTMLElement | null
      if (e.metaKey || e.ctrlKey || e.altKey || t?.closest('input, textarea, select, [contenteditable="true"]')) return
      const k = e.key.toLowerCase()
      if (k !== 'n' && k !== 'p') return
      e.preventDefault()
      stepBy(k === 'n' ? 1 : -1)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [showing])
  if (!showing || !host || !wid) return null
  // How many of each, in the checklist's signs and the diff colours (only the kinds this preview has).
  const tally = (['new', 'edited', 'moved', 'deleted'] as Mark[])
    .map((m) => ({ m, n: [...(marks?.entries() ?? [])].filter(([id, x]) => x === m && !hidden?.some((f) => f.id === id)).length }))
    .filter((t) => t.n > 0)
  return createPortal(
    // In the HUD's place: the only way around is between this workspace's views.
    <StageBox title={`preview · ${count} change${count === 1 ? '' : 's'}`} barProps={{ 'data-preview-bar': true }}>
      <Part className={styles.previewKey} title="nothing is written until you apply">
        {tally.map(({ m, n }) => (
          <span key={m} style={{ color: MARK_VAR[m] }} title={`${n} ${m}`}>
            {MARK_SIGN[m]}
            {n}
          </span>
        ))}
      </Part>
      <Rule long />
      <nav className={stageBoxStyles.part} aria-label="Preview views">
        <span className={styles.previewViews}>
          {(['board', 'flow', 'table', 'matrix'] as const).map((v) => (
            <NavLink key={v} to={workspacePath(wid, v === 'board' ? undefined : v)} end={v === 'board'}>
              {v}
            </NavLink>
          ))}
        </span>
      </nav>
      <Rule long />
      {steps > 0 && <Stepper step={step} steps={steps} noun="change" onStep={stepBy} />}
      <Rule />
      <BarButton onClick={() => usePreview.getState().close()}>esc</BarButton>
    </StageBox>,
    host,
  )
}

// A deep research run in the chat (D-088). While you review the plan: its questions to tick and `research N`; once the
// report is written: a card that opens it on the report screen (D-089). The run itself shows in the answer's steps.
function ResearchPlan({ message, onRun }: { message: ChatMessage; onRun: () => void }) {
  const r = message.research!
  const busy = useChat((s) => s.busy)
  const toggle = useChat((s) => s.toggleQuestion)
  const on = r.questions.filter((q) => q.on).length
  const cancel = () =>
    useChat.setState((s) => ({ messages: s.messages.map((m) => (m.id === message.id ? { ...m, research: { ...r, phase: 'cancelled' as Research['phase'] } } : m)) }))
  if (r.phase === 'review')
    return (
      <div className={styles.proposal} data-status="pending">
        <BoxHead label={`research plan · ${r.questions.length} questions`} />
        <p className={styles.proposalSummary}>{r.topic || 'our market'}</p>
        <ul className={styles.changes}>
          {r.questions.map((q) => (
            <li key={q.id} className={styles.change} data-off={!q.on || undefined}>
              <label>
                <input type="checkbox" checked={q.on} onChange={() => toggle(message.id, q.id)} />
                <span className={styles.sign}>?</span>
                <span className={styles.changeBody}>
                  <span className={styles.changeText}>{q.question}</span>
                  {q.why && <span className={styles.changeDetail}>{q.why}</span>}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <p className={styles.fine}>One researcher per question, each searching the web a few times (billed to the key in use).</p>
        <div className={styles.proposalActions}>
          <button className={styles.send} onClick={onRun} disabled={!on || busy}>
            research {on}
          </button>
          <button className={styles.action} onClick={cancel}>
            cancel
          </button>
        </div>
      </div>
    )
  if (message.report) return <ReportCard message={message} />
  if (r.phase === 'cancelled') return <span className={styles.fine}>research cancelled</span>
  return null
}

// A report in the chat: from /research (D-089) or a write-up of the conversation (D-090), as a box like a proposal
// (D-101): its title and answer, a row per section, and what to do with it. Cyan while it waits for you to save it.
// It opens on the stage (D-094); a row goes to its section there, and the section lit on the stage lights its row.
// Research is saved to the reports tab as it's written, a write-up when you save it; either is yours until you share it.
function ReportCard({ message }: { message: ChatMessage }) {
  const report = message.report!
  const id = message.reportId
  const wid = useWs().wid
  const navigate = useNavigate()
  const reportOpen = useChat((s) => !!id && s.reportOpen === id)
  const staged = useStage((s) => !!id && s.reportId === id)
  const lit = useReportFocus((f) => (staged ? f.lit : null))
  const stepping = useReportFocus((f) => staged && f.step !== null)
  const saved = useReportSummary(wid, id ?? null).data
  const research = message.reportMeta?.kind !== 'chat'
  const status = saved
    ? `saved in reports · ${saved.shared ? 'shared with the workspace' : 'only you can see it'}`
    : message.reportError
      ? `! not saved: ${message.reportError}`
      : research
        ? 'saving to reports…'
        : 'not saved yet'
  const list = useRef<HTMLUListElement>(null)
  useEffect(() => {
    if (!stepping || lit === null) return
    list.current?.querySelector(`[data-n="${lit}"]`)?.scrollIntoView({ block: 'nearest', behavior: isReducedMotion() ? 'auto' : 'smooth' })
  }, [lit, stepping])
  // To a section: at once if the report is on the stage, else once it has opened there.
  const goTo = (i: number) => {
    if (!id) return
    if (staged) return goToSection(i)
    useChat.getState().showReport(id)
    const off = useStage.subscribe((st) => {
      if (st.reportId !== id) return
      off()
      requestAnimationFrame(() => goToSection(i))
    })
  }
  // Saved, it can be read as a page of the reports tab too (D-100).
  const inTab = () => {
    if (!id) return
    useChat.getState().showReport(null)
    navigate(reportPath(wid, id))
  }
  const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
  return (
    <div className={styles.proposal} data-status={!saved && !research && !message.reportError ? 'pending' : undefined}>
      <BoxHead label={`report · ${count(report.sections.length, research ? 'question' : 'section')}`} />
      <p className={styles.proposalSummary}>{report.title}</p>
      <p className={styles.reportAnswer}>{report.answer}</p>
      {report.sections.length > 0 && (
        <ul className={styles.changes} ref={list}>
          {report.sections.map((s, i) => (
            <li
              key={i}
              className={styles.change}
              data-n={i}
              data-lit={lit === i || undefined}
              onPointerEnter={staged ? () => useReportFocus.setState({ lit: i }) : undefined}
              onPointerLeave={staged ? unlightSection : undefined}
            >
              <button className={styles.reportRow} onClick={() => goTo(i)} title={staged ? 'Go to it' : 'Open the report here'}>
                <span className={styles.reportNum}>{String(i + 1).padStart(2, '0')}</span>
                <span className={styles.changeBody}>
                  <span className={styles.changeText}>{s.question}</span>
                  <span className={styles.changeDetail}>
                    {count(s.points.length, 'point')}
                    {(() => {
                      const n = new Set(s.points.flatMap((p) => p.sources)).size
                      return n ? ` · ${count(n, 'source')}` : ''
                    })()}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.fine}>
        {[
          report.implications.length && count(report.implications.length, 'thing') + ' for us',
          report.openQuestions.length && count(report.openQuestions.length, 'open question'),
          report.sources.length && count(report.sources.length, 'source'),
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <p className={styles.fine}>{status}</p>
      <div className={styles.proposalActions}>
        {/* Open first: it opens the stage beside the chat (D-094), like a proposal's preview. */}
        <button className={styles.action} aria-pressed={reportOpen} onClick={() => id && useChat.getState().showReport(reportOpen ? null : id)}>
          {reportOpen ? 'close report' : 'open report →'}
        </button>
        {!saved && !research && (
          <button className={styles.send} onClick={() => useChat.getState().keepReport(message.id)}>
            save to reports
          </button>
        )}
        {saved && (
          <button className={styles.action} onClick={inTab}>
            open in reports
          </button>
        )}
      </div>
    </div>
  )
}
