import type { ImportAdapter } from './types.js'
import { claudeCodeAdapter } from './claude-code.js'
import { clineAdapter } from './cline.js'

const ALL_ADAPTERS: ImportAdapter[] = [
  claudeCodeAdapter,
  clineAdapter,
]

export function getInstalledAdapters(): ImportAdapter[] {
  return ALL_ADAPTERS.filter(a => a.detect())
}

export function getAllAdapters(): ImportAdapter[] {
  return ALL_ADAPTERS
}
