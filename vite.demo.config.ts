// The onboarding's demo realm (D-315, docs/specs/onboarding.md §6.2): demo.html, the real components on made-up data in a
// sealed frame, built on its own after the app (`npm run build`), into the same dist/ (never emptied here). A build of its
// own so the modules it shares with the app never split the app's chunks. Its files are named `demo-…`, and React (its
// own copy: a build of its own can't reuse the app's chunk) `react-…` with its own hash, so nothing meets the app's
// files. It ships no Firebase: the demo never starts it, so `firebase/*` is a stub here (src/demo/firebaseStub.ts); the
// real package's types still check it (tsc). The dev server (vite.config.ts) serves demo.html as it is, with the real SDK.
import { fileURLToPath } from 'node:url'
import { defineConfig, type UserConfig } from 'vite'
import app from './vite.config'

const stub = fileURLToPath(new URL('./src/demo/firebaseStub.ts', import.meta.url))

const base = app as UserConfig
const LIBS = ['three', 'react', 'rolldown-runtime']
const out = base.build?.rolldownOptions?.output
const shared = Array.isArray(out) ? out[0] : out

export default defineConfig({
  ...base,
  resolve: { ...base.resolve, alias: [{ find: /^firebase\/(app|auth|database|firestore|functions|storage)$/, replacement: stub }] },
  build: {
    ...base.build,
    emptyOutDir: false,
    rolldownOptions: {
      input: { demo: 'demo.html' },
      output: {
        ...shared,
        entryFileNames: 'assets/demo-[name]-[hash].js',
        chunkFileNames: (c) => (LIBS.includes(c.name) ? 'assets/[name]-[hash].js' : 'assets/demo-[name]-[hash].js'),
        assetFileNames: 'assets/demo-[name]-[hash][extname]',
      },
    },
  },
})
