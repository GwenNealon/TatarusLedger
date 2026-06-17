import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { reactCompilerPreset } from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    babel({
      presets: [reactCompilerPreset()],
    }),
  ],
  test: {
    globals: false,
    environment: 'jsdom',
    setupFiles: [],
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
