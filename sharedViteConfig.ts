import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string }
const appVersion = packageJson.version
const buildTimestamp = new Date().toISOString()

export function createSharedViteConfig() {
  return {
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
      'import.meta.env.VITE_BUILD_TIMESTAMP': JSON.stringify(buildTimestamp),
    },
    plugins: [react()],
  }
}
