import { useState } from 'react'
import { example } from '../../../gallery/example'
import { pagesOf } from '../../../model/paging'
import { PageArrows, PageSize } from './Pager'

function Demo({ count, start, editor = true }: { count: number; start?: number; editor?: boolean }) {
  const [size, setSize] = useState<number | undefined>(start)
  const [page, setPage] = useState(0)
  const p = pagesOf({ pageSize: size }, count, page)
  return (
    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
      <PageArrows p={p} go={setPage} />
      <PageSize p={p} count={count} noun="rows" editor={editor} onSize={(s) => (setPage(0), setSize(s))} />
    </div>
  )
}

export default example({
  name: 'Pager',
  place: 'canvas/pieces',
  file: 'src/views/workspace/canvas/Pager.tsx',
  note: 'a paged list’s controls in its dock (D-213, D-234, D-361): the table’s and the documents list’s; arrows only past one page',
  states: {
    'several pages': () => <Demo count={64} start={25} />,
    'one page': () => <Demo count={8} start={10} />,
    'all at once': () => <Demo count={64} />,
    'a size from before': () => <Demo count={64} start={20} />,
    'read only': () => <Demo count={64} start={25} editor={false} />,
  },
})
