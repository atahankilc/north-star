// The plane the board has open (D-139), for the views that show it; the data layer follows it (openPlane in
// data/planes.ts), so moves and new things go to this plane. Anything but the board leaves it at All.
import { create } from 'zustand'
import { ALL, setOpenPlane } from '../data/planes'
import { setPresencePlane } from '../data/presence'

export const usePlaneView = create<{ plane: string }>(() => ({ plane: ALL }))

usePlaneView.subscribe((s) => {
  setOpenPlane(s.plane)
  setPresencePlane(s.plane === ALL ? undefined : s.plane)
})
