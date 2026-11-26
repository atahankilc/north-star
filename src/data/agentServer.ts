// The agent on the server, as the app talks to it (D-434, docs/specs/agent-server.md §5.4): a message starts a run
// (`startAgent`); its events, the moves it asks of the screen and how it ended come down over RTDB
// (`agentLive/{uid}/{run}`); stop, words for its next step, where the person is, that this tab watches and the answers to
// moves go up (`agentCtl/{uid}/{run}`); what the person did with a preview goes back (`tellAgent`); the chat's pending
// changes come for the preview (`agentChanges`). A person's own key kept in their account (`setOwnKey`) is never sent
// back; what they keep there is `users/{uid}/private/aiKeys` (`sk-…abcd`).
import { doc, onSnapshot } from 'firebase/firestore'
import { child, onChildAdded, onDisconnect, onValue, push, ref, remove, serverTimestamp, set } from 'firebase/database'
import type { Changeset } from '../agent/changeset'
import type { Job } from '../agent/job'
import type { IdsState } from '../agent/read'
import type { WhereView } from '../agent/read/tools'
import type { Source, Usage } from '../agent/contract'
import { keepLocal, readLocal } from '../state/local'
import { MOVE_SAID_MAX } from '../model/limits'
import { cut } from '../model/words'
import { callFunction, db, firebase } from './firebase'

// Whether chats run on the server (D-434): only where it's been switched on in this browser (`northstar.agent.server` =
// 1, or `?agentServer=1` once), until it's deployed and opened to everyone; on the emulators it needs the functions
// running too (`npm run emulators` starts them).
const asked = typeof location !== 'undefined' && new URLSearchParams(location.search).get('agentServer') === '1'
if (asked) keepLocal('northstar.agent.server', '1')
export const serverAgentOn = () => !!firebase && readLocal('northstar.agent.server') === '1'

export type PaidBy = 'workspace' | 'own'
export type StartRun = { wid: string; chatId: string; text: string; view: WhereView; paidBy: PaidBy; model: string; effort?: string; key?: string; off?: string[] }

export const startRun = (o: StartRun) => callFunction<{ run: string }>('startAgent', o, "The agent couldn't start.")

// What the person did, told to the chat on the server; a run may follow by itself (`run`, with its words `say`).
export type Told = { kind: 'applied' | 'discarded'; text: string; done: string[]; notDone: string[] } | { kind: 'undone' } | { kind: 'job'; act: 'all' | 'each' | 'stopAfter' | 'keepOn' | 'goOn' | 'raise' | 'drop' }
export type TellRun = Pick<StartRun, 'wid' | 'chatId' | 'view'> & Partial<Pick<StartRun, 'paidBy' | 'model' | 'effort' | 'key'>> & { what: Told }
export const tellRun = (o: TellRun) => callFunction<{ run?: string; say?: string; auto?: boolean; job: Job | null }>('tellAgent', o, "The agent didn't hear that.")

export type Pending = { run: string | null; changes: Changeset; ids: IdsState; job: Job | null } | null
export const pendingOf = (wid: string, chatId: string) => callFunction<Pending>('agentChanges', { wid, chatId }, "The agent's changes couldn't be read.")

// The loop's events as the server sends them (functions/src/agent/live.ts' LiveEvent).
export type RunEvent =
  | { type: 'text'; n: number; delta: string }
  | { type: 'search'; n: number; query: string }
  | { type: 'step'; n: number; final: boolean }
  | { type: 'tool_started' | 'tool_finished'; n: number; call: { id: string; name: string; label: string; args: string; ok?: boolean; ms?: number } }
  | { type: 'usage'; n: number; total: Usage }
  | { type: 'again'; n: number }
  | { type: 'heard'; n: number; text: string }
  | { type: 'asked'; n: number; text: string; auto?: boolean }

export type RunEnd = {
  status: 'waiting' | 'done' | 'stopped' | 'failed'
  end?: string
  said?: string
  pending?: number
  answer?: string
  usage?: Usage
  ms?: number
  sources?: Source[]
  job?: Job | null
  // The run that follows by itself, and its words (`auto`: the app's own go-on, not the person's).
  next?: string
  say?: string
  auto?: boolean
}
export type Move = { id: string; tool: 'goTo' | 'focus' | 'select' | 'openPanel' | 'showBeside'; args: unknown }

const parse = <T,>(v: unknown): T | null => {
  try {
    return typeof v === 'string' ? (JSON.parse(v) as T) : null
  } catch {
    return null
  }
}

// Watches a run: every event in order (from its start, so a reload or another tab catches up), the moves it asks of
// this screen, and its end. This tab counts as watching while it's open (the server moves nothing on a screen nobody
// looks at). Returns the stop.
export function watchRun(uid: string, run: string, on: { event: (e: RunEvent) => void; move: (m: Move) => void; end: (e: RunEnd) => void }): () => void {
  const rtdb = firebase?.rtdb
  if (!rtdb) return () => {}
  const live = ref(rtdb, `agentLive/${uid}/${run}`)
  const here = ref(rtdb, `agentCtl/${uid}/${run}/here`)
  void set(here, serverTimestamp()).catch(() => {})
  void onDisconnect(here).remove().catch(() => {})
  let ended = false
  const offs = [
    onChildAdded(child(live, 'ev'), (s) => {
      const e = parse<RunEvent>(s.val())
      if (e) on.event(e)
    }),
    onChildAdded(child(live, 'moves'), (s) => {
      const m = parse<Omit<Move, 'id'>>(s.val())
      if (m && s.key) on.move({ ...m, id: s.key })
    }),
    onValue(child(live, 'end'), (s) => {
      const e = parse<RunEnd>(s.val())
      if (e && !ended) {
        ended = true
        on.end(e)
      }
    }),
  ]
  return () => {
    offs.forEach((off) => off())
    void remove(here).catch(() => {})
  }
}

const ctl = (uid: string, run: string, part: string) => ref(firebase!.rtdb!, `agentCtl/${uid}/${run}/${part}`)
export const stopRun = (uid: string, run: string) => set(ctl(uid, run, 'stop'), true)
// The job stops after the step under way (D-328), told while the run works.
export const stopAfterStep = (uid: string, run: string, on: boolean) => set(ctl(uid, run, 'after'), on)
export const tellWords = (uid: string, run: string, text: string) => push(ctl(uid, run, 'words'), { text, at: serverTimestamp() })
export const tellView = (uid: string, run: string, view: WhereView) => set(ctl(uid, run, 'view'), JSON.stringify(view))
// A move done (true) or why not, in a few words.
export const answerMove = (uid: string, run: string, move: string, said: true | string) => set(ctl(uid, run, `done/${move}`), said === true ? true : cut(said, MOVE_SAID_MAX))

// The chat on the server: whether a run is going (`running`) and whether a preview waits.
export type ChatOnServer = { running: string | null; last: string | null; waiting: boolean; turn: number }
export function watchChatOnServer(wid: string, chatId: string, cb: (t: ChatOnServer | null) => void): () => void {
  if (!firebase) return () => {}
  return onSnapshot(
    doc(db(), 'agentThreads', `${wid}_${chatId}`),
    (s) => cb(s.exists() ? (s.data() as ChatOnServer) : null),
    () => cb(null),
  )
}

// A person's own keys kept in their account (only `sk-…abcd`).
export type AccountKeys = { openai?: { hint: string; at: number }; anthropic?: { hint: string; at: number } }
export function watchAccountKeys(uid: string, cb: (k: AccountKeys) => void): () => void {
  if (!firebase) return () => {}
  return onSnapshot(
    doc(db(), 'users', uid, 'private', 'aiKeys'),
    (s) => cb((s.data() as AccountKeys | undefined) ?? {}),
    () => cb({}),
  )
}
export const keepKeyInAccount = (provider: 'openai' | 'anthropic', key: string | null) => callFunction<{ hint: string | null }>('setOwnKey', { provider, key: key ?? '' }, "The key couldn't be saved.")
