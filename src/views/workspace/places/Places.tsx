// A place beside the canvas, and a place as the page (D-412, docs/specs/shell.md).
// - PlaceColumn: a column on the left ground, beside the HUD's rail (EdgeColumn, D-387, D-395): the place's name and
//   its tools in the head with `full` and `×`; its right edge dragged.
// - PlacePage: the place in the canvas's place, in the main sheet (it reads the sheet's edges, `data-sheet`): under the
//   breadcrumb's bar, clear of the HUD's buttons on the left; `beside the canvas` and `×` in its head, Escape back to
//   the canvas. The canvas stays mounted under it, hidden (CanvasBehind), so its camera and selection are as they were.
// - Places: what WorkspaceScreen mounts: Tasks' and Docs' column or page (Talk draws its own, ThreadInbox, into the
//   page's host).
import { useRef, type ReactNode } from 'react'
import { EdgeColumn } from '../../../ui/patterns/EdgeColumn'
import { PanelHead } from '../../../ui/patterns/PanelHead'
import { Button } from '../../../ui/primitives/Button'
import { DragLine } from '../../../ui/primitives/DragLine'
import { stopCanvas } from '../../../ui/foundation/canvasGuard'
import { useEscapeLayer } from '../../../ui/foundation/useEscapeLayer'
import { tokenPx } from '../../../styles/cssToken'
import { AnimatePresence } from 'motion/react'
import { closePlace, dragWidth, PLACE_NAME, setPage, usePlace, type Place } from './placeStore'
import { TasksPlace } from '../deck/TasksPlace'
import { DocsPlace } from '../documents/DocsPlace'
import { usePageHost } from './pageHost'
import styles from './Places.module.css'


function PlaceColumn({ place, tools, children }: { place: Place; tools?: ReactNode; children: ReactNode }) {
  const width = usePlace((s) => s.width)
  return (
    <EdgeColumn
      side="left"
      offset="var(--sheet-rail-w)"
      width={width ? `${width}px` : undefined}
      label={PLACE_NAME[place]}
      onClose={closePlace}
      className={styles.column}
      data-learn={`place-${place}`}
      data-off-space
      data-viewer-ok
    >
      <DragLine at="right" label={`${PLACE_NAME[place]}'s width`} onDrag={(e) => dragWidth(tokenPx('--sheet-rail-w'), e.clientX)} />
      <PanelHead
        kind={PLACE_NAME[place]}
        tools={
          <>
            {tools}
            <Button onClick={() => setPage(true)} title="as the page, in the canvas's place">
              full
            </Button>
          </>
        }
        onClose={closePlace}
      />
      {children}
    </EdgeColumn>
  )
}

function PlacePage({ place, head = true, tools, children }: { place: Place; head?: boolean; tools?: ReactNode; children: ReactNode }) {
  const box = useRef<HTMLElement>(null)
  useEscapeLayer(closePlace, { root: box })
  return (
    <section
      ref={box}
      {...stopCanvas}
      className={styles.page}
      data-sheet
      role="dialog" /* kit-ok: the page in the canvas's place (D-412): the canvas's keys and wheel step aside for it */
      aria-label={PLACE_NAME[place]}
      data-learn={`page-${place}`}
      data-off-space
      data-viewer-ok
    >
      {head && (
        <PanelHead
          kind={PLACE_NAME[place]}
          tools={
            <>
              {tools}
              <Button onClick={() => setPage(false)} title="beside the canvas again">
                beside the canvas
              </Button>
            </>
          }
          onClose={closePlace}
        />
      )}
      <div className={styles.pageBody}>{children}</div>
    </section>
  )
}

// The canvas while a place is the page: still there, unseen.
export function CanvasBehind({ children }: { children: ReactNode }) {
  const hidden = usePlace((s) => !!s.open && s.page)
  return (
    <div className={styles.behind} data-hidden={hidden || undefined} aria-hidden={hidden || undefined}>
      {children}
    </div>
  )
}

function TalkHost() {
  return <div ref={(el) => usePageHost.setState({ el })} className={styles.talkHost} />
}

export function Places({ editor }: { editor: boolean }) {
  const { open, page } = usePlace()
  return (
    <>
      {open && page && (
        <PlacePage place={open} head={open !== 'talk'}>
          {open === 'talk' ? <TalkHost /> : open === 'tasks' ? <TasksPlace page editor={editor} /> : <DocsPlace page />}
        </PlacePage>
      )}
      <AnimatePresence>
        {open === 'tasks' && !page && (
          <PlaceColumn key="tasks" place="tasks">
            <TasksPlace editor={editor} />
          </PlaceColumn>
        )}
        {open === 'docs' && !page && (
          <PlaceColumn key="docs" place="docs">
            <DocsPlace />
          </PlaceColumn>
        )}
      </AnimatePresence>
    </>
  )
}
