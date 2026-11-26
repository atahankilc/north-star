// Builds the functions (D-434): one SSR build by the repo's own Vite, so they can use the agent's code (src/agent, src/ops,
// src/model) as it is. Packages stay outside (functions/package.json has them); code a function loads lazily is a chunk of
// its own, so the light ones start fast. `npm run build` types first (tsc), then runs this.
import { cpSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const out = here('./lib')
rmSync(out, { recursive: true, force: true })
await build({
  root: here('..'),
  configFile: false,
  logLevel: 'warn',
  publicDir: false,
  // Nothing of the app's .env reaches the server.
  envPrefix: 'NONE_',
  envDir: false,
  build: {
    ssr: true,
    outDir: out,
    target: 'node22',
    sourcemap: true,
    minify: false,
    // Only the functions are exported (the CLI deploys every export): what the chunks share is a chunk of its own.
    rollupOptions: { preserveEntrySignatures: 'strict', external: (id) => /^[^./\0]/.test(id), input: { index: here('./src/index.ts') }, output: { format: 'es', entryFileNames: '[name].js', chunkFileNames: '[name]-[hash].js' } },
  },
})
// Inter for `look`'s pictures (src/agent/render.ts).
cpSync(here('../evals/fonts'), here('./lib/fonts'), { recursive: true })
