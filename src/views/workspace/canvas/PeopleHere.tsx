// Who else is in this workspace right now (D-065, D-067, D-169; bottom left above the threads button, D-193): a square per person, in the colour their cursor, rings
// and tags use, no names; the squares overlap, the name and where they are show on hover, and past MAX a `+N` opens the
// list of everyone. A click follows them, totally (D-191, collab.tsx): their space, their cursor, their selection; a
// second click, Escape, or a pan or zoom of your own stops it. While following, the page is framed in their colour.
// Someone away (D-331: their tab hidden, or untouched for a while) is drawn faint, last, `away` on hover; a click on them
// starts no following (one already going goes on).
// Past MAX, `+N` is the kit's Menu (D-406: the list was its own, with its own outside press and Escape): everyone here
// as its rows, their circle before the name, where they are on the right, the one followed lit.
import { useState } from 'react'
import { usePresence, type Peer } from '../../../data/presence'
import { useThemeAccent } from '../../../state/theme'
import { useEscapeLayer } from '../../../ui/foundation/useEscapeLayer'
import { Menu } from '../../../ui/patterns/Menu'
import { Avatar } from '../../../ui/primitives/Avatar'
import { useWs } from './context'
import styles from './PeopleHere.module.css'

// Squares shown before `+N`.
const MAX = 4

export function PeopleHere() {
  const peers = usePresence((s) => s.peers)
  const following = usePresence((s) => s.following)
  const follow = usePresence((s) => s.follow)
  const leader = peers.find((p) => p.uid === following)
  const tone = useThemeAccent()
  const { pieces, canvases } = useWs()
  // Where someone is: the canvas, or the plane they have in focus; with several canvases, which (D-302).
  const canvasName = (p: Peer) => (canvases.length > 1 ? canvases.find((c) => c.id === (p.canvas ?? 'main'))?.name : undefined)
  const place = (p: Peer) => (p.plane ? `in ${pieces.find((x) => x.id === p.plane)?.name || 'a plane'}` : `on ${canvasName(p) ?? 'the canvas'}`)
  const where = (p: Peer) => (p.away ? `away · ${place(p)}` : place(p))
  const toggle = (p: Peer) => {
    if (following === p.uid) follow(null)
    else if (!p.away) follow(p.uid)
  }
  // The list (a Menu) closes on Escape before Escape stops following (D-191: that layer is heard first otherwise).
  const [listOpen, setListOpen] = useState(false)
  useEscapeLayer(() => follow(null), { on: !!following && !listOpen, first: true })

  if (peers.length === 0) return null

  const shown = peers.length <= MAX ? peers : peers.slice(0, MAX - 1)
  const more = peers.length - shown.length
  return (
    <div className={styles.root} data-learn="people" data-filled>
      <ul className={`${styles.people} ${styles.stack}`} aria-label={`${peers.length} more ${peers.length === 1 ? 'person' : 'people'} here`}>
        {shown.map((p) => {
          const on = following === p.uid
          return (
            <li key={p.uid}>
              <button /* kit-ok: a person's circle in the HUD's stack, overlapping the next, edged in their colour */
                className={styles.person}
                style={{ ['--peer' as string]: tone(p.color) }}
                data-away={p.away || undefined}
                aria-label={`${p.name}, ${where(p)}${on ? ', following' : ''}`}
                aria-pressed={on}
                onClick={() => toggle(p)}
              >
                <Avatar name={p.name} photo={p.photo} color={tone(p.color)} away={p.away} className={styles.swatch} />
                <span className={styles.tip} aria-hidden>
                  {p.name} <span className={styles.where}>· {on ? 'click to stop' : where(p)}</span>
                </span>
              </button>
            </li>
          )
        })}
        {more > 0 && (
          <li className={styles.more}>
            <Menu
              icon
              quiet
              hud
              right
              label={`+${more}`}
              ariaLabel={`${more} more · everyone here`}
              prompt="find someone…"
              onOpen={() => setListOpen(true)}
              onClose={() => setListOpen(false)}
              items={peers.map((p) => ({
                key: p.uid,
                label: p.name,
                glyph: <Avatar name={p.name} photo={p.photo} color={tone(p.color)} away={p.away} size="sm" />,
                hint: following === p.uid ? 'following' : where(p),
                current: following === p.uid,
                faint: p.away,
                onSelect: () => toggle(p),
              }))}
            />
          </li>
        )}
      </ul>
      {leader && (
        <div className={styles.following} style={{ ['--peer' as string]: tone(leader.color) }}>
          <button /* kit-ok: the tag that says whom you follow, filled in their colour (D-191) */ className={styles.followTag} data-learn="follow-label" onClick={() => follow(null)}>
            following {leader.name} · {where(leader)} <span className={styles.stop}>stop</span>
          </button>
        </div>
      )}
    </div>
  )
}

