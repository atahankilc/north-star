// The agent in the screen's bottom-right corner (S14, D-312; docs/specs/agent.md §4.6, §6 Phase 6). Closed: a small
// framed box with the `>` prompt (`ask about Pazar…`). Focused (a click, ⌘J, or `/` when nothing has the keyboard): the
// first asks above it. The first message grows it, cell by cell, into a full-height column on the right; the app
// narrows beside it (`html[data-agent-open]` sets `--ai-w`, which WorkspaceLayout's `[data-app]` box and the right
// panel read), so the canvas, the card panel, beside and the tasks side view are never under it. ≤ 760 px it covers the
// screen. `[×] esc` folds it back to the box, the chat kept. Chats are saved (S16): `[chats]` lists them (yours and
// shared ones) to reopen, rename, share or delete; `[notes]` opens the agent notes (AgentMemory.tsx).
//
// The column and the box are dialogs to the onboarding (`role="dialog"`, an <aside>): lessons treat them as obstacles.
// Everything it shows is DOM text, never under the ASCII effect; colours are tokens (light under [data-theme='light']);
// every animation reads useMotion().reduced (Appear and the spinner do).
import { AnimatePresence } from 'motion/react'
import { Fragment, memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../data/auth'
import { KIND_NAME, kindOfPiece } from '../../model/pieces'
import { Appear } from '../../ui/Appear'
import { Select } from '../../ui/Select'
import { openSettingsAt } from '../../ui/Settings'
import { useWs } from '../../views/workspace/context'
import { isTyping } from '../../views/workspace/useEditKeys'
import { agentActions, byWhereLines, canRun, chatModel, isViewer, namedOfShort, stubOn, useAgent, type ChangeLine, type Entry, type StepLine } from './agentStore'
import { pickerRows } from '../models'
import type { Job, JobStep } from '../job'
import { pickable, suggested, useAgentSettings } from './settings'
import { firstAsks } from './suggest'
import { agentUi } from '../ui'
import { AgentGhost } from './AgentGhost'
import { PreviewMarks } from './PreviewMarks'
import { ChatsView, NotesDiff, NotesView } from './AgentMemory'
import styles from './Agent.module.css'
import { skillChip, useSkillMenu } from './SkillMenu'
import { SKILLS } from '../skills'
import { Button } from '../../ui/Button'
import { Spinner } from '../../ui/Spinner'
import { PromptField } from '../../ui/PromptField'
import { Num, Rule } from '../../ui/Rule'
import { Label } from '../../ui/Label'

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
  const name = piece?.name?.trim() || (piece ? KIND_NAME[kindOfPiece(piece)] : '') || ''
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
  const skills = useSkillMenu(text, setText)
  const viewer = isViewer(useAgent.getState().wid)
  // Closed, the box's prompt never keeps the keyboard.
  useEffect(() => {
    if (!open && document.activeElement === input.current) input.current?.blur()
  }, [open])

  const onKey = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (skills.onKey(e)) return
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
            <span className={styles.close}>
              <Button keyHint="esc" onClick={() => closeAgent()} title="Close (Esc)">
                ×
              </Button>
            </span>
          </div>
          <FirstAsks focus={focus} onAsk={(t) => agentActions.send(t)} compact />
          <p className={styles.note}>changes are shown first · one undo step</p>
          {viewer && <p className={styles.viewer}>you're a viewer here: the agent reads and answers, it changes nothing</p>}
        </div>
      )}
      {open && <div className={styles.skillAnchor}>{skills.menu}</div>}
      {/* The kit's `>` line (PromptField, D-326): the agent's own keys decide (the / menu, Enter), so its submit does
          nothing; every key still reaches the column (passKeys). */}
      <PromptField
        ref={input as never}
        className={styles.prompt}
        multiline
        passKeys
        running={running}
        data={{ 'data-agent-input': true }}
        value={text}
        placeholder={running ? 'working…' : pending ? 'changes are waiting: open the chat' : entries ? 'go on with the chat…' : `ask about ${ask}… (/ for skills)`}
        label="Ask the agent"
        onFocus={(e) => {
          remember(e.relatedTarget)
          if (entries) agentActions.open()
          else if (!open) agentActions.open()
          if (entries) requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('[data-agent-input]')?.focus())
        }}
        onChange={setText}
        onSubmit={() => {}}
        onKeyDown={onKey as never}
      >
        {!open && <kbd className={styles.kbd}>⌘J</kbd>}
      </PromptField>
    </Appear>
  )
}

// ---- Open: the column

function Column() {
  const chat = useAgent((s) => s.chat)
  const view = useAgent((s) => s.view)
  const phase = chat.wf.phase
  const running = phase === 'running' || phase === 'applying'
  const { workspace, here, ask, focus } = useWhere()
  const [text, setText] = useState('')
  const input = useRef<HTMLTextAreaElement>(null)
  const log = useRef<HTMLDivElement>(null)
  const skills = useSkillMenu(text, setText)
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
      if (useAgent.getState().view !== 'chat') agentActions.show('chat')
      else if (phase === 'previewing') agentActions.discard()
      else closeAgent()
    }
  }
  const onInputKey = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (skills.onKey(e)) return
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      if (!text.trim()) {
        if (phase === 'previewing') agentActions.accept()
        return
      }
      // While it works the words steer it: they reach the model at its next step (D-328).
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
          <Button className={styles.action} pressed={view === 'chats'} onClick={() => agentActions.show(view === 'chats' ? 'chat' : 'chats')} disabled={running} title="Your saved chats and the shared ones">
            chats
          </Button>
          <Button className={styles.action} pressed={view === 'notes'} onClick={() => agentActions.show(view === 'notes' ? 'chat' : 'notes')} title="The agent notes: the workspace's memory">
            notes
          </Button>
          <Button className={styles.action} onClick={() => agentActions.newChat()} disabled={running} title="A new chat (this one is saved)">
            new
          </Button>
          <span className={styles.close}>
            <Button keyHint="esc" onClick={() => closeAgent()} title="Fold it back to the box (Esc); the chat stays">
              ×
            </Button>
          </span>
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
        {view === 'chats' ? <ChatsView /> : view === 'notes' ? <NotesView /> : chat.entries.length === 0 ? <Empty focus={focus} /> : numbered(chat.entries).map(([e, n]) => <EntryView key={e.id} entry={e} n={n} />)}
      </div>
      <footer className={styles.foot}>
        {viewer && <p className={styles.viewer}>you're a viewer here: the agent reads and answers, it changes nothing</p>}
        {chat.job && view === 'chat' && <JobPanel job={chat.job} phase={phase} />}
        <div className={styles.skillAnchor}>{skills.menu}</div>
        <PromptField
          ref={input as never}
          className={styles.prompt}
          multiline
          passKeys
          running={running}
          data={{ 'data-agent-input': true }}
          value={text}
          placeholder={running ? 'tell it something while it works… (it reads it at its next step)' : phase === 'previewing' ? 'change something… (↵ on empty applies)' : `ask about ${ask}… (/ for skills)`}
          label="Ask the agent"
          onChange={setText}
          onSubmit={() => {}}
          onKeyDown={onInputKey as never}
        >
          {running && (
            <Button
              className={styles.action}
              tone="danger"
              onClick={() => {
                agentActions.stop()
                input.current?.focus()
              }}
            >
              stop
            </Button>
          )}
        </PromptField>
        <p className={styles.scope}>
          <Label tone="faint" className={styles.scopeLabel}>sees</Label> whole workspace{here ? <> · you're in <span className={styles.scopeHere}>"{here}"</span></> : <> · {workspace}</>}
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
  const claudeModels = useAgentSettings((s) => s.claudeModels)
  const hasKey = useAgentSettings((s) => s.hasKey)
  const hasClaudeKey = useAgentSettings((s) => s.hasClaudeKey)
  const rows = useMemo(() => {
    const keys = { hasKey, hasClaudeKey, models, claudeModels }
    return pickerRows(pickable(keys), model || saved || undefined, suggested(keys))
  }, [models, claudeModels, hasKey, hasClaudeKey, model, saved])
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
      <FirstSkills />
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

// The person's message, a skill named at its start shown as a chip (`/gaps`), the rest in their words.
function YouText({ text }: { text: string }) {
  const chip = skillChip(text)
  if (!chip) return <>{text}</>
  return (
    <>
      <span className={styles.skillChip} data-skill={chip.name}>
        /{chip.name}
      </span>
      {chip.rest ? ` ${chip.rest}` : ''}
    </>
  )
}

// The empty chat's skills: four that need nothing after them (one click runs them), and how to see the rest.
const FIRST_SKILLS = ['gaps', 'next', 'digest', 'swot']
function FirstSkills() {
  const list = FIRST_SKILLS.map((n) => SKILLS.find((s) => s.name === n)!).filter(Boolean)
  return (
    <div className={styles.asks}>
      <Rule as="div" name="skills" />
      {list.map((s) => (
        <button key={s.name} className={styles.ask} data-skill-ask onClick={() => agentActions.send(`/${s.name}`)}>
          <span className={styles.skillName}>/{s.name}</span>
          <span className={styles.skillSummary}>{s.summary}</span>
        </button>
      ))}
      <p className={styles.skillMore}>
        type <kbd className={styles.skillKey}>/</kbd> in the prompt for all {SKILLS.length}
      </p>
    </div>
  )
}

function KeyNeeded() {
  return (
    <p className={styles.note} data-tone="error">
      add your key first (OpenAI or Anthropic): it stays in this browser.{' '}
      <Button className={styles.action} tone="primary" onClick={() => openSettingsAt('agent')}>
        settings → the agent
      </Button>
    </p>
  )
}

function FirstAsks({ focus, onAsk, compact }: { focus: string | null; onAsk: (t: string) => void; compact?: boolean }) {
  const ws = useWs()
  const asks = useMemo(() => firstAsks(ws, focus), [ws, focus])
  if (!asks.length) return null
  return (
    <div className={styles.asks} data-compact={compact || undefined}>
      <Rule as="div" name="try" />
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
  return entries.map((e) => [e, e.kind === 'user' && !e.steer && !e.auto ? ++n : n])
}

// The job's checklist (D-328): the plan as state, live; what it has used against its budget; the person's controls.
const MARKS: Record<JobStep['state'], string> = { todo: ' ', doing: '>', done: '×', skipped: '−' }
const kTok = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${Math.round(n / 1000)}k`)

function JobPanel({ job, phase }: { job: Job; phase: string }) {
  const running = phase === 'running' || phase === 'applying'
  const done = job.steps.filter((x) => x.state === 'done' || x.state === 'skipped').length
  const over = job.tokens >= job.budget
  return (
    <section className={styles.job} aria-label="The job" data-status={job.status}>
      <header className={styles.jobHead}>
        <span className={styles.jobKind}>job</span>
        <span className={styles.jobTitle}>{job.title}</span>
        <span className={styles.jobRule} aria-hidden />
        <span className={styles.jobCount}>
          {done}/{job.steps.length}
        </span>
      </header>
      <ol className={styles.jobSteps}>
        {job.steps.map((x) => (
          <li key={x.n} className={styles.jobStep} data-state={x.state}>
            <span className={styles.jobMark} aria-label={x.state}>
              [{MARKS[x.state]}]
            </span>
            <Num n={x.n} className={styles.jobN} />
            <span className={styles.jobText}>
              {x.title}
              {x.why && <span className={styles.jobWhy}> · {x.why}</span>}
            </span>
          </li>
        ))}
      </ol>
      <footer className={styles.jobFoot}>
        <span className={styles.jobUsed} data-over={over || undefined}>
          {job.status === 'paused' && job.paused ? `paused: ${job.paused} · ` : job.status === 'planned' ? 'waiting for go · ' : job.status === 'done' ? 'done · ' : job.stopAfter ? 'stops after this step · ' : ''}
          {kTok(job.tokens)} / {kTok(job.budget)} tokens
        </span>
        <span className={styles.jobTools}>
          {job.status === 'running' && !job.stopAfter && (
            <Button className={styles.action} onClick={() => agentActions.jobStopAfter()}>
              stop after this step
            </Button>
          )}
          {job.status === 'running' && job.stopAfter && (
            <Button className={styles.action} onClick={() => agentActions.jobStopAfter(false)}>
              keep going
            </Button>
          )}
          {(job.status === 'paused' || job.status === 'planned') && !running && phase !== 'previewing' && (
            <Button className={styles.action} tone="primary" onClick={() => agentActions.jobGoOn(over)}>
              {over ? 'raise budget and go on' : 'go on'}
            </Button>
          )}
          {!running && (
            <Button className={styles.action} onClick={() => agentActions.jobDrop()}>
              drop
            </Button>
          )}
        </span>
      </footer>
    </section>
  )
}

const EntryView = memo(function EntryView({ entry, n }: { entry: Entry; n: number }) {
  switch (entry.kind) {
    case 'user':
      // The app's own go-on to a job's next step: a quiet line, not the person's words.
      if (entry.auto)
        return (
          <p className={styles.goOn}>
            <span aria-hidden>→ </span>
            {entry.text}
          </p>
        )
      if (entry.steer)
        return (
          <div className={styles.you} data-steer>
            <span className={styles.steerTag}>while it worked</span>
            <span className={styles.youText}>
              <YouText text={entry.text} />
            </span>
          </div>
        )
      return (
        <div className={styles.you}>
          <span className={styles.turn} aria-label={`turn ${n}`}>
            <Num n={n} />
            <span className={styles.turnLine} aria-hidden />
          </span>
          <span className={styles.youText}>
            <YouText text={entry.text} />
          </span>
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
              <Button className={styles.action} tone="primary" onClick={() => openSettingsAt('agent')}>
                open settings
              </Button>
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
          <Spinner className={styles.spinner} /> thinking…
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
              <Button className={styles.action} tone="primary" onClick={() => openSettingsAt('agent')}>
                open settings
              </Button>
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
        {s.running ? <Spinner className={styles.spinner} /> : s.ok === false ? '!' : '·'}
      </span>
      <span className={styles.stepLabel}>{s.label || '…'}</span>
      {!s.running && s.ms !== undefined && <span className={styles.stepMs}>{secs(s.ms)}</span>}
    </li>
  )
}

// The answer in light Markdown (paragraphs, `- ` bullets, **bold**, `code`), with cited things as links: `c12 "title"`
// goes there (the UI facade's goTo). Every short id, of every letter, shows its name (agent-bugs 2): a bare `c12` reads
// `c12 "Bread club"`; one with no place to go to (a document, a person) is named but not a link.
const CITE = /\*\*[^*]+\*\*|`[^`]+`|\b[cptxkevfdmu]\d+\b(?:\s+"[^"\n]{1,90}")?/g

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
      const short = /^[a-z]\d+/.exec(t)![0]
      const named = namedOfShort(short)
      const real = named?.go
      // The model's own title when it gave one, else the name.
      const rest = t.length > short.length ? t.slice(short.length) : named ? ` ${named.name}` : ''
      out.push(
        !named ? (
          t
        ) : real ? (
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
            {rest}
          </span>
        ) : (
          <span key={i}>
            <span className={styles.citeId}>{short}</span>
            {rest}
          </span>
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
    const k = i.op === 'update_notes' ? 'change to the notes' : i.op === 'merge_cards' ? 'merge' : i.op === 'create_document' ? 'new document' : i.op === 'arrange' ? 'move' : i.op === 'delete' ? 'deletion' : i.op === 'resize' ? 'resize' : i.op === 'rename' ? 'rename' : `${verbOf(i)} ${noun}`
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
  // Button takes no ref: the apply button is found in its box.
  const apply = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (live) apply.current?.querySelector('button')?.focus({ preventScroll: true })
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
  const deletes = on.filter((i) => i.delete).length
  return (
    <section className={styles.changes} data-state={entry.state} onKeyDown={onKey} aria-label="The changes">
      <Rule
        n={1}
        name={live ? 'changes' : on.length === 1 ? 'change' : 'changes'}
        aside={
          <span className={styles.changesState}>
            {live && on.length !== entry.items.length ? `${on.length} of ${entry.items.length} · ` : `${on.length} · `}
            {STATE_WORDS[entry.state]}
          </span>
        }
      />
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
              <Num n={at >= 0 ? String(at + 1) : '–'} /> / {on.length}
            </span>
            <button className={styles.stepBtn} onClick={() => go(at + 1)} disabled={!on.length} aria-label="The next change">
              ›
            </button>
            <span className={styles.changesHint}>{at >= 0 && on[at] ? on[at].where : '← → goes to each one'}</span>
          </div>
          <div className={styles.changesFoot}>
            {/* The deletes it holds named on the button (agent-bugs 17, D-333): accepting is the yes to them, so none goes
                unseen in a long list. */}
            <span ref={apply} className={styles.applyBox}>
              <Button className={styles.action} tone="primary" onClick={() => agentActions.accept()}>
                apply{deletes > 0 && <span className={styles.applyDeletes}> · {deletes} delete{deletes === 1 ? '' : 's'}</span>} ↵
              </Button>
            </span>
            <Button className={styles.action} tone="danger" onClick={() => agentActions.discard()}>
              discard esc
            </Button>
            <span className={styles.changesHint}>{on.length ? 'one undo step · the app waits till then' : 'nothing ticked: apply closes it'}</span>
          </div>
        </>
      )}
    </section>
  )
}

// A removed item: only its verb struck (`delete a card`), what it names left readable.
function ItemText({ line, struck, strike }: { line: string; struck: boolean; strike?: string }) {
  // A merge (S17): only the merged card's name struck.
  const at0 = strike ? line.indexOf(strike) : -1
  if (strike && at0 >= 0)
    return (
      <span className={styles.itemText}>
        {line.slice(0, at0)}
        <span data-struck>{strike}</span>
        {line.slice(at0 + strike.length)}
      </span>
    )
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
  unapplied: 'not applied',
}

function ChangeRow({ i, live, current, onGo }: { i: ChangeLine; live: boolean; current: boolean; onGo: () => void }) {
  return (
    <li className={styles.item} data-diff={i.diff ? '' : undefined} data-delete={i.delete || undefined} data-off={!i.on || undefined} data-current={current || undefined}>
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
        <ItemText line={i.line} struck={i.delete} strike={i.strike} />
        {i.why && <span className={styles.why}> — {i.why}</span>}
        {i.needs && <span className={styles.needs}> · off: it needs {(i.needsWords ?? i.needs).join('; ')}</span>}
      </span>
      {i.diff && <NotesDiff lines={i.diff} />}
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
        <Button className={styles.action} onClick={() => agentActions.undo()} disabled={shown.undoing}>
          {shown.undoing ? 'undoing…' : 'undo'}
        </Button>
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

