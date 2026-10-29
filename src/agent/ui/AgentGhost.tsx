// The agent in presence, LOCAL ONLY (S14, D-312, D-317; agent.md §4.6): while a turn runs, what it reads or changes
// (a card, a plane, a task, text) gets the agent's marks the way others' selections are drawn (D-272): cyan L's round
// it (magenta while changing) and a name tag outside its top edge, gliding from thing to thing. Only a thing truly on
// screen gets them: the point at its middle must hit it (not the HUD, the side nav, a panel, nor the canvas picture
// behind a focus). They go a moment after the turn ends. Nothing is sent: others don't see it yet. Showing it to them
// needs a presence field under the person's own node (`agent: {state, at}`) and a rule for it in database.rules.json
// with a test (agent-run.md, "For the user"); a fake uid can't be used (presence peers are filtered to members, D-317).
import { useEffect, useState } from 'react'
import { useAgent } from './agentStore'
import styles from './Agent.module.css'

const LINGER_MS = 2500
type Box = { x: number; y: number; w: number; h: number }

// The element on screen for a real id: a card's or plane's comment target, a task, a text item; only one whose middle
// is really there to see.
function boxOf(id: string): Box | null {
  const sel = [`[data-target="card:${id}"]`, `[data-target="plane:${id}"]`, `[data-task="${id}"]`, `[data-id="${id}"]`]
  for (const s of sel) {
    const all = document.querySelectorAll<HTMLElement>(`[data-app] ${s}`)
    // Dev mounts draw twice (a canvas picture and the focus): the last one is the live one.
    for (let i = all.length - 1; i >= 0; i--) {
      const r = all[i].getBoundingClientRect()
      if (r.width < 4 || r.height < 4) continue
      const cx = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1)
      const cy = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1)
      const hit = document.elementFromPoint(cx, cy)
      if (!hit || !hit.closest('[data-app]') || !(all[i] === hit || all[i].contains(hit))) continue
      return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }
    }
  }
  return null
}

export function AgentGhost() {
  const touch = useAgent((s) => s.touch)
  const running = useAgent((s) => s.chat.wf.phase === 'running' || s.chat.wf.phase === 'applying')
  const [at, setAt] = useState<Box | null>(null)

  // Follows the thing while it moves (a pan, a focus gliding), a few times a second.
  useEffect(() => {
    if (!touch) return
    const find = () => setAt(boxOf(touch.id))
    find()
    const t = setInterval(find, 250)
    return () => clearInterval(t)
  }, [touch])

  // Gone a moment after the turn ends.
  useEffect(() => {
    if (running || !touch) return
    const t = setTimeout(() => useAgent.setState({ touch: null }), LINGER_MS)
    return () => clearTimeout(t)
  }, [running, touch])

  // The preview's own marks say where things change; the agent's look-marks would only cover them.
  const previewing = useAgent((s) => s.chat.wf.phase === 'previewing')
  if (!touch || !at || previewing) return null
  return (
    <div className={styles.ghost} style={{ left: at.x, top: at.y, width: at.w, height: at.h }} data-kind={touch.kind} aria-hidden>
      <i />
      <i />
      <i />
      <i />
      <span className={styles.ghostTag}>agent · {touch.kind === 'change' ? 'changing' : touch.kind === 'ui' ? 'showing' : 'reading'}</span>
    </div>
  )
}
