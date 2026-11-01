// What the onboarding's demo realm (D-315, boot.tsx) and the component gallery (D-324, src/gallery/) share: every store
// the real views keep outside React, put back as it was when the page loaded, so a scene or an example starts afresh.
// What was left in the page's own storage (the split, snapping, the side view's tab…; demo.html and gallery.html keep it
// in memory) goes too, but for the app's theme and motion, which both pages follow.
import { useCanvasView } from '../state/canvasView'
import { useKanbanUi } from '../views/workspace/deck/Kanban'
import { useMatrixUi } from '../views/workspace/matrix/Matrix'
import { useTableUi } from '../views/workspace/table/Table'
import { useFind } from '../views/workspace/find/find'
import { useTasksSide } from '../views/workspace/deck/sideState'
import { usePlaneFilter } from '../views/workspace/canvas/planeFilter'
import { useThreadView } from '../views/workspace/threads/Threads'
import { useDocUi } from '../views/workspace/documents/Documents'
import { useShelf } from '../views/workspace/canvas/FilterDock'
import { useGoTo } from '../views/workspace/canvas/goTo'
import { useGuides } from '../views/workspace/canvas/guides'
import { useKanbanSizes, useOpenSize } from '../views/workspace/canvas/sizes'
import { usePresence } from '../data/presence'
import { useHistory } from '../data/history'

const stores = [useCanvasView, useKanbanUi, useMatrixUi, useTableUi, useFind, useTasksSide, usePlaneFilter, useThreadView, useDocUi, useShelf, useGoTo, useGuides, useOpenSize, useKanbanSizes, usePresence]
const KEEP = ['north-star.theme', 'north-star.motion']

export function fresh() {
  for (const st of [localStorage, sessionStorage]) {
    const keys = Array.from({ length: st.length }, (_, i) => st.key(i)).filter((k): k is string => !!k && !KEEP.includes(k))
    keys.forEach((k) => st.removeItem(k))
  }
  stores.forEach((s) => (s as { setState: (v: unknown, replace: true) => void }).setState(s.getInitialState(), true))
  // The last notice too (the toast), which the demo never shows but an example may.
  useHistory.setState({ notice: null })
}
