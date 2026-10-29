// `npm run eval`: runs evals/run.ts in node through Vite's module runner (TypeScript and the app's imports as Vite
// resolves them; no tsx or other dependency needed). `--emulator`: VITE_USE_EMULATORS=true first (so src/data/firebase.ts
// connects to the local emulators of the demo-north-star project, never the real one), then evals/emulator.ts gives the
// runner its backend: accepts through the real apply into Firestore.
import { runnerImport } from 'vite'

const argv = process.argv.slice(2)
const emulator = argv.includes('--emulator')
if (emulator) process.env.VITE_USE_EMULATORS = 'true'

const { module } = await runnerImport(new URL(emulator ? './emulatorMain.ts' : './run.ts', import.meta.url).pathname)
try {
  process.exitCode = await module.main(argv)
} catch (e) {
  console.error(e instanceof Error ? e.message : e)
  process.exitCode = 2
}
// Firestore's listeners and gRPC channel keep node alive in the emulator mode.
if (emulator) process.exit(process.exitCode)
