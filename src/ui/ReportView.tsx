// The assistant's report on its stage (D-089, D-094, D-101): a report the chat just wrote (research, or a write-up,
// D-090), with the chat beside it. Drawn like the preview: one box with its title in the top edge (StageBox), who can
// see it, a stepper through its sections (‹ n/N ›, or n and p) lit both ways with the chat's report card, save / share /
// download, esc. Reports opened from the reports tab or a link don't come here: they open in the tab's reader (ReportReader, D-102).
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useChat } from '../ai/chat'
import { deleteReport, shareReport, useReport } from '../data/reports'
import { isOwnerOf } from '../data/workspaces'
import { Loading } from './Loading'
import { firebase } from '../data/firebase'
import { useHistory } from '../data/history'
import { useCanvas } from '../state/canvasStore'
import { usePreview } from '../views/workspace/preview'
import { unlightSection, useReportFocus, useStage } from '../views/workspace/stage'
import { sectionBy } from '../views/workspace/reportNav'
import { useWs } from '../views/workspace/context'
import { useNodeIndex } from '../views/workspace/nodeIndex'
import { UNDO_HINT } from '../views/workspace/useEditKeys'
import { downloadReport, ReportDocument } from '../views/reports/ReportDocument'
import { BarButton, Part, Rule, StageBox, Stepper } from './StageBox'
import styles from './ReportView.module.css'

export function ReportView() {
  // The report on the stage (D-094); `asked` is the one asked for, which the stage follows once the app has made way.
  const id = useStage((s) => s.reportId)
  const asked = useChat((s) => s.reportOpen)
  const ws = useWs()
  // The saved copy (D-090), its body fetched only now (D-098); until it arrives, or if saving failed, the chat's own.
  const loaded = useReport(ws.wid, id)
  const saved = loaded.report
  const message = useChat((s) => (id ? s.messages.find((m) => m.reportId === id) : undefined))
  const report = saved ?? message?.report
  const focus = useReportFocus()
  const index = useNodeIndex()
  const navigate = useNavigate()
  const [host, setHost] = useState<Element | null>(null)
  useEffect(() => setHost(document.querySelector('[data-app]')), [])
  const close = () => useChat.getState().showReport(null)

  // One screen at a time: a preview opening closes the report, and the other way round.
  useEffect(() => {
    if (asked === null) return
    usePreview.getState().close()
    return usePreview.subscribe((s) => s.sim && useChat.getState().showReport(null))
  }, [asked])
  // A new report on the stage starts with nothing lit.
  useEffect(() => useReportFocus.setState({ lit: null, step: null }), [id])
  useEffect(() => {
    if (id === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopImmediatePropagation()
        close()
        return
      }
      // n / p step through the sections, unless you're typing (the chat's prompt stays live beside the stage).
      const t = e.target as HTMLElement | null
      if (e.metaKey || e.ctrlKey || e.altKey || t?.closest('input, textarea, select, [contenteditable="true"]')) return
      const k = e.key.toLowerCase()
      if (k !== 'n' && k !== 'p') return
      e.preventDefault()
      sectionBy(k === 'n' ? 1 : -1)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [id])

  if (!host || id === null) return null
  // Saved and opened again from the chat's card: say so while its body comes, or that it's gone.
  if (!report) {
    if (!loaded.isLoading && !loaded.missing) return null
    return createPortal(
      <div className={styles.screen} role="dialog" aria-label="Report">
        <StageBox title={`report · ${loaded.summary?.title ?? ''}`}>
          <Rule long />
          <BarButton onClick={close} label="Close the report">
            esc
          </BarButton>
        </StageBox>
        <div className={styles.page}>
          {loaded.isLoading ? <Loading label="loading the report…" /> : <p className={styles.gone}>! This report was deleted.</p>}
        </div>
      </div>,
      host,
    )
  }
  const me = firebase?.auth.currentUser?.uid
  const mine = !!saved && saved.uid === me
  const isOwner = isOwnerOf(ws.workspace, me)
  const nameOf = (item: string) => index.get(item)?.title
  const open = (item: string) => {
    const it = index.get(item)
    if (!it) return
    close()
    useCanvas.getState().select(item)
    navigate(it.path)
  }
  const remove = () => {
    if (!saved) return
    close()
    deleteReport(ws.wid, saved.id).catch(() => useHistory.getState().say("Couldn't delete the report"))
    useHistory.getState().say(`Deleted "${report.title}" · ${UNDO_HINT} to undo`)
  }
  const kind = saved?.kind ?? message?.reportMeta?.kind ?? 'research'
  const unsaved = !saved && message && !message.research
  const status = saved
    ? saved.shared
      ? 'shared with the workspace'
      : 'only you can see it'
    : message?.reportError
      ? `not saved: ${message.reportError}`
      : unsaved
        ? 'not saved yet'
        : 'saving…'

  return createPortal(
    <div className={styles.screen} role="dialog" aria-label="Report">
      <StageBox title={`report · ${report.title}`}>
        <Part className={styles.status}>
          <span data-shared={saved?.shared || undefined} data-error={(!saved && !!message?.reportError) || undefined}>
            {status}
          </span>
        </Part>
        <Rule long />
        {report.sections.length > 0 && (
          <>
            <Stepper step={focus.step} steps={report.sections.length} noun={kind === 'research' ? 'question' : 'section'} onStep={sectionBy} />
            <Rule />
          </>
        )}
        {unsaved && (
          <BarButton primary onClick={() => useChat.getState().keepReport(message.id)}>
            save to reports
          </BarButton>
        )}
        {mine && <BarButton onClick={() => void shareReport(ws.wid, saved.id, !saved.shared)}>{saved.shared ? 'unshare' : 'share'}</BarButton>}
        {saved && (mine || (isOwner && saved.shared)) && <BarButton onClick={remove}>delete</BarButton>}
        <BarButton onClick={() => downloadReport(report, ws.workspace.name, nameOf, saved?.createdAt)}>download .md</BarButton>
        <Rule />
        <BarButton onClick={close} label="Close the report">
          esc
        </BarButton>
      </StageBox>
      <div className={styles.page} data-report-stage>
        <ReportDocument
          report={report}
          kind={kind}
          topic={saved?.topic ?? message?.reportMeta?.topic}
          who={saved && !mine ? saved.name : 'you'}
          createdAt={saved?.createdAt}
          nameOf={nameOf}
          onItem={open}
          lit={focus.lit}
          // Hovering a section lights its row in the chat's report card, and the reverse (AiChat's ReportCard).
          sectionProps={(i) => ({ onPointerEnter: () => useReportFocus.setState({ lit: i }), onPointerLeave: unlightSection })}
        />
      </div>
    </div>,
    host,
  )
}
