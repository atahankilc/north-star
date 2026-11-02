import { example, type GalleryCtx } from '../../../gallery/example'
import { P, PAZAR } from '../../../gallery/canvas'
import { inFocusAt, onCanvasAt, screen } from '../../../gallery/screens'
import { usePresence, type Peer } from '../../../data/presence'
import { accents } from '../../../styles/tokens'
import { DEMO_DAY } from '../../../demo/clock'

const peer = (uid: string, name: string, color: string, since: number, extra: Partial<Peer> = {}): Peer => ({ uid, name, color, view: 'canvas', since, ts: DEMO_DAY, ...extra })
const AYLA = (extra: Partial<Peer> = {}) => peer('u-ayla', 'Ayla', accents[2], 1, extra)
const JONAS = (extra: Partial<Peer> = {}) => peer('u-jonas', 'Jonas', accents[0], 2, extra)

// Their cursors: PeerCursors draws one per peer in your space with x/y, placed from RTDB's samples (which the gallery
// hasn't got), so the gallery puts each where its x/y is, once the view has settled.
const place = (focus: boolean) => (c: GalleryCtx) => {
  const peers = usePresence.getState().peers
  c.root.querySelectorAll<HTMLElement>('[class*="cursors"] > [class*="cursor"]').forEach((el, i) => {
    const p = peers.filter((q) => q.x !== undefined && (focus ? q.plane : !q.plane))[i]
    const at = p && (focus ? inFocusAt(p.x!, p.y!) : onCanvasAt(p.x!, p.y!))
    if (!at) return
    el.style.visibility = 'visible'
    el.style.transform = `translate(${at[0]}px, ${at[1]}px)`
  })
}
const here = (peers: Peer[], following: string | null = null, focus = false) => async (c: GalleryCtx) => {
  usePresence.setState({ peers, following })
  await c.wait(400)
  place(focus)(c)
}

export default example({
  name: 'Together',
  place: 'hud/presence',
  also: ['motion/camera'],
  file: 'src/views/workspace/canvas/collab.tsx',
  note: 'others here: their cursors, their selections as L’s with a name tag, following (D-065, D-191, D-260)',
  states: {
    cursors: { ...screen({ then: here([AYLA({ x: 420, y: 330 }), JONAS({ x: 1850, y: 300 })]) }), note: 'an arrow each; the name only while you point at it' },
    'their selections': screen({ focus: P.lunch, then: here([AYLA({ plane: P.lunch, sel: 'i-preorder', x: 120, y: 560 }), JONAS({ plane: P.lunch, sel: 'r-greasy', more: 'r-break', x: 300, y: 200 })], null, true) }),
    following: { ...screen({ then: here([AYLA({ x: 600, y: 360 }), JONAS({ x: 2000, y: 400 })], 'u-ayla') }), note: 'the page framed in her colour, `following Ayla · stop`' },
    'following into a plane': screen({ focus: P.lunch, then: here([AYLA({ plane: P.lunch, x: 330, y: 300, sel: 'i-shelf' })], 'u-ayla', true) }),
    'a task held by someone': {
      ...screen({ only: [P.deck], focus: P.deck, then: here([AYLA({ plane: P.deck, drag: `${PAZAR.tasks[0].id} 300 120 1` })], null, true) }),
      note: 'the task as a ghost in her colour where she holds it (PeerTaskDrags)',
    },
  },
})
