// /workspaces/<id>/reports (D-090): the research reports you may see, newest first: your own (only you, until you share
// one) and those others shared. A row opens the report screen (D-089); `?report=<id>` opens it from a link. `upload .md`
// (or a dropped file) adds your own (D-091). The list loads only here, 20 at a time, as small summaries; a report's
// body loads when it's opened (D-098).
import { useEffect, useRef, useState, type DragEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useChat } from '../../ai/chat'
import { reportPath, workspacePath } from '../../app/paths'
import { firebase } from '../../data/firebase'
import { setPresenceSelection } from '../../data/presence'
import { useCanvas } from '../../state/canvasStore'
import { useHistory } from '../../data/history'
import type { WithId } from '../../data/hooks'
import type { ReportSummary } from '../../data/model'
import { deleteReport, newReportId, saveReport, sectionCount, shareReport, sourceCount, useReportList, useReportSummary } from '../../data/reports'
import { isOwnerOf } from '../../data/workspaces'
import { Loading } from '../../ui/Loading'
import { parseReportMarkdown, REPORT_FILE_MAX } from '../../io/reportMarkdown'
import { Appear } from '../../ui/Appear'
import { DecodeText } from '../../ui/DecodeText'
import { useWs } from '../workspace/context'
import { useNodeIndex } from '../workspace/nodeIndex'
import { RowPeers } from '../workspace/PeerMarks'
import { UNDO_HINT } from '../workspace/useEditKeys'
import styles from './ReportsView.module.css'

const day = (t: number) => new Date(t).toLocaleDateString('en-CA')
const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function ReportsView() {
  const ws = useWs()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const linked = params.get('report')
  const open = useChat((s) => s.reportOpen)
  const me = firebase?.auth.currentUser?.uid
  const isOwner = isOwnerOf(ws.workspace, me)
  const reports = useReportList(ws.wid, me)

  // Others see which report you have open, like a selected card (D-068); closing hands back your card selection.
  useEffect(() => {
    if (!open) return
    setPresenceSelection(open)
    return () => setPresenceSelection(useCanvas.getState().selectedId)
  }, [open])

  // A link opens its report (it may be far down the list); the screen closing takes `?report=` away again (ReportView).
  const linkedReport = useReportSummary(ws.wid, linked)
  const found = !!linked && !!linkedReport.data
  const notFound = !!linked && !linkedReport.isLoading && !linkedReport.data
  useEffect(() => {
    if (found) useChat.getState().showReport(linked)
  }, [found, linked])

  const show = (r: WithId<ReportSummary>) => {
    useChat.getState().showReport(r.id)
    navigate(reportPath(ws.wid, r.id), { replace: true })
  }
  const remove = (r: WithId<ReportSummary>) => {
    deleteReport(ws.wid, r.id).catch(() => useHistory.getState().say("Couldn't delete the report"))
    useHistory.getState().say(`Deleted "${r.title}" · ${UNDO_HINT} to undo`)
  }
  // Your own .md file as a report (D-091): only you see it until you share it, like the assistant's.
  const index = useNodeIndex()
  const file = useRef<HTMLInputElement>(null)
  const [upload, setUpload] = useState<{ error?: string; busy?: boolean } | null>(null)
  const [dropping, setDropping] = useState(false)
  const load = async (f: File | undefined) => {
    if (!f) return
    if (!/\.(md|markdown|txt)$/i.test(f.name)) return setUpload({ error: `${f.name} isn't a Markdown file (.md).` })
    if (f.size > REPORT_FILE_MAX) return setUpload({ error: `${f.name} is over 512 KB; split it into smaller reports.` })
    const byTitle = new Map([...index.values()].map((n) => [n.title, n.id]))
    const report = parseReportMarkdown(await f.text(), f.name, (t) => byTitle.get(t))
    if (!report) return setUpload({ error: `There's no text to read in ${f.name}.` })
    const id = newReportId(ws.wid)
    setUpload({ busy: true })
    try {
      await saveReport(ws.wid, id, report, { kind: 'upload', topic: f.name, model: '' })
      setUpload(null)
      useChat.getState().showReport(id)
      navigate(reportPath(ws.wid, id), { replace: true })
    } catch (e) {
      setUpload({ error: `Couldn't save it: ${(e as Error).message}` })
    }
  }
  const drag = (e: DragEvent, on: boolean) => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    setDropping(on)
  }

  return (
    <main
      className={styles.page}
      // A viewer keeps their own reports (D-098): uploading stays open to them.
      data-viewer-ok
      data-dropping={dropping || undefined}
      onDragOver={(e) => drag(e, true)}
      onDragLeave={(e) => drag(e, false)}
      onDrop={(e) => {
        drag(e, false)
        void load(e.dataTransfer.files[0])
      }}
    >
      <header className={styles.head}>
        <h1 className={styles.heading}>reports</h1>
        <span className={styles.count}>{reports.isLoading ? '' : `${reports.data.length}${reports.hasMore ? '+' : ''} · newest first`}</span>
        <button className={styles.action} data-tone="primary" onClick={() => file.current?.click()} disabled={upload?.busy} title="Add a report from a Markdown file">
          {upload?.busy ? 'uploading…' : 'upload .md'}
        </button>
        <input
          ref={file}
          type="file"
          accept=".md,.markdown,.txt,text/markdown,text/plain"
          hidden
          onChange={(e) => {
            void load(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </header>
      {upload?.error && (
        <p className={styles.note}>
          ! {upload.error}{' '}
          <button className={styles.action} onClick={() => setUpload(null)}>
            ok
          </button>
        </p>
      )}
      {notFound && (
        <p className={styles.note}>
          ! That report isn't shared with you, or it was deleted.{' '}
          <button className={styles.action} onClick={() => navigate(workspacePath(ws.wid, 'reports'), { replace: true })}>
            ok
          </button>
        </p>
      )}
      {reports.isLoading ? (
        <Loading label="loading reports…" className={styles.loading} />
      ) : reports.error ? (
        <p className={styles.note}>! Couldn&apos;t load the reports.</p>
      ) : reports.data.length === 0 ? (
        <div className={styles.empty}>
          <DecodeText text="No reports yet" />
          <p>
            Ask the assistant <code>/research &lt;topic&gt;</code> or to write up a chat as a report, or upload a <code>.md</code> file (or drop
            one here). Reports are yours only until you share them with the workspace.
          </p>
        </div>
      ) : (
        <Appear as="ul" className={styles.list}>
          {reports.data.map((r) => {
            const yours = r.uid === me
            return (
              <li key={r.id} className={styles.row} data-open={open === r.id || undefined}>
                <button className={styles.open} onClick={() => show(r)}>
                  <span className={styles.title}>{r.title}</span>
                  <span className={styles.answer}>{r.answer}</span>
                  <span className={styles.meta}>
                    {r.kind === 'chat' ? 'from a chat' : r.kind === 'upload' ? `uploaded ${r.topic}` : r.topic || 'research'} · by {yours ? 'you' : r.name} · {day(r.createdAt)} ·{' '}
                    {count(sectionCount(r), r.kind === 'chat' || r.kind === 'upload' ? 'section' : 'question')}
                    {sourceCount(r) > 0 && ` · ${count(sourceCount(r), 'source')}`}
                  </span>
                </button>
                <span className={styles.side}>
                  {/* A bar down the row's edge and the names of whoever else has it open (D-068). */}
                  <RowPeers id={r.id} />
                  <span className={styles.badge} data-shared={r.shared || undefined}>
                    {r.shared ? 'shared' : 'only you'}
                  </span>
                  {yours && (
                    <button className={styles.action} onClick={() => void shareReport(ws.wid, r.id, !r.shared)}>
                      {r.shared ? 'unshare' : 'share'}
                    </button>
                  )}
                  {(yours || (isOwner && r.shared)) && (
                    <button className={styles.action} data-tone="danger" onClick={() => remove(r)}>
                      delete
                    </button>
                  )}
                </span>
              </li>
            )
          })}
        </Appear>
      )}
      {reports.hasMore && (
        <div className={styles.more}>
          <button className={styles.action} onClick={reports.more} disabled={reports.loadingMore}>
            {reports.loadingMore ? 'loading…' : 'show more'}
          </button>
        </div>
      )}
    </main>
  )
}
