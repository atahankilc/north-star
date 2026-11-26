import { useState } from 'react'
import { example } from '../../gallery/example'
import { CountBadge } from '../primitives/CountBadge'
import { SideList } from './SideList'

function Demo({ start }: { start: string }) {
  const [on, setOn] = useState(start)
  return (
    <SideList
      label="Settings"
      current={on}
      onPick={setOn}
      groups={[
        { name: 'you', items: [{ id: 'account', label: 'account' }, { id: 'display', label: 'display' }, { id: 'agent', label: 'the agent' }] },
        { name: 'workspace', aside: 'Pazar', items: [{ id: 'general', label: 'general' }, { id: 'people', label: 'people', extra: <CountBadge count={2} tone="cyan" placement="inline" /> }] },
      ]}
    />
  )
}

export default example({
  name: 'SideList',
  place: 'overlays/settings',
  file: 'src/ui/patterns/SideList.tsx',
  note: "a page's side list (D-404): Settings' menu and the backoffice's (D-434); a row of tabs on a narrow screen",
  states: { 'on a page': () => <Demo start="account" />, 'a badge, a group named': () => <Demo start="people" /> },
})
