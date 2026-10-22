// A piece drawn still (D-236): the finder's preview draws what a place will look like once you're there (in focus, at
// its own zoom), without anything in it being live. What reads its detail by the canvas's zoom when it isn't live reads
// it as in focus instead.
import { createContext, useContext } from 'react'

export const Still = createContext(false)
export const useStill = () => useContext(Still)
