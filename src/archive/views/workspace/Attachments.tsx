// Files on an item (D-083), in its side panel: images as thumbnails, SVGs and PDFs as rows. Attach with the button or by
// dropping files anywhere on the panel. Images and SVGs are only ever shown through <img> (never inline), so an SVG's
// scripts can't run. Nothing at all shows where attachments aren't available yet (attachmentsAvailable).
import { AnimatePresence } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import {
  AttachmentError,
  attachFile,
  attachmentsAvailable,
  formatSize,
  isImage,
  removeAttachment,
  useAttachmentUrl,
} from '../../data/attachments'
import { useAuth } from '../../data/auth'
import { useHistory } from '../../data/history'
import type { WithId } from '../../data/hooks'
import type { Attachment, NodeType } from '../../data/model'
import { Appear } from '../../ui/Appear'
import { useWs } from './context'
import { UNDO_HINT } from './useEditKeys'
import styles from './Attachments.module.css'

type Node = { id: string; type: NodeType }
type Upload = { key: number; name: string; progress: number }

export function Attachments({ node }: { node: Node }) {
  return attachmentsAvailable ? <Section node={node} /> : null
}

let nextKey = 0

function Section({ node }: { node: Node }) {
  const { wid, attachments } = useWs()
  const { user } = useAuth()
  const [uploads, setUploads] = useState<Upload[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [viewing, setViewing] = useState<WithId<Attachment> | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const mine = attachments.filter((a) => a.nodeId === node.id).sort((a, b) => a.createdAt - b.createdAt)
  const images = mine.filter(isImage)
  const files = mine.filter((a) => !isImage(a))

  const add = (list: Iterable<File>) => {
    if (!user) return
    setErrors([])
    for (const file of list) {
      const key = nextKey++
      setUploads((u) => [...u, { key, name: file.name, progress: 0 }])
      attachFile(wid, node, file, user.id, (progress) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, progress } : x))))
        .catch((err) => setErrors((e) => [...e, explain(err, file.name)]))
        .finally(() => setUploads((u) => u.filter((x) => x.key !== key)))
    }
  }
  const addRef = useRef(add)
  addRef.current = add

  // Dropping files anywhere on the side panel attaches them.
  useEffect(() => {
    const panel = root.current?.closest<HTMLElement>('[data-side-panel]')
    if (!panel) return
    let depth = 0
    const hasFiles = (e: DragEvent) => Boolean(e.dataTransfer?.types.includes('Files'))
    const show = (on: boolean) => (on ? (panel.dataset.dropping = 'true') : delete panel.dataset.dropping)
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth++
      show(true)
    }
    const over = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) show(false)
    }
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      show(false)
      addRef.current(Array.from(e.dataTransfer?.files ?? []))
    }
    panel.addEventListener('dragenter', enter)
    panel.addEventListener('dragover', over)
    panel.addEventListener('dragleave', leave)
    panel.addEventListener('drop', drop)
    return () => {
      show(false)
      panel.removeEventListener('dragenter', enter)
      panel.removeEventListener('dragover', over)
      panel.removeEventListener('dragleave', leave)
      panel.removeEventListener('drop', drop)
    }
  }, [])

  const remove = (a: WithId<Attachment>) => {
    void removeAttachment(wid, a.id, a.name)
    useHistory.getState().say(`Removed "${a.name}" · ${UNDO_HINT} to undo`)
  }

  return (
    <div ref={root} className={styles.section} data-attachments>
      <div className={styles.head}>
        <span>
          attachments{mine.length > 0 && ` · ${mine.length}`}
        </span>
        <button className={styles.add} onClick={() => input.current?.click()}>
          + attach
        </button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,application/pdf,.png,.jpg,.jpeg,.webp,.gif,.svg,.pdf"
          onChange={(e) => {
            add(Array.from(e.target.files ?? []))
            e.target.value = ''
          }}
        />
      </div>

      {mine.length === 0 && uploads.length === 0 && (
        <p className={styles.hint}>Images, SVGs and PDFs up to 10 MB. Drop them on this panel or attach them here.</p>
      )}

      {images.length > 0 && (
        <ul className={styles.grid}>
          <AnimatePresence initial={false}>
            {images.map((a) => (
              <Appear as="li" key={a.id} className={styles.thumbCell}>
                <Thumb attachment={a} onOpen={() => setViewing(a)} />
                <button className={styles.removeThumb} onClick={() => remove(a)} aria-label={`Remove ${a.name}`}>
                  ×
                </button>
              </Appear>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {(files.length > 0 || uploads.length > 0) && (
        <ul className={styles.rows}>
          <AnimatePresence initial={false}>
            {files.map((a) => (
              <Appear as="li" key={a.id} className={styles.row}>
                <FileRow attachment={a} onOpen={() => setViewing(a)} />
                <button className={styles.remove} onClick={() => remove(a)} aria-label={`Remove ${a.name}`}>
                  ×
                </button>
              </Appear>
            ))}
          </AnimatePresence>
          {uploads.map((u) => (
            <li key={u.key} className={styles.row} aria-live="polite">
              <span className={styles.glyph} aria-hidden>
                ↑
              </span>
              <span className={styles.name}>{u.name}</span>
              <span className={styles.progress} role="progressbar" aria-valuenow={Math.round(u.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                <span className={styles.bar} style={{ width: `${u.progress * 100}%` }} />
              </span>
              <span className={styles.size}>{Math.round(u.progress * 100)}%</span>
            </li>
          ))}
        </ul>
      )}

      {errors.map((e, i) => (
        <p key={i} className={styles.error} role="alert">
          ! {e}
        </p>
      ))}

      <Lightbox attachment={viewing} onClose={() => setViewing(null)} />
    </div>
  )
}

function explain(err: unknown, name: string): string {
  if (err instanceof AttachmentError) return err.message
  const code = (err as { code?: string }).code
  if (code === 'storage/unauthorized') return `${name} was refused: only members can attach files, up to 10 MB, images and PDFs only.`
  if (code === 'storage/retry-limit-exceeded') return `${name} couldn't be uploaded: the connection kept dropping. Try again.`
  if (code === 'permission-denied') return `${name} was uploaded but couldn't be saved on the item. Try again.`
  return `${name} couldn't be uploaded. Try again.`
}

function Thumb({ attachment: a, onOpen }: { attachment: WithId<Attachment>; onOpen: () => void }) {
  // The small thumbnail when there is one; the full image loads only in the lightbox.
  const thumb = useAttachmentUrl(a.thumbPath ?? null)
  const thumbGone = thumb.state === 'missing' || thumb.state === 'failed'
  const full = useAttachmentUrl(!a.thumbPath || thumbGone ? a.path : null)
  const file = a.thumbPath && !thumbGone ? thumb : full
  if (file.state === 'missing' || file.state === 'failed') {
    return (
      <span className={styles.missing} title={a.name}>
        {file.state === 'missing' ? 'file missing' : "couldn't load"}
      </span>
    )
  }
  return (
    <button className={styles.thumb} data-nav onClick={onOpen} aria-label={`View ${a.name}`} title={`${a.name} · ${formatSize(a.size)}`}>
      {file.url && <img src={file.url} alt="" loading="lazy" draggable={false} />}
    </button>
  )
}

function FileRow({ attachment: a, onOpen }: { attachment: WithId<Attachment>; onOpen: () => void }) {
  const file = useAttachmentUrl(a.path)
  const pdf = a.contentType === 'application/pdf'
  const label = (
    <>
      <span className={styles.glyph} aria-hidden>
        {pdf ? '▤' : '◇'}
      </span>
      <span className={styles.name}>{a.name}</span>
    </>
  )
  return (
    <>
      {file.state === 'ready' && file.url ? (
        pdf ? (
          // PDFs open in the browser's own viewer, in a new tab.
          <a className={styles.open} href={file.url} target="_blank" rel="noopener noreferrer" title={`Open ${a.name}`}>
            {label}
          </a>
        ) : (
          <button className={styles.open} data-nav onClick={onOpen} title={`View ${a.name}`}>
            {label}
          </button>
        )
      ) : (
        <span className={styles.open} data-dim>
          {label}
        </span>
      )}
      <span className={styles.size}>
        {file.state === 'missing' ? 'file missing' : file.state === 'failed' ? "couldn't load" : formatSize(a.size)}
      </span>
    </>
  )
}

// A native <dialog>, closed until an image is picked; Esc or a click outside the picture closes it.
function Lightbox({ attachment: a, onClose }: { attachment: WithId<Attachment> | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const file = useAttachmentUrl(a?.path ?? null)

  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (a && !d.open) d.showModal()
    if (!a && d.open) d.close()
  }, [a])

  return (
    <dialog
      ref={dialog}
      className={styles.lightbox}
      onClose={onClose}
      // Esc belongs to the dialog here, not to the board (deselect, stop following).
      onKeyDown={(e) => e.key === 'Escape' && e.stopPropagation()}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-label={a ? a.name : 'Attachment'}
    >
      {a && (
        <figure className={styles.figure}>
          {file.url ? (
            <img className={styles.full} src={file.url} alt={a.name} />
          ) : (
            <span className={styles.missing}>{file.state === 'loading' ? 'loading' : 'file missing'}</span>
          )}
          <figcaption className={styles.caption}>
            <span className={styles.name}>{a.name}</span>
            <span className={styles.size}>
              {a.width && a.height ? `${a.width} × ${a.height} · ` : ''}
              {formatSize(a.size)}
            </span>
            <button className={styles.close} onClick={onClose} aria-label="Close">
              [×]
            </button>
          </figcaption>
        </figure>
      )}
    </dialog>
  )
}
