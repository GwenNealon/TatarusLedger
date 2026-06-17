import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/TatarusLedger/' : '/',
  plugins: [
    react(),
    babel({
      presets: [reactCompilerPreset()],
    }),
  ],
}))
