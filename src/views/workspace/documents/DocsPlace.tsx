// Docs as a place (D-412, docs/specs/shell.md): every document you may see (the shared ones and your own, D-232),
// newest first, as rows (its kind, its title, who, how long). Beside the canvas, a row opens the document in the list's
// place (`‹ docs` back); as the page, the list on the left and the document read on the rest. Writing in one, sharing
// and the rest are the reader window's (`edit`, D-371, D-373). Folders come later (docs/specs/shell.md, step 3).
// DocsTools: the page's own actions, in the HUD's middle while Docs is the page: write a new one, upload, the finder.
import { useEffect, useMemo, useRef, useState } from 'react'
import { learn } from '../../../onboarding/events'
import type { WithId } from '../../../data/hooks'
import { newDocument, useDocBody, type Doc } from '../../../data/documents'
import { useAuth } from '../../../data/auth'
import { authorName } from '../../../model/words'
import { useWs } from '../canvas/context'
import { ago } from '../../../ui/foundation/ago'
import { Button } from '../../../ui/primitives/Button'
import { Label } from '../../../ui/primitives/Label'
import { Empty } from '../../../ui/primitives/Empty'
import { ToolButton } from '../../../ui/primitives/ToolButton'
import { DownloadIcon, WriteIcon } from '../../../ui/primitives/hudIcons'
import { CardRow } from '../cards/CardRow'
import { DocContent } from './DocContent'
import { readDoc, uploadFiles } from './Documents'
import styles from './DocsPlace.module.css'

const KIND_WORD: Record<Doc['kind'], string> = { markdown: 'md', report: 'report', image: 'image', pdf: 'pdf' }

function Reading({ d }: { d: WithId<Doc> }) {
  const { wid } = useWs()
  const { user } = useAuth()
  const body = useDocBody(wid, d)
  return <DocContent d={d} body={body.data} loading={body.isLoading} failed={!!body.error} me={user?.id} links />
}

export function DocsPlace({ page = false }: { page?: boolean }) {
  const { documents } = useWs()
  const docs = useMemo(() => [...(documents ?? [])].sort((a, b) => b.createdAt - a.createdAt), [documents])
  const [openId, setOpenId] = useState<string | null>(null)
  // Its lesson (onboarding: `docs`).
  useEffect(() => learn('docs-open'), [])
  const open = docs.find((d) => d.id === openId) ?? (page ? docs[0] : undefined)

  const list = (
    <div className={styles.list} data-scrolls>
      {docs.length === 0 && <Empty>No documents yet: write one, or upload a .md.</Empty>}
      {docs.map((d) => (
        <CardRow
          key={d.id}
          className={styles.row}
          title={d.title || 'untitled'}
          empty={!d.title}
          selected={page && d.id === open?.id}
          lead={<Label className={styles.kind}>{KIND_WORD[d.kind]}</Label>}
          end={
            <span className={styles.meta}>
              {d.name} · {ago(d.createdAt)}
              {d.shared ? '' : ' · only you'}
            </span>
          }
          onClick={() => setOpenId(d.id)}
        />
      ))}
    </div>
  )

  if (!page)
    return open ? (
      <div className={styles.scroll} data-scrolls>
        <div className={styles.back}>
          <Button onClick={() => setOpenId(null)}>‹ docs</Button>
          <Button onClick={() => readDoc(open.id)} title="open it in its window: edit, share, place, download">
            open ↗
          </Button>
        </div>
        <div className={styles.reading}>
          <Reading d={open} />
        </div>
      </div>
    ) : (
      list
    )

  return (
    <div className={styles.split}>
      {list}
      <div className={styles.page} data-scrolls>
        {open ? (
          <>
            <div className={styles.back}>
              <Button onClick={() => readDoc(open.id)} title="open it in its window: edit, share, place, download">
                open ↗
              </Button>
            </div>
            <div className={styles.readingWide}>
              <Reading d={open} />
            </div>
          </>
        ) : (
          <Empty className={styles.none}>Pick a document.</Empty>
        )}
      </div>
    </div>
  )
}

// The page's actions (the HUD's middle while Docs is the page): write a new document (private until shared), upload.
export function DocsTools() {
  const { wid } = useWs()
  const { user } = useAuth()
  const input = useRef<HTMLInputElement>(null)
  if (!user) return null
  const who = { uid: user.id, name: authorName(user) }
  return (
    <>
      <ToolButton label="Write a document" title="write a new document (only you see it until you share it)" onClick={() => void newDocument(wid, who).then((id) => readDoc(id, true))}>
        <WriteIcon />
      </ToolButton>
      <ToolButton label="Upload documents" title="add .md files (images and PDFs come with Storage)" onClick={() => input.current?.click()}>
        <DownloadIcon />
      </ToolButton>
      <input /* kit-ok: the hidden file picker the upload tool opens */
        ref={input}
        type="file"
        multiple
        accept=".md,.markdown,text/markdown,image/*,application/pdf"
        hidden
        className={styles.picker}
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = ''
          if (files.length) void uploadFiles(wid, who, files)
        }}
      />
    </>
  )
}
