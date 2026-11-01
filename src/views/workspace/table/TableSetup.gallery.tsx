import { example } from '../../../gallery/example'
import { onCanvas, P } from '../../../gallery/canvas'
import { useTableUi, TABLE_TABS } from './Table'

export default example({
  name: 'Table setup',
  place: 'panels/setups',
  also: ['forms/layout'],
  file: 'src/views/workspace/table/TableSetup.tsx',
  note: 'a table’s `[setup]` in focus: rows (rules), columns, view',
  states: Object.fromEntries(TABLE_TABS.map((tab) => [tab, onCanvas({ only: [P.table], focus: P.table, then: () => useTableUi.setState({ setup: P.table, tab }) })])),
})
