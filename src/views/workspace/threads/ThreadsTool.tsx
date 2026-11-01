// The threads tool in the bottom-left corner, just above your square (D-193): the comment mark, cyan while the threads
// panel is open; a magenta count of new mentions in its corner, or a magenta dot while anything else is new.
import type { WithId } from '../../../data/hooks'
import type { Thread } from '../../../data/model'
import { isNew, useReads } from '../../../data/threads'
import { myUid, toggleInbox, useThreadView } from './Threads'
import { ToolButton } from '../../../ui/primitives/ToolButton'
import { ThreadsIcon } from '../../../ui/primitives/hudIcons'

export function ThreadsTool({ wid, threads }: { wid: string; threads: WithId<Thread>[] }) {
  const open = useThreadView((s) => s.inbox)
  const me = myUid()
  const seen = useReads(wid, me || null).data?.seen
  const fresh = threads.filter((t) => !t.resolved && isNew(t, seen, t.id, me))
  const mentions = fresh.filter((t) => t.mentions?.includes(me)).length
  return (
    <ToolButton
      pressed={open}
      badge={mentions}
      dot={fresh.length > 0}
      label={`Threads${mentions ? `, ${mentions} new mention${mentions === 1 ? '' : 's'}` : fresh.length ? `, ${fresh.length} new` : ''}`}
      title={mentions ? `${mentions} new mention${mentions === 1 ? '' : 's'}` : fresh.length ? `${fresh.length} thread${fresh.length === 1 ? '' : 's'} with something new` : 'Threads'}
      data-viewer-ok
      onClick={() => toggleInbox()}
    >
      <ThreadsIcon />
    </ToolButton>
  )
}
