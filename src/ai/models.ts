// Which model each assistant call uses (D-104). Models belong to the key that pays:
// - your own key: your default per task, or this workspace's override (only you, this browser);
// - the workspace key: the owners' pick per task, or one of the models they allow that you chose (the server refuses
//   anything else, functions/src/index.ts);
// and on top of either, a switch in the chat header for this conversation only (within what the key allows).
import { create } from 'zustand'
import { useChat } from './chat'
import type { AiConfig, KeySource } from '../data/ai'
import { AI_TASKS, DEFAULT_MODELS, MODELS, type AiTask, type TaskModels } from './settings'
import { useAiSettings } from './settings'

// Where a task's model comes from, said in the UI so it's clear who it applies to.
export type ModelOrigin = 'chat' | 'workspace' | 'default' | 'owners' | 'you'
export const ORIGIN_LABEL: Record<ModelOrigin, string> = {
  chat: 'this chat only',
  workspace: 'your pick for this workspace',
  default: 'your default',
  owners: "the owners' pick",
  you: 'your pick, allowed by the owners',
}

export type Resolved = { model: string; origin: ModelOrigin }

// The owners' model for a task on the workspace key.
export const ownersModel = (config: AiConfig | null | undefined, task: AiTask) => config?.models?.[task] ?? DEFAULT_MODELS[task]

// Every model the workspace key may be used with: the owners' picks and the extras they allow (the server's list).
export function workspaceModels(config: AiConfig | null | undefined): string[] {
  const picks = AI_TASKS.map((t) => ownersModel(config, t))
  return [...new Set([...picks, ...(config?.allowedModels ?? [])])]
}

// The models a switch offers for a key: the known list and anything already chosen (own key); what owners allow (workspace).
export function modelChoices(source: KeySource, config: AiConfig | null | undefined, chosen: string[] = []): string[] {
  if (source === 'workspace') return workspaceModels(config)
  return [...new Set([...MODELS.map((m) => m.id), ...chosen])]
}

type Inputs = {
  source: KeySource
  wid: string
  config: AiConfig | null | undefined
  ownModels: ReturnType<typeof useAiSettings.getState>['ownModels']
  wsChoice: Record<string, TaskModels>
  chat: TaskModels
}

export function resolveModel(task: AiTask, i: Inputs): Resolved {
  if (i.source === 'workspace') {
    const allowed = workspaceModels(i.config)
    const fromChat = i.chat[task]
    if (fromChat && allowed.includes(fromChat)) return { model: fromChat, origin: 'chat' }
    const mine = i.wsChoice[i.wid]?.[task]
    if (mine && allowed.includes(mine) && mine !== ownersModel(i.config, task)) return { model: mine, origin: 'you' }
    return { model: ownersModel(i.config, task), origin: 'owners' }
  }
  if (i.chat[task]) return { model: i.chat[task]!, origin: 'chat' }
  const here = i.ownModels.byWorkspace[i.wid]?.[task]
  if (here) return { model: here, origin: 'workspace' }
  return { model: i.ownModels.default[task], origin: 'default' }
}

// This conversation's switch (the chat header), per workspace and key; cleared with the chat.
type ChatModels = { key: string; models: TaskModels; set: (key: string, task: AiTask, id: string) => void; reset: () => void }
export const useChatModels = create<ChatModels>((set) => ({
  key: '',
  models: {},
  set: (key, task, id) =>
    set((s) => {
      const models = s.key === key ? { ...s.models } : {}
      if (id) models[task] = id
      else delete models[task]
      return { key, models }
    }),
  reset: () => set({ key: '', models: {} }),
}))
export const chatKey = (wid: string, source: KeySource) => `${wid}:${source}`

// Every task's model for this workspace and key, with where it comes from.
export function useModels(wid: string, source: KeySource | null, config: AiConfig | null | undefined): Record<AiTask, Resolved> | null {
  const ownModels = useAiSettings((s) => s.ownModels)
  const wsChoice = useAiSettings((s) => s.wsChoice)
  const chat = useChatModels((s) => (source && s.key === chatKey(wid, source) ? s.models : EMPTY))
  if (!source) return null
  const i: Inputs = { source, wid, config, ownModels, wsChoice, chat }
  return { chat: resolveModel('chat', i), research: resolveModel('research', i), deep: resolveModel('deep', i) }
}
const EMPTY: TaskModels = {}

// Just the ids, for a call.
export const modelIds = (m: Record<AiTask, Resolved>): Record<AiTask, string> => ({ chat: m.chat.model, research: m.research.model, deep: m.deep.model })

// A cleared (or new) conversation starts on the defaults again.
useChat.subscribe((s, prev) => {
  if (s.messages.length === 0 && prev.messages.length > 0) useChatModels.getState().reset()
})

// Dev-only handle for automation.
if (import.meta.env.DEV) (window as unknown as { __chatModels: typeof useChatModels }).__chatModels = useChatModels
