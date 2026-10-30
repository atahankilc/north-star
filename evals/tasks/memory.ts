// Memory (S16, D-312; agent.md §4.7, §4.9 layers 4–6, §6 Phase 7's gate "a fact told in one chat is used in the next
// (via notes)"): the agent notes carried from one chat to the next, whats_new read from the change log, a viewer's own
// chat kept privately. In memory: the notes are the workspace's notes document (project/validate like every op), the
// change log is written by the eval env with each apply (as the browser's), chats go to chats.ts' memoryChats.
import { answerIncludes, chatSaved, cites, logged, noWriteAttempts, noWrites, notesSay, notesSeenIn, onlyChanged, toolSaid, undoRestores } from '../graders'
import { NOW } from '../fixtures'
import type { Task } from '../types'
import type { AgentWs } from '../../src/agent/contract'
import { answer, call, change, realOf } from './util'

const R = (s: string) => realOf('medium', s)
const H = 3_600_000

// A change log on the medium fixture: Jonas changed a customer and moved a task yesterday; Mert made a card three days
// ago (before "since"); the agent, through Ayşe, this morning.
const withLog = (ws: AgentWs): AgentWs => ({
  ...ws,
  changeLog: [
    { by: 'u-mert', at: NOW - 72 * H, kinds: ['customers'], ids: [R('c8')], op: 'create_card', actor: 'person' },
    { by: 'u-jonas', at: NOW - 20 * H, kinds: ['customers'], ids: [R('c3')], op: 'update_card', actor: 'person' },
    { by: 'u-jonas', at: NOW - 19 * H, kinds: ['tasks'], ids: [R('t41')], op: 'move_task', actor: 'person' },
    { by: 'u-ayse', at: NOW - 3 * H, kinds: ['problems'], ids: [R('c20')], op: 'update_card', actor: 'agent' },
  ],
})

export const MEMORY: Task[] = [
  {
    id: 'mem-01-notes-next-chat',
    group: 'memory',
    set: 'capability',
    fixture: 'medium',
    ask: 'Remember for later: we only sell in Berlin for now.',
    // The person accepts the notes change, starts a new chat, and asks something where it matters.
    followUps: [{ newChat: true }, 'Which city should our first pop-up stall be in?'],
    autoGo: false,
    graders: [
      notesSay(['only sell in Berlin']),
      notesSeenIn(2, ['only sell in Berlin']),
      answerIncludes(['Berlin']),
      logged('update_notes'),
      onlyChanged({ add: { documents: 1 } }),
      undoRestores(),
    ],
    reference: [
      change([['update_notes', { add: ['We only sell in Berlin for now.'] }]], 'remember: Berlin only'),
      answer('Proposed adding "We only sell in Berlin for now." to the agent notes; it waits in the preview. Every new chat reads them.'),
      answer('Berlin: the agent notes say we only sell in Berlin for now, so the first pop-up stall should be there.'),
    ],
    wrong: [answer('Noted.'), answer('Istanbul, where most of the stalls are.')],
  },
  {
    id: 'mem-02-whats-new-log',
    group: 'memory',
    set: 'capability',
    fixture: 'medium',
    setup: withLog,
    ask: 'What did Jonas change since yesterday?',
    graders: [toolSaid('whats_new', ['by Jonas Weber', 'From the change log']), cites([R('c3'), R('t41')]), answerIncludes(['Jonas']), noWriteAttempts()],
    reference: [
      call('whats_new', { since: '2026-11-02' }),
      answer('Since yesterday Jonas Weber changed the customer c3 "Office lunch groups in Kreuzberg" and moved the task t41 "Ship Saturday pilot" (from the change log).'),
    ],
    wrong: [call('whats_new', { since: '2026-11-02' }), answer('Jonas made a few changes yesterday.')],
  },
  {
    id: 'mem-03-viewer-chat-saved',
    group: 'memory',
    set: 'regression',
    fixture: 'medium',
    role: 'viewer',
    autoGo: false,
    ask: 'Which customers are validated?',
    graders: [chatSaved({ other: 'u-jonas' }), cites([R('c2'), R('c5'), R('c9')]), noWrites(), noWriteAttempts()],
    reference: [
      call('query', { kind: 'card', type: 'customer', status: 'validated' }),
      answer('Three customers are validated: c2 "Organic farmers in Beşiktaş (early)", c5 "Stall owners new to the city" and c9 "Organic farmers who pay cash". All three show `!`: they have no evidence behind them yet.'),
    ],
    wrong: [call('query', { kind: 'card', type: 'customer', status: 'validated' }), answer('A few of them are validated.')],
  },
]
