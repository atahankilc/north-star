// Going to a task on a live timeline (D-298, D-304): each live timeline says here how to bring one of its tasks into
// view (its days glided to it, its rows scrolled), and whether it draws that task at all. Its own module so the kanban's
// go to can ask without importing the timeline.
const live = new Map<string, (task: string) => boolean>()

export function registerStrip(id: string, reveal: (task: string) => boolean) {
  live.set(id, reveal)
  return () => {
    if (live.get(id) === reveal) live.delete(id)
  }
}

// True when a live timeline draws it (and brings it into view).
export const revealOnStrip = (task: string) => [...live.values()].some((reveal) => reveal(task))
