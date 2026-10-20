// An item's tags (D-056, D-057): the tag picker, suggesting every tag already used in the workspace. Saves at once (undoable).
import type { BoardType } from '../../data/model'
import { updateNode } from '../../data/nodes'
import { TagInput } from '../../ui/TagInput'
import { useAllTags, useBoardItems } from '../canvas/boardKinds'
import { useWs } from './context'

export function ItemTags({ item }: { item: { id: string; type: BoardType; tags: string[] } }) {
  const { wid } = useWs()
  const all = useAllTags(useBoardItems())
  return (
    <TagInput
      label="Tags"
      value={item.tags}
      suggestions={all.map((t) => t.tag)}
      onChange={(tags) => void updateNode(wid, item.type, item.id, { tags: tags.length ? tags : undefined } as never)}
    />
  )
}
