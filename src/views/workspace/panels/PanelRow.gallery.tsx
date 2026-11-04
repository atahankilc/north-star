import { example } from '../../../gallery/example'
import { PanelRow } from './PanelRow'

const go = () => {}
const Box = ({ children }: { children: React.ReactNode }) => <div style={{ width: 360 }}>{children}</div>

export default example({
  name: 'PanelRow',
  place: 'panels/cards',
  also: ['panels/tasks'],
  file: 'src/views/workspace/panels/PanelRow.tsx',
  note: 'one row of a panel’s list (D-361): links, planes, rests on, matched by; parts and a package’s holds as a tree',
  states: {
    'tinted by the card it goes to (light theme)': () => (
      <Box>
        <PanelRow tone="var(--link-solves)" card="var(--type-problem)" kind="solves →" name="Cooks waste an hour a day" onGo={go} type="problem" />
        <PanelRow tree={{ depth: 0, mark: '▌', tone: 'var(--type-feature)' }} card="var(--type-feature)" name="Lunch preorder" onGo={go} type="planned" />
        <PanelRow tone="var(--accent-yellow)" card="var(--type-competitor)" kind="≈ theirs" name="Toast · Order ahead" onGo={go} type="paid" />
      </Box>
    ),
    links: () => (
      <Box>
        <PanelRow tone="var(--accent-magenta)" kind="solves →" name="Cooks waste an hour a day" onGo={go} type="problem" onRemove={go} removeTitle="Unlink" />
        <PanelRow tone="var(--accent-magenta)" kind="· solves" faint name="Menus change daily" onGo={go} type="testing" />
        <PanelRow tone="var(--accent-yellow)" kind="≈ theirs" name="Toast · Order ahead" onGo={go} type="paid" onRemove={go} />
      </Box>
    ),
    tree: () => (
      <Box>
        <PanelRow tree={{ depth: 0, mark: '▌', tone: 'var(--type-feature)' }} name="Lunch preorder" onGo={go} type="P1" onRemove={go} />
        <PanelRow tree={{ depth: 1, mark: '├' }} name="Pick a slot" onGo={go} type="planned" />
        <PanelRow tree={{ depth: 1, mark: '└' }} name="Pay ahead" onGo={go} type="idea" />
      </Box>
    ),
    'read only': () => (
      <Box>
        <PanelRow tone="var(--fg)" name="01 Pazar" onGo={go} type="here" />
      </Box>
    ),
  },
})
