// /workspaces/<id>/reports (D-090, D-102, D-106): the reports you may see, newest first: your own (only you, until you
// share one) and those others shared. A table on its own, in one solid frame (the backdrop never moves behind text),
// with the table's own actions in its top row: filters (kind, whose, who can see it) and upload (D-091, D-103). Ten a
// page, with numbered pages. Picking a report (`?report=<id>`) rebuilds the table cell by cell as a narrow list on the
// left while the report builds up on the right (ReportReader, with the report's own actions); closing it gives the
// table back its width. Phones show the table, then the report alone. A report's body loads when it's opened (D-098).
import { useEffect, useRef, useState, type DragEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { reportPath, workspacePath } from "../../app/paths";
import { firebase } from "../../data/firebase";
import { setPresenceSelection } from "../../data/presence";
import { useCanvas } from "../../state/canvasStore";
import type { WithId } from "../../data/hooks";
import type { ReportKind, ReportSummary } from "../../data/model";
import {
  ANY_REPORTS,
  newReportId,
  saveReport,
  sectionCount,
  sourceCount,
  useReportPage,
  type ReportFilter,
} from "../../data/reports";
import { Appear, runCells } from "../../ui/Appear";
import { Loading } from "../../ui/Loading";
import { Menu, type MenuEntry } from "../../ui/Menu";
import { parseReportMarkdown, REPORT_FILE_MAX } from "../../io/reportMarkdown";
import { useWs } from "../workspace/context";
import { useNodeIndex } from "../workspace/nodeIndex";
import { RowPeers } from "../workspace/PeerMarks";
import { ReportReader } from "./ReportReader";
import styles from "./ReportsView.module.css";

const day = (t: number) => new Date(t).toLocaleDateString("en-CA");
const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const KIND_WORD: Record<ReportKind, string> = {
  research: "research",
  chat: "from a chat",
  upload: "uploaded",
};
const kindOf = (r: ReportSummary): ReportKind => r.kind ?? "research";
// How long the table takes to rebuild in its new shape (the components' build-up, D-035).
const REBUILD_MS = 320;

// The page numbers to show: all of them when few, else the first, the last and the current one's neighbours.
function pageList(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const near = [page - 1, page, page + 1].filter((p) => p > 1 && p < pages);
  return [
    1,
    ...(near[0] > 2 ? ["…" as const] : []),
    ...near,
    ...(near[near.length - 1] < pages - 1 ? ["…" as const] : []),
    pages,
  ];
}

export function ReportsView() {
  const ws = useWs();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const open = params.get("report");
  const me = firebase?.auth.currentUser?.uid;
  const [filter, setFilter] = useState<ReportFilter>(ANY_REPORTS);
  const [page, setPage] = useState(1);
  const reports = useReportPage(ws.wid, me, filter, page);
  const narrowing =
    filter.kind !== null || filter.mine || filter.sharing !== "any";

  // A filter starts again from the first page; a page that has gone (deletes) falls back to the last one.
  const pick = (f: Partial<ReportFilter>) => {
    setFilter((now) => ({ ...now, ...f }));
    setPage(1);
  };
  useEffect(() => {
    if (reports.pages !== null && page > reports.pages) setPage(reports.pages);
  }, [reports.pages, page]);

  // Others see which report you have open, like a selected card (D-068); closing hands back your card selection.
  useEffect(() => {
    if (!open) return;
    setPresenceSelection(open);
    return () => setPresenceSelection(useCanvas.getState().selectedId, useCanvas.getState().selection);
  }, [open]);

  // Opening or closing a report rebuilds the table cell by cell in its new shape (D-035), so it never jumps.
  const table = useRef<HTMLElement>(null);
  const reading = !!open;
  const was = useRef(reading);
  useEffect(() => {
    if (was.current === reading || !table.current) return;
    was.current = reading;
    return runCells(table.current, "enter", 0, REBUILD_MS);
  }, [reading]);

  // Your own .md file as a report (D-091): only you see it until you share it, like the assistant's.
  const index = useNodeIndex();
  const file = useRef<HTMLInputElement>(null);
  const [upload, setUpload] = useState<{
    error?: string;
    busy?: boolean;
  } | null>(null);
  const [dropping, setDropping] = useState(false);
  const load = async (f: File | undefined) => {
    if (!f) return;
    if (!/\.(md|markdown|txt)$/i.test(f.name))
      return setUpload({ error: `${f.name} isn't a Markdown file (.md).` });
    if (f.size > REPORT_FILE_MAX)
      return setUpload({
        error: `${f.name} is over 512 KB; split it into smaller reports.`,
      });
    const byTitle = new Map([...index.values()].map((n) => [n.title, n.id]));
    const report = parseReportMarkdown(await f.text(), f.name, (t) =>
      byTitle.get(t),
    );
    if (!report)
      return setUpload({ error: `There's no text to read in ${f.name}.` });
    const id = newReportId(ws.wid);
    setUpload({ busy: true });
    try {
      await saveReport(ws.wid, id, report, {
        kind: "upload",
        topic: f.name,
        model: "",
      });
      setUpload(null);
      navigate(reportPath(ws.wid, id));
    } catch (e) {
      setUpload({ error: `Couldn't save it: ${(e as Error).message}` });
    }
  };
  const drag = (e: DragEvent, on: boolean) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    setDropping(on);
  };

  const choose = <T,>(
    options: [T, string][],
    now: T,
    set: (v: T) => void,
  ): MenuEntry[] =>
    options.map(([v, label]) => ({
      key: String(v),
      label,
      checked: v === now,
      onSelect: () => set(v),
    }));
  const kinds: [ReportKind | null, string][] = [
    [null, "any kind"],
    ["research", "research"],
    ["chat", "from a chat"],
    ["upload", "uploaded"],
  ];
  const sharings: [ReportFilter["sharing"], string][] = [
    ["any", "anyone it can"],
    ["shared", "the workspace"],
    ["private", "only me"],
  ];

  const show = (r: WithId<ReportSummary>) =>
    navigate(
      open === r.id
        ? workspacePath(ws.wid, "reports")
        : reportPath(ws.wid, r.id),
    );
  const rows = reports.data;
  const noneAtAll =
    !reports.isLoading && !reports.error && rows.length === 0 && !narrowing;

  return (
    <main
      className={styles.page}
      // A viewer keeps their own reports (D-098): uploading stays open to them.
      data-viewer-ok
      data-reading={reading || undefined}
      data-dropping={dropping || undefined}
      onDragOver={(e) => drag(e, true)}
      onDragLeave={(e) => drag(e, false)}
      onDrop={(e) => {
        drag(e, false);
        void load(e.dataTransfer.files[0]);
      }}
    >
      <div className={styles.split}>
        {/* The table's actions in the filter row's place, like every view's filters: what it lists, and adding one. */}
        <div className={styles.tools}>
          <div className={styles.filters}>
            <Menu
              label="kind"
              summary={filter.kind ? KIND_WORD[filter.kind] : "any"}
              active={filter.kind !== null}
              items={choose(kinds, filter.kind, (kind) => pick({ kind }))}
              ariaLabel="Filter by kind"
            />
            <Menu
              label="by"
              summary={filter.mine ? "me" : "anyone"}
              active={filter.mine}
              items={choose<boolean>(
                [
                  [false, "anyone"],
                  [true, "me"],
                ],
                filter.mine,
                (mine) => pick({ mine }),
              )}
              ariaLabel="Filter by author"
            />
            <Menu
              label="seen by"
              summary={
                filter.sharing === "any"
                  ? "any"
                  : filter.sharing === "shared"
                    ? "workspace"
                    : "only me"
              }
              active={filter.sharing !== "any"}
              items={choose(sharings, filter.sharing, (sharing) =>
                pick({ sharing }),
              )}
              ariaLabel="Filter by who can see it"
            />
            {narrowing && (
              <button
                className={styles.action}
                onClick={() => pick(ANY_REPORTS)}
              >
                clear
              </button>
            )}
          </div>
          <span className={styles.count}>
            {reports.total !== null && reports.total >= 0
              ? count(reports.total, "report")
              : ""}
          </span>
          {/* Adding one: a solid square like the board's `+` (D-103). */}
          <button
            className={styles.upload}
            onClick={() => file.current?.click()}
            disabled={upload?.busy}
            data-busy={upload?.busy || undefined}
            title={
              upload?.busy
                ? "Uploading…"
                : "Upload a report (.md), or drop one here"
            }
            aria-label="Upload a report from a Markdown file"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
              <path
                d="M8 11V2.5M4.5 6 8 2.5 11.5 6M2.5 10.5v3h11v-3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="square"
              />
            </svg>
          </button>
          <input
            ref={file}
            type="file"
            accept=".md,.markdown,.txt,text/markdown,text/plain"
            hidden
            onChange={(e) => {
              void load(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
        {/* Builds up cell by cell like every view's frame (D-034); opening a report rebuilds it again (below). */}
        <Appear as="section" className={styles.table} elRef={table} aria-label="Reports">
          {upload?.error && (
            <p className={styles.note}>
              ! {upload.error}{" "}
              <button className={styles.action} onClick={() => setUpload(null)}>
                ok
              </button>
            </p>
          )}

          <div
            className={styles.body}
            data-stale={(reports.isLoading && rows.length > 0) || undefined}
          >
            {!reading && rows.length > 0 && (
              <div className={styles.head} role="presentation">
                <span>report</span>
                <span>kind</span>
                <span>by</span>
                <span>date</span>
                <span>size</span>
                <span>seen by</span>
              </div>
            )}
            {reports.isLoading && rows.length === 0 ? (
              <Loading label="loading reports…" className={styles.loading} />
            ) : reports.error ? (
              <p className={styles.note}>! Couldn&apos;t load the reports.</p>
            ) : noneAtAll ? (
              <div className={styles.empty}>
                <p className={styles.emptyTitle}>No reports yet</p>
                <p>
                  Ask the assistant <code>/research &lt;topic&gt;</code> or to
                  write up a chat as a report, or upload a <code>.md</code> file
                  (or drop one here). Reports are yours only until you share
                  them with the workspace.
                </p>
              </div>
            ) : rows.length === 0 ? (
              <p className={styles.none}>
                No reports match these filters.{" "}
                <button
                  className={styles.action}
                  onClick={() => pick(ANY_REPORTS)}
                >
                  clear
                </button>
              </p>
            ) : (
              <ul className={styles.rows}>
                {rows.map((r) => {
                  const by = r.uid === me ? "you" : r.name;
                  const size = `${count(sectionCount(r), kindOf(r) === "research" ? "question" : "section")}${sourceCount(r) ? ` · ${count(sourceCount(r), "source")}` : ""}`;
                  return (
                    <li
                      key={r.id}
                      className={styles.row}
                      data-open={open === r.id || undefined}
                    >
                      <button
                        className={styles.open}
                        data-nav
                        onClick={() => show(r)}
                        aria-current={open === r.id || undefined}
                      >
                        <span className={styles.what}>
                          <span className={styles.title}>{r.title}</span>
                          <span className={styles.answer}>{r.answer}</span>
                        </span>
                        {reading ? (
                          <span className={styles.meta}>
                            {KIND_WORD[kindOf(r)]} · {by} · {day(r.createdAt)} ·{" "}
                            <span
                              className={styles.badge}
                              data-shared={r.shared || undefined}
                            >
                              {r.shared ? "workspace" : "only you"}
                            </span>
                          </span>
                        ) : (
                          <>
                            <span className={styles.cell}>
                              {KIND_WORD[kindOf(r)]}
                            </span>
                            <span className={styles.cell}>{by}</span>
                            <span className={styles.cell}>
                              {day(r.createdAt)}
                            </span>
                            <span className={styles.cell}>{size}</span>
                            <span
                              className={`${styles.cell} ${styles.badge}`}
                              data-shared={r.shared || undefined}
                            >
                              {r.shared ? "workspace" : "only you"}
                            </span>
                          </>
                        )}
                      </button>
                      {/* A bar down the row's edge and the names of whoever else has it open (D-068). */}
                      <RowPeers id={r.id} />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Numbered pages (D-106); while counting, or if counting failed, only ‹ › by what's there. */}
          {(page > 1 ||
            (reports.pages ?? 1) > 1 ||
            (reports.total === -1 && rows.length === 10)) && (
            <nav className={styles.pager} aria-label="Pages">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                aria-label="Previous page"
              >
                ‹
              </button>
              {reports.pages !== null &&
                pageList(page, reports.pages).map((p, i) =>
                  p === "…" ? (
                    <span key={`gap${i}`} className={styles.gap}>
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      aria-current={p === page ? "page" : undefined}
                    >
                      {p}
                    </button>
                  ),
                )}
              <button
                onClick={() => setPage(page + 1)}
                disabled={
                  reports.pages !== null
                    ? page >= reports.pages
                    : rows.length < 10
                }
                aria-label="Next page"
              >
                ›
              </button>
            </nav>
          )}
        </Appear>

        {open && (
          <Appear key={open} className={styles.reader}>
            <ReportReader
              id={open}
              onClose={() => navigate(workspacePath(ws.wid, "reports"))}
            />
          </Appear>
        )}
      </div>
    </main>
  );
}
