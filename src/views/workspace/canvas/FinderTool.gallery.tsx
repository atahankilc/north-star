import { useEffect } from 'react'
import { example } from '../../../gallery/example'
import { useFind } from '../find/find'
import { FinderTool } from './FinderTool'

// The finder open while shown (only its state: the finder itself isn't mounted here); closed again after.
function Open() {
  useEffect(() => {
    useFind.setState({ open: true })
    return () => useFind.setState({ open: false })
  }, [])
  return <FinderTool />
}

export default example({
  name: 'FinderTool',
  place: 'hud/navigation',
  file: 'src/views/workspace/canvas/FinderTool.tsx',
  note: 'the side nav’s compass (D-236), the same as ⌘F: cyan while the finder is open',
  states: {
    default: () => <FinderTool />,
    open: () => <Open />,
  },
})
