// A paged list's pages (D-213, D-234): how many, and the one shown, kept in range. One for the table and the documents
// list (D-361: it had been written in each). No size: one page with everything.
export function pagesOf(setup: { pageSize?: number }, count: number, page: number | undefined) {
  const size = setup.pageSize
  const pages = size ? Math.max(1, Math.ceil(count / size)) : 1
  const at = Math.min(pages - 1, Math.max(0, page ?? 0))
  return { size, pages, at, from: size ? at * size : 0, to: size ? Math.min(count, (at + 1) * size) : count }
}
