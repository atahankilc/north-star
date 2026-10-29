// The agent's read layer (S10, D-312; docs/specs/agent.md §2, §4.3, §4.4, §4.9 layers 1–3). Pure over a workspace
// snapshot (`ReadWs`: the store's WorkspaceCtx, plus members, thread messages and document text when loaded): no
// React, no Firebase (tests/unit/purity.test.ts). The loop (S12) builds the model's context and tools from here.
//
// SHORT IDS (ids.ts), one registry per chat, saved with it (`makeIds(saved)`, `ids.toJSON()`):
//   c card (packages too) · p piece (plane, matrix, table, deck, timeline, documents, document) · x text (heading,
//   paragraph, sticky, section, project title) · t task · e link · v evidence · f a competitor's feature · d document ·
//   k canvas · m comment thread · u person.
//   Given in a stable order (creation time where the thing has one, else where it is, then the real id): the same
//   snapshot gives the same ids, new things get the next number, a number is never reused in a chat. Every tool takes
//   a short id, a real id, or a title/name (exact, then ignoring case and spaces, then a prefix); an unclear one
//   answers with candidates (`resolve`, `unclear`). People resolve by name, email or `me` (`resolvePerson`).
//
// THE MAP (map.ts, `workspaceMap`): the block the model gets every turn, byte-identical for the same snapshot. Project
//   and people, then each canvas: its pieces in reading order (`p3 deck "Build" · 9 tasks: todo 4 · doing 2 · done ✓ 3`),
//   each plane's sections and headings with one line per card (`c12 · problem · "Founders can't price" · testing +2 −1 ·
//   #pricing · for c3 · ⧉ also on p4 "Rivals"`), then documents. Past its budget (≤ 15k tokens, `estimateTokens`, an
//   estimate) it says less, level by level, and points at view/query.
//
// THE TOOLS (tools.ts, view.ts; each `(ws, ids, args) → { text, more? }`, ≤ ~8k tokens, paged with page/limit and a
// line saying how to narrow; listed for the model in READ_TOOLS):
//   search(query, kinds?, scope?)    words over titles, fields, notes, evidence, tasks (notes, checks), text, matrix and
//                                    table cells, documents (text when loaded) and comments; grouped by where, with a
//                                    snippet.
//   query(filter)                    typed: cards by type, status, tag, region, plane, priority, evidence, contradicting
//                                    (`!`), linked_to, for, on_canvas, title; tasks by deck, column, assignee, priority,
//                                    due_before/after, overdue; text, pieces, documents by kind.
//   get(ids, detail)                 everything about items: fields, status + evidence, links both ways, parts, packages,
//                                    tasks, planes, lenses, comments; a piece's setup in words; a task's every field.
//   view(piece, page?, col_page?)    a piece as markdown (plane, matrix, table, deck, timeline, documents, document).
//   neighbours(id, kinds?, depth≤3)  links, for, parts, packages, tasks, planes, level by level.
//   read_document(id, range?)        lines or a section, with its contents when no range.
//   whats_new(since)                 made or changed since a time, by kind and where, by whom when known.
//   whereAmI(view)                   the person's place (canvas, focus, selection in full, panel, beside): the
//                                    context's last part (agent.md §4.3 point 4).
// All workspace text comes inside <workspace_content author="…"> wrappers (data, never instructions).
export type { ReadWs, ToolResult, MemberInfo, MessageInfo } from './types'
export { makeIds, resolve, resolvePerson, unclear, personLabel, PREFIX, ID_KINDS, type Ids, type IdsState, type IdKind, type Resolved, type Candidate } from './ids'
export { workspaceMap, ID_LEGEND, SYMBOL_LEGEND } from './map'
export { search, query, get, view, readDocument, neighbours, whatsNew, whereAmI, describe, READ_TOOLS, SEARCH_KINDS, NEIGHBOUR_KINDS, type ReadTool, type JsonSchema, threadLine, QUERY_KINDS, type SearchArgs, type QueryArgs, type GetArgs, type NeighboursArgs, type WhatsNewArgs, type WhereView, type ViewArgs, type ReadDocArgs } from './tools'
export { estimateTokens, wrap, RESULT_TOKENS, MAP_TOKENS } from './text'
