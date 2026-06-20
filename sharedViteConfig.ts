import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

const VERSION_TAG_PATTERN = /^v(\d+\.\d+\.\d+)$/

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string }

function resolveAppVersionFromGitTags(fallbackVersion: string): string {
  try {
    const tags = execSync("git tag --list 'v*' --sort=-version:refname", {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .split('\n')
      .map((tag) => tag.trim())

    for (const tag of tags) {
      const match = VERSION_TAG_PATTERN.exec(tag)
      if (match !== null) {
        return match[1]
      }
    }

    return fallbackVersion
  } catch {
    return fallbackVersion
  }
}

const appVersion = resolveAppVersionFromGitTags(packageJson.version)
const buildTimestamp = new Date().toISOString()

export function createSharedViteConfig() {
  return {
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
      'import.meta.env.VITE_BUILD_TIMESTAMP': JSON.stringify(buildTimestamp),
    },
    plugins: [
      react(),
      babel({
        presets: [reactCompilerPreset()],
      }),
    ],
  }
}
