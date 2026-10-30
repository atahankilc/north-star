// The agent's id arguments (S13): change.ts resolves short ids and names only under these, and the changeset reads
// `$handles` only under them (a title "$a" stays text).
// The argument names that hold ids (of cards, pieces, text, tasks, links, evidence, canvases…) in the ops registry's
// schemas. Only strings under these are read as ids: a title, name, text or note that happens to look like `c12`
// stays as written.
export const ID_KEYS = new Set([
  'id', 'ids', 'card', 'cards', 'plane', 'canvas', 'from', 'to', 'link', 'items', 'pieces', 'near', 'in_section', 'deck', 'task', 'tasks',
  'stuck_to', 'evidence', 'competitor', 'ours', 'memberIds', 'around', 'doc', 'before', 'after', 'lane', 'from_task', 'row', 'col',
  'entry', 'open', 'fold', 'tasks_to', 'values', 'column', 'feature', 'assignee', 'keep', 'merge',
])
