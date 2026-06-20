import { defineConfig } from 'vitest/config'
import { createSharedViteConfig } from './sharedViteConfig.ts'

export default defineConfig({
  ...createSharedViteConfig(),
  test: {
    globals: false,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.config.{js,ts}',
        '**/*.d.ts',
        '**/index.html',
      ],
    },
  },
})
