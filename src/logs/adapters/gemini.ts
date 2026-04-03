import fs from 'fs'
import path from 'path'
import os from 'os'
import type { ImportAdapter } from './types.js'
import type { LogEntry } from '../jsonl-parser.js'

function getGeminiDir(): string {
  return path.join(os.homedir(), '.gemini', 'tmp')
}

function findJsonFiles(dir: string): string[] {
  const results: string[] = []
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        results.push(...findJsonFiles(full))
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        results.push(full)
      }
    }
  } catch {}
  return results
}

export const geminiAdapter: ImportAdapter = {
  name: 'gemini',

  detect() {
    return fs.existsSync(getGeminiDir())
  },

  scan() {
    return findJsonFiles(getGeminiDir()).sort()
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

    const entries: LogEntry[] = []
    const fileId = path.basename(filePath, '.json')

    try {
      // Try to extract from various possible structures
      const messages = Array.isArray(data) ? data : data.messages ?? data.history ?? [data]

      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i]
        if (!msg) continue

        const usage = msg.usage ?? msg.usageMetadata ?? msg.usage_metadata
        if (!usage) continue

        const inputTokens = usage.input_tokens ?? usage.promptTokenCount ?? usage.prompt_tokens ?? 0
        const outputTokens = usage.output_tokens ?? usage.candidatesTokenCount ?? usage.completion_tokens ?? 0
        const cachedTokens = usage.cached_tokens ?? usage.cachedContentTokenCount ?? 0

        entries.push({
          uuid: `gemini-${fileId}-${i}`,
          parentUuid: i > 0 ? `gemini-${fileId}-${i - 1}` : null,
          sessionId: fileId,
          timestamp: msg.timestamp ? new Date(msg.timestamp).getTime() : 0,
          model: msg.model ?? data.model ?? '',
          inputTokens,
          outputTokens,
          cacheReadTokens: cachedTokens,
          cacheWriteTokens: 0,
          toolUse: [],
          stopReason: '',
          cwd: '',
        })
      }
    } catch {}

    return entries
  },

  getFileSize(filePath: string): number {
    try { return fs.statSync(filePath).size } catch { return 0 }
  },
}
