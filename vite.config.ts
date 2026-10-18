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

// GitHub Pages serves from /<repo-name>/; CI sets BASE_PATH from the repo name (deploy.yml).
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  customLogger: logger,
  plugins: [react()],
})
