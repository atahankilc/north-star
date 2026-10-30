// The `/` menu (S17, D-312; agent.md §4.10): typing `/` at the start of the agent's prompt opens the skills in the prompt
// look (D-222). The prompt itself is the `>` line: what's typed after the slash narrows the list (names that start with
// it first: one letter puts its names first, more letters narrow), rows read `› /name  summary`, `# analysis` / `# building` / `# documents` while
// nothing is typed, a counting foot. ↑↓ move, Enter or Tab picks (the prompt becomes `/name `), Esc closes. A click picks.
import { useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { SKILLS, type Skill } from '../skills'
import styles from './Agent.module.css'

const GROUPS: [Skill['group'], string][] = [
  ['analysis', 'analysis'],
  ['building', 'building'],
  ['documents', 'documents'],
]

// What's typed as a skill name: `/` then letters and dashes, nothing after (a space means it's picked).
const typedName = (text: string): string | null => {
  const m = /^\/([a-z-]*)$/i.exec(text)
  return m ? m[1].toLowerCase() : null
}

export function matchSkills(q: string): Skill[] {
  if (!q) return SKILLS
  const starts = SKILLS.filter((s) => s.name.startsWith(q))
  // One letter puts the names it starts first (D-222), the rest after; more letters narrow, by names, then (from three
  // letters) by summaries.
  if (q.length === 1) return [...starts, ...SKILLS.filter((s) => !starts.includes(s))]
  return [...starts, ...SKILLS.filter((s) => !starts.includes(s) && (s.name.includes(q) || (q.length >= 3 && s.summary.toLowerCase().includes(q))))]
}

export function useSkillMenu(text: string, setText: (t: string) => void) {
  const q = typedName(text)
  const [closed, setClosed] = useState<string | null>(null)
  const [at, setAt] = useState(0)
  const list = useMemo(() => (q === null ? [] : matchSkills(q)), [q])
  const open = q !== null && closed !== text && list.length > 0
  useEffect(() => setAt(0), [q])
  const pick = (s: Skill | undefined) => {
    if (!s) return
    setText(`/${s.name} `)
    setClosed(null)
  }
  // True when the key was the menu's (the prompt should not act on it).
  const onKey = (e: ReactKeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (!open) return false
    if (e.key === 'ArrowDown') (e.preventDefault(), setAt((i) => (i + 1) % list.length))
    else if (e.key === 'ArrowUp') (e.preventDefault(), setAt((i) => (i - 1 + list.length) % list.length))
    else if ((e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) || e.key === 'Tab') (e.preventDefault(), pick(list[at]))
    else if (e.key === 'Escape') (e.preventDefault(), e.stopPropagation(), setClosed(text))
    else return false
    return true
  }
  const menu = open ? <SkillList q={q ?? ''} list={list} at={at} onPick={pick} onHover={setAt} /> : null
  return { open, onKey, menu }
}

function Lit({ text, q }: { text: string; q: string }) {
  const i = q ? text.indexOf(q) : -1
  if (i < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <mark className={styles.skillMatch}>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  )
}

function SkillList({ q, list, at, onPick, onHover }: { q: string; list: Skill[]; at: number; onPick: (s: Skill) => void; onHover: (i: number) => void }) {
  const rows = q
    ? list.map((s, i) => ({ s, i }))
    : GROUPS.flatMap(([g]) => list.map((s, i) => ({ s, i })).filter((x) => x.s.group === g))
  let group = ''
  return (
    <div className={styles.skillMenu} role="listbox" aria-label="Skills" data-skill-menu onPointerDown={(e) => e.preventDefault()}>
      <div className={styles.skillList}>
        {rows.map(({ s, i }) => {
          const head = !q && s.group !== group ? (group = s.group) : null
          return (
            <div key={s.name}>
              {head && <div className={styles.skillHead}>{head}</div>}
              <button type="button" role="option" aria-selected={i === at} className={styles.skillRow} data-on={i === at || undefined} onMouseEnter={() => onHover(i)} onClick={() => onPick(s)}>
                <span className={styles.skillCursor} aria-hidden>
                  ›
                </span>
                <span className={styles.skillName}>
                  /<Lit text={s.name} q={q} />
                  {s.usage && <span className={styles.skillUsage}> {s.usage}</span>}
                </span>
                <span className={styles.skillSummary}>{s.summary}</span>
              </button>
            </div>
          )
        })}
      </div>
      <div className={styles.skillFoot} aria-hidden>
        {list.length} {list.length === 1 ? 'skill' : 'skills'} · ↵ picks{q ? '' : ' · type to narrow'} · esc closes
      </div>
    </div>
  )
}

// A skill named at the start of a message, for the chip in the person's message.
export function skillChip(text: string): { name: string; rest: string } | null {
  const m = /^\s*\/([a-z][a-z-]*)\b(?![/.])\s*([\s\S]*)$/i.exec(text)
  if (!m || !SKILLS.some((s) => s.name === m[1].toLowerCase())) return null
  return { name: m[1].toLowerCase(), rest: m[2] }
}
