// `npm run eval -- --emulator`'s entry (S13): run.ts' main with the emulator backend. Loaded only by evals/cli.mjs
// after it set VITE_USE_EMULATORS=true (all imports are static: Vite's runner is closed once this module has loaded).
import { main as runMain } from './run'
import { emulate } from './emulator'

export const main = (argv: string[]) => runMain(argv, { backend: emulate })
