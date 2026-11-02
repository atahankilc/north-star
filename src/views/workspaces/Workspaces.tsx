// The workspaces page (D-338, docs/specs/workspaces-page.md): for going back to work. The big title with its count, one
// prompt (it finds, starts, joins; a .zip dropped anywhere imports), and under it, with nothing typed: the workspace you
// left (its picture, since you left, who's here), what needs you, the others; the three ways in while you have few.
// A first visit is the same page with a START piece where the continue piece goes. Typed: ledger rows.
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { workspacePath } from '../../app/paths'
import type { AuthUser } from '../../data/auth'
import type { WithId } from '../../data/hooks'
import { importWorkspace } from '../../data/importWorkspace'
import type { Workspace } from '../../data/model'
import { readBundle } from '../../io/bundle'
import {
  acceptInvite,
  createWorkspace,
  declineInvite,
  deleteWorkspace,
  JoinError,
  leaveWorkspace,
  renameWorkspace,
  requestToJoin,
  useMyInvites,
  useMyJoinRequests,
  useMyWorkspaces,
  useJoinRequests,
  canEditIn,
  isOwnerOf,
  ownerCount,
  withdrawJoinRequest,
  INVITE_CODE_TYPED,
} from '../../data/workspaces'
import { useVisits, type Visit } from '../../data/glance'
import { useHoldCurtain } from '../../state/curtain'
import { ago } from '../../ui/foundation/ago'
import { Appear } from '../../ui/primitives/Appear'
import { Button } from '../../ui/primitives/Button'
import { ButtonGroup } from '../../ui/primitives/ButtonGroup'
import { DecodeText } from '../../ui/primitives/DecodeText'
import { Field } from '../../ui/primitives/Field'
import { Label } from '../../ui/primitives/Label'
import { PromptField } from '../../ui/primitives/PromptField'
import { Num, numText, Rule } from '../../ui/primitives/Rule'
import { Hud } from '../../ui/patterns/Hud'
import { HazardConfirm } from '../../ui/patterns/HazardConfirm'
import type { PromptEntry } from '../../ui/foundation/promptModel'
import { ContextMenu } from '../../ui/patterns/ContextMenu'
import { Window } from '../../ui/patterns/Window'
import { learn } from '../../onboarding/learn'
import { DESCRIPTION_MAX, WORKSPACE_NAME_MAX } from '../../model/limits'
import { ContinuePiece, NewTasksOf, OtherPiece, People } from './pieces'
import { PieceCard } from '../../ui/patterns/PieceCard'
import { WorkspacePicture } from './WorkspacePicture'
import styles from './Workspaces.module.css'

// The onboarding's coach (D-315), loaded apart from this page (it's shared with the workspace's chunk).
const Coach = lazy(() => import('../../onboarding/Coach').then((m) => ({ default: m.Coach })))

// An invite code as typed (workspaces.ts): with the dash it reads as a code first; without, a name first (`Pazarlar`).
const CODE = INVITE_CODE_TYPED
// While you have this many or fewer, the three ways in stay under your workspaces (D-345: one, not two).
const START_ROW_UNTIL = 1
const NAME_MAX = WORKSPACE_NAME_MAX

type Row = { kind: 'ws'; w: WithId<Workspace> } | { kind: 'new'; name: string; again: boolean } | { kind: 'code'; code: string }
type Ask = { kind: 'new'; name: string } | { kind: 'rename'; w: WithId<Workspace> } | { kind: 'delete' | 'leave'; w: WithId<Workspace> }

export function Workspaces({ user }: { user: AuthUser }) {
  const workspaces = useMyWorkspaces(user.id)
  const navigate = useNavigate()
  const ids = useMemo(() => workspaces.data.map((w) => w.id).sort(), [workspaces.data])
  const visits = useVisits(ids, user.id)
  useHoldCurtain('workspaces', workspaces.isLoading)
  // Your last visit first; never visited, when it was made (D-338).
  const sorted = useMemo(
    () => [...workspaces.data].sort((a, b) => (visits.data[b.id]?.visited ?? b.createdAt) - (visits.data[a.id]?.visited ?? a.createdAt)),
    [workspaces.data, visits.data],
  )
  const invites = useMyInvites(user.email)
  const requests = useMyJoinRequests(user.id)
  const none = !workspaces.isLoading && sorted.length === 0

  const [typed, setTyped] = useState('')
  const [pick, setPick] = useState(0)
  const [note, setNote] = useState<{ text: string; tone?: 'ok' | 'warn'; open?: string } | null>(null)
  const [ask, setAsk] = useState<Ask | null>(null)
  const [menu, setMenu] = useState<{ at: [number, number]; w: WithId<Workspace> } | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const prompt = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const [tasks, setTasks] = useState<Record<string, number>>({})
  const onTasks = useCallback((wid: string, n: number) => setTasks((t) => (t[wid] === n ? t : { ...t, [wid]: n })), [])

  const go = (wid: string) => navigate(workspacePath(wid))
  const goNewTab = (wid: string) => window.open(new URL(workspacePath(wid), window.location.href).href, '_blank', 'noopener')

  // ── What's typed: your workspaces that match, then a new one or a code ──
  const q = typed.trim()
  const rows: Row[] = useMemo(() => {
    if (!q) return []
    const isCode = CODE.test(q)
    const low = q.toLowerCase()
    const found: Row[] = sorted.filter((w) => w.name.toLowerCase().includes(low)).map((w) => ({ kind: 'ws', w }))
    // A name you already have can be made again (two ideas may share one): the match stays first, so ↵ opens it.
    const make: Row = { kind: 'new', name: q.slice(0, NAME_MAX), again: sorted.some((w) => w.name.toLowerCase() === low) }
    const code: Row = { kind: 'code', code: q.toUpperCase() }
    // `+ new` is always there; a code is offered beside it, first only when typed with its dash.
    if (isCode) found.push(...(q.includes('-') ? [code, make] : [make, code]))
    else found.push(make)
    return found
  }, [q, sorted])
  useEffect(() => setPick(0), [q])

  const make = async (name: string, description?: string) => {
    setBusy(true)
    setNote(null)
    try {
      const id = await createWorkspace(name, user.id, description)
      learn('ws-made')
      go(id)
    } catch (e) {
      setNote({ text: (e as Error).message, tone: 'warn' })
      setBusy(false)
    }
  }
  const join = async (code: string) => {
    setBusy(true)
    setNote(null)
    try {
      const result = await requestToJoin(code, user)
      if (result.status === 'member') return go(result.workspaceId)
      setTyped('')
      setNote({ text: 'Request sent. An owner lets you in from their settings; it waits below until then.', tone: 'ok' })
      learn('join-requested')
    } catch (e) {
      setNote({ text: e instanceof JoinError ? e.message : 'Could not send the request. Check the code and try again.', tone: 'warn' })
    }
    setBusy(false)
  }
  const importFile = async (f: File | undefined) => {
    if (!f) return
    setBusy(true)
    setNote({ text: `importing ${f.name}…` })
    try {
      const result = await importWorkspace(await readBundle(f), user.id, user.name || user.email || 'someone')
      learn('ws-made')
      if (!result.skipped) return go(result.workspaceId)
      const n = result.skipped
      setNote({ text: `Imported. ${n} ${n === 1 ? 'thing was' : 'things were'} left out: broken, or pointing at something not in the file.`, tone: 'ok', open: result.workspaceId })
    } catch (e) {
      setNote({ text: (e as Error).message, tone: 'warn' })
    } finally {
      setBusy(false)
      if (file.current) file.current.value = ''
    }
  }
  const run = (r: Row | undefined, newTab = false) => {
    if (!r) return
    if (r.kind === 'ws') return newTab ? goNewTab(r.w.id) : go(r.w.id)
    if (r.kind === 'code') return void join(r.code)
    void make(r.name)
  }
  const submit = () => {
    if (busy) return
    if (!q) return sorted[0] ? go(sorted[0].id) : undefined
    run(rows[pick])
  }

  // Typing anywhere on the page types into the prompt (not while a field, a window or a menu has the keys).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return
      if (t?.closest('input, textarea, [contenteditable], [role="dialog"], [data-coach], dialog') || ask || menu) return // kit-ok: reads where the key went, makes no dialog
      prompt.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ask, menu])

  // A .zip dropped anywhere imports it.
  const onDragOver = (e: DragEvent) => {
    if (![...e.dataTransfer.types].includes('Files')) return
    e.preventDefault()
    setDragging(true)
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    void importFile(e.dataTransfer.files[0])
  }

  const menuItems = (w: WithId<Workspace>): PromptEntry[] => {
    const owner = isOwnerOf(w, user.id)
    const items: PromptEntry[] = [
      { key: 'open', label: 'open', letter: 'o', onSelect: () => go(w.id) },
      { key: 'tab', label: 'open in a new tab', letter: 't', onSelect: () => goNewTab(w.id) },
    ]
    if (canEditIn(w, user.id)) items.push({ key: 'rename', label: 'rename…', letter: 'r', onSelect: () => setAsk({ kind: 'rename', w }) })
    if (owner)
      items.push({
        key: 'code',
        label: 'copy invite code',
        letter: 'c',
        hint: `${w.inviteCode.slice(0, 4)}-${w.inviteCode.slice(4)}`,
        onSelect: () => {
          void navigator.clipboard?.writeText(`${w.inviteCode.slice(0, 4)}-${w.inviteCode.slice(4)}`)
          setNote({ text: `${w.name}'s invite code copied.`, tone: 'ok' })
        },
      })
    items.push({ key: 'rule', heading: '' })
    if (!owner || ownerCount(w) > 1) items.push({ key: 'leave', label: 'leave…', letter: 'l', danger: true, onSelect: () => setAsk({ kind: 'leave', w }) })
    if (owner) items.push({ key: 'delete', label: 'delete…', letter: 'd', danger: true, onSelect: () => setAsk({ kind: 'delete', w }) })
    return items
  }
  const openMenu = (w: WithId<Workspace>) => (at: [number, number]) => setMenu({ at, w })

  const placeholder = none ? 'name your first workspace, or paste an invite code…' : 'find, start a new one, or paste an invite code…'
  return (
    <main className={styles.page} onDragOver={onDragOver} onDragLeave={(e) => !e.relatedTarget && setDragging(false)} onDrop={onDrop}>
      <Hud crumbs={[{ label: 'workspaces' }]} />

      <section className={styles.content}>
        <h1 className={styles.title}>
          <DecodeText text="Workspaces" />
          <span className={styles.count}>{workspaces.isLoading ? '' : numText(sorted.length)}</span>
        </h1>

        <Appear className={styles.ask}>
          <PromptField
            ref={prompt}
            value={typed}
            onChange={setTyped}
            onSubmit={submit}
            onEscape={() => setTyped('')}
            label="Find a workspace, start one, or paste an invite code"
            placeholder={placeholder}
            running={busy}
            framed
            maxLength={NAME_MAX}
            data={{ 'data-ws-prompt': true }}
            onKeyDown={(e) => {
              if (!rows.length) return
              if (e.key === 'ArrowDown') (e.preventDefault(), setPick((p) => (p + 1) % rows.length))
              if (e.key === 'ArrowUp') (e.preventDefault(), setPick((p) => (p - 1 + rows.length) % rows.length))
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) (e.preventDefault(), run(rows[pick], true))
              // Tab on `+ new workspace`: name it and say what you're building first.
              const r = rows[pick]
              if (e.key === 'Tab' && !e.shiftKey && r?.kind === 'new') (e.preventDefault(), setAsk({ kind: 'new', name: r.name }))
            }}
          />
          {note && (
            <p className={styles.note} data-tone={note.tone}>
              {note.text}
              {note.open && (
                <Button tone="primary" onClick={() => go(note.open!)}>
                  open it
                </Button>
              )}
            </p>
          )}
        </Appear>

        {workspaces.error && <p className={styles.note} data-tone="warn">{workspaces.error.message}</p>}

        {sorted.map((w) => (
          <NewTasksOf key={w.id} wid={w.id} uid={user.id} seen={visits.data[w.id]?.tasks} onCount={onTasks} />
        ))}

        {q ? (
          <Found rows={rows} pick={pick} q={q} visits={visits.data} tasks={tasks} onPick={setPick} onRun={run} onMenu={openMenu} />
        ) : none ? (
          <FirstVisit onFile={() => file.current?.click()} invites={invites.data} requests={requests.data} user={user} onJoined={go} />
        ) : workspaces.isLoading ? null : (
          <>
            <ContinuePiece w={sorted[0]} uid={user.id} visit={visits.data[sorted[0].id]} onOpen={() => go(sorted[0].id)} onMenu={openMenu(sorted[0])} />
            <NeedsYou user={user} workspaces={sorted} tasks={tasks} invites={invites.data} requests={requests.data} onOpen={go} />
            {sorted.length > 1 && (
              <>
                <Rule name="others" count={numText(sorted.length - 1)} countAt="end" className={styles.rule} />
                <div className={styles.others}>
                  {sorted.slice(1).map((w, i) => (
                    <Appear key={w.id}>
                      <OtherPiece w={w} n={i + 2} uid={user.id} visit={visits.data[w.id]} newTasks={tasks[w.id] ?? 0} onOpen={() => go(w.id)} onMenu={openMenu(w)} />
                    </Appear>
                  ))}
                  {sorted.length > START_ROW_UNTIL && (
                    <Appear>
                      <ImportPiece onFile={() => file.current?.click()} />
                    </Appear>
                  )}
                </div>
              </>
            )}
            {sorted.length <= START_ROW_UNTIL && (
              <>
                <Rule name="start another" className={styles.rule} />
                <StartRow small onFile={() => file.current?.click()} />
              </>
            )}
          </>
        )}
      </section>

      {/* the hidden file picker `choose file` opens */}
      <input /* kit-ok: the hidden file picker */ ref={file} id="ws-import" type="file" accept=".zip,.json,application/zip,application/json" hidden onChange={(e) => void importFile(e.target.files?.[0])} />

      {dragging && (
        <div className={styles.drop} aria-hidden>
          <span>drop to import as a new workspace</span>
        </div>
      )}

      {menu && (
        <div className={styles.layer}>
          <ContextMenu at={menu.at} items={menuItems(menu.w)} what="workspace" prompt={menu.w.name} onClose={() => setMenu(null)} />
        </div>
      )}

      {ask?.kind === 'new' && <NameWindow title="New workspace" name={ask.name} withAbout onCancel={() => setAsk(null)} onDone={(name, about) => (setAsk(null), void make(name, about))} />}
      {ask?.kind === 'rename' && (
        <NameWindow
          title="Rename"
          name={ask.w.name}
          onCancel={() => setAsk(null)}
          onDone={(name) => {
            const w = ask.w
            setAsk(null)
            if (name && name !== w.name) renameWorkspace(w.id, name).catch((e: Error) => setNote({ text: e.message, tone: 'warn' }))
          }}
        />
      )}
      {(ask?.kind === 'delete' || ask?.kind === 'leave') && (
        <HazardConfirm
          title={ask.kind === 'delete' ? `Delete ${ask.w.name}?` : `Leave ${ask.w.name}?`}
          lines={ask.kind === 'delete' ? ['Everything in it goes, for everyone in it.', 'This cannot be undone.'] : ['An owner has to let you in again.']}
          confirm={ask.kind}
          onCancel={() => setAsk(null)}
          onConfirm={() => {
            const { w, kind } = ask
            setAsk(null)
            ;(kind === 'delete' ? deleteWorkspace(w.id, w.inviteCode, user.id) : leaveWorkspace(w.id, user.id)).catch((e: Error) => setNote({ text: e.message, tone: 'warn' }))
          }}
        />
      )}

      <Suspense fallback={null}>
        <Coach />
        <Listed loading={workspaces.isLoading} empty={workspaces.data.length === 0} />
      </Suspense>
    </main>
  )
}

// The list loaded, said to the coach (D-315). Mounted with it (both wait for its chunk), so it's listening by then.
function Listed({ loading, empty }: { loading: boolean; empty: boolean }) {
  useEffect(() => void (!loading && learn('workspaces-open', { empty })), [loading]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

// ── Typed: ledger rows ───────────────────────────────────────────────────────────────────────────────────────────
function Found({ rows, pick, q, visits, tasks, onPick, onRun, onMenu }: {
  rows: Row[]
  pick: number
  q: string
  visits: Record<string, Visit>
  tasks: Record<string, number>
  onPick: (i: number) => void
  onRun: (r: Row) => void
  onMenu: (w: WithId<Workspace>) => (at: [number, number]) => void
}) {
  const matches = rows.filter((r) => r.kind === 'ws').length
  const lit = (name: string) => {
    const i = name.toLowerCase().indexOf(q.toLowerCase())
    if (i < 0) return name
    return (
      <>
        {name.slice(0, i)}
        <mark className={styles.mark}>{name.slice(i, i + q.length)}</mark>
        {name.slice(i + q.length)}
      </>
    )
  }
  return (
    <Appear className={styles.found}>
      <Rule name="matches" count={numText(matches)} countAt="end" className={styles.rule} />
      <ul className={styles.rows}>
        {rows.map((r, i) => (
          <li key={r.kind === 'ws' ? r.w.id : r.kind} onPointerEnter={() => onPick(i)} onContextMenu={r.kind === 'ws' ? (e) => (e.preventDefault(), onMenu(r.w)([e.clientX, e.clientY])) : undefined}>
            <PieceCard band="transparent" name={null} tier="s" picked={i === pick} onOpen={() => onRun(r)} className={styles.rowPiece}>
              {r.kind === 'ws' ? (
                <>
                  <Num n={i + 1} className={styles.rowN} />
                  <span className={styles.rowName}>{lit(r.w.name)}</span>
                  <span className={styles.rowMeta}>
                    {(tasks[r.w.id] ?? 0) > 0 && <span className={styles.mine}>☐ {tasks[r.w.id]}</span>}
                    <People w={r.w} />
                    <span>{visits[r.w.id]?.visited ? ago(visits[r.w.id].visited!) : ''}</span>
                  </span>
                  {r.w.description && <span className={styles.rowSub}>{r.w.description}</span>}
                </>
              ) : r.kind === 'new' ? (
                <>
                  <span className={styles.rowN} data-make>+</span>
                  <span className={styles.rowName} data-make>new workspace “{r.name}”</span>
                  <span className={styles.rowSub}>
                    {r.again ? 'you have one by this name already; this makes another' : 'it opens on an empty canvas'}
                  </span>
                </>
              ) : (
                <>
                  <span className={styles.rowN} data-make>→</span>
                  <span className={styles.rowName} data-make>ask to join {r.code}</span>
                  <span className={styles.rowSub}>an owner lets you in; it waits on this page until then</span>
                </>
              )}
            </PieceCard>
          </li>
        ))}
      </ul>
    </Appear>
  )
}

// ── What needs you ───────────────────────────────────────────────────────────────────────────────────────────────
function NeedsYou({ user, workspaces, tasks, invites, requests, onOpen }: {
  user: AuthUser
  workspaces: WithId<Workspace>[]
  tasks: Record<string, number>
  invites: ReturnType<typeof useMyInvites>['data']
  requests: ReturnType<typeof useMyJoinRequests>['data']
  onOpen: (wid: string) => void
}) {
  const withTasks = workspaces.filter((w) => (tasks[w.id] ?? 0) > 0)
  const total = withTasks.reduce((n, w) => n + (tasks[w.id] ?? 0), 0)
  const owned = workspaces.filter((w) => isOwnerOf(w, user.id))
  const [asking, setAsking] = useState<Record<string, number>>({})
  const onAsking = useCallback((wid: string, n: number) => setAsking((a) => (a[wid] === n ? a : { ...a, [wid]: n })), [])
  const askingIn = owned.filter((w) => (asking[w.id] ?? 0) > 0)
  const [busy, setBusy] = useState<string | null>(null)
  const runBusy = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key)
    await fn().catch(() => {})
    setBusy(null)
  }
  const pieces = total + askingIn.length + invites.length + requests.length
  return (
    <>
      {owned.map((w) => (
        <AskingOf key={w.id} wid={w.id} onCount={onAsking} />
      ))}
      {pieces > 0 && (
        <div className={styles.needs}>
          {total > 0 && (
            <Appear>
              <PieceCard band="var(--accent-yellow)" name="for you" className={styles.info} onOpen={() => onOpen(withTasks[0].id)}>
                <span className={styles.needT}>☐ {total} new {total === 1 ? 'task' : 'tasks'} for you</span>
                <span className={styles.needS}>{withTasks.map((w) => `${tasks[w.id]} in ${w.name}`).join(' · ')}</span>
              </PieceCard>
            </Appear>
          )}
          {askingIn.map((w) => (
            <Appear key={w.id}>
              <PieceCard band="var(--accent-magenta)" name="asking" className={styles.info} onOpen={() => onOpen(w.id)}>
                <span className={styles.needT}>
                  {asking[w.id]} {asking[w.id] === 1 ? 'person asks' : 'people ask'} to join {w.name}
                </span>
                <span className={styles.needS}>let them in from its settings → people</span>
              </PieceCard>
            </Appear>
          ))}
          {invites.map((i) => (
            <Appear key={i.id}>
              <PieceCard band="var(--accent-cyan)" name="invited" className={styles.info}>
                <span className={styles.needT}>{i.name}</span>
                <span className={styles.needS}>
                  invited you · {i.memberCount} {i.memberCount === 1 ? 'person' : 'people'}
                </span>
                <ButtonGroup className={styles.acts}>
                  <Button tone="primary" disabled={busy !== null} onClick={() => runBusy(i.id, async () => (await acceptInvite(i.workspaceId, user), onOpen(i.workspaceId)))}>
                    join
                  </Button>
                  <Button disabled={busy !== null} onClick={() => runBusy(i.id, () => declineInvite(i.workspaceId, user.email ?? ''))}>
                    decline
                  </Button>
                </ButtonGroup>
              </PieceCard>
            </Appear>
          ))}
          {requests.map((r) => (
            <Appear key={r.id} data-learn="pending-row">
              <PieceCard band="var(--line-hover)" name="waiting" className={styles.info}>
                <span className={styles.needT}>
                  {r.code.slice(0, 4)}-{r.code.slice(4)}
                </span>
                <span className={styles.needS}>you asked to join · an owner lets you in</span>
                <span className={styles.acts}>
                  <Button disabled={busy !== null} onClick={() => runBusy(r.id, () => withdrawJoinRequest(r.workspaceId, user.id))}>
                    withdraw
                  </Button>
                </span>
              </PieceCard>
            </Appear>
          ))}
        </div>
      )}
    </>
  )
}

function AskingOf({ wid, onCount }: { wid: string; onCount: (wid: string, n: number) => void }) {
  const n = useJoinRequests(wid).data.length
  useEffect(() => onCount(wid, n), [wid, n, onCount])
  return null
}

// The import card's words, the same wherever it is.
const IMPORT_TITLE = 'Bring one in'
const IMPORT_LINE = 'A .zip exported from North Star: drop it anywhere on this page.'

// A .zip at the end of the others, as a workspace card: its picture a drop target, its strip the words and the button.
function ImportPiece({ onFile }: { onFile: () => void }) {
  return (
    <PieceCard band="var(--accent-blue)" name="import" onOpen={onFile} className={styles.mini}>
      <div className={styles.miniPic} data-drop>
        <Label>drop a .zip</Label>
      </div>
      <div className={styles.miniInfo}>
        <span className={styles.miniName}>{IMPORT_TITLE}</span>
        <span className={styles.row}>
          <span className={styles.people}>from North Star</span>
          <span className={styles.grow} />
          <Button onClick={onFile}>choose file</Button>
        </span>
      </div>
    </PieceCard>
  )
}

// ── The three ways in (the onboarding's `workspaces-empty` choices draw over them, D-315) ────────────────────────────
function StartRow({ small, onFile }: { small?: boolean; onFile: () => void }) {
  return (
    <div className={styles.starts} data-small={small || undefined} data-learn="workspaces-empty">
      <Appear>
        <PieceCard band="var(--accent-magenta)" name="new" className={styles.info}>
          <span className={styles.needT}>{small ? 'Another idea' : 'Start one'}</span>
          <span className={styles.needS}>Type its name in the line above.</span>
        </PieceCard>
      </Appear>
      <Appear>
        <PieceCard band="var(--accent-cyan)" name="join" className={styles.info}>
          <span className={styles.needT}>Join a teammate's</span>
          <span className={styles.needS}>Paste the code they gave you above. An owner lets you in.</span>
        </PieceCard>
      </Appear>
      <Appear>
        <PieceCard band="var(--accent-blue)" name="import" className={styles.info}>
          <span className={styles.needT}>{IMPORT_TITLE}</span>
          <span className={styles.needS}>{IMPORT_LINE}</span>
          <span className={styles.acts}>
            <Button onClick={onFile}>choose file</Button>
          </span>
        </PieceCard>
      </Appear>
    </div>
  )
}

// ── A first visit: the same page, a START piece where the continue piece goes ───────────────────────────────────
function FirstVisit({ onFile, invites, requests, user, onJoined }: {
  onFile: () => void
  invites: ReturnType<typeof useMyInvites>['data']
  requests: ReturnType<typeof useMyJoinRequests>['data']
  user: AuthUser
  onJoined: (wid: string) => void
}) {
  return (
    <>
      <Appear>
        <PieceCard band="var(--accent-magenta)" tier="l" className={styles.hero} name={<><Num n={1} /> start</>}>
          <div className={styles.heroPic}>
            <WorkspacePicture summary={null} sample />
          </div>
          <div className={styles.heroSide}>
            <h2 className={styles.heroName}>Your first workspace</h2>
            <p className={styles.about}>A workspace is one startup idea: its customers, problems, rivals and plan, on a canvas you share.</p>
            <Label className={styles.caps}>how it starts</Label>
            <ol className={styles.steps}>
              {['name it in the line above', 'it opens on its own canvas', 'the welcome shows you around, about a minute'].map((t, i) => (
                <li key={t}>
                  <Num n={String(i + 1)} className={styles.stepN} /> {t}
                </li>
              ))}
            </ol>
          </div>
        </PieceCard>
      </Appear>
      <NeedsYou user={user} workspaces={[]} tasks={{}} invites={invites} requests={requests} onOpen={onJoined} />
      <StartRow onFile={onFile} />
    </>
  )
}

// ── New workspace / rename: a name (and what you're building) in a window ────────────────────────────────────────
function NameWindow({ title, name, withAbout, onCancel, onDone }: { title: string; name: string; withAbout?: boolean; onCancel: () => void; onDone: (name: string, about?: string) => void }) {
  const [value, setValue] = useState(name)
  const [about, setAbout] = useState('')
  const done = () => value.trim() && onDone(value.trim(), about.trim() || undefined)
  return (
    <Window label={title} onClose={onCancel} close>
      <div className={styles.window}>
        <h3 className={styles.windowTitle}>{title}</h3>
        <Field value={value} onChange={setValue} label="Name" placeholder="e.g. Pet-sitting marketplace" maxLength={NAME_MAX} onEnter={done} autoFocus />
        {withAbout && <Field value={about} onChange={setAbout} label="What are you building?" placeholder="One line: who it's for and what it does (optional)" maxLength={DESCRIPTION_MAX} multiline />}
        <ButtonGroup className={styles.windowFoot}>
          <Button onClick={onCancel}>cancel</Button>
          <Button tone="primary" disabled={!value.trim()} onClick={done}>
            {withAbout ? 'create' : 'rename'}
          </Button>
        </ButtonGroup>
      </div>
    </Window>
  )
}
