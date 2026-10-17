// What differs between the idea canvas and the features board (D-037). Everything else is shared.
import type { BoardNode, BoardType, Feature } from '../../data/model'

type Kind = {
  label: string
  addLabel: string
  empty: string
  placeholder: string
}

export const BOARD_KINDS: Record<BoardType, Kind> = {
  idea: {
    label: 'idea',
    addLabel: '+ Idea',
    empty: 'Double-click anywhere to pin your first idea',
    placeholder: "What's the thought?",
  },
  feature: {
    label: 'feature',
    addLabel: '+ Feature',
    empty: 'Double-click anywhere to add a feature, or promote an idea',
    placeholder: 'What does it do, and for whom?',
  },
}

// The card's bottom line.
export function cardMeta(type: BoardType, node: BoardNode): string {
  const tags = (node.tags ?? []).map((t) => `#${t}`).join('  ')
  if (type === 'idea') return tags
  const f = node as Feature
  return [[f.priority, f.status, f.effort].filter(Boolean).join(' · '), tags].filter(Boolean).join('   ')
}
