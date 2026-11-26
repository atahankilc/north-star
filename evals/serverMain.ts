// `npm run eval -- --server`'s entry (D-434): run.ts' main with the server backend. Loaded only by evals/cli.mjs, as
// evals/emulatorMain.ts is.
import { main as runMain } from './run'
import { emulateServer } from './server'

export const main = (argv: string[]) => runMain(argv, { backend: emulateServer })
