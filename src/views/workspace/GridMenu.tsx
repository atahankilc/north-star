// The focus dock's `[grid ▾]` on a plane (D-232): snapping to the grid and the alignment guides (D-231), each a
// checkbox in the shared menu (D-222), its key on the right; the same switches as `g` and `a`.
import { Menu } from '../../ui/Menu'
import { toggleGuides, toggleSnap, useGuides } from './guides'

export function GridMenu() {
  const snap = useGuides((s) => s.snap)
  const guides = useGuides((s) => s.guides)
  return (
    <Menu
      label="grid"
      up
      ariaLabel="Snapping and guides"
      noun="switches"
      items={[
        { key: 'snap', label: 'snap to the grid', checked: snap, hint: 'g', onSelect: toggleSnap },
        { key: 'guides', label: 'alignment guides', checked: guides, hint: 'a', onSelect: toggleGuides },
      ]}
    />
  )
}
