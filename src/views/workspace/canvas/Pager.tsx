// A paged list's controls (D-213, D-234; D-361: the table's and the documents list's had each written them and drifted):
// `‹ 2 / 5 ›` only when there's more than one page, and how many a page (shared), a Select for an editor, its words for
// anyone else. `noun`: what's counted (`rows`, `documents`), for the Select's label.
import { ButtonGroup } from '../../../ui/primitives/ButtonGroup'
import { Button } from '../../../ui/primitives/Button'
import { Select } from '../../../ui/patterns/Select'
import { pageSizesWith, type pagesOf } from '../../../model/paging'
import styles from './Pager.module.css'

const ALL = 'all'
type Pages = ReturnType<typeof pagesOf>

export function PageArrows({ p, go, toolClass }: { p: Pages; go: (at: number) => void; toolClass?: string }) {
  if (!p.size || p.pages < 2) return null
  return (
    <ButtonGroup label="Pages">
      <Button icon className={toolClass} disabled={p.at === 0} title="the page before" aria-label="Page before" onClick={() => go(p.at - 1)}>
        ‹
      </Button>
      <span className={styles.pageAt}>
        {p.at + 1} / {p.pages}
      </span>
      <Button icon className={toolClass} disabled={p.at >= p.pages - 1} title="the page after" aria-label="Page after" onClick={() => go(p.at + 1)}>
        ›
      </Button>
    </ButtonGroup>
  )
}

export function PageSize({ p, count, noun, editor, onSize }: { p: Pages; count: number; noun: string; editor: boolean; onSize: (size: number | undefined) => void }) {
  if (!editor) return <span className={styles.pageAt}>{p.size ? `${p.size} a page` : `all ${count}`}</span>
  return (
    <Select<string>
      ariaLabel={`${noun[0].toUpperCase()}${noun.slice(1)} a page`}
      value={p.size ? String(p.size) : ALL}
      options={[{ value: ALL, label: `all ${count}` }, ...pageSizesWith(p.size).map((n) => ({ value: String(n), label: `${n} a page` }))]}
      onChange={(v) => onSize(v === ALL ? undefined : Number(v))}
    />
  )
}
