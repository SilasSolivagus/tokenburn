import fs from 'fs'
import path from 'path'
import os from 'os'
import type { ImportAdapter } from './types.js'
import type { LogEntry } from '../jsonl-parser.js'

function getOpenCodeDir(): string {
  return path.join(os.homedir(), '.local', 'share', 'opencode', 'storage')
}

function findMessageFiles(dir: string): string[] {
  const msgDir = path.join(dir, 'message')
  const results: string[] = []
  try {
    const sessionDirs = fs.readdirSync(msgDir, { withFileTypes: true })
    for (const d of sessionDirs) {
      if (!d.isDirectory()) continue
      const sessionPath = path.join(msgDir, d.name)
      try {
        const files = fs.readdirSync(sessionPath, { withFileTypes: true })
        for (const f of files) {
          if (f.isFile() && f.name.startsWith('msg_') && f.name.endsWith('.json')) {
            results.push(path.join(sessionPath, f.name))
          }
        }
      } catch {}
    }
  } catch {}
  return results
}

export const openCodeAdapter: ImportAdapter = {
  name: 'opencode',

  detect() {
    return fs.existsSync(getOpenCodeDir())
  },

  scan() {
    return findMessageFiles(getOpenCodeDir()).sort()
  },

  parse(filePath: string, _offset: number = 0): LogEntry[] {
    let content: string
    try {
      content = fs.readFileSync(filePath, 'utf8')
    } catch { return [] }

    let data: any
    try {
      data = JSON.parse(content)
    } catch { return [] }

    try {
      const usage = data.usage ?? data.metadata?.usage ?? data.token_usage
      if (!usage) return []

      const sessionId = path.basename(path.dirname(filePath))
      const msgId = path.basename(filePath, '.json')

      const inputTokens = usage.input_tokens ?? usage.prompt_tokens ?? 0
      const outputTokens = usage.output_tokens ?? usage.completion_tokens ?? 0
      const cacheRead = usage.cache_read_tokens ?? usage.cacheRead ?? 0
      const cacheWrite = usage.cache_write_tokens ?? usage.cacheWrite ?? 0

      return [{
        uuid: `opencode-${sessionId}-${msgId}`,
        parentUuid: null,
        sessionId,
        timestamp: data.timestamp ? new Date(data.timestamp).getTime() : 0,
        model: data.model ?? data.metadata?.model ?? '',
        inputTokens,
        outputTokens,
        cacheReadTokens: cacheRead,
        cacheWriteTokens: cacheWrite,
        toolUse: [],
        stopReason: '',
        cwd: '',
      }]
    } catch {
      return []
    }
  },

  getFileSize(filePath: string): number {
    try { return fs.statSync(filePath).size } catch { return 0 }
  },
}
