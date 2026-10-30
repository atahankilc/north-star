// The agent's memory in its column (S16, D-312; docs/specs/agent.md §4.7): the saved chats as a prompt list (D-222:
// `>` narrows, `# yours` / `# shared with the workspace`, `•` the open one, a counting foot) with the open chat's own
// actions on top (`[r] rename`, `[s] share`, `[d] delete`); the agent notes as a page (Markdown), editable by owners and
// editors (one undo step, as the person); and a notes change in the preview as a line diff (+ added, − taken out).
// DOM text only (never under the ASCII effect); tokens only; the list's build-up is MenuPanel's.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { MenuPanel, type MenuEntry } from '../../ui/Menu'
import { Markdown } from '../../ui/Markdown'
import { ago } from '../../ui/ago'
import { useAutoGrow } from '../../ui/autoGrow'
import { useWs } from '../../views/workspace/context'
import { useAuth } from '../../data/auth'
import { diffShown, NOTES_MAX, NOTES_TITLE, type DiffLine } from '../../model/notes'
import { agentActions, isViewer, liveWs, useAgent } from './agentStore'
import styles from './AgentMemory.module.css'

// `01 ── CHATS` as the column's other views start.
function Rule({ n, label, aside }: { n: string; label: string; aside?: string }) {
  return (
    <h3 className={styles.rule}>
      <span className={styles.n}>{n}</span>
      <span>{label}</span>
      <span className={styles.ruleLine} aria-hidden />
      {aside && <span className={styles.aside}>{aside}</span>}
    </h3>
  )
}

// ---- The saved chats

export function ChatsView() {
  const ws = useWs()
  const { user } = useAuth()
  const uid = user?.id
  const list = useAgent((s) => s.chats)
  const more = useAgent((s) => s.chatsMore)
  const chat = useAgent((s) => s.chat)
  const [confirm, setConfirm] = useState(false)
  // A teammate's name for their shared chats (members as the read layer knows them, else what they wrote).
  const wid = useAgent((s) => s.wid)
  const names = useMemo(() => {
    const m = new Map([...(ws.documents ?? []).map((d) => [d.uid, d.name] as const), ...(ws.tasks ?? []).flatMap((t) => (t.assignee && t.assigneeName ? [[t.assignee, t.assigneeName] as const] : []))])
    for (const x of (wid ? liveWs(wid)?.members : undefined) ?? []) if (x.name) m.set(x.uid, x.name)
    return m
    // The members come with the list (loaded while the panel is up).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.documents, ws.tasks, wid, list])
  // The open chat's own actions, once it's saved and yours.
  const open = chat.saved && chat.saved.uid === uid ? { ...chat.saved, ...(list?.find((c) => c.id === chat.id) ?? {}), id: chat.id } : null
  const yours = (list ?? []).filter((c) => c.uid === uid)
  const shared = (list ?? []).filter((c) => c.uid !== uid)
  const row = (c: NonNullable<typeof list>[number]): MenuEntry => ({
    key: c.id,
    label: c.title,
    // Short, so the title keeps the room: when, and whose or shared; the open one says so.
    hint: [...(c.id === chat.id ? ['open'] : []), ago(c.updatedAt), ...(c.uid !== uid ? [names.get(c.uid)?.split(/[ @]/)[0] || 'a teammate'] : c.shared ? ['shared'] : [])].join(' · '),
    words: `${c.turns} asks`,
    onSelect: () => void agentActions.openChat(c.id),
  })
  const items: MenuEntry[] = [
    ...(open
      ? [
          { key: 'h-this', heading: 'this chat' },
          { key: 'a-share', letter: 's', label: open.shared ? 'unshare it' : 'share with the workspace', onSelect: () => (void agentActions.shareChat(chat.id, !open.shared), 'keep') },
          {
            key: 'a-delete',
            letter: 'd',
            danger: true,
            label: confirm ? 'press again to delete it' : 'delete this chat',
            onSelect: () => {
              if (!confirm) return (setConfirm(true), 'keep')
              void agentActions.deleteChat(chat.id)
              setConfirm(false)
              return 'keep'
            },
          },
        ]
      : []),
    { key: 'h-yours', heading: 'yours' },
    ...yours.map(row),
    ...(shared.length ? [{ key: 'h-shared', heading: 'shared with the workspace' }, ...shared.map(row)] : []),
    ...(more ? [{ key: 'more', label: 'older chats…', hint: 'load 20 more', onSelect: () => (void agentActions.listChats(true), 'keep') }] : []),
  ]
  return (
    <div className={styles.view} data-agent-chats>
      <Rule n="01" label="chats" aside={list ? undefined : 'loading…'} />
      <p className={styles.lead}>Saved for you, private unless you share one. Pick one to go on with it.</p>
      <div className={styles.panel}>
        <MenuPanel
          items={items}
          ariaLabel="Saved chats"
          prompt={open ? 'find, or type a new name…' : 'find a chat…'}
          noun="entries"
          empty="No saved chats yet: they're kept after the first answer."
          keys="↵ opens · esc back"
          more={(typed) => (open ? [{ key: 'a-rename', letter: 'r', label: `rename this chat to "${typed.slice(0, 120)}"`, onSelect: () => (void agentActions.renameChat(chat.id, typed), 'keep') }] : [])}
          onClose={() => agentActions.show('chat')}
        />
      </div>
    </div>
  )
}

// ---- The agent notes

export function NotesView() {
  const text = useAgent((s) => s.notes)
  const wid = useAgent((s) => s.wid)
  const viewer = isViewer(wid)
  const ws = useWs()
  const doc = ws.documents?.find((d) => d.id === 'agent-notes')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [said, setSaid] = useState('')
  const area = useRef<HTMLTextAreaElement>(null)
  useAutoGrow(area, draft)
  useEffect(() => {
    // The caret at the end, where a new line usually goes.
    if (!editing || !area.current) return
    area.current.focus()
    area.current.setSelectionRange(area.current.value.length, area.current.value.length)
  }, [editing])
  const start = () => {
    setDraft(text ?? `# ${NOTES_TITLE}\n\n- `)
    setSaid('')
    setEditing(true)
  }
  const save = async () => {
    if (draft.length > NOTES_MAX) return setSaid(`too long: at most ${NOTES_MAX} characters`)
    await agentActions.saveNotes(draft)
    setEditing(false)
  }
  const onKey = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setEditing(false)
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      void save()
    }
  }
  return (
    <div className={styles.view} data-agent-notes>
      <Rule n="01" label="agent notes" aside={doc ? `${doc.words ?? 0} words · ${ago(doc.updatedAt)}` : 'none yet'} />
      <p className={styles.lead}>The workspace's memory: read at the start of every chat. Everyone here reads it; owners and editors change it, and the agent proposes changes in its preview.</p>
      {editing ? (
        <div className={styles.edit}>
          <textarea ref={area} className={styles.area} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} aria-label="The agent notes" spellCheck />
          <div className={styles.foot}>
            <button className={styles.action} data-tone="primary" onClick={() => void save()}>
              save ⌘↵
            </button>
            <button className={styles.action} onClick={() => setEditing(false)}>
              cancel esc
            </button>
            <span className={styles.count} data-over={draft.length > NOTES_MAX || undefined}>
              {draft.length}/{NOTES_MAX}
            </span>
            {said && <span className={styles.said}>{said}</span>}
          </div>
        </div>
      ) : (
        <>
          <div className={styles.page}>{text ? <Markdown text={text} /> : <p className={styles.none}>{doc ? 'loading…' : 'Nothing yet. Tell the agent "remember …", or write the first lines here.'}</p>}</div>
          <div className={styles.foot}>
            {!viewer && (
              // Not before the text is loaded: saving would overwrite notes not seen.
              <button className={styles.action} data-tone="primary" onClick={start} disabled={!!doc && text == null}>
                {text ? 'edit' : 'write'}
              </button>
            )}
            <button className={styles.action} onClick={() => agentActions.show('chat')}>
              back to the chat
            </button>
            <span className={styles.count}>{viewer ? "you're a viewer: read only" : 'one undo step'}</span>
          </div>
        </>
      )}
    </div>
  )
}

// ---- A notes change in the preview: the lines that come (+) and go (−), a line of context round them.

export function NotesDiff({ lines }: { lines: DiffLine[] }) {
  const shown = diffShown(lines, 1)
  return (
    <pre className={styles.diff} aria-label="What changes in the agent notes">
      {shown.map((l, i) => (
        <span key={i} className={styles.dl} data-sign={l.sign === '+' ? 'add' : l.sign === '-' ? 'del' : l.sign === '…' ? 'gap' : 'same'}>
          <span className={styles.ds} aria-hidden>
            {l.sign === '-' ? '−' : l.sign === '…' ? '…' : l.sign}
          </span>
          {l.sign === '…' ? '' : l.text || ' '}
        </span>
      ))}
    </pre>
  )
}
