// A paged list's pages (D-213, D-234): how many, and the one shown, kept in range. One for the table and the documents
// list (D-361: it had been written in each). No size: one page with everything.
export function pagesOf(setup: { pageSize?: number }, count: number, page: number | undefined) {
  const size = setup.pageSize
  const pages = size ? Math.max(1, Math.ceil(count / size)) : 1
  const at = Math.min(pages - 1, Math.max(0, page ?? 0))
  return { size, pages, at, from: size ? at * size : 0, to: size ? Math.min(count, (at + 1) * size) : count }
}

// How many a page can be chosen (D-361: the table's and the documents list's lists had drifted, 10/25/50/100 vs
// 10/20/50). A size kept from before that isn't one of them stays offered, so it reads as what it is.
export const PAGE_SIZES = [10, 25, 50, 100]
export const pageSizesWith = (size: number | undefined) => (size && !PAGE_SIZES.includes(size) ? [...PAGE_SIZES, size].sort((a, b) => a - b) : PAGE_SIZES)
