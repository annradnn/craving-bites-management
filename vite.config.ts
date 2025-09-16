import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  root: '.',          // project root
  base: './',         // relative paths for assets (needed for Firebase Hosting)
  build: {
    outDir: 'dist',   // output directory
    emptyOutDir: true // clear dist before building
  }
})
