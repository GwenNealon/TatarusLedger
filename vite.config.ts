import { defineConfig } from 'vite'
import { createSharedViteConfig } from './sharedViteConfig.ts'

export default defineConfig(() => ({
  base: '/TatarusLedger/',
  ...createSharedViteConfig(),
}))
