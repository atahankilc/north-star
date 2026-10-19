// `[ SHOW all ▾ ] [ FOR any ▾ ] [ TAG any ▾ ] [ REGION any ▾ ] [ GO TO ▾ ] [ COMMENTS 2 ▾ ]` under the HUD (docs/specs/board.md §3, D-053, D-056).
import { useMemo, type ReactNode } from 'react'
import { BOARD_TYPES } from '../../data/model'
import { QUIET_LINKS, useWsView } from '../../state/workspaceView'
import { Menu, type MenuEntry } from '../../ui/Menu'
import menuStyles from '../../ui/Menu.module.css'
import { BOARD_KINDS, TYPE_ACCENT, useAllTags, useBoardItems } from '../canvas/boardKinds'
import { LINK_GROUPS, LINK_TONE } from '../canvas/linkKinds'
import { PlaneFilter } from '../canvas/PlaneSwitcher'
import { RegionFilter } from '../competitors/RegionFilter'
import { useWs } from './context'
import styles from './Bars.module.css'

type Props = {
  // The board's jump list (D-050); other views leave it out.
  goTo?: { key: string; label: string; onSelect: () => void }[]
  // The board's link filter, which is also its colour key (D-108); other views leave it out.
  links?: boolean
  // The focus view's card picker (D-127): what it's on, and every card to choose from.
  focus?: { summary: string; items: MenuEntry[] }
  // The board's plane switcher (D-139), first in the bar.
  plane?: ReactNode
  // The board's comment threads (D-159): the pins' switch and every thread, last in the bar.
  comments?: { summary: string; active: boolean; items: MenuEntry[] }
}

export function FilterBar({ goTo, links, focus, plane, comments }: Props) {
  const { customers } = useWs()
  const { types, forIds, tags, hiddenLinks, toggleType, toggleFor, clearFor, toggleTag, clearTags, toggleLinks, showAllLinks } = useWsView()
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

  const linkItems: MenuEntry[] = [
    { key: 'all', label: 'every link', checked: hiddenLinks.length === 0, onSelect: showAllLinks },
    ...LINK_GROUPS.map((g) => ({
      key: g.key,
      label: g.label,
      checked: !hiddenLinks.includes(g.key),
      tone: LINK_TONE[g.key],
      glyph: '━',
      onSelect: () => toggleLinks(g.key),
    })),
  ]

  return (
    // Hidden in the assistant's bare preview screen (D-087).
    <div className={styles.filters} data-preview-hide>
      {/* The board has its own switcher; the focus view is on All; the other views filter by plane (D-143). */}
      {plane ?? (!focus && <PlaneFilter />)}
      {focus && (
        <Menu
          label="focus"
          summary={focus.summary}
          active={focus.summary !== 'none'}
          items={focus.items}
          ariaLabel="Focus on a card"
          search="find a card"
          empty="No cards yet: add some on the board"
        />
      )}
      <Menu
        label="show"
        summary={BOARD_TYPES.map((t) => (
          <span key={t} className={menuStyles.swatch} data-on={types.includes(t)} style={{ ['--tone' as string]: TYPE_ACCENT[t] }} />
        ))}
        active={types.length < BOARD_TYPES.length}
        items={show}
        ariaLabel="Show item types"
      />
      <Menu
        label="for"
        summary={forSummary}
        active={forIds.length > 0}
        items={forItems}
        ariaLabel="Only items for these customers"
        empty="No customers yet: create one with +"
      />
      <Menu
        label="tag"
        summary={tagSummary}
        active={tags.length > 0}
        items={allTags.length ? tagItems : []}
        ariaLabel="Only items with these tags"
        empty="No tags yet: add some in a card's panel"
      />
      <RegionFilter />
      {links && (
        <Menu
          label="links"
          summary={LINK_GROUPS.map((g) => (
            <span key={g.key} className={menuStyles.swatch} data-on={!hiddenLinks.includes(g.key)} style={{ ['--tone' as string]: LINK_TONE[g.key] }} />
          ))}
          // `relates`, customer tags (D-128) and competes lines (D-135) are hidden by default, so only hiding another group
          // counts as narrowing.
          active={hiddenLinks.some((g) => !QUIET_LINKS.includes(g))}
          items={linkItems}
          ariaLabel="Show links by kind"
        />
      )}
      {goTo && (
        <Menu
          label="go to"
          items={goTo.map((g, i) => ({ ...g, glyph: '↳', hint: i < 9 ? `${i + 1}` : undefined }))}
          ariaLabel="Go to a label on the board"
          search="find a place"
          empty="Write a heading on the board (+ → Text) to jump to it from here"
        />
      )}
      {comments && <Menu label="comments" summary={comments.summary} active={comments.active} items={comments.items} ariaLabel="Comment threads" />}
    </div>
  )
}
