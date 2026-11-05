// Writes past what one batch takes (D-361): the items cut into batches of `size` (WRITE_BATCH_MAX unless said; fewer
// where a batch's rules read other docs), each filled by `put`. The caller commits them one after the other where a rule
// reads what the last one left (a workspace's delete). Import cuts by bytes too, so it keeps its own.
import { writeBatch, type WriteBatch } from 'firebase/firestore'
import { db } from './firebase'
import { ATOMIC_WRITE_BYTES, ATOMIC_WRITE_MAX, WRITE_BATCH_MAX } from '../model/limits'

export function inBatches<T>(items: readonly T[], put: (batch: WriteBatch, item: T) => void, size = WRITE_BATCH_MAX): WriteBatch[] {
  const out: WriteBatch[] = []
  for (let i = 0; i < items.length; i += size) {
    const batch = writeBatch(db())
    for (const item of items.slice(i, i + size)) put(batch, item)
    out.push(batch)
  }
  return out
}

// A doc's size as batches count it: its JSON, nothing for no doc.
export const docBytes = (data: unknown): number => JSON.stringify(data)?.length ?? 0

// A write that should land whole (apply, undo, redo; D-369): ONE batch, all or nothing, while it's within
// ATOMIC_WRITE_MAX docs and ATOMIC_WRITE_BYTES. Past either it can't be: cut at WRITE_BATCH_MAX docs or those bytes, and
// the caller says so when only part lands (PartlyWritten). The caller commits every batch at once: they apply to the
// local cache together, so a step's `after` sees them all.
export function wholeBatches<T>(items: readonly T[], bytesOf: (item: T) => number, put: (batch: WriteBatch, item: T) => void): WriteBatch[] {
  const sizes = items.map(bytesOf)
  if (items.length <= ATOMIC_WRITE_MAX && sizes.reduce((a, b) => a + b, 0) <= ATOMIC_WRITE_BYTES) return inBatches(items, put, items.length)
  const out: WriteBatch[] = []
  let batch: WriteBatch | null = null
  let n = 0
  let size = 0
  items.forEach((item, i) => {
    if (!batch || n >= WRITE_BATCH_MAX || size + sizes[i] > ATOMIC_WRITE_BYTES) {
      batch = writeBatch(db())
      out.push(batch)
      n = 0
      size = 0
    }
    put(batch, item)
    n++
    size += sizes[i]
  })
  return out
}
