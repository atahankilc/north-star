// Talk's button (D-412: the threads are a place, beside the canvas or as the page), at the HUD's foot. Before, the threads tool in the HUD's bottom-left corner, above your square (D-402, as D-193 had it; for a while a tab on the
// screen's foot, D-393): the comment mark, lit while the list is open; a magenta count of new mentions in its corner, or
// a magenta dot while anything else is new.
import type { WithId } from '../../../data/hooks'
import type { Thread } from '../../../data/model'
import { isNew, useReads } from '../../../data/threads'
import { myUid } from './Threads'
import { openPlace, usePlace } from '../places/placeStore'
import { ToolButton } from '../../../ui/primitives/ToolButton'
import { ThreadsIcon } from '../../../ui/primitives/hudIcons'
import { plural } from '../../../model/words'

export function ThreadsTool({ wid, threads }: { wid: string; threads: WithId<Thread>[] }) {
  const open = usePlace((s) => s.open === 'talk')
  const me = myUid()
  const seen = useReads(wid, me || null).data?.seen
  const fresh = threads.filter((t) => !t.resolved && isNew(t, seen, t.id, me))
  const mentions = fresh.filter((t) => t.mentions?.includes(me)).length
  return (
    <ToolButton
      pressed={open}
      badge={mentions}
      dot={fresh.length > 0}
      label={`Talk${mentions ? `, ${plural(mentions, 'new mention')}` : fresh.length ? `, ${fresh.length} new` : ''}`}
      title={mentions ? plural(mentions, 'new mention') : fresh.length ? `${plural(fresh.length, 'thread')} with something new` : 'Talk: every conversation in the workspace'}
      data-viewer-ok
      onClick={() => openPlace('talk')}
    >
      <ThreadsIcon />
    </ToolButton>
  )
}
