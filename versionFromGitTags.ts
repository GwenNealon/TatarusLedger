import { execSync } from 'node:child_process'

const VERSION_TAG_PATTERN = /^v(\d+\.\d+\.\d+)$/

export function resolveAppVersionFromGitTags(fallbackVersion: string): string {
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
