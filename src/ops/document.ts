// create_document (S17, D-312; docs/specs/agent.md §4.10's document skills: `/swot`, `/one-pager`, `/pitch`,
// `/lean-canvas`, `/interview`): a markdown document written from the workspace, the person's own (D-232), private
// unless `share` says otherwise. The same shape the app writes for an uploaded .md (data/documents.ts' uploadMarkdown):
// `documents/{id}` (the summary) and its `content/body` ({ text }), in one plan, so one undo step takes both away.
// origin 'assistant' when the agent writes it. firestore.rules already let any member create their own document and its
// body (validDoc, mayCreate); validate checks the same shape (validate.ts, documents). Pure.
import { DOC_LIMITS } from '../model/shapes'
import { bytesOf, excerptOf, wordsOf } from '../model/notes'
import type { OpCtx, Plan } from './types'
import { handleOf, refuse } from './util'

export type CreateDocumentArgs = {
  title: string
  // Markdown.
  text: string
  // Shared with every member (left out: private, only its author sees it).
  share?: boolean
  handle?: string
}

// A title cut for an undo line.
const cut = (t: string) => (t.length > 40 ? `${t.slice(0, 39)}…` : t)

const OP = 'create_document'

// The fields a document an op writes may have (a subset of firestore.rules' validDoc).
export const DOC_FIELDS = ['kind', 'title', 'excerpt', 'origin', 'uid', 'name', 'shared', 'contentType', 'size', 'words', 'createdAt', 'updatedAt'] as const

export function createDocument(ctx: OpCtx, args: CreateDocumentArgs): Plan {
  const title = String(args.title ?? '').replace(/\s+/g, ' ').trim()
  if (!title) refuse(OP, 'a document needs a title', 'give it a short title ("SWOT: Pazar")')
  const text = String(args.text ?? '').replace(/\r\n?/g, '\n').trimEnd()
  if (!text.trim()) refuse(OP, 'the document has no text', 'give its text as Markdown')
  if (bytesOf(text) > DOC_LIMITS.text) refuse(OP, `the text is over ${DOC_LIMITS.text / 1000} KB`, 'make it shorter, or split it into two documents')
  const id = ctx.newId()
  const now = ctx.now
  const excerpt = excerptOf(text)
  const summary: Record<string, unknown> = {
    kind: 'markdown',
    title: title.slice(0, DOC_LIMITS.title),
    ...(excerpt ? { excerpt } : {}),
    origin: ctx.actor.agent ? 'assistant' : 'upload',
    uid: ctx.actor.uid,
    name: (ctx.actor.name || 'someone').slice(0, 200),
    shared: !!args.share,
    contentType: 'text/markdown',
    size: bytesOf(text),
    words: wordsOf(text),
    createdAt: now,
    updatedAt: now,
  }
  return {
    op: OP,
    label: `write the document "${cut(title)}"`,
    writes: [
      { coll: 'documents', id, set: summary },
      { coll: 'docBodies', id, set: { text } },
    ],
    ids: { [handleOf(args)]: id },
    meta: { kind: 'document', ids: [id] },
  }
}
