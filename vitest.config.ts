import { defineConfig } from 'vitest/config'

// Unit tests (R12, docs/specs/agent.md §5): pure code in node (src/model/, src/state/wsStore.ts, the ops layer). The
// rules tests (tests/rules.test.mjs) run on the emulators with `npm run test:rules`, not here.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    // Firebase stays unconfigured (data/firebase.ts's `firebase` is null): nothing in a unit test reaches a project.
    // src/model/ and src/ops/ don't need this (they never load Firebase: tests/unit/purity.test.ts); it stays as the net
    // under tests of the Firestore adapter (src/ops/firestore.ts → data/history.ts → data/firebase.ts), which mock
    // Firebase anyway, so a forgotten mock can never reach the real project in .env.local.
    env: { VITE_FIREBASE_API_KEY: '', VITE_FIREBASE_PROJECT_ID: '', VITE_USE_EMULATORS: 'false' },
  },
})
