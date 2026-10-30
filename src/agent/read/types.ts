// What the read layer reads (S10, D-312): the workspace snapshot the store holds (`getWs()`, a WorkspaceCtx) plus what
// the browser may have loaded beside it and the store doesn't carry. Everything optional past WorkspaceData, so a bare
// snapshot (a test, a preview's `project`) reads too; what's missing is said in the results, never guessed.
import type { WorkspaceData } from '../../data/workspaceData'
import type { DocBody } from '../../data/documents'
import type { ChangeEntry } from '../../model/changeLog'

// A member as the people list knows them (members/{uid}); their role is on the workspace.
export type MemberInfo = { uid: string; name: string; email?: string }

// One message of a comment thread (threads/{id}/messages), as far as the read layer needs it.
export type MessageInfo = { uid: string; name: string; text: string; createdAt: number }

export type ReadWs = WorkspaceData & {
  wid?: string
  workspace?: { name: string; description?: string; memberIds?: string[]; roles?: Record<string, string> }
  // The canvas shown.
  canvas?: string
  // The people list (members/{uid}), when loaded; else names are read off what people wrote (tasks, notes, threads).
  members?: MemberInfo[]
  // Comment threads' messages by thread id (layer 2), when loaded; else a thread reads as its last message.
  messages?: Record<string, MessageInfo[]>
  // Documents' text by document id (layer 3), when loaded; else a document reads as its title and first words.
  bodies?: Record<string, DocBody>
  // Cards' times and who made them, by card id: the snapshot's cards don't carry them.
  times?: Record<string, { createdAt?: number; updatedAt?: number; by?: string }>
  // The change log (S16, src/model/changeLog.ts: who changed which ids when, no text), newest last or in any order,
  // when loaded: whats_new reads it first and falls back to the items' times before it starts.
  changeLog?: ChangeEntry[]
  // The signed-in person's uid ("me" in filters), and now (ms) for today / overdue; the clock when unset.
  me?: string
  now?: number
}

// Every tool's answer: text for the model, and when there's more, how to get it or narrow it.
export type ToolResult = { text: string; more?: string }
