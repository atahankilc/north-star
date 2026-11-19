// Docs as a place (D-412, docs/specs/shell.md): every document you may see (the shared ones and your own, D-232),
// newest first, as rows (its kind, its title, who, how long). Beside the canvas, a row opens the document in the list's
// place (`‹ docs` back); as the page, the list on the left and the document read on the rest. Writing in one, sharing
// and the rest are the reader window's (`edit`, D-371, D-373). Folders come later (docs/specs/shell.md, step 3).
// DocsTools: the page's own actions, in the HUD's middle while Docs is the page: write a new one, upload, the finder.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { create } from 'zustand'
import { learn } from '../../../onboarding/events'
import type { WithId } from '../../../data/hooks'
import { newDocument, useDocBody, type Doc } from '../../../data/documents'
import { deleteFolder, makeFolder, moveDocument, renameFolder, type Folder } from '../../../data/folders'
import { roleOf } from '../../../data/workspaces'
import { NOTES_ID } from '../../../model/notes'
import { FOLDER_NAME_MAX } from '../../../model/limits'
import { plural } from '../../../model/words'
import { CommitField } from '../../../ui/primitives/CommitField'
import { Select } from '../../../ui/patterns/Select'
import { useAuth } from '../../../data/auth'
import { authorName } from '../../../model/words'
import { useWs } from '../canvas/context'
import { ago } from '../../../ui/foundation/ago'
import { Button } from '../../../ui/primitives/Button'
import { Label } from '../../../ui/primitives/Label'
import { Empty } from '../../../ui/primitives/Empty'
import { ToolButton } from '../../../ui/primitives/ToolButton'
import { BinIcon, DownloadIcon, EditIcon, FolderIcon, WriteIcon } from '../../../ui/primitives/hudIcons'
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

// May this person move a document between folders (firestore.rules: its author, or an owner or editor once it's shared).
const mayMoveDoc = (d: Pick<Doc, 'uid' | 'shared'> & { id: string }, me: string | undefined, role: string | undefined) =>
  d.id !== NOTES_ID && ((!!me && d.uid === me) || (d.shared && (role === 'owner' || role === 'editor')))

// Where Docs is: the folder open (null: the top) and the document read. Kept while Docs is closed and opened again.
export const useDocsAt = create<{ folder: string | null; open: string | null; renaming: string | null }>(() => ({ folder: null, open: null, renaming: null }))

const folderPath = (id: string | null, folders: WithId<Folder>[]) => {
  const out: WithId<Folder>[] = []
  for (let f = folders.find((x) => x.id === id), n = 0; f && n < folders.length; f = folders.find((x) => x.id === f!.parent), n++) out.unshift(f)
  return out
}
// How many documents are in a folder, its folders' too.
const countIn = (id: string, folders: WithId<Folder>[], docs: WithId<Doc>[]): number =>
  docs.filter((d) => d.folderId === id).length + folders.filter((f) => f.parent === id).reduce((n, f) => n + countIn(f.id, folders, docs), 0)
// A document whose folder is gone stands at the top.
const folderOf = (d: WithId<Doc>, folders: WithId<Folder>[]) => (d.folderId && folders.some((f) => f.id === d.folderId) ? d.folderId : null)

function Crumbs({ at, folders }: { at: string | null; folders: WithId<Folder>[] }) {
  return (
    <nav className={styles.crumbs} aria-label="Where in Docs">
      <Button link data-here={at === null || undefined} onClick={() => useDocsAt.setState({ folder: null, open: null })}>
        All files
      </Button>
      {folderPath(at, folders).map((f) => (
        <span key={f.id} className={styles.crumb}>
          <span className={styles.sep}>/</span>
          <Button link data-here={f.id === at || undefined} onClick={() => useDocsAt.setState({ folder: f.id, open: null })}>
            {f.name}
          </Button>
        </span>
      ))}
    </nav>
  )
}

function FolderRow({ f, count, editor }: { f: WithId<Folder>; count: number; editor: boolean }) {
  const { wid, folders, documents } = useWs()
  const { user } = useAuth()
  const role = roleOf(useWs().workspace, user?.id) ?? undefined
  const renaming = useDocsAt((s) => s.renaming === f.id)
  if (renaming)
    return (
      <div className={styles.folderEdit}>
        <FolderIcon />
        <CommitField line autoFocus select value={f.name} label="Folder name" maxLength={FOLDER_NAME_MAX} empty="undo" onSave={(v) => void renameFolder(wid, f.id, v)} onEnd={() => useDocsAt.setState({ renaming: null })} />
      </div>
    )
  return (
    <CardRow
      className={styles.row}
      data-folder
      title={f.name}
      lead={<FolderIcon />}
      end={
        <span className={styles.meta}>
          {plural(count, 'file')}
          {editor && (
            <span className={styles.rowTools}>
              <Button icon aria-label={`Rename ${f.name}`} title="rename" onClick={(e) => (e.stopPropagation(), useDocsAt.setState({ renaming: f.id }))}>
                <EditIcon />
              </Button>
              <Button
                icon
                tone="danger"
                aria-label={`Delete ${f.name}`}
                title="delete the folder: what's in it goes up a level (undo brings it back)"
                onClick={(e) => (e.stopPropagation(), void deleteFolder(wid, f.id, folders, documents, (d) => mayMoveDoc(d, user?.id, role)))}
              >
                <BinIcon />
              </Button>
            </span>
          )}
        </span>
      }
      onClick={() => useDocsAt.setState({ folder: f.id, open: null })}
    />
  )
}

function DocRow({ d, picked }: { d: WithId<Doc>; picked?: boolean }) {
  return (
    <CardRow
      className={styles.row}
      title={d.title || 'untitled'}
      empty={!d.title}
      selected={picked}
      lead={<Label className={styles.kind}>{KIND_WORD[d.kind]}</Label>}
      end={
        <span className={styles.meta}>
          {d.name} · {ago(d.createdAt)}
          {d.shared ? '' : ' · only you'}
        </span>
      }
      onClick={() => useDocsAt.setState({ open: d.id })}
    />
  )
}

// A document's own head in Docs: back, its folder (moved by who may), its window.
function DocHead({ d, back }: { d: WithId<Doc>; back?: string }) {
  const { wid, folders, workspace } = useWs()
  const { user } = useAuth()
  const may = mayMoveDoc(d, user?.id, roleOf(workspace, user?.id) ?? undefined)
  const options = [{ value: '', label: 'All files' }, ...folders.map((f) => ({ value: f.id, label: folderPath(f.id, folders).map((x) => x.name).join(' / ') }))]
  return (
    <div className={styles.back}>
      {back && <Button onClick={() => useDocsAt.setState({ open: null })}>‹ {back}</Button>}
      <span className={styles.docTools}>
        {may && folders.length > 0 && (
          <Select ariaLabel="The folder it's in" value={folderOf(d, folders) ?? ''} options={options} onChange={(v) => void moveDocument(wid, d.id, v || null)} />
        )}
        <Button onClick={() => readDoc(d.id)} title="open it in its window: edit, share, place, download">
          open ↗
        </Button>
      </span>
    </div>
  )
}

// The folders as a tree (the page's left), the one open lit, each opening and folding.
function Tree({ at }: { at: string | null }) {
  const { folders } = useWs()
  const [shut, setShut] = useState<Set<string>>(new Set())
  const kids = (id: string | null) => folders.filter((f) => (f.parent ?? null) === id && (id === null || folders.some((x) => x.id === id))).sort((a, b) => a.name.localeCompare(b.name))
  const branch = (id: string | null, depth: number): ReactNode =>
    kids(id).map((f) => {
      const open = !shut.has(f.id)
      const has = folders.some((x) => x.parent === f.id)
      return (
        <li key={f.id}>
          <div className={styles.treeRow} data-here={f.id === at || undefined} style={{ '--depth': depth } as CSSProperties}>
            <Button icon className={styles.fold} data-none={!has || undefined} aria-label={open ? 'fold' : 'open'} onClick={() => setShut((s) => (s.has(f.id) ? (s.delete(f.id), new Set(s)) : new Set(s.add(f.id))))}>
              {open ? '▾' : '▸'}
            </Button>
            <Button link className={styles.treeName} onClick={() => useDocsAt.setState({ folder: f.id, open: null })}>
              <FolderIcon /> {f.name}
            </Button>
          </div>
          {open && has && <ul className={styles.tree}>{branch(f.id, depth + 1)}</ul>}
        </li>
      )
    })
  // Folders whose parent is gone stand at the top.
  const orphans = folders.filter((f) => f.parent && !folders.some((x) => x.id === f.parent))
  return (
    <ul className={styles.tree} aria-label="Folders">
      <li>
        <div className={styles.treeRow} data-here={at === null || undefined} style={{ '--depth': 0 } as CSSProperties}>
          <span className={styles.fold} />
          <Button link className={styles.treeName} onClick={() => useDocsAt.setState({ folder: null, open: null })}>
            All files
          </Button>
        </div>
      </li>
      {branch(null, 1)}
      {orphans.map((f) => (
        <li key={f.id}>
          <div className={styles.treeRow} data-here={f.id === at || undefined} style={{ '--depth': 1 } as CSSProperties}>
            <span className={styles.fold} />
            <Button link className={styles.treeName} onClick={() => useDocsAt.setState({ folder: f.id, open: null })}>
              <FolderIcon /> {f.name}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}

export function DocsPlace({ page = false }: { page?: boolean }) {
  const { documents, folders, workspace } = useWs()
  const { user } = useAuth()
  const editor = roleOf(workspace, user?.id) === 'owner' || roleOf(workspace, user?.id) === 'editor'
  // Its lesson (onboarding: `docs`).
  useEffect(() => learn('docs-open'), [])
  const { folder: atRaw, open: openId } = useDocsAt()
  const at = atRaw && folders.some((f) => f.id === atRaw) ? atRaw : null
  const docs = useMemo(() => [...(documents ?? [])].sort((a, b) => b.createdAt - a.createdAt), [documents])
  const here = docs.filter((d) => folderOf(d, folders) === at)
  const subs = folders.filter((f) => (f.parent ?? null) === at || (at === null && f.parent && !folders.some((x) => x.id === f.parent))).sort((a, b) => a.name.localeCompare(b.name))
  const open = docs.find((d) => d.id === openId)
  const where = at ? (folders.find((f) => f.id === at)?.name ?? 'All files') : 'All files'

  const list = (
    <div className={styles.list} data-scrolls>
      {subs.map((f) => (
        <FolderRow key={f.id} f={f} count={countIn(f.id, folders, docs)} editor={editor} />
      ))}
      {here.map((d) => (
        <DocRow key={d.id} d={d} picked={page && d.id === open?.id} />
      ))}
      {subs.length === 0 && here.length === 0 && <Empty>{at ? 'Nothing in this folder yet.' : 'No documents yet: write one, or upload a .md.'}</Empty>}
    </div>
  )

  if (!page)
    return open ? (
      <div className={styles.scroll} data-scrolls>
        <DocHead d={open} back={where} />
        <div className={styles.reading}>
          <Reading d={open} />
        </div>
      </div>
    ) : (
      <>
        <Crumbs at={at} folders={folders} />
        {list}
      </>
    )

  return (
    <div className={styles.split} data-reading={open ? true : undefined}>
      <Tree at={at} />
      <div className={styles.middle}>
        <Crumbs at={at} folders={folders} />
        {list}
      </div>
      {open && (
        <div className={styles.page} data-scrolls>
          <DocHead d={open} />
          <div className={styles.readingWide}>
            <Reading d={open} />
          </div>
        </div>
      )}
    </div>
  )
}

// A document made while a folder is open goes into it.
const placeNew = async (wid: string, id: string) => {
  const folder = useDocsAt.getState().folder
  if (folder) await moveDocument(wid, id, folder)
}

// The page's actions (the HUD's middle while Docs is the page): write a new document (private until shared), upload.
export function DocsTools() {
  const { wid } = useWs()
  const { user } = useAuth()
  const input = useRef<HTMLInputElement>(null)
  const role = roleOf(useWs().workspace, user?.id) ?? undefined
  if (!user) return null
  const who = { uid: user.id, name: authorName(user) }
  return (
    <>
      {(role === 'owner' || role === 'editor') && (
        <ToolButton
          label="New folder"
          title="a new folder here"
          onClick={() => void makeFolder(wid, useDocsAt.getState().folder, 'untitled folder', user.id).then((id) => useDocsAt.setState({ renaming: id }))}
        >
          <FolderIcon />
        </ToolButton>
      )}
      <ToolButton label="Write a document" title="write a new document (only you see it until you share it)" onClick={() => void newDocument(wid, who).then(async (id) => (await placeNew(wid, id), readDoc(id, true)))}>
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
          if (files.length) void uploadFiles(wid, who, files).then((ids) => ids.forEach((id) => void placeNew(wid, id)))
        }}
      />
    </>
  )
}
