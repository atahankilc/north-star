// A document read in a window over whatever's open: the way to one that nothing on a canvas shows (the agent's `open`,
// the finder's match in a document no list takes). A list or a piece stays where a document is worked with (D-232);
// this reads it, with what takes it further: placing it on the canvas, downloading it, and writing a .md (D-373):
// `edit` turns the page into the editor in place (DocEditor, loaded then), `done` back.
import { lazy, Suspense } from 'react'
import type { WithId } from '../../../data/hooks'
import { downloadDocument, mayWriteDoc, renameDocument, useDocBody, writeDocumentText, type Doc, type DocBody } from '../../../data/documents'
import { useAuth } from '../../../data/auth'
import { DOC_LIMITS } from '../../../model/shapes'
import { Button } from '../../../ui/primitives/Button'
import { ButtonGroup } from '../../../ui/primitives/ButtonGroup'
import { CommitField } from '../../../ui/primitives/CommitField'
import { Window } from '../../../ui/patterns/Window'
import { useWs } from '../canvas/context'
import { DocContent, splitTitle } from './DocContent'
import { useDocUi } from './Documents'
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
}

export function DocReaderView({ d, body, loading, failed, me, onClose, onDownload, onPlace, editing = false, onEdit, onSave, onRename }: ViewProps) {
  const writing = editing && !!onSave
  const { head, rest } = splitTitle(body?.text ?? '', d.title)
  const editor = writing ? (
    <Suspense fallback={<p className={content.note}>loading the editor…</p>}>
      <DocEditor
        text={rest}
        label={`${d.title}: text`}
        autoFocus
        // The title's heading stays in front, as it came (renamed: the new title).
        onSave={(t) => onSave?.((head ? `# ${d.title}\n\n` : '') + t)}
      />
    </Suspense>
  ) : undefined
  const title =
    writing && onRename ? (
      <CommitField className={styles.titleField} value={d.title} onSave={(v) => v.trim() && onRename(v)} label="Document title" empty="undo" maxLength={DOC_LIMITS.title} />
    ) : undefined
  return (
    <Window label={d.title} onClose={onClose} close className={styles.reader}>
      <div className={styles.page} data-scrolls>
        <DocContent d={d} body={body} loading={loading} failed={failed} me={me} links title={title} editor={editor} />
      </div>
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
    </Window>
  )
}

export function DocReader() {
  const reading = useDocUi((s) => s.reading)
  const editing = useDocUi((s) => s.editing)
  const { wid, documents, workspace } = useWs()
  const { user } = useAuth()
  const d = documents.find((x) => x.id === reading) ?? null
  const body = useDocBody(wid, d)
  if (!d) return null
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
      onClose={() => useDocUi.setState({ reading: null, editing: false })}
      onDownload={() => void downloadDocument(wid, d)}
      onPlace={editor ? () => useDocUi.setState({ reading: null, editing: false, placing: { docId: d.id } }) : undefined}
      editing={writes && editing}
      onEdit={writes ? (on) => useDocUi.setState({ editing: on }) : undefined}
      onSave={writes ? (text) => void writeDocumentText(wid, d.id, text, { joinNew: !d.updatedAt || d.updatedAt === d.createdAt }) : undefined}
      onRename={d.uid === user?.id ? (title) => void renameDocument(wid, d.id, title) : undefined}
    />
  )
}
