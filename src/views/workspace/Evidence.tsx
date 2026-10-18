// A customer's, problem's or idea's status and what was learned about it (D-137). You set the status; the evidence
// informs it: its tally sits beside the status, and a status the evidence doesn't back says so.
import { useState } from 'react'
import { addEvidence, mismatch, removeEvidence, tally, updateEvidence } from '../../data/evidence'
import type { WithId } from '../../data/hooks'
import {
  EVIDENCE_KINDS,
  STANCES,
  VALIDATIONS,
  type Evidence,
  type EvidenceKind,
  type EvidenceType,
  type Stance,
  type Validation,
} from '../../data/model'
import { updateNode } from '../../data/nodes'
import { AutosaveField } from '../../ui/AutosaveField'
import { Choice } from '../../ui/Choice'
import { useWs } from './context'
import styles from './Evidence.module.css'

export const VALIDATION_TONE: Record<Validation, string> = {
  hypothesis: 'var(--fg-dim)',
  testing: 'var(--accent-yellow)',
  validated: 'var(--accent-green)',
  invalidated: 'var(--accent-magenta)',
}

const STANCE_TONE: Record<Stance, string> = { supports: 'var(--accent-green)', contradicts: 'var(--accent-yellow)' }
const SIGN: Record<Stance, string> = { supports: '+', contradicts: '−' }

export function ValidationField({ node, type }: { node: { id: string; validation?: Validation }; type: EvidenceType }) {
  const { wid, evidence } = useWs()
  const list = evidence.filter((e) => e.nodeId === node.id)
  const t = tally(list)
  const warn = mismatch(node.validation, list)
  return (
    <div className={styles.status}>
      <Choice
        label="status"
        options={VALIDATIONS}
        value={node.validation}
        tones={VALIDATION_TONE}
        onChange={(validation) => void updateNode(wid, type, node.id, { validation })}
      />
      {(list.length > 0 || warn) && (
        <span className={styles.statusNote}>
          {list.length > 0 && (
            <span>
              <span style={{ color: STANCE_TONE.supports }}>+{t.supports}</span>{' '}
              <span style={{ color: STANCE_TONE.contradicts }}>−{t.contradicts}</span>
            </span>
          )}
          {warn && <span className={styles.warn}>! {warn}</span>}
        </span>
      )}
    </div>
  )
}

// Today where you are, `YYYY-MM-DD` (toISOString would give UTC's date).
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function EvidenceList({ node, type }: { node: { id: string }; type: EvidenceType }) {
  const { wid, evidence } = useWs()
  const list = evidence.filter((e) => e.nodeId === node.id).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || b.createdAt - a.createdAt)
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState<string | null>(null)

  return (
    <div className={styles.block}>
      <span className={styles.head}>
        <span className={styles.label}>evidence</span>
        {!adding && (
          <button className={styles.small} onClick={() => setAdding(true)}>
            add
          </button>
        )}
      </span>
      {adding && <NewEvidence onDone={() => setAdding(false)} onAdd={(fields) => void addEvidence(wid, { nodeId: node.id, nodeType: type, ...fields })} />}
      {list.length > 0 && (
        <ul className={styles.list}>
          {list.map((e) => (
            <EvidenceRow key={e.id} wid={wid} e={e} open={open === e.id} onToggle={() => setOpen(open === e.id ? null : e.id)} />
          ))}
        </ul>
      )}
      {!list.length && !adding && (
        <span className={styles.hint}>What you learned that backs this or speaks against it: an interview, a quote, a number, a link.</span>
      )}
    </div>
  )
}

type NewFields = { kind: EvidenceKind; text: string; stance: Stance; source?: string; date?: string }

function NewEvidence({ onAdd, onDone }: { onAdd: (f: NewFields) => void; onDone: () => void }) {
  const [text, setText] = useState('')
  const [kind, setKind] = useState<EvidenceKind>('interview')
  const [stance, setStance] = useState<Stance>('supports')
  const [source, setSource] = useState('')
  const [date, setDate] = useState(today())
  const add = () => {
    if (!text.trim()) return
    onAdd({ kind, stance, text: text.trim(), ...(source.trim() && { source: source.trim() }), ...(date && { date }) })
    onDone()
  }
  return (
    <div className={styles.form}>
      <textarea
        className={styles.input}
        aria-label="What was learned"
        placeholder="What did you learn? A finding, a quote, a number."
        rows={2}
        autoFocus
        value={text}
        maxLength={2000}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) add()
          if (e.key === 'Escape') onDone()
        }}
      />
      <Choice label="it" options={STANCES} value={stance} tones={STANCE_TONE} onChange={(v) => v && setStance(v)} />
      <Choice label="kind" options={EVIDENCE_KINDS} value={kind} onChange={(v) => v && setKind(v)} />
      <span className={styles.pair}>
        <input className={styles.input} aria-label="Source" placeholder="from (who or where)" value={source} maxLength={200} onChange={(e) => setSource(e.target.value)} />
        <input className={styles.input} aria-label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </span>
      <span className={styles.actions}>
        <button className={styles.small} data-tone="primary" disabled={!text.trim()} onClick={add}>
          add
        </button>
        <button className={styles.small} onClick={onDone}>
          cancel
        </button>
      </span>
    </div>
  )
}

// One piece: its sign, kind and text; open, its fields to edit.
function EvidenceRow({ wid, e, open, onToggle }: { wid: string; e: WithId<Evidence>; open: boolean; onToggle: () => void }) {
  const set = (fields: Parameters<typeof updateEvidence>[2]) => void updateEvidence(wid, e.id, fields)
  const meta = [e.source, e.date].filter(Boolean).join(' · ')
  return (
    <li className={styles.item} style={{ ['--tone' as string]: STANCE_TONE[e.stance] }}>
      <button className={styles.row} onClick={onToggle} aria-expanded={open}>
        <span className={styles.sign}>{SIGN[e.stance]}</span>
        <span className={styles.text}>
          <span className={styles.kind}>{e.kind}</span> {e.text}
          {meta && <span className={styles.meta}>{meta}</span>}
        </span>
      </button>
      {open && (
        <div className={styles.form}>
          <AutosaveField className={styles.input} label="What was learned" value={e.text} multiline rows={2} maxLength={2000} onSave={(text) => text.trim() && set({ text: text.trim() })} />
          <Choice label="it" options={STANCES} value={e.stance} tones={STANCE_TONE} onChange={(stance) => stance && set({ stance })} />
          <Choice label="kind" options={EVIDENCE_KINDS} value={e.kind} onChange={(kind) => kind && set({ kind })} />
          <span className={styles.pair}>
            <AutosaveField className={styles.input} label="Source" placeholder="from (who or where)" value={e.source ?? ''} maxLength={200} onSave={(v) => set({ source: v.trim() || undefined })} />
            <input
              className={styles.input}
              aria-label="Date"
              type="date"
              value={e.date ?? ''}
              onChange={(ev) => set({ date: ev.target.value || undefined })}
            />
          </span>
          <AutosaveField className={styles.input} label="Link" placeholder="link (optional)" value={e.url ?? ''} maxLength={2000} onSave={(v) => set({ url: v.trim() || undefined })} />
          <span className={styles.actions}>
            {e.url && (
              <a className={styles.small} href={e.url} target="_blank" rel="noreferrer">
                open link
              </a>
            )}
            <button className={styles.small} data-tone="danger" onClick={() => void removeEvidence(wid, e.id)}>
              remove
            </button>
          </span>
        </div>
      )}
    </li>
  )
}
