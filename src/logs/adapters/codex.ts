import fs from 'fs'
import path from 'path'
import os from 'os'
import type { ImportAdapter } from './types.js'
import type { LogEntry } from '../jsonl-parser.js'

function getCodexDir(): string {
  return path.join(os.homedir(), '.codex', 'sessions')
}

function findJsonlFiles(dir: string): string[] {
  const results: string[] = []
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        results.push(...findJsonlFiles(full))
      } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        results.push(full)
      }
    }
  } catch {}
  return results
}

export const codexAdapter: ImportAdapter = {
  name: 'codex',

  detect() {
    return fs.existsSync(getCodexDir())
  },

  scan() {
    return findJsonlFiles(getCodexDir()).sort()
  },

  parse(filePath: string, offset: number = 0): LogEntry[] {
    let content: string
    try {
      if (offset > 0) {
        const fd = fs.openSync(filePath, 'r')
        const stats = fs.fstatSync(fd)
        const size = stats.size - offset
        if (size <= 0) { fs.closeSync(fd); return [] }
        const buffer = Buffer.alloc(size)
        fs.readSync(fd, buffer, 0, size, offset)
        fs.closeSync(fd)
        content = buffer.toString('utf8')
      } else {
        content = fs.readFileSync(filePath, 'utf8')
      }
    } catch { return [] }

    const lines = content.split('\n').filter(l => l.trim())
    const entries: LogEntry[] = []

    for (const line of lines) {
      let obj: any
      try { obj = JSON.parse(line) } catch { continue }

      const msg = obj.message
      if (!msg?.usage) continue

      const usage = msg.usage
      const sessionId = obj.sessionId ?? path.basename(filePath, '.jsonl')
      const msgId = msg.id ?? `${Date.now()}-${Math.random()}`
      const timestamp = obj.timestamp ? new Date(obj.timestamp).getTime() : 0

      entries.push({
        uuid: `codex-${sessionId}-${msgId}`,
        parentUuid: null,
        sessionId,
        timestamp,
        model: msg.model ?? '',
        inputTokens: usage.input_tokens ?? 0,
        outputTokens: usage.output_tokens ?? 0,
        cacheReadTokens: usage.cache_read_tokens ?? 0,
        cacheWriteTokens: usage.cache_write_tokens ?? 0,
        toolUse: [],
        stopReason: '',
        cwd: '',
      })
    }

    return entries
  },

  getFileSize(filePath: string): number {
    try { return fs.statSync(filePath).size } catch { return 0 }
  },
}
