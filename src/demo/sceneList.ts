// Every scene demo.html can play (src/demo/scenes/, one file each, its id its file's name). The coach's list of them is
// src/onboarding/Demo.tsx's BUILT (kept apart, so the app's bundle never pulls the scenes in).
import type { Scene } from './director'
import canvasFit from './scenes/canvas-fit'
import deckDrag from './scenes/deck-drag'
import planeDrag from './scenes/plane-drag'
import sidenavPlus from './scenes/sidenav-plus'
import peersComment from './scenes/peers-comment'
import piecesTour from './scenes/pieces-tour'
import plusAddsPlane from './scenes/plus-adds-plane'
import finderGo from './scenes/finder-go'

export const SCENES: Record<string, Scene> = Object.fromEntries([planeDrag, canvasFit, sidenavPlus, deckDrag, peersComment, piecesTour, plusAddsPlane, finderGo].map((s) => [s.id, s]))
