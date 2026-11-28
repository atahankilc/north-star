import { createLogger, defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `composes: x from './Other.module.css'` makes postcss-modules add `:import` declarations with no source file, and Vite's
// url() rewriter warns about each. They never hold a url(), so the warning is noise; every other warning still shows.
const logger = createLogger()
const warnOnce = logger.warnOnce
logger.warnOnce = (msg, options) => {
  if (msg.includes('did not pass the `from` option')) return
  warnOnce(msg, options)
}

// Served from the root of its own domain (north-star.atem-lab.com, D-430); CI sets BASE_PATH (deploy.yml).
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  customLogger: logger,
  plugins: [react()],
  // This app's own port, so it never lands on another project's 5173; strict, so it fails rather than moving.
  server: { port: 5288, strictPort: true },
  // The libraries every page needs at once in files of their own, named by what's in them: a deploy changes only the
  // app's own files, so a visitor keeps the libraries from before (D-288). The rest stays with what imports it (the
  // workspace's chunk, D-287).
  build: {
    rolldownOptions: {
      // The app. The onboarding's demo realm (demo.html, D-315) is a build of its own (vite.demo.config.ts), so the
      // modules it shares with the app never split the app's chunks. The dev server serves both pages.
      // Paths from the project's root (where npm runs Vite).
      input: {
        main: 'index.html',
      },
      output: {
        codeSplitting: {
          groups: [
            { name: 'firebase', test: /node_modules[\\/](firebase|@firebase|idb)[\\/]/, priority: 2 },
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|motion|motion-dom|motion-utils|framer-motion|zustand)[\\/]/, priority: 1 },
          ],
        },
      },
    },
  },
})
