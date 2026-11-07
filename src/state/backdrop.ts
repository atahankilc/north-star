// How many pieces the canvas on screen holds, for the backdrop's level (D-385): null off a canvas or while it loads.
// The canvas view writes it and clears it when it goes; the app shell reads it.
import { create } from 'zustand'

type BackdropState = { pieces: number | null }

export const useBackdropPieces = create<BackdropState>(() => ({ pieces: null }))
