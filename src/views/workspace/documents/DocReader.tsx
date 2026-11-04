// A document read in a window over whatever's open: the way to one that nothing on a canvas shows (the agent's `open`,
// the finder's match in a document no list takes). A list or a piece stays where a document is worked with (D-232);
// this only reads it, with what takes it further: placing it on the canvas, downloading it.
import type { WithId } from '../../../data/hooks'
import { downloadDocument, useDocBody, type Doc, type DocBody } from '../../../data/documents'
import { useAuth } from '../../../data/auth'
import { Button } from '../../../ui/primitives/Button'
import { ButtonGroup } from '../../../ui/primitives/ButtonGroup'
import { Window } from '../../../ui/patterns/Window'
import { useWs } from '../canvas/context'
import { DocContent } from './DocContent'
import { useDocUi } from './Documents'
import styles from './DocReader.module.css'

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
}

export function DocReaderView({ d, body, loading, failed, me, onClose, onDownload, onPlace }: ViewProps) {
  return (
    <Window label={d.title} onClose={onClose} close className={styles.reader}>
      <div className={styles.page} data-scrolls>
        <DocContent d={d} body={body} loading={loading} failed={failed} me={me} links />
      </div>
      <ButtonGroup className={styles.foot}>
        {onPlace && (
          <Button title={d.shared ? 'put it on the canvas on its own' : 'put it on the canvas on its own (shares it; asks first)'} onClick={onPlace}>
            place on the canvas
          </Button>
        )}
        <Button title="save it as a .md file" onClick={onDownload}>
          download
        </Button>
      </ButtonGroup>
    </Window>
  )
}

export function DocReader() {
  const reading = useDocUi((s) => s.reading)
  const { wid, documents, workspace } = useWs()
  const { user } = useAuth()
  const d = documents.find((x) => x.id === reading) ?? null
  const body = useDocBody(wid, d)
  if (!d) return null
  const editor = !!user && ['owner', 'editor'].includes(workspace.roles[user.id] ?? '')
  return (
    <DocReaderView
      d={d}
      body={body.data}
      loading={body.isLoading}
      failed={!!body.error}
      me={user?.id}
      onClose={() => useDocUi.setState({ reading: null })}
      onDownload={() => void downloadDocument(wid, d)}
      onPlace={editor ? () => useDocUi.setState({ reading: null, placing: { docId: d.id } }) : undefined}
    />
  )
}
