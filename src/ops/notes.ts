// update_notes (S16, D-312; docs/specs/agent.md §4.7, §4.9 layer 4): the agent notes changed, by the agent (through
// the change tool's preview, one undo step with the rest of the turn) or a person (the notes view in the agent's
// column, data/agentNotes.ts through runUi). Writes the notes' summary and body whole (`documents/agent-notes` and its
// `content/body`); the first update makes them. Pure.
//
// How it's said: `add` (lines put at the end), `remove` (lines taken out, matched by their words), or `text` (the
// whole notes, replacing them). The result must fit NOTES_MAX. The notes' text must be loaded to add or remove (else
// the old text would be lost), and to replace them once they exist (else someone's edit could be overwritten unseen).
import { NOTES_ID, NOTES_MAX, NOTES_TITLE, notesOf, notesSummary, type NotesDoc } from '../model/notes'
import { norm } from '../agent/read/text'
import type { OpCtx, Plan } from './types'
import { refuse } from './util'

export type UpdateNotesArgs = { add?: string[] | string; remove?: string[] | string; text?: string; handle?: string }

const list = (v: string[] | string | undefined): string[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]).flatMap((x) => String(x).split('\n')).map((x) => x.trimEnd()).filter((x) => x.trim())
// A line as said in a list: `- …` unless it already is a heading, a list item or a quote.
const asItem = (l: string) => (/^\s*(#{1,6}\s|[-*+>]\s|\d+[.)]\s)/.test(l) ? l.trim() : `- ${l.trim()}`)
const bare = (l: string) => norm(l.replace(/^\s*([-*+>]|\d+[.)])\s+/, ''))

export function updateNotes(ctx: OpCtx, args: UpdateNotesArgs): Plan {
  const op = 'update_notes'
  const add = list(args.add)
  const remove = list(args.remove)
  const notes = notesOf(ctx.ws as never)
  if (args.text === undefined && !add.length && !remove.length) refuse(op, 'nothing to change in the agent notes', 'give add (lines to put at the end), remove (lines to take out) or text (the whole notes)')
  if (args.text !== undefined && (add.length || remove.length)) refuse(op, 'text replaces the whole notes, so it goes alone', 'either give the whole new text, or add/remove lines')
  let text: string
  if (args.text !== undefined) {
    // Replacing text you haven't seen would overwrite what someone wrote meanwhile: the notes must be loaded too.
    if (notes.doc && !notes.loaded) refuse(op, "the agent notes' text isn't loaded yet", 'try again in a moment')
    text = String(args.text).replace(/\r\n?/g, '\n').trimEnd()
  }
  else {
    if (!notes.loaded) refuse(op, "the agent notes' text isn't loaded yet", 'try again in a moment')
    let lines = notes.text ? notes.text.split('\n') : [`# ${NOTES_TITLE}`, '']
    for (const r of remove) {
      const at = lines.findIndex((l) => bare(l) === bare(r))
      if (at < 0) refuse(op, `the agent notes have no line "${r.slice(0, 80)}"`, `remove one of their lines as written: ${lines.filter((l) => l.trim() && !l.startsWith('#')).slice(0, 12).map((l) => JSON.stringify(l.slice(0, 60))).join(', ') || '(they have none)'}`)
      lines.splice(at, 1)
    }
    const have = new Set(lines.map(bare))
    const fresh = add.filter((l) => !have.has(bare(l)))
    if (fresh.length) {
      while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
      lines = [...lines, ...(lines.length && lines[lines.length - 1].startsWith('#') ? [''] : []), ...fresh.map(asItem)]
    }
    text = lines.join('\n').trimEnd()
  }
  if (text.length > NOTES_MAX) refuse(op, `the agent notes would be ${text.length} characters; they hold at most ${NOTES_MAX}`, 'keep them short: take out what no longer matters (remove), or say it in fewer words')
  if (notes.doc && notes.loaded && text === notes.text.trimEnd()) refuse(op, 'the agent notes already say that', 'nothing to change: leave update_notes out')
  const summary: NotesDoc = notesSummary(text, notes.doc as Partial<NotesDoc> | null, { uid: ctx.actor.uid, ...(ctx.actor.name ? { name: ctx.actor.name } : {}), agent: ctx.actor.agent }, ctx.now)
  const { ...fields } = summary as unknown as Record<string, unknown>
  return {
    op,
    label: notes.doc ? 'update the agent notes' : 'start the agent notes',
    writes: [
      { coll: 'documents', id: NOTES_ID, set: fields },
      { coll: 'docBodies', id: NOTES_ID, set: { text } },
    ],
    // The notes are made the first time (so undo takes them away again).
    ids: notes.doc ? {} : { [args.handle ?? '$notes']: NOTES_ID },
    meta: { kind: 'document', ids: [NOTES_ID] },
  }
}
