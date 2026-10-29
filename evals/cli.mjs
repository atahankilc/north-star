// `npm run eval`: runs evals/run.ts in node through Vite's module runner (TypeScript and the app's imports as Vite
// resolves them; no tsx or other dependency needed).
import { runnerImport } from 'vite'

const { module } = await runnerImport(new URL('./run.ts', import.meta.url).pathname)
try {
  process.exitCode = await module.main(process.argv.slice(2))
} catch (e) {
  console.error(e instanceof Error ? e.message : e)
  process.exitCode = 2
}
