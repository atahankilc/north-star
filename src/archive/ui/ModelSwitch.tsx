// The chat header's model (D-104): which model the next message goes to and which key pays. Click to switch it for
// this conversation only, among what the key allows (your list on your own key, the owners' list on the workspace key);
// Settings → assistant keeps the defaults. With [web] on it switches the web-answers model.
import type { AiConfig, KeySource } from '../data/ai'
import { chatKey, modelChoices, ORIGIN_LABEL, resolveModel, useChatModels, useModels } from '../ai/models'
import { TASK_LABEL, useAiSettings } from '../ai/settings'
import { useWs } from '../views/workspace/context'
import { Select } from './Select'
import styles from './ModelSwitch.module.css'

const KEY_LABEL: Record<KeySource, string> = { own: 'your key', workspace: 'workspace key' }
const RESET = '__default'

export function ModelSwitch({ source, config }: { source: KeySource | null; config: AiConfig | null }) {
  const { wid } = useWs()
  const web = useAiSettings((s) => s.web)
  const settings = useAiSettings()
  const models = useModels(wid, source, config)
  const setChat = useChatModels((s) => s.set)
  if (!source || !models) return <span className={styles.label}>no key yet</span>

  const task = web ? 'research' : 'chat'
  const now = models[task]
  // What it would be without this chat's switch.
  const base = resolveModel(task, { source, wid, config, ownModels: settings.ownModels, wsChoice: settings.wsChoice, chat: {} })
  const choices = modelChoices(source, config, [now.model, base.model])
  const options = [
    ...choices.map((id) => ({ value: id, label: id === base.model ? `${id} · ${ORIGIN_LABEL[base.origin]}` : id })),
    ...(now.origin === 'chat' ? [{ value: RESET, label: `back to ${base.model}` }] : []),
  ]

  return (
    <span className={styles.wrap} title={`${TASK_LABEL[task]}: ${now.model} (${ORIGIN_LABEL[now.origin]}) · ${KEY_LABEL[source]}`}>
      <Select
        className={styles.trigger}
        ariaLabel={`Model for ${TASK_LABEL[task]} in this chat`}
        value={now.model}
        options={options}
        onChange={(id) => setChat(chatKey(wid, source), task, id === RESET || id === base.model ? '' : id)}
      />
      <span className={styles.label}>
        {now.origin === 'chat' && <span className={styles.chat}>this chat · </span>}
        {KEY_LABEL[source]}
      </span>
    </span>
  )
}
