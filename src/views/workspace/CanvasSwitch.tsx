// The canvases in the breadcrumb (D-302, docs/specs/canvases.md): the workspace's name while it has one canvas, the
// canvas's after it; a click opens the prompt (D-222) with the canvases in order (`•` the one shown), then `+ new
// canvas`, rename, move up or down and delete for those who edit. Typing a name nobody has offers it as a new canvas.
// Naming (new or rename) turns the same prompt into its `>` line. Delete asks in the hazard confirm.
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { canvasPath } from '../../app/paths'
import { useAuth } from '../../data/auth'
import { addCanvas, canvasGoes, CANVAS_NAME_MAX, deleteCanvas, moveCanvas, onCanvas, renameCanvas, type Canvas } from '../../data/canvases'
import { canEditIn } from '../../data/workspaces'
import { HazardConfirm } from '../../ui/HazardConfirm'
import type { MenuEntry } from '../../ui/Menu'
import { ContextMenu } from './ContextMenu'
import { useWs, useWsNow } from './context'
import styles from './CanvasSwitch.module.css'

const UNDO_HINT = navigator.platform.toLowerCase().includes('mac') ? '⌘Z' : 'Ctrl+Z'
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

type Mode = 'list' | 'new' | 'rename'

export function CanvasCrumb({ label, current }: { label: string; current: boolean }) {
  const { wid, workspace, canvas, canvases, pieces } = useWs()
  const now = useWsNow()
  const { user } = useAuth()
  const editor = canEditIn(workspace, user?.id)
  const navigate = useNavigate()
  const [open, setOpen] = useState<{ at: [number, number]; mode: Mode } | null>(null)
  const [deleting, setDeleting] = useState<Canvas | null>(null)
  const shown = canvases.find((c) => c.id === canvas) ?? canvases[0]
  const go = (id: string) => navigate(canvasPath(wid, id))
  const close = () => setOpen(null)
  const make = async (name: string) => {
    close()
    const id = await addCanvas(wid, name, now().canvases, user?.id)
    go(id)
  }
  const taken = (name: string) => canvases.some((c) => c.name.toLowerCase() === name.toLowerCase())

  const list: MenuEntry[] = [
    { key: 'canvases', heading: 'canvases' },
    ...canvases.map((c, i) => ({
      key: c.id,
      label: c.name,
      glyph: c.id === canvas ? '•' : ' ',
      letter: i < 9 ? String(i + 1) : undefined,
      hint: plural(pieces.filter(onCanvas(c.id)).length, 'piece'),
      onSelect: () => c.id !== canvas && go(c.id),
    })),
    ...(editor
      ? [
          { key: 'rule', heading: '' },
          { key: 'new', label: 'new canvas', glyph: '+', letter: 'n', hint: 'name it', onSelect: () => (setOpen((o) => o && { ...o, mode: 'new' }), 'keep') },
          { key: 'rename', label: `rename "${shown.name}"`, glyph: '✎', letter: 'r', onSelect: () => (setOpen((o) => o && { ...o, mode: 'rename' }), 'keep') },
          ...(canvases.length > 1 && canvases[0].id !== shown.id ? [{ key: 'up', label: 'move it up', glyph: '↑', onSelect: () => void moveCanvas(wid, canvases, shown.id, -1) }] : []),
          ...(canvases.length > 1 && canvases[canvases.length - 1].id !== shown.id ? [{ key: 'down', label: 'move it down', glyph: '↓', onSelect: () => void moveCanvas(wid, canvases, shown.id, 1) }] : []),
          ...(canvases.length > 1 ? [{ key: 'delete', label: `delete "${shown.name}"`, glyph: '×', letter: 'x', danger: true, onSelect: () => setDeleting(shown) }] : []),
        ]
      : []),
  ]
  // Typed: a name nobody has is a new canvas.
  const offerNew = (typed: string): MenuEntry[] =>
    editor && typed && !taken(typed) ? [{ key: 'make', label: `new canvas "${typed.slice(0, CANVAS_NAME_MAX)}"`, glyph: '+', onSelect: () => void make(typed) }] : []
  const naming = (typed: string): MenuEntry[] =>
    !typed
      ? []
      : open?.mode === 'rename'
        ? [{ key: 'rename', label: `rename to "${typed.slice(0, CANVAS_NAME_MAX)}"`, glyph: '✎', onSelect: () => void renameCanvas(wid, shown, typed) }]
        : [{ key: 'make', label: `make "${typed.slice(0, CANVAS_NAME_MAX)}"`, glyph: '+', onSelect: () => void make(typed) }]

  const goes = deleting ? canvasGoes(deleting.id, now()) : null
  return (
    <>
      <button
        className={styles.crumb}
        data-current={current || undefined}
        aria-haspopup="menu"
        aria-expanded={!!open}
        aria-label={`Canvas: ${label}. Other canvases`}
        title={canvases.length > 1 ? 'canvases' : 'canvases: add another'}
        onClick={(e) => {
          if (open) return close()
          const r = e.currentTarget.getBoundingClientRect()
          setOpen({ at: [r.left - 12, r.bottom + 6], mode: 'list' })
        }}
      >
        {label}
        <span className={styles.caret} aria-hidden>
          {' '}▾
        </span>
      </button>
      {open &&
        createPortal(
          <div className={styles.layer}>
            {open.mode === 'list' ? (
              <ContextMenu key="list" at={open.at} what="canvas" items={list} onClose={close} prompt="go to a canvas…" more={offerNew} />
            ) : (
              <ContextMenu
                key={open.mode}
                at={open.at}
                what="canvas"
                items={[]}
                onClose={close}
                prompt={open.mode === 'new' ? 'name the new canvas…' : `rename "${shown.name}"…`}
                empty={`a name, up to ${CANVAS_NAME_MAX} letters · ↵`}
                more={naming}
              />
            )}
          </div>,
          document.body,
        )}
      {deleting && goes && (
        <HazardConfirm
          title={`delete the canvas "${deleting.name.length > 40 ? `${deleting.name.slice(0, 39)}…` : deleting.name}"?`}
          lines={[
            goes.pieces.length ? `${plural(goes.pieces.length, 'piece')} on it ${goes.pieces.length === 1 ? 'goes' : 'go'}${goes.gone.length ? `, with ${plural(goes.gone.length, 'card')}` : ''}, and the text on it.` : 'Nothing is on it but its text.',
            ...(goes.stay.length ? [`${plural(goes.stay.length, 'card')} also on planes elsewhere ${goes.stay.length === 1 ? 'stays' : 'stay'} there.`] : []),
            // A piece also on another canvas stays there (D-302's session 3).
            ...(goes.kept.length ? [`${plural(goes.kept.length, 'piece')} also on other canvases ${goes.kept.length === 1 ? 'stays' : 'stay'} there.`] : []),
            `${UNDO_HINT} brings it back.`,
          ]}
          confirm="delete"
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            const d = deleting
            setDeleting(null)
            // Off it first when it's the one shown: to its neighbour.
            const all = now().canvases
            if (d.id === canvas) go(all.find((c) => c.id !== d.id)!.id)
            void deleteCanvas(wid, d.id, now())
          }}
        />
      )}
    </>
  )
}
