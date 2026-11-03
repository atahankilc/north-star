// The `/` menu (S17, D-312; agent.md §4.10): typing `/` at the start of the agent's prompt opens the skills in the prompt
// look (D-222). The prompt itself is the `>` line: what's typed after the slash narrows the list (names that start with
// it first: one letter puts its names first, more letters narrow), rows read `› /name usage` with the summary under,
// `# analysis` / `# building` / `# documents` while nothing is typed (the prompt's rows, D-350). ↑↓ move, Enter or Tab picks (the prompt becomes `/name `), Esc closes. A click picks.
import { useCallback, useMemo, useState } from 'react'
import { PromptList } from '../../ui/patterns/PromptList'
import type { PromptEntry } from '../../ui/foundation/promptModel'
import { usePromptPick } from '../../ui/foundation/usePromptPick'
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

// Nothing typed: in the order the list draws them, group by group, so ↑↓ step down the rows as seen (agent-bugs 9).
const GROUPED = GROUPS.flatMap(([g]) => SKILLS.filter((s) => s.group === g))

export function matchSkills(q: string): Skill[] {
  if (!q) return GROUPED
  const starts = SKILLS.filter((s) => s.name.startsWith(q))
  // One letter puts the names it starts first (D-222), the rest after; more letters narrow, by names, then (from three
  // letters) by summaries.
  if (q.length === 1) return [...starts, ...SKILLS.filter((s) => !starts.includes(s))]
  return [...starts, ...SKILLS.filter((s) => !starts.includes(s) && (s.name.includes(q) || (q.length >= 3 && s.summary.toLowerCase().includes(q))))]
}

export function useSkillMenu(text: string, setText: (t: string) => void) {
  const q = typedName(text)
  const [closed, setClosed] = useState<string | null>(null)
  const list = useMemo(() => (q === null ? [] : matchSkills(q)), [q])
  const open = q !== null && closed !== text && list.length > 0
  const pick = useCallback(
    (s: Skill | undefined) => {
      if (!s) return
      setText(`/${s.name} `)
      setClosed(null)
    },
    [setText],
  )
  // onKey: true when the key was the menu's (the prompt should not act on it).
  const { at, setAt, onKey } = usePromptPick(list, open, { pick, close: () => setClosed(text), reset: q })
  const menu = open ? <SkillList q={q ?? ''} list={list} at={at} onPick={pick} onHover={setAt} /> : null
  return { open, onKey, menu }
}

// The skills as the prompt's entries (D-350): `# analysis` heads while nothing is typed, rows `› / name  usage` with
// the summary under them; the agent's prompt keeps the keys, so the list only shows and takes clicks.
function SkillList({ q, list, at, onPick, onHover }: { q: string; list: Skill[]; at: number; onPick: (s: Skill) => void; onHover: (i: number) => void }) {
  const entries = useMemo<PromptEntry[]>(() => {
    const out: PromptEntry[] = []
    let group = ''
    for (const s of list) {
      if (!q && s.group !== group) out.push({ key: `#${(group = s.group)}`, heading: s.group })
      out.push({ key: s.name, label: s.name, glyph: '/', tone: 'var(--accent-cyan)', meta: s.usage, sub: s.summary, onSelect: () => onPick(s) })
    }
    return out
  }, [list, q, onPick])
  const index = useMemo(() => new Map(list.map((s, i) => [s.name, i])), [list])
  return (
    <div className={styles.skillMenu} data-skill-menu onPointerDown={(e) => e.preventDefault()}>
      <PromptList
        role="listbox"
        label="Skills"
        entries={entries}
        picked={list[at]?.name ?? null}
        q={q}
        onPick={(i) => i.onSelect({ shift: false, alt: false })}
        onPoint={(k) => onHover(index.get(k) ?? 0)}
        idOf={(k) => `skill-${k}`}
      />
    </div>
  )
}

// A skill named at the start of a message, for the chip in the person's message.
export function skillChip(text: string): { name: string; rest: string } | null {
  const m = /^\s*\/([a-z][a-z-]*)\b(?![/.])\s*([\s\S]*)$/i.exec(text)
  if (!m || !SKILLS.some((s) => s.name === m[1].toLowerCase())) return null
  return { name: m[1].toLowerCase(), rest: m[2] }
}
