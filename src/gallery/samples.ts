// Made-up values the examples share (D-361's round 2, R2): each example file had its own copy.
import { today } from '../model/tasks'
import type { Task } from '../data/tasks'

// A handler that does nothing: an example shows the control, its press goes nowhere.
export const none = () => {}

// A card's title, by type (Pazar's).
export const TITLE = { customer: 'Office workers near the market', problem: 'Lunch takes too long', competitor: 'Lunchpost', idea: 'Pre-order at the stall', feature: 'Order by QR code', package: 'Pickup at work' } as const

// The day `n` days from today, as a task writes it.
export const day = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return today(d)
}

// A task with nothing but what every task has.
export const baseTask: Task = { id: 't', pieceId: 'deck', col: 'todo', order: 1, title: 'Ask five stall owners what they lose a week', uid: 'u', createdAt: 0, updatedAt: 0 }
