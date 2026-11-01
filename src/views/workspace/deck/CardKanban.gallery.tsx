import { example } from '../../../gallery/example'
import { onCanvas, PAZAR } from '../../../gallery/canvas'
import { emptyKanban } from '../../../data/tasks'
import { KANBAN_TEMPLATES } from '../../../model/kanbanCards'
import type { WithId } from '../../../data/hooks'
import type { Piece } from '../../../data/model'

const AT = PAZAR.workspace.createdAt + 9 * 24 * 3600 * 1000
const deck = (id: string, name: string, t: number): WithId<Piece> => ({ id, kind: 'kanban', x: 0, y: 1550, w: 1500, h: 700, name, kanban: { ...emptyKanban(), ...KANBAN_TEMPLATES[t].setup() }, createdAt: AT, updatedAt: AT })
const PRIORITIES = deck('k-priorities', '08 Priorities', KANBAN_TEMPLATES.findIndex((t) => t.key === 'priorities'))
const with_ = (p: WithId<Piece>) => (ws: typeof PAZAR) => ({ ...ws, pieces: [...ws.pieces, p] })

export default example({
  name: 'Cards deck',
  place: 'canvas/pieces',
  file: 'src/views/workspace/deck/CardKanban.tsx',
  note: 'a deck holding cards: columns and rows are fields, a drop sets them (D-253, D-268)',
  states: {
    'priorities: on the canvas': onCanvas({ only: [PRIORITIES.id], change: with_(PRIORITIES) }),
    'priorities: in focus': onCanvas({ only: [PRIORITIES.id], change: with_(PRIORITIES), focus: PRIORITIES.id, note: 'effort × impact, the corners named (D-271)' }),
    ...Object.fromEntries(
      KANBAN_TEMPLATES.flatMap((tpl, i) => {
        if (tpl.key === 'tasks' || tpl.key === 'priorities') return []
        const d = deck(`k-${tpl.key}`, `09 ${tpl.name}`, i)
        return [[tpl.name, onCanvas({ only: [d.id], change: with_(d), focus: d.id, note: tpl.hint })]]
      }),
    ),
  },
})
