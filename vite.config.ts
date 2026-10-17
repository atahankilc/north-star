import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves from /<repo-name>/; CI sets BASE_PATH from the repo name (deploy.yml).
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
})
