/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages dient unter https://cansi798.github.io/Fussball/ aus,
// daher der base-Pfad. Lokal (dev) bleibt es '/'.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/Fussball/' : '/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}))
