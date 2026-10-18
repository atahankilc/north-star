// Which key this workspace's assistant calls use right now (D-079), or null when there's none to use.
import { canUseWorkspaceKey, useAiConfig, type KeySource } from '../data/ai'
import { useAuth } from '../data/auth'
import { isOwnerOf } from '../data/workspaces'
import { useWs } from '../views/workspace/context'
import { keySourceFor, useAiSettings } from './settings'

export function useKeySource(): { source: KeySource | null; workspaceKeyExists: boolean; workspaceKeyUsable: boolean } {
  const { wid, workspace } = useWs()
  const { user } = useAuth()
  const config = useAiConfig(wid).data
  const apiKey = useAiSettings((s) => s.apiKey)
  const keyChoice = useAiSettings((s) => s.keyChoice)
  const usable = canUseWorkspaceKey(config, user?.id, isOwnerOf(workspace, user?.id))
  return {
    source: keySourceFor({ apiKey, keyChoice }, wid, usable),
    workspaceKeyExists: Boolean(config?.hasKey),
    workspaceKeyUsable: usable,
  }
}
