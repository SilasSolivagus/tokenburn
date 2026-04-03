import fs from 'fs'
import path from 'path'
import os from 'os'
import type { ImportAdapter } from './types.js'
import type { LogEntry } from '../jsonl-parser.js'

function getPiDir(): string {
  return path.join(os.homedir(), '.pi', 'agent', 'sessions')
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

export const piAdapter: ImportAdapter = {
  name: 'pi',

  detect() {
    return fs.existsSync(getPiDir())
  },

  scan() {
    return findJsonlFiles(getPiDir()).sort()
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
    let sessionId = path.basename(filePath, '.jsonl')
    let cwd = ''

    for (const line of lines) {
      let obj: any
      try { obj = JSON.parse(line) } catch { continue }

      if (obj.type === 'session') {
        if (obj.id) sessionId = obj.id
        if (obj.cwd) cwd = obj.cwd
        continue
      }

      if (obj.type !== 'message') continue
      const msg = obj.message
      if (!msg || msg.role !== 'assistant' || !msg.usage) continue

      const usage = msg.usage
      const id = obj.id ?? `${Date.now()}-${Math.random()}`
      const parentId = obj.parentId ?? null

      entries.push({
        uuid: `pi-${sessionId}-${id}`,
        parentUuid: parentId ? `pi-${sessionId}-${parentId}` : null,
        sessionId,
        timestamp: obj.timestamp ? new Date(obj.timestamp).getTime() : 0,
        model: msg.model ?? '',
        inputTokens: usage.input ?? 0,
        outputTokens: usage.output ?? 0,
        cacheReadTokens: usage.cacheRead ?? 0,
        cacheWriteTokens: usage.cacheWrite ?? 0,
        toolUse: [],
        stopReason: '',
        cwd,
      })
    }

    return entries
  },

  getFileSize(filePath: string): number {
    try { return fs.statSync(filePath).size } catch { return 0 }
  },
}
