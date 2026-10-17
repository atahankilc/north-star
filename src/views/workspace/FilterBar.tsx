// `[ SHOW all ▾ ] [ FOR any ▾ ] [ TAG any ▾ ] [ GO TO ▾ ]` under the HUD (docs/specs/board.md §3, D-053, D-056).
import { useMemo } from 'react'
import { BOARD_TYPES } from '../../data/model'
import { useWsView } from '../../state/workspaceView'
import { Menu, type MenuEntry } from '../../ui/Menu'
import { BOARD_KINDS, TYPE_ACCENT, useAllTags, useBoardItems } from '../canvas/boardKinds'
import { useWs } from './context'
import styles from './Bars.module.css'

type Props = {
  // The board's jump list (D-050); other views leave it out.
  goTo?: { key: string; label: string; onSelect: () => void }[]
}

export function FilterBar({ goTo }: Props) {
  const { customers } = useWs()
  const { types, forIds, tags, toggleType, toggleFor, clearFor, toggleTag, clearTags } = useWsView()
  const allTags = useAllTags(useBoardItems())
  const sorted = useMemo(() => [...customers].sort((a, b) => a.createdAt - b.createdAt), [customers])

  const show: MenuEntry[] = BOARD_TYPES.map((t) => ({
    key: t,
    label: BOARD_KINDS[t].plural,
    checked: types.includes(t),
    tone: TYPE_ACCENT[t],
    onSelect: () => toggleType(t),
  }))

  const forItems: MenuEntry[] = [
    { key: 'any', label: 'any customer', checked: forIds.length === 0, onSelect: clearFor },
    ...sorted.map((c) => ({
      key: c.id,
      label: c.title || 'Untitled',
      checked: forIds.includes(c.id),
      tone: 'var(--accent-green)',
      onSelect: () => toggleFor(c.id),
    })),
  ]
  const forSummary =
    forIds.length === 0 ? 'any' : forIds.length === 1 ? (sorted.find((c) => c.id === forIds[0])?.title ?? '1') : `${forIds.length}`

  const tagItems: MenuEntry[] = [
    { key: 'any', label: 'any tag', checked: tags.length === 0, onSelect: clearTags },
    ...allTags.map(({ tag, count }) => ({
      key: tag,
      label: `#${tag}`,
      checked: tags.includes(tag),
      hint: `${count}`,
      onSelect: () => toggleTag(tag),
    })),
  ]
  const tagSummary = tags.length === 0 ? 'any' : tags.length === 1 ? `#${tags[0]}` : `${tags.length}`

  return (
    <div className={styles.filters}>
      <Menu
        label="show"
        summary={types.length === BOARD_TYPES.length ? 'all' : `${types.length}/${BOARD_TYPES.length}`}
        items={show}
        ariaLabel="Show item types"
      />
      <Menu
        label="for"
        summary={forSummary}
        items={forItems}
        ariaLabel="Only items for these customers"
        empty="No customers yet: create one with +"
      />
      <Menu
        label="tag"
        summary={tagSummary}
        items={allTags.length ? tagItems : []}
        ariaLabel="Only items with these tags"
        empty="No tags yet: add some in a card's panel"
      />
      {goTo && (
        <Menu
          label="go to"
          items={goTo.map((g, i) => ({ ...g, glyph: '↳', hint: i < 9 ? `${i + 1}` : undefined }))}
          ariaLabel="Go to a label on the board"
          empty="Write text on the board (+ → Text) to jump to it from here"
        />
      )}
    </div>
  )
}
