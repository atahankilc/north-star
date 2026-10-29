// Every eval task (agent.md §8: Find & answer 10, Small edits 8, Big builds 8, Context 5, Refuse/ask 4, Injection 5).
// A new bug a person hits becomes a task here before it's fixed.
import type { Task } from '../types'
import { FIND } from './find'
import { EDIT } from './edit'
import { BUILD } from './build'
import { CONTEXT } from './context'
import { REFUSE } from './refuse'
import { INJECTION } from './injection'

export const TASKS: Task[] = [...FIND, ...EDIT, ...BUILD, ...CONTEXT, ...REFUSE, ...INJECTION]
