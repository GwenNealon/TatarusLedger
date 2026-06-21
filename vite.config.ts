import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const appVersion = (() => {
  try {
    return execSync('git describe --tags --always', { encoding: 'utf8' }).trim()
  } catch {
    const pkg = JSON.parse(
      readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
    ) as { version: string }
    return pkg.version
  }
})()
const buildTimestamp = new Date().toISOString()

export default defineConfig(() => ({
  base: '/TatarusLedger/',
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
    'import.meta.env.VITE_BUILD_TIMESTAMP': JSON.stringify(buildTimestamp),
  },
  plugins: [react()],
}))
