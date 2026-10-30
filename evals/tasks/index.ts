// Every eval task (agent.md §8: Find & answer 10, Small edits 8 + 5 on the preview (S13), Big builds 8, Context 5, Refuse/ask 4, Injection 5; Memory 3, S16; Skills 61, S17: three per `/` command + 7 judged twins).
// A new bug a person hits becomes a task here before it's fixed.
import type { Task } from '../types'
import { FIND } from './find'
import { EDIT } from './edit'
import { BUILD } from './build'
import { CONTEXT } from './context'
import { REFUSE } from './refuse'
import { INJECTION } from './injection'
import { MEMORY } from './memory'
import { SKILL_TASKS } from './skills'

export const TASKS: Task[] = [...FIND, ...EDIT, ...BUILD, ...CONTEXT, ...REFUSE, ...INJECTION, ...MEMORY, ...SKILL_TASKS]
