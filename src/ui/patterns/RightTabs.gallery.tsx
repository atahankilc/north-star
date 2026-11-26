import { useLayoutEffect } from 'react'
import { example } from '../../gallery/example'
import { useRightColumn } from '../foundation/rightColumn'
import { RightTabs } from './RightTabs'

function Both({ front }: { front: 'thing' | 'agent' }) {
  useLayoutEffect(() => {
    useRightColumn.setState({ thing: 'feature', agent: true, front })
    return () => useRightColumn.setState({ thing: null, agent: false })
  }, [front])
  return <RightTabs />
}

export default example({
  name: 'RightTabs',
  place: 'panels/frame',
  file: 'src/ui/patterns/RightTabs.tsx',
  note: 'the right side is one column (D-435): the thing selected and the agent share it, as wide as the agent’s, by these tabs over the panel’s own head; nothing while only one of them is there; what came last is in front',
  states: {
    'the thing in front': { render: () => <Both front="thing" /> },
    'the agent in front': { render: () => <Both front="agent" /> },
  },
})
