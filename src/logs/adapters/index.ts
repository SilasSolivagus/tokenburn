import type { ImportAdapter } from './types.js'
import { claudeCodeAdapter } from './claude-code.js'
import { clineAdapter } from './cline.js'
import { piAdapter } from './pi.js'
import { codexAdapter } from './codex.js'
import { geminiAdapter } from './gemini.js'
import { rooCodeAdapter } from './roo-code.js'
import { openCodeAdapter } from './opencode.js'

const ALL_ADAPTERS: ImportAdapter[] = [
  claudeCodeAdapter,
  clineAdapter,
  piAdapter,
  codexAdapter,
  geminiAdapter,
  rooCodeAdapter,
  openCodeAdapter,
]

export function getInstalledAdapters(): ImportAdapter[] {
  return ALL_ADAPTERS.filter(a => a.detect())
}

export function getAllAdapters(): ImportAdapter[] {
  return ALL_ADAPTERS
}
