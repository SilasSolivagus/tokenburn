import fs from 'fs'
import path from 'path'
import os from 'os'
import type { ImportAdapter } from './types.js'
import type { LogEntry } from '../jsonl-parser.js'

function getClineDir(): string {
  const home = os.homedir()
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev')
  }
  return path.join(home, '.config', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev')
}

export const clineAdapter: ImportAdapter = {
  name: 'cline',

  detect() {
    return fs.existsSync(path.join(getClineDir(), 'tasks'))
  },

  scan() {
    const tasksDir = path.join(getClineDir(), 'tasks')
    if (!fs.existsSync(tasksDir)) return []
    const results: string[] = []
    try {
      const taskDirs = fs.readdirSync(tasksDir, { withFileTypes: true })
      for (const d of taskDirs) {
        if (!d.isDirectory()) continue
        const uiFile = path.join(tasksDir, d.name, 'ui_messages.json')
        if (fs.existsSync(uiFile)) results.push(uiFile)
      }
    } catch {}
    return results.sort()
  },

  parse(filePath: string, offset: number = 0): LogEntry[] {
    // Cline stores complete JSON arrays, not JSONL
    // offset-based incremental import doesn't work well with JSON arrays
    // so we read the whole file but skip entries older than what we've seen
    let content: string
    try {
      content = fs.readFileSync(filePath, 'utf8')
    } catch { return [] }

    let events: Array<{ type?: string; say?: string; text?: string; ts?: string | number }>
    try {
      events = JSON.parse(content)
    } catch { return [] }

    const entries: LogEntry[] = []
    const taskId = path.basename(path.dirname(filePath))

    for (const event of events) {
      if (event.say !== 'api_req_started' || !event.text) continue

      let data: { tokensIn?: number; tokensOut?: number; cacheReads?: number; cacheWrites?: number; cost?: number; model?: string }
      try { data = JSON.parse(event.text) } catch { continue }

      const timestamp = event.ts ? (typeof event.ts === 'number' ? event.ts : new Date(event.ts).getTime()) : 0
      if (offset > 0 && timestamp <= offset) continue

      entries.push({
        uuid: `cline-${taskId}-${timestamp}`,
        parentUuid: null,
        sessionId: taskId,
        timestamp,
        model: data.model ?? '',
        inputTokens: data.tokensIn ?? 0,
        outputTokens: data.tokensOut ?? 0,
        cacheReadTokens: data.cacheReads ?? 0,
        cacheWriteTokens: data.cacheWrites ?? 0,
        toolUse: [],
        stopReason: '',
        cwd: '',
      })
    }

    return entries.sort((a, b) => a.timestamp - b.timestamp)
  },

  getFileSize(filePath: string): number {
    try { return fs.statSync(filePath).size } catch { return 0 }
  },
}
