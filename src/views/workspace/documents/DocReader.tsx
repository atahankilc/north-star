// A document read in a window over whatever's open: the way to one that nothing on a canvas shows (the agent's `open`,
// the finder's match in a document no list takes). A list or a piece stays where a document is worked with (D-232);
// this reads it, with what takes it further: placing it on the canvas, downloading it, and writing a .md (D-373):
// `edit` turns the page into the editor in place (DocEditor, loaded then), `done` back. Written together (D-374): the
// editor is the shared text (liveTransport.ts), others' carets come through presence, and the head shows who's writing.
// Beside the agent (D-382): what the agent wrote is read docked to the left of its column, the whole height, no shade,
// so the chat and its one `create` stay where they are. Its draft (D-381) is read there before it's made; the
// preview's `create` makes it and the same page goes on to the document made, nothing more to press.
import { lazy, Suspense, useEffect, useMemo } from 'react'
import type { WithId } from '../../../data/hooks'
import { downloadDocument, mayWriteDoc, renameDocument, useDocBody, writeDocumentText, type Doc, type DocBody } from '../../../data/documents'
import { useAuth } from '../../../data/auth'
import { caretsIn, onCarets, presenceColor, setPresenceDoc, usePresence, type Peer } from '../../../data/presence'
import { firestoreLive } from '../../../data/liveTransport'
import { themeAccent } from '../../../state/theme'
import { Avatar } from '../../../ui/primitives/Avatar'
import type { LiveSetup } from './DocEditor'
import { DOC_LIMITS } from '../../../model/shapes'
import { Button } from '../../../ui/primitives/Button'
import { ButtonGroup } from '../../../ui/primitives/ButtonGroup'
import { CommitField } from '../../../ui/primitives/CommitField'
import { Window } from '../../../ui/patterns/Window'
import { EdgeColumn } from '../../../ui/patterns/EdgeColumn'
import { PanelHead } from '../../../ui/patterns/PanelHead'
import { useWs } from '../canvas/context'
import { DocContent, splitTitle } from './DocContent'
import { useDocUi, type DocDraft } from './Documents'
import { wordsOf } from '../../../model/notes'
import styles from './DocReader.module.css'
import content from './DocContent.module.css'

const DocEditor = lazy(() => import('./DocEditor'))

type ViewProps = {
  d: WithId<Doc>
  body: DocBody | null
  loading?: boolean
  failed?: boolean
  me?: string
  onClose: () => void
  onDownload: () => void
  // Left out for who can't change the canvas.
  onPlace?: () => void
  // Writing it (D-373): left out for who may not.
  editing?: boolean
  onEdit?: (editing: boolean) => void
  onSave?: (text: string) => void
  // Its author renames it there.
  onRename?: (title: string) => void
  // Written together (D-374): the shared text while editing, and who else is writing in it now.
  live?: LiveSetup
  writers?: Peer[]
  // The agent's draft (D-381): not made yet, made from the agent's preview.
  draft?: boolean
  // Docked beside the agent's column (D-382), not a window.
  docked?: boolean
}

export function DocReaderView({ d, body, loading, failed, me, onClose, onDownload, onPlace, editing = false, onEdit, onSave, onRename, live, writers = [], draft = false, docked = false }: ViewProps) {
  // Only on its own text, once it's read: what the page opens with seeds the shared text (D-374).
  const writing = editing && !!onSave && !!body
  const { head, rest } = splitTitle(body?.text ?? '', d.title)
  const editor = writing ? (
    <Suspense fallback={<p className={content.note}>loading the editor…</p>}>
      <DocEditor
        // A page per document: another one opened while writing gets its own (never the first one's text).
        key={d.id}
        text={rest}
        label={`${d.title}: text`}
        autoFocus
        live={live}
        // The title's heading stays in front, as it came (renamed: the new title).
        onSave={(t) => onSave?.((head ? `# ${d.title}\n\n` : '') + t)}
      />
    </Suspense>
  ) : undefined
  const title =
    writing && onRename ? (
      <CommitField className={styles.titleField} value={d.title} onSave={(v) => v.trim() && onRename(v)} label="Document title" empty="undo" maxLength={DOC_LIMITS.title} />
    ) : undefined
  const page = (
    <div className={styles.page} data-scrolls>
      <DocContent d={d} body={body} loading={loading} failed={failed} me={me} links title={title} editor={editor} people={people(writers)} />
    </div>
  )
  const foot = draft ? (
    <p className={styles.draftNote}>not made yet · create it in the agent&apos;s preview →</p>
  ) : (
    <ButtonGroup className={styles.foot}>
      {writing ? (
        <Button tone="primary" title="back to reading it (it's saved as you type)" onClick={() => onEdit?.(false)}>
          done
        </Button>
      ) : (
        <>
          {onSave && onEdit && (
            <Button title="write in it, on the page as it reads" onClick={() => onEdit(true)}>
              edit
            </Button>
          )}
          {onPlace && (
            <Button title={d.shared ? 'put it on the canvas on its own' : 'put it on the canvas on its own (shares it; asks first)'} onClick={onPlace}>
              place on the canvas
            </Button>
          )}
          <Button title="save it as a .md file" onClick={onDownload}>
            download
          </Button>
        </>
      )}
    </ButtonGroup>
  )
  if (docked)
    return (
      <EdgeColumn label={d.title} onClose={onClose} offset="var(--ai-w, 0px)" width="var(--doc-beside-w)" className={styles.beside} data-doc-beside>
        <PanelHead className={styles.besideHead} kind={draft ? "the agent's draft" : 'document'} tone={draft ? 'var(--accent-cyan)' : undefined} onClose={onClose} />
        {page}
        {foot}
      </EdgeColumn>
    )
  return (
    <Window label={d.title} onClose={onClose} close className={styles.reader}>
      {page}
      {foot}
    </Window>
  )
}

// Who's writing in it now (D-374): their squares, as people here draws them, a name on hover.
function people(writers: Peer[]) {
  if (!writers.length) return undefined
  return (
    <span className={styles.writers} title={`writing in it: ${writers.map((p) => p.name).join(', ')}`} aria-label={`${writers.length} writing in it`}>
      {writers.map((p) => (
        <Avatar key={p.uid} name={p.name} color={themeAccent(p.color)} photo={p.photo} size="sm" away={p.away} />
      ))}
    </span>
  )
}

export function DocReader() {
  const reading = useDocUi((s) => s.reading)
  const draft = useDocUi((s) => s.draft)
  const beside = useDocUi((s) => s.beside)
  const { documents } = useWs()
  const d = documents.find((x) => x.id === reading) ?? null
  if (!d && draft) return <DraftReader draft={draft} />
  // One reader per document: its body is read afresh (a listener moved to another path still holds the last one's
  // text for a moment, and writing would open on it, D-374).
  return d ? <Reading key={d.id} d={d} docked={beside} /> : null
}

// The agent's draft read as the document it would be (D-381), beside its column (D-382): yours, now, its words counted;
// nothing fetched or written.
function DraftReader({ draft }: { draft: DocDraft }) {
  const { user } = useAuth()
  const me = user?.id ?? ''
  const now = Date.now()
  const d: WithId<Doc> = { id: `draft-${draft.item}`, kind: 'markdown', title: draft.title, origin: 'assistant', uid: me, name: user?.name ?? '', shared: draft.shared, contentType: 'text/markdown', size: draft.text.length, words: wordsOf(draft.text), createdAt: now, updatedAt: now }
  return (
    <DocReaderView
      d={d}
      body={{ text: draft.text }}
      me={me}
      onClose={() => useDocUi.setState({ draft: null, beside: false })}
      onDownload={() => {}}
      draft
      docked
    />
  )
}

function Reading({ d, docked }: { d: WithId<Doc>; docked: boolean }) {
  const editing = useDocUi((s) => s.editing)
  const { wid, workspace } = useWs()
  const { user } = useAuth()
  const body = useDocBody(wid, d)
  const peers = usePresence((s) => s.peers)
  const myColor = usePresence((s) => s.myColor)
  const id = d.id
  const uid = user?.id
  const writing = !!uid && editing && mayWriteDoc(d, uid, user ? workspace.roles[user.id] : undefined)
  const name = user?.name || user?.email || 'Someone'
  // The shared text and the carets, made once per document opened for writing.
  const live = useMemo<LiveSetup | undefined>(() => {
    if (!writing || !id || !uid) return undefined
    return {
      transport: () => firestoreLive(wid, id, uid),
      user: { name, color: themeAccent(myColor ?? presenceColor(uid)) },
      carets: {
        list: () => caretsIn(id).map((c) => ({ ...c, color: themeAccent(c.color) })),
        listen: onCarets,
        here: (c) => setPresenceDoc({ id, ...(c ?? {}) }),
        gone: () => setPresenceDoc(null),
      },
    }
    // The colour is read when it opens (it's settled by then); a new one would reopen the shared text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [writing, id, uid, wid, name])
  useEffect(() => {
    if (!writing || !id) return
    setPresenceDoc({ id })
    return () => setPresenceDoc(null)
  }, [writing, id])
  const role = user ? workspace.roles[user.id] : undefined
  const editor = role === 'owner' || role === 'editor'
  const writes = mayWriteDoc(d, user?.id, role)
  return (
    <DocReaderView
      d={d}
      body={body.data}
      loading={body.isLoading}
      failed={!!body.error}
      me={user?.id}
      onClose={() => useDocUi.setState({ reading: null, editing: false, beside: false })}
      onDownload={() => void downloadDocument(wid, d)}
      onPlace={editor ? () => useDocUi.setState({ reading: null, editing: false, beside: false, placing: { docId: d.id } }) : undefined}
      editing={writes && editing}
      onEdit={writes ? (on) => useDocUi.setState({ editing: on }) : undefined}
      onSave={writes ? (text) => void writeDocumentText(wid, d.id, text) : undefined}
      onRename={d.uid === user?.id ? (title) => void renameDocument(wid, d.id, title) : undefined}
      live={live}
      writers={peers.filter((p) => p.doc?.id === d.id)}
      docked={docked}
    />
  )
}
