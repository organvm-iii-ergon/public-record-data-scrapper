import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts']
  }
})
