import { defineConfig } from 'vitest/config'
import serverConfig from './vitest.config.server'

export default defineConfig({
  resolve: serverConfig.resolve,
  test: {
    name: 'database',
    environment: 'node',
    include: ['database/__tests__/**/*.test.ts'],
    env: { NODE_ENV: 'test', JWT_SECRET: 'database-test-secret' },
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 10000,
    hookTimeout: 10000
  }
})
