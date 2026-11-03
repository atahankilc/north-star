// Writes past what one batch takes (D-361): the items cut into batches of `size` (WRITE_BATCH_MAX unless said; fewer
// where a batch's rules read other docs), each filled by `put`. The caller commits them: all at once where they apply
// to the cache together (an undo step, apply), one after the other where a rule reads what the last one left (a
// workspace's delete). Import cuts by bytes too, so it keeps its own.
import { writeBatch, type WriteBatch } from 'firebase/firestore'
import { db } from './firebase'
import { WRITE_BATCH_MAX } from '../model/limits'

export function inBatches<T>(items: readonly T[], put: (batch: WriteBatch, item: T) => void, size = WRITE_BATCH_MAX): WriteBatch[] {
  const out: WriteBatch[] = []
  for (let i = 0; i < items.length; i += size) {
    const batch = writeBatch(db())
    for (const item of items.slice(i, i + size)) put(batch, item)
    out.push(batch)
  }
  return out
}
