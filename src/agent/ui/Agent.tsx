// The agent in the screen's bottom-right corner (S14, D-312; docs/specs/agent.md §4.6, §6 Phase 6). Closed: a small
// framed box with the `>` prompt (`ask about Pazar…`). Focused (a click, ⌘J, or `/` when nothing has the keyboard): the
// first asks above it. The first message grows it, cell by cell, into a full-height column on the right; the app
// narrows beside it (`html[data-agent-open]` sets `--ai-w`, which WorkspaceLayout's `[data-app]` box and the right
// panel read), so the canvas, the card panel, beside and the tasks side view are never under it. ≤ 760 px it covers the
// screen. `[×] esc` folds it back to the box, the chat kept (for this tab: saving is S16).
//
// The column and the box are dialogs to the onboarding (`role="dialog"`, an <aside>): lessons treat them as obstacles.
// Everything it shows is DOM text, never under the ASCII effect; colours are tokens (light under [data-theme='light']);
// every animation reads useMotion().reduced (Appear and the spinner do).
import { AnimatePresence } from 'motion/react'
import { Fragment, memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../data/auth'
import { kindOfPiece } from '../../model/pieces'
import { useMotion } from '../../state/motion'
import { Appear } from '../../ui/Appear'
import { useAutoGrow } from '../../ui/autoGrow'
import { Select } from '../../ui/Select'
import { openSettingsAt } from '../../ui/Settings'
import { useWs } from '../../views/workspace/context'
import { isTyping } from '../../views/workspace/useEditKeys'
import { agentActions, byWhereLines, canRun, chatModel, isViewer, realOf, stubOn, useAgent, type ChangeLine, type Entry, type StepLine } from './agentStore'
import { pickerRows, KNOWN_MODELS } from '../models'
import { useAgentSettings } from './settings'
import { firstAsks } from './suggest'
import { agentUi } from '../ui'
import { AgentGhost } from './AgentGhost'
import { PreviewMarks } from './PreviewMarks'
import styles from './Agent.module.css'

const WIDTH_STORE = 'northstar.agent.width'
const W_MIN = 340
const W_MAX = 720

export function Agent() {
  const { user } = useAuth()
  const ws = useWs()
  const wid = ws.wid
  const mode = useAgent((s) => s.mode)

  useEffect(() => {
    agentActions.attach(wid, user ? { uid: user.id, ...(user.name || user.email ? { name: (user.name || user.email)! } : {}) } : null)
  }, [wid, user])
  useEffect(() => () => agentActions.detach(), [])

  // The app narrows beside the column (WorkspaceLayout.module.css `.app { right: var(--ai-w) }`).
  useLayoutEffect(() => {
    const h = document.documentElement
    const w = Number(localStorage.getItem(WIDTH_STORE))
    if (w >= W_MIN && w <= W_MAX) h.style.setProperty('--agent-width', `${w}px`)
    if (mode !== 'column') return
    h.setAttribute('data-agent-open', '')
    return () => h.removeAttribute('data-agent-open')
  }, [mode])

  // ⌘J opens or folds it from anywhere; `/` opens it when nothing has the keyboard. On Windows and Linux it's Ctrl+J,
  // which inside a workspace takes over the browser's own Ctrl+J (Downloads); Settings → the agent says so.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        if (useAgent.getState().mode === 'closed') openAndFocus()
        else closeAgent()
        return
      }
      // Not while a list, menu or right-click menu is open (it may take `/` itself), nor when someone handled it.
      const listOpen = !!document.querySelector('[role="listbox"], [role="menu"]')
      if (e.key === '/' && !mod && !e.altKey && !e.defaultPrevented && !listOpen && !isTyping(e.target) && useAgent.getState().mode === 'closed') {
        e.preventDefault()
        openAndFocus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!user) return null
  return (
    <>
      <AnimatePresence>{mode === 'column' ? <Column key="column" /> : <Box key="box" />}</AnimatePresence>
      <AgentGhost />
      <PreviewMarks />
    </>
  )
}

// What had the keyboard before the agent took it: given back when the agent folds (⌘J, Esc, [×]).
let before: HTMLElement | null = null
const inAgent = (el: Element | null) => !!el?.closest('[data-agent]')
function remember(el: EventTarget | Element | null) {
  if (el instanceof HTMLElement && el !== document.body && !inAgent(el)) before = el
}

function openAndFocus() {
  remember(document.activeElement)
  agentActions.open()
  requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('[data-agent-input]')?.focus())
}

export function closeAgent() {
  agentActions.close()
  const back = before
  before = null
  requestAnimationFrame(() => {
    const a = document.activeElement
    if (back?.isConnected) back.focus({ preventScroll: true })
    else if (a instanceof HTMLElement && inAgent(a)) a.blur()
  })
}

// ---- Where the person is, for the placeholder and the scope line

function useWhere() {
  const ws = useWs()
  const [params] = useSearchParams()
  const focus = params.get('focus')
  const piece = focus ? ws.pieces.find((p) => p.id === focus) : undefined
  const canvas = ws.canvases.find((c) => c.id === ws.canvas)
  const name = piece?.name?.trim() || (piece ? kindOfPiece(piece) : '') || ''
  const workspace = ws.workspace.name?.trim() || 'this workspace'
  // `ask about Pazar…` on a canvas, `ask about Segments…` in a plane's focus; the scope line names the canvas too.
  return { focus, here: name || (ws.canvases.length > 1 && canvas?.name ? `${workspace} · ${canvas.name}` : ''), ask: name || workspace, workspace }
}

// ---- Closed: the box

function Box() {
  const mode = useAgent((s) => s.mode)
  const entries = useAgent((s) => s.chat.entries.length)
  const running = useAgent((s) => s.chat.wf.phase === 'running' || s.chat.wf.phase === 'applying')
  const pending = useAgent((s) => s.chat.wf.phase === 'previewing')
  const { ask, focus } = useWhere()
  const open = mode === 'box'
  const [text, setText] = useState('')
  const input = useRef<HTMLTextAreaElement>(null)
  useAutoGrow(input, text)
  const viewer = isViewer(useAgent.getState().wid)
  // Closed, the box's prompt never keeps the keyboard.
  useEffect(() => {
    if (!open && document.activeElement === input.current) input.current?.blur()
  }, [open])

  const onKey = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      closeAgent()
    } else if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      if (!text.trim()) return
      agentActions.send(text)
      setText('')
    }
  }

  return (
    <Appear
      as="aside"
      className={styles.box}
      data-open={open || undefined}
      // Closed it's a region of the page (an <aside>); open, a dialog the keyboard is in.
      role={open ? 'dialog' : undefined}
      aria-label="The agent"
      data-agent
      data-side-panel
      data-learn="agent-box"
      onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
    >
      {open && (
        <div className={styles.boxTop}>
          <div className={styles.boxHead}>
            <span className={styles.kind}>
              <AgentMark /> agent
            </span>
            <span className={styles.boxModel}>{chatModel()}</span>
            <button className={styles.close} onClick={() => closeAgent()} title="Close (Esc)">
              <span className={styles.br}>[</span>×<span className={styles.br}>]</span> esc
            </button>
          </div>
          <FirstAsks focus={focus} onAsk={(t) => agentActions.send(t)} compact />
          <p className={styles.note}>changes are shown first · one undo step</p>
          {viewer && <p className={styles.viewer}>you're a viewer here: the agent reads and answers, it changes nothing</p>}
        </div>
      )}
      <label className={styles.prompt} data-running={running || undefined}>
        <span className={styles.ps} aria-hidden>
          {running ? <Spinner /> : '>'}
        </span>
        <textarea
          ref={input}
          data-agent-input
          className={styles.input}
          rows={1}
          value={text}
          placeholder={running ? 'working…' : pending ? 'changes are waiting: open the chat' : entries ? 'go on with the chat…' : `ask about ${ask}…`}
          aria-label="Ask the agent"
          onFocus={(e) => {
            remember(e.relatedTarget)
            if (entries) agentActions.open()
            else if (!open) agentActions.open()
            if (entries) requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('[data-agent-input]')?.focus())
          }}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
        />
        {!open && <kbd className={styles.kbd}>⌘J</kbd>}
      </label>
    </Appear>
  )
}

// ---- Open: the column

function Column() {
  const chat = useAgent((s) => s.chat)
  const phase = chat.wf.phase
  const running = phase === 'running' || phase === 'applying'
  const { workspace, here, ask, focus } = useWhere()
  const [text, setText] = useState('')
  const input = useRef<HTMLTextAreaElement>(null)
  const log = useRef<HTMLDivElement>(null)
  useAutoGrow(input, text)
  const viewer = isViewer(chat.wid)

  // Kept at the bottom while new things come in (unless the person scrolled up to read).
  const stick = useRef(true)
  useLayoutEffect(() => {
    const el = log.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [chat.entries])
  useEffect(() => input.current?.focus(), [])

  const onKey = (e: ReactKeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape') {
      // A list open inside (the model's) closes itself first.
      if (e.defaultPrevented) return
      e.preventDefault()
      e.stopPropagation()
      if (phase === 'previewing') agentActions.discard()
      else closeAgent()
    }
  }
  const onInputKey = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      if (!text.trim()) {
        if (phase === 'previewing') agentActions.accept()
        return
      }
      if (running) return
      agentActions.send(text)
      setText('')
      stick.current = true
    }
  }

  return (
    <Appear
      as="aside"
      className={styles.column}
      role="dialog"
      aria-label="The agent"
      data-agent
      data-side-panel
      data-learn="agent-column"
      onKeyDown={onKey}
      onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
    >
      <ResizeEdge />
      <header className={styles.head}>
        <span className={styles.kind}>
          <AgentMark running={running} /> agent
        </span>
        <ModelSwitch />
        <span className={styles.headTools}>
          <button className={styles.action} onClick={() => agentActions.newChat()} disabled={running}>
            new chat
          </button>
          <button className={styles.close} onClick={() => closeAgent()} title="Fold it back to the box (Esc); the chat stays">
            <span className={styles.br}>[</span>×<span className={styles.br}>]</span> esc
          </button>
        </span>
      </header>
      <div
        className={styles.log}
        ref={log}
        onScroll={(e) => {
          const el = e.currentTarget
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
        }}
      >
        {chat.entries.length === 0 ? <Empty focus={focus} /> : numbered(chat.entries).map(([e, n]) => <EntryView key={e.id} entry={e} n={n} />)}
      </div>
      <footer className={styles.foot}>
        {viewer && <p className={styles.viewer}>you're a viewer here: the agent reads and answers, it changes nothing</p>}
        <label className={styles.prompt} data-running={running || undefined}>
          <span className={styles.ps} aria-hidden>
            {running ? <Spinner /> : '>'}
          </span>
          <textarea
            ref={input}
            data-agent-input
            className={styles.input}
            rows={1}
            value={text}
            placeholder={phase === 'previewing' ? 'change something… (↵ on empty applies)' : phase === 'asking' ? 'answer, or say go…' : `ask about ${ask}…`}
            aria-label="Ask the agent"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onInputKey}
          />
          {running && (
            <button
              className={styles.action}
              data-tone="danger"
              onClick={() => {
                agentActions.stop()
                input.current?.focus()
              }}
            >
              stop
            </button>
          )}
        </label>
        <p className={styles.scope}>
          <span className={styles.scopeLabel}>sees</span> whole workspace{here ? <> · you're in <span className={styles.scopeHere}>"{here}"</span></> : <> · {workspace}</>}
        </p>
      </footer>
    </Appear>
  )
}

// Drag the column's left edge to resize it; remembered in this browser.
function ResizeEdge() {
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const h = document.documentElement
    h.setAttribute('data-agent-resizing', '')
    const move = (ev: PointerEvent) => {
      const w = Math.round(Math.min(W_MAX, Math.max(W_MIN, window.innerWidth - ev.clientX)))
      h.style.setProperty('--agent-width', `${w}px`)
    }
    const up = () => {
      h.removeAttribute('data-agent-resizing')
      const w = parseInt(h.style.getPropertyValue('--agent-width'), 10)
      if (w) localStorage.setItem(WIDTH_STORE, String(w))
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  return <div className={styles.edge} onPointerDown={onDown} aria-hidden />
}

// The model for this chat (agent.md §4.2): the person's pick in Settings, switchable here for this chat only.
function ModelSwitch() {
  const model = useAgent((s) => s.chat.model)
  const saved = useAgentSettings((s) => s.model)
  const models = useAgentSettings((s) => s.models)
  const rows = useMemo(() => pickerRows(models.length ? models : KNOWN_MODELS.map((m) => m.id), model || saved || undefined), [models, model, saved])
  if (stubOn()) return <span className={styles.model} title="Dev only: ?agentStub=1 plays scripted answers on the real tools, no key">dev stub</span>
  const current = chatModel()
  return (
    <Select
      ariaLabel="Model for this chat"
      className={styles.modelSelect}
      value={current}
      options={rows.map((r) => ({ value: r.id, label: r.id }))}
      onChange={(v) => agentActions.setModel(v)}
    />
  )
}

// ---- The empty chat

function Empty({ focus }: { focus: string | null }) {
  return (
    <div className={styles.empty}>
      <p className={styles.emptyLead}>Ask about your workspace, or ask for a change.</p>
      <FirstAsks focus={focus} onAsk={(t) => agentActions.send(t)} />
      <ul className={styles.can}>
        <li>
          <span className={styles.canMark}>+</span>reads every plane, card, deck, matrix and table here
        </li>
        <li>
          <span className={styles.canMark}>+</span>proposes changes: you see them first, then apply as one undo step
        </li>
        <li>
          <span className={styles.canMark} data-tone="no">−</span>no web, other workspaces, members or settings
        </li>
      </ul>
      {!canRun() && <KeyNeeded />}
    </div>
  )
}

function KeyNeeded() {
  return (
    <p className={styles.note} data-tone="error">
      add your OpenAI key first: it stays in this browser.{' '}
      <button className={styles.action} data-tone="primary" onClick={() => openSettingsAt('agent')}>
        settings → the agent
      </button>
    </p>
  )
}

function FirstAsks({ focus, onAsk, compact }: { focus: string | null; onAsk: (t: string) => void; compact?: boolean }) {
  const ws = useWs()
  const asks = useMemo(() => firstAsks(ws, focus), [ws, focus])
  if (!asks.length) return null
  return (
    <div className={styles.asks} data-compact={compact || undefined}>
      <div className={styles.rule}>
        <span>try</span>
        <span className={styles.ruleLine} aria-hidden />
      </div>
      {asks.map((a) => (
        <button key={a} className={styles.ask} onClick={() => onAsk(a)}>
          <span className={styles.askMark} aria-hidden>
            ›
          </span>
          {a}
        </button>
      ))}
    </div>
  )
}

// ---- One entry

// Each turn numbered by the person's messages (`01 ── which problems…`, D-266: numbers magenta, before the name).
function numbered(entries: Entry[]): [Entry, number][] {
  let n = 0
  return entries.map((e) => [e, e.kind === 'user' ? ++n : n])
}

const EntryView = memo(function EntryView({ entry, n }: { entry: Entry; n: number }) {
  switch (entry.kind) {
    case 'user':
      return (
        <div className={styles.you}>
          <span className={styles.turn} aria-label={`turn ${n}`}>
            <span className={styles.n}>{String(n).padStart(2, '0')}</span>
            <span className={styles.turnLine} aria-hidden />
          </span>
          <span className={styles.youText}>{entry.text}</span>
        </div>
      )
    case 'agent':
      return <AgentAnswer entry={entry} />
    case 'changes':
      return <Changes entry={entry} />
    case 'report':
      return <ReportLine entry={entry} />
    case 'note':
      return (
        <p className={styles.note} data-tone={entry.tone}>
          {entry.text}
          {entry.settings && (
            <>
              {' '}
              <button className={styles.action} data-tone="primary" onClick={() => openSettingsAt('agent')}>
                open settings
              </button>
            </>
          )}
        </p>
      )
  }
})

const k = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))
const secs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`)

function AgentAnswer({ entry }: { entry: Extract<Entry, { kind: 'agent' }> }) {
  const [unfold, setUnfold] = useState(false)
  const tools = entry.steps.filter((s) => !s.say)
  const folded = !entry.running && tools.length > 0 && !unfold
  return (
    <div className={styles.answer}>
      {tools.length > 0 && !entry.running && (
        <button className={styles.fold} onClick={() => setUnfold((u) => !u)} aria-expanded={!folded}>
          <span className={styles.foldMark}>{folded ? '▸' : '▾'}</span> {tools.length} step{tools.length === 1 ? '' : 's'}
          {entry.ms !== undefined && <> · {secs(entry.ms)}</>}
        </button>
      )}
      {!folded && entry.steps.length > 0 && (
        <ol className={styles.steps}>
          {entry.steps.map((s) => (
            <Step key={s.id} s={s} />
          ))}
        </ol>
      )}
      {entry.running && !entry.live && !entry.steps.some((s) => s.running) && (
        <p className={styles.thinking}>
          <Spinner /> thinking…
        </p>
      )}
      {(entry.text || entry.live) && (
        <div className={styles.answerText}>
          <Answer text={entry.text || entry.live} />
          {entry.running && <span className={styles.caret} aria-hidden />}
        </div>
      )}
      {entry.end === 'stopped' && <p className={styles.meta}>stopped</p>}
      {entry.end === 'budget' && <p className={styles.meta}>it ran out of steps for this turn: ask it to go on</p>}
      {entry.error && (
        <p className={styles.note} data-tone="error">
          ! {entry.error}
          {entry.errorSettings && (
            <>
              {' '}
              <button className={styles.action} data-tone="primary" onClick={() => openSettingsAt('agent')}>
                open settings
              </button>
            </>
          )}
        </p>
      )}
      {!entry.running && (entry.usage.input > 0 || entry.usage.output > 0) && (
        <p className={styles.tokens} title={`${entry.model}${entry.usage.cached ? ` · ${k(entry.usage.cached)} of the input cached` : ''}`}>
          {k(entry.usage.input)} in · {k(entry.usage.output)} out
        </p>
      )}
    </div>
  )
}

function Step({ s }: { s: StepLine }) {
  if (s.say) return <li className={styles.say}>{s.say}</li>
  return (
    <li className={styles.step} data-ok={s.ok === false ? 'no' : undefined}>
      <span className={styles.stepMark} aria-hidden>
        {s.running ? <Spinner /> : s.ok === false ? '!' : '·'}
      </span>
      <span className={styles.stepLabel}>{s.label || '…'}</span>
      {!s.running && s.ms !== undefined && <span className={styles.stepMs}>{secs(s.ms)}</span>}
    </li>
  )
}

// The answer in light Markdown (paragraphs, `- ` bullets, **bold**, `code`), with cited things as links: `c12 "title"`
// goes there (the UI facade's goTo).
const CITE = /\*\*[^*]+\*\*|`[^`]+`|\b[cptxd]\d+\b(?:\s+"[^"\n]{1,90}")?/g

function inline(line: string): ReactNode[] {
  const out: ReactNode[] = []
  let at = 0
  for (const m of line.matchAll(CITE)) {
    const t = m[0]
    const i = m.index!
    if (i > at) out.push(line.slice(at, i))
    if (t.startsWith('**')) out.push(<strong key={i}>{t.slice(2, -2)}</strong>)
    else if (t.startsWith('`')) out.push(<code key={i}>{t.slice(1, -1)}</code>)
    else {
      const short = /^[cptxd]\d+/.exec(t)![0]
      const real = realOf(short)
      out.push(
        real ? (
          // A span, not a button: a button is inline-block, so a wrapped title's underline ran to the edge.
          <span
            key={i}
            role="link"
            tabIndex={0}
            className={styles.cite}
            onClick={() => void agentUi.goTo(real).catch(() => {})}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              void agentUi.goTo(real).catch(() => {})
            }}
            title="go there"
          >
            <span className={styles.citeId}>{short}</span>
            {t.slice(short.length)}
          </span>
        ) : (
          t
        ),
      )
    }
    at = i + t.length
  }
  if (at < line.length) out.push(line.slice(at))
  return out
}

function Answer({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/)
  return (
    <>
      {blocks.map((b, bi) => {
        const lines = b.split('\n')
        return (
          <div key={bi} className={styles.para}>
            {lines.map((l, li) => {
              const bullet = /^\s*[-*]\s+/.exec(l)
              const num = /^\s*(\d+)[.)]\s+/.exec(l)
              if (bullet || num)
                return (
                  <span key={li} className={styles.bullet}>
                    <span className={num ? styles.num : styles.dash} aria-hidden={!num}>
                      {num ? num[1] : '–'}
                    </span>
                    <span>{inline(l.slice((bullet ?? num)![0].length))}</span>
                  </span>
                )
              return (
                <Fragment key={li}>
                  {li > 0 && <br />}
                  {inline(l)}
                </Fragment>
              )
            })}
          </div>
        )
      })}
    </>
  )
}

// ---- The preview (S15, agent.md §4.5): `01 CHANGES ──`, grouped by where (`Segments · plane: 4 new cards, 3 links`),
// each change a row with its tick (off takes what needs it off too, with a short note), deletes struck with the agent's
// reason, the stepper `‹ 3 / 9 ›` (←/→ or j/k while the preview has the keyboard) gliding to each change, and the foot
// `[apply ↵] [discard esc]`; `> change something…` is the column's prompt below it.

const NOUN: Record<string, string> = { card: 'card', link: 'link', text: 'text', task: 'task', piece: 'piece', canvas: 'canvas', place: 'place', evidence: 'evidence', feature: 'feature', package: 'package', lens: 'cell', matrix: 'matrix', table: 'table', deck: 'deck', timeline: 'timeline' }
const verbOf = (i: ChangeLine) => (i.sign === '−' ? 'deleted' : i.sign === '+' ? 'new' : 'changed')
// `4 new cards, 3 new links, 1 changed task`, in the order first met.
function counted(items: ChangeLine[]): string {
  const n = new Map<string, number>()
  for (const i of items) {
    const noun = i.op === 'axis_add' || i.op === 'axis_remove' ? 'head' : i.op === 'update_cell' ? 'cell' : i.op === 'move_task' ? 'task' : (NOUN[i.kind] ?? 'change')
    const k = i.op === 'arrange' ? 'move' : i.op === 'delete' ? 'deletion' : i.op === 'resize' ? 'resize' : i.op === 'rename' ? 'rename' : `${verbOf(i)} ${noun}`
    n.set(k, (n.get(k) ?? 0) + 1)
  }
  return [...n].map(([k, c]) => (c === 1 ? `1 ${k}` : `${c} ${k.replace(/(?<!s)$/, k.endsWith('evidence') ? '' : 's')}`)).join(', ')
}

function Changes({ entry }: { entry: Extract<Entry, { kind: 'changes' }> }) {
  const live = entry.state === 'pending'
  const items = live ? entry.items : entry.items.filter((i) => i.on)
  const groups = byWhereLines(items)
  const on = useMemo(() => entry.items.filter((i) => i.on), [entry.items])
  const [at, setAt] = useState(-1)
  const apply = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (live) apply.current?.focus({ preventScroll: true })
  }, [live])
  // An item unticked under the stepper: it stays on the same number (or the last one).
  useEffect(() => {
    if (at >= on.length) setAt(on.length - 1)
  }, [on.length, at])
  const go = (k: number) => {
    if (!on.length) return
    const n = (k + on.length) % on.length
    setAt(n)
    agentActions.goToItem(on[n].id)
  }
  const onKey = (e: ReactKeyboardEvent<HTMLElement>) => {
    if (!live || isTyping(e.target)) return
    if (e.key === 'ArrowRight' || e.key === 'j') (e.preventDefault(), go(at + 1))
    else if (e.key === 'ArrowLeft' || e.key === 'k') (e.preventDefault(), go(at < 0 ? on.length - 1 : at - 1))
  }
  const current = live && at >= 0 ? on[at]?.id : undefined
  return (
    <section className={styles.changes} data-state={entry.state} onKeyDown={onKey} aria-label="The changes">
      <h3 className={styles.rule}>
        <span className={styles.n}>01</span>
        <span>{live ? 'changes' : on.length === 1 ? 'change' : 'changes'}</span>
        <span className={styles.ruleLine} data-tone="magenta" aria-hidden />
        <span className={styles.changesState}>
          {live && on.length !== entry.items.length ? `${on.length} of ${entry.items.length} · ` : `${on.length} · `}
          {STATE_WORDS[entry.state]}
        </span>
      </h3>
      {groups.map(([where, list]) => (
        <div key={where} className={styles.where}>
          <div className={styles.whereName}>
            {where}
            <span className={styles.whereCount}>: {counted(list.filter((i) => i.on))}</span>
          </div>
          <ul className={styles.items}>
            {list.map((i) => (
              <ChangeRow key={i.id} i={i} live={live} current={i.id === current} onGo={() => go(on.findIndex((x) => x.id === i.id))} />
            ))}
          </ul>
        </div>
      ))}
      {entry.note && <p className={styles.changesNote}>{entry.note}</p>}
      {entry.warnings.length > 0 && (
        <ul className={styles.warnings}>
          {entry.warnings.map((w, j) => (
            <li key={j}>{w}</li>
          ))}
        </ul>
      )}
      {entry.said && <p className={styles.note} data-tone="error">{entry.said}</p>}
      {live && (
        <>
          <div className={styles.stepper}>
            <button className={styles.stepBtn} onClick={() => go(at < 0 ? on.length - 1 : at - 1)} disabled={!on.length} aria-label="The change before">
              ‹
            </button>
            <span className={styles.stepAt} aria-live="polite">
              <span className={styles.n}>{at >= 0 ? at + 1 : '–'}</span> / {on.length}
            </span>
            <button className={styles.stepBtn} onClick={() => go(at + 1)} disabled={!on.length} aria-label="The next change">
              ›
            </button>
            <span className={styles.changesHint}>{at >= 0 && on[at] ? on[at].where : '← → goes to each one'}</span>
          </div>
          <div className={styles.changesFoot}>
            <button ref={apply} className={styles.action} data-tone="primary" onClick={() => agentActions.accept()}>
              apply ↵
            </button>
            <button className={styles.action} data-tone="danger" onClick={() => agentActions.discard()}>
              discard esc
            </button>
            <span className={styles.changesHint}>{on.length ? 'one undo step · the app waits till then' : 'nothing ticked: apply closes it'}</span>
          </div>
        </>
      )}
    </section>
  )
}

// A removed item: only its verb struck (`delete a card`), what it names left readable.
function ItemText({ line, struck }: { line: string; struck: boolean }) {
  if (!struck) return <span className={styles.itemText}>{line}</span>
  const at = line.indexOf(': ')
  if (at < 0) return <span className={styles.itemText} data-struck>{line}</span>
  return (
    <span className={styles.itemText}>
      <span data-struck>{line.slice(0, at)}</span>
      {line.slice(at)}
    </span>
  )
}

const STATE_WORDS: Record<Extract<Entry, { kind: 'changes' }>['state'], string> = {
  pending: 'nothing written yet',
  applying: 'applying…',
  applied: 'applied',
  undone: 'undone',
  discarded: 'discarded',
  revising: 'being revised…',
}

function ChangeRow({ i, live, current, onGo }: { i: ChangeLine; live: boolean; current: boolean; onGo: () => void }) {
  return (
    <li className={styles.item} data-delete={i.delete || undefined} data-off={!i.on || undefined} data-current={current || undefined}>
      {live && (
        <button
          className={styles.tick}
          role="checkbox"
          aria-checked={i.on}
          aria-label={`${i.on ? 'untick' : 'tick'}: ${i.line}`}
          title={i.needs ? `off: it needs ${i.needs.join(', ')}` : i.on ? 'untick: leave this change out' : 'tick: put it back'}
          onClick={() => agentActions.tick(i.id, !i.on)}
          disabled={!i.on && !!i.needs}
        >
          [{i.on ? '×' : ' '}]
        </button>
      )}
      <span className={styles.itemMark} aria-hidden>
        {i.sign}
      </span>
      <span className={styles.itemLine} onClick={live && i.on ? onGo : undefined} data-go={(live && i.on) || undefined}>
        <ItemText line={i.line} struck={i.delete} />
        {i.why && <span className={styles.why}> — {i.why}</span>}
        {i.needs && <span className={styles.needs}> · off: it needs {(i.needsWords ?? i.needs).join('; ')}</span>}
      </span>
    </li>
  )
}

// After an accept: `✓ APPLIED · 1 change · Segments  [undo]`; undone, `↺ UNDONE · …`; a discard, its own words.
function ReportLine({ entry }: { entry: Extract<Entry, { kind: 'report' }> }) {
  const r = entry.report
  const wf = useAgent((s) => s.chat.wf)
  // Only the last applied step can be undone from here (browser.ts' undoAgentStep checks it's still the last).
  const current = wf.phase === 'applied' && wf.report?.step?.key && wf.report.step.key === r.step?.key
  const shown = current ? wf.report! : r
  if (!r.step) {
    return (
      <p className={styles.status}>
        <span className={styles.statusMark} aria-hidden>·</span>
        <span className={styles.statusText}>{r.text}</span>
      </p>
    )
  }
  const what = [`${entry.count} change${entry.count === 1 ? '' : 's'}`, ...entry.wheres.slice(0, 3), ...(r.notDone.length ? [`${r.notDone.length} left out`] : [])]
  return (
    <div className={styles.status} data-undone={shown.undone || undefined}>
      <span className={styles.statusMark} aria-hidden>
        {shown.undone ? '↺' : '✓'}
      </span>
      <span className={styles.statusWord}>{shown.undone ? 'undone' : 'applied'}</span>
      <span className={styles.statusText}>· {what.join(' · ')}</span>
      {current && !shown.undone && (
        <button className={styles.action} onClick={() => agentActions.undo()} disabled={shown.undoing}>
          {shown.undoing ? 'undoing…' : 'undo'}
        </button>
      )}
      {current && wf.error && <span className={styles.reportError}>{wf.error}</span>}
    </div>
  )
}

// ---- Small things

// The agent's own mark: a small cyan square with a `>` cut in (its colour wherever it shows, D-312's participant).
function AgentMark({ running }: { running?: boolean }) {
  return <span className={styles.mark} data-running={running || undefined} aria-hidden />
}

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export function Spinner() {
  const reduced = useMotion((s) => s.reduced)
  const [i, setI] = useState(0)
  useEffect(() => {
    if (reduced) return
    const t = setInterval(() => setI((x) => (x + 1) % FRAMES.length), 90)
    return () => clearInterval(t)
  }, [reduced])
  return (
    <span className={styles.spinner} aria-hidden>
      {reduced ? '…' : FRAMES[i]}
    </span>
  )
}
