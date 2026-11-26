// What a conversation is about, beside it on Talk's page (D-435): where the thing is (a picture of its plane, or of the
// canvas, the thing lit; a press shows it there) and who has written in it, who of them is here now. Only where the page
// has room for a third part (Threads.module.css' container). A channel is on nothing: its people alone.
import { useMemo, type CSSProperties } from 'react'
import type { WithId } from '../../../data/hooks'
import type { Thread } from '../../../data/model'
import { CARD } from '../../../data/cards'
import { cardsOn } from '../../../data/places'
import { useMessages } from '../../../data/threads'
import { usePresence } from '../../../data/presence'
import { boundsOf } from '../../../model/layout'
import { Avatar } from '../../../ui/primitives/Avatar'
import { Button } from '../../../ui/primitives/Button'
import { Rule } from '../../../ui/primitives/Rule'
import { useWs } from '../canvas/context'
import { myUid, usePersonColor, type ThreadThing } from './Threads'
import styles from './ThreadAside.module.css'

type Props = { wid: string; thread: WithId<Thread> | null; thing: ThreadThing; where?: string; channel: boolean; onShow?: () => void }

export function ThreadAside({ wid, thread, thing, where, channel, onShow }: Props) {
  const { cards, places, pieces } = useWs()
  const messages = useMessages(wid, thread?.id ?? null)
  const peers = usePresence((s) => s.peers)
  const colorOf = usePersonColor()
  const me = myUid()
  // Everything in its space, as boxes: a card's plane, a piece's canvas.
  const boxes = useMemo(() => {
    if (!thread) return []
    if (thread.on === 'card') return cardsOn(cards, places, thread.planeId).map((c) => ({ id: c.id, x: c.x, y: c.y, w: CARD.w, h: CARD.h }))
    if (thread.on === 'plane') return pieces.map((p) => ({ id: p.id, x: p.x, y: p.y, w: p.w, h: p.h }))
    return []
  }, [thread, cards, places, pieces])
  const b = boxes.length ? boundsOf(boxes) : null
  const people = [...new Map(messages.data.map((m) => [m.uid, m.name]))]
  return (
    <aside className={styles.aside} aria-label="What it's about">
      {!channel && b && boxes.some((x) => x.id === thread?.targetId) && (
        <section>
          <Rule as="div" className={styles.rule} name={where ? where.toUpperCase() : 'WHERE IT IS'} />
          <button /* kit-ok: a picture of where the thing is that goes there */ className={styles.map} title="show it on the canvas" aria-label={`Show ${thing.name || thing.kind} on the canvas`} onClick={onShow} style={thing.tone ? ({ '--tone': thing.tone } as CSSProperties) : undefined}>
            <svg viewBox={`${b.x} ${b.y} ${Math.max(1, b.w)} ${Math.max(1, b.h)}`} preserveAspectRatio="xMidYMid meet" aria-hidden>
              {boxes.map((x) => (
                <rect key={x.id} x={x.x} y={x.y} width={x.w} height={x.h} rx={Math.min(x.w, x.h) / 8} data-it={x.id === thread?.targetId || undefined} />
              ))}
            </svg>
          </button>
          {onShow && (
            <div className={styles.go}>
              <Button onClick={onShow}>show it on the canvas</Button>
            </div>
          )}
        </section>
      )}
      {people.length > 0 && (
        <section>
          <Rule as="div" className={styles.rule} name="IN IT" count={people.length} countAt="end" />
          <ul className={styles.people}>
            {people.map(([uid, name]) => {
              const here = uid === me ? 'here' : peers.find((p) => p.uid === uid)
              return (
                <li key={uid} className={styles.person}>
                  <Avatar size="sm" name={name} color={colorOf(uid)} />
                  <span className={styles.name}>{uid === me ? 'You' : name}</span>
                  <span className={styles.here}>{here === 'here' ? 'here' : here ? (here.away ? 'away' : 'here') : ''}</span>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </aside>
  )
}
