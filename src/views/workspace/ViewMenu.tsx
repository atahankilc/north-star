// The focus dock's `[view ▾]` on a plane (D-231): how it's shown and handled, in the shared menu (D-222), each
// a checkbox with its key on the right. ARRANGE (editors): snapping to the grid (g) and the alignment guides (a). SHOW:
// the comments' chips (c, D-159). More switches go here, not in the dock.
import { Menu, type MenuEntry } from '../../ui/Menu'
import { toggleGuides, toggleSnap, useGuides } from './guides'
import { toggleThreadPins, useThreadView } from './Threads'

export function ViewMenu({ editor = true }: { editor?: boolean }) {
  const snap = useGuides((s) => s.snap)
  const guides = useGuides((s) => s.guides)
  const comments = useThreadView((s) => s.show)
  const items: MenuEntry[] = [
    ...(editor
      ? [
          { key: 'arrange', heading: 'arrange' },
          { key: 'snap', label: 'snap to the grid', checked: snap, hint: 'g', onSelect: toggleSnap },
          { key: 'guides', label: 'alignment guides', checked: guides, hint: 'a', onSelect: toggleGuides },
        ]
      : []),
    { key: 'show', heading: 'show' },
    { key: 'comments', label: 'comments', checked: comments, hint: 'c', onSelect: toggleThreadPins },
  ]
  return <Menu label="view" up plain data-learn="dock-view" ariaLabel="How this plane is shown" noun="switches" items={items} />
}
