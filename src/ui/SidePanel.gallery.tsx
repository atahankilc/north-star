import { example } from '../gallery/example'
import { PanelAction, PanelSection, SidePanel } from './SidePanel'

const none = () => {}

function Problem({ empty }: { empty?: boolean }) {
  return (
    <SidePanel
      kind="problem"
      tone="var(--accent-magenta)"
      title="Lunch near the office is expensive and samey"
      label="problem panel"
      onClose={none}
      actions={
        <>
          <PanelAction label="comment" onClick={none} />
          <PanelAction label="delete" danger onClick={none} />
        </>
      }
    >
      <PanelSection n={1} name="what it is">
        <p style={{ color: 'var(--fg-dim)', margin: 0 }}>testing · +2 −1</p>
      </PanelSection>
      <PanelSection n={2} name="evidence" count={3} add={{ label: 'add', onClick: none }}>
        <ul style={{ margin: 0, paddingLeft: 'var(--space-4)', color: 'var(--fg-dim)' }}>
          <li>6 of 8 interviewed spend over €10</li>
          <li>office canteen closed in 2025</li>
          <li>one said they bring food from home</li>
        </ul>
      </PanelSection>
      <PanelSection n={3} name="tags" empty={empty ?? true} add={{ label: 'tag', onClick: none }} />
    </SidePanel>
  )
}

export default example({
  name: 'SidePanel',
  section: 'ui',
  file: 'src/ui/SidePanel.tsx',
  note: 'every right panel (D-219): 400 px, flush right, full height; with PanelSection and PanelAction',
  states: {
    default: { size: 'full', render: () => <Problem /> },
    'long title': {
      size: 'full',
      render: () => <SidePanel kind="idea" tone="var(--accent-green)" title="A daily fixed menu from three cooks, ordered by nine the night before, picked up at the lobby" label="idea" onClose={none} />,
    },
    'tools and width': {
      size: 'full',
      render: () => (
        <SidePanel kind="task" title="Call the office park" label="task" onClose={none} width={320} tools={<button style={{ background: 'none', border: 0, color: 'var(--fg-dim)', font: 'inherit' }}>[full]</button>}>
          <PanelSection n={1} name="checklist" count="1/3" />
        </SidePanel>
      ),
    },
  },
})
