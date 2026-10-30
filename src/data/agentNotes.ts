// The agent notes in the browser (S16, D-312; docs/specs/agent.md §4.7; the shape and helpers in src/model/notes.ts):
// one shared markdown document per workspace (`documents/agent-notes` + `content/body`). Its summary arrives with the
// other documents (it's always shared, so useDocuments has it); its text is read here, live, once the summary is there
// (the body's rule reads the summary: a listener opened before it exists would be refused and never come back).
//
// People edit it in the agent's column (saveNotes: the same op the agent proposes, update_notes, through runUi: one
// undo step, as the person); the agent proposes changes through its preview (src/agent/changeset.ts).
import { doc, onSnapshot } from 'firebase/firestore'
import { db, firebase, isDemo } from './firebase'
import { runUi } from '../ops/firestore'
import { updateNotes } from '../ops/notes'
import { NOTES_ID } from '../model/notes'

export { NOTES_ID, NOTES_TITLE, NOTES_MAX, notesOf, isNotesDoc } from '../model/notes'

// The notes' text, live: `cb(text)` on every change (null while it isn't loaded or there are none). Returns the stop.
export function watchNotes(wid: string, cb: (text: string | null) => void): () => void {
  if (!firebase || isDemo) return () => {}
  return onSnapshot(
    doc(db(), 'workspaces', wid, 'documents', NOTES_ID, 'content', 'body'),
    (snap) => cb(snap.exists() ? String((snap.data() as { text?: unknown }).text ?? '') : null),
    () => cb(null),
  )
}

// A person's edit: the whole text, one undo step, keyed so typing bursts merge. `seen`: the text they started from (the
// store's snapshot doesn't carry it; null when there are no notes yet).
export function saveNotes(wid: string, text: string, seen: string | null): Promise<void> {
  return runUi(wid, (ctx) => [updateNotes(seen == null ? ctx : { ...ctx, ws: { ...ctx.ws, bodies: { [NOTES_ID]: { text: seen } } } as typeof ctx.ws }, { text })], { label: 'edit the agent notes', key: `notes:${wid}` })
}
