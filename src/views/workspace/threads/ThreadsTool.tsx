// The threads tab on the screen's foot, at its left (D-393; it was a tool in the HUD's corner, D-193): one of the foot's
// three tabs, with the dock in the middle and the agent's on the right, the same height, line and corners. Its lamp is
// lit while the list is open; a magenta count of new mentions (`@2`), or of threads with something new.
import type { WithId } from '../../../data/hooks'
import type { Thread } from '../../../data/model'
import { isNew, useReads } from '../../../data/threads'
import { myUid, toggleInbox, useThreadView } from './Threads'
import { Button } from '../../../ui/primitives/Button'
import { ThreadsIcon } from '../../../ui/primitives/hudIcons'
import styles from './Threads.module.css'
import { plural } from '../../../model/words'

export function ThreadsTool({ wid, threads }: { wid: string; threads: WithId<Thread>[] }) {
  const open = useThreadView((s) => s.inbox)
  const me = myUid()
  const seen = useReads(wid, me || null).data?.seen
  const fresh = threads.filter((t) => !t.resolved && isNew(t, seen, t.id, me))
  const mentions = fresh.filter((t) => t.mentions?.includes(me)).length
  return (
    <span className={styles.footTab} data-learn="threads-tab">
      <Button
        pressed={open}
        aria-label={`Threads${mentions ? `, ${mentions} new mention${mentions === 1 ? '' : 's'}` : fresh.length ? `, ${fresh.length} new` : ''}`}
        title={mentions ? `${mentions} new mention${mentions === 1 ? '' : 's'}` : fresh.length ? `${plural(fresh.length, 'thread')} with something new` : 'Every conversation in the workspace'}
        data-viewer-ok
        onClick={() => toggleInbox()}
      >
        <ThreadsIcon />
        threads
        {fresh.length > 0 && <span className={styles.lit}>{mentions ? `@${mentions}` : fresh.length}</span>}
      </Button>
    </span>
  )
}
