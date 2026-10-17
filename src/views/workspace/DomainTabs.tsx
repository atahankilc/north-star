// `[all] dev tools  home fitness  + domain` in the HUD (D-039). Click the current domain to rename it.
import { useEffect, useMemo, useRef, useState } from 'react'
import { createDomain, deleteDomain, renameDomain } from '../../data/domains'
import { ALL, useWsView } from '../../state/workspaceView'
import { InlineEdit } from '../../ui/InlineEdit'
import { useWs } from './context'
import styles from './Bars.module.css'

export function DomainTabs() {
  const { wid, domains } = useWs()
  const domain = useWsView((s) => s.domain)
  const setDomain = useWsView((s) => s.setDomain)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Enter closes the input, which also blurs it: create only once.
  const committed = useRef(false)
  const sorted = useMemo(() => [...domains].sort((a, b) => a.createdAt - b.createdAt), [domains])
  // A domain deleted elsewhere falls back to `all`.
  const current = sorted.some((d) => d.id === domain) ? domain : ALL

  useEffect(() => setConfirmDelete(false), [current])
  useEffect(() => {
    if (!confirmDelete) return
    const t = window.setTimeout(() => setConfirmDelete(false), 3000)
    return () => window.clearTimeout(t)
  }, [confirmDelete])

  const add = async () => {
    if (committed.current) return
    committed.current = true
    const name = draft.trim()
    setAdding(false)
    setDraft('')
    if (name) setDomain(await createDomain(wid, name))
  }

  return (
    <span className={styles.domains} role="tablist" aria-label="Domains">
      <button
        role="tab"
        aria-selected={current === ALL}
        data-active={current === ALL}
        className={`${styles.toggle} ${styles.domain}`}
        onClick={() => setDomain(ALL)}
      >
        all
      </button>
      {sorted.map((d) =>
        d.id === current ? (
          <span key={d.id} className={`${styles.toggle} ${styles.domain}`} role="tab" aria-selected data-active>
            <InlineEdit className={styles.rename} label="domain" value={d.name} onSave={(n) => renameDomain(wid, d.id, n)} />
            <button
              className={styles.remove}
              data-confirm={confirmDelete}
              title="Delete domain (its items become unsorted)"
              aria-label={confirmDelete ? `Confirm deleting ${d.name}` : `Delete ${d.name}`}
              onClick={() => {
                if (!confirmDelete) return setConfirmDelete(true)
                setDomain(ALL)
                void deleteDomain(wid, d.id)
              }}
            >
              {confirmDelete ? 'delete?' : '×'}
            </button>
          </span>
        ) : (
          <button
            key={d.id}
            role="tab"
            aria-selected={false}
            className={`${styles.toggle} ${styles.domain}`}
            onClick={() => setDomain(d.id)}
          >
            {d.name}
          </button>
        ),
      )}
      {adding ? (
        <input
          autoFocus
          className={styles.newDomain}
          placeholder="domain name"
          maxLength={100}
          value={draft}
          aria-label="New domain name"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={add}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void add()
            if (e.key === 'Escape') {
              committed.current = true
              setDraft('')
              setAdding(false)
            }
            e.stopPropagation()
          }}
        />
      ) : (
        <button
          className={styles.add}
          onClick={() => {
            committed.current = false
            setAdding(true)
          }}
        >
          + domain
        </button>
      )}
    </span>
  )
}
