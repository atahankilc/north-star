// Docs' button (D-412): at the HUD's foot, under Talk and Tasks; it opens Docs, a place beside the canvas (or the page).
import { ToolButton } from '../../../ui/primitives/ToolButton'
import { DocsIcon } from '../../../ui/primitives/hudIcons'
import { openPlace, usePlace } from '../places/placeStore'

export function DocsTool() {
  const open = usePlace((s) => s.open === 'docs')
  return (
    <ToolButton data-learn="docs" pressed={open} label="Docs" title="Docs: every document you may see" data-viewer-ok onClick={() => openPlace('docs')}>
      <DocsIcon />
    </ToolButton>
  )
}
