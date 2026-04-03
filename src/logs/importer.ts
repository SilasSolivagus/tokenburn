import { scanLogFiles, getDefaultLogDirs, extractProjectPath } from './scanner.js'
import { parseJsonlFile, getFileSize } from './jsonl-parser.js'
import { getDb, insertRequest } from '../db/db.js'
import { calculateCost } from '../pricing/cost.js'
import crypto from 'crypto'

export interface ImportResult {
  filesScanned: number
  imported: number
  skipped: number
  totalMessages: number
}

export function importLogs(logDirs?: string[], sinceMs: number = 0): ImportResult {
  const dirs = logDirs ?? getDefaultLogDirs()
  const db = getDb()
  let filesScanned = 0, imported = 0, skipped = 0, totalMessages = 0

  for (const dir of dirs) {
    const files = scanLogFiles(dir)
    for (const filePath of files) {
      filesScanned++
      // Check import_state for incremental import
      const state = db.prepare('SELECT lastOffset FROM import_state WHERE filePath = ?').get(filePath) as { lastOffset: number } | undefined
      const offset = state?.lastOffset ?? 0
      const fileSize = getFileSize(filePath)
      if (offset >= fileSize) continue // file hasn't grown

      const projectPath = extractProjectPath(filePath)
      const entries = parseJsonlFile(filePath, offset)
      totalMessages += entries.length

      for (const entry of entries) {
        if (sinceMs > 0 && entry.timestamp < sinceMs) { skipped++; continue }
        const id = `jsonl-${entry.sessionId}-${entry.uuid}`
        const existing = db.prepare('SELECT id FROM requests WHERE id = ?').get(id)
        if (existing) { skipped++; continue }

        const model = entry.model || 'claude-sonnet-4-6'
        const costUSD = calculateCost(model, {
          inputTokens: entry.inputTokens, outputTokens: entry.outputTokens,
          cacheReadTokens: entry.cacheReadTokens, cacheWriteTokens: entry.cacheWriteTokens,
        })
        const promptHash = entry.parentUuid
          ? crypto.createHash('sha256').update(entry.parentUuid).digest('hex').slice(0, 16)
          : ''

        insertRequest({
          id, timestamp: entry.timestamp, provider: 'anthropic', model,
          source: 'claude-code',
          inputTokens: entry.inputTokens, outputTokens: entry.outputTokens,
          cacheReadTokens: entry.cacheReadTokens, cacheWriteTokens: entry.cacheWriteTokens,
          costUSD, durationMs: 0, promptHash,
          toolUse: JSON.stringify(entry.toolUse), stopReason: entry.stopReason,
          sessionId: entry.sessionId, projectPath,
        })
        db.prepare(`INSERT OR REPLACE INTO agent_tree (uuid, sessionId, parentUuid, role, timestamp, inputTokens, outputTokens, costUSD, toolUse)
          VALUES (?, ?, ?, 'assistant', ?, ?, ?, ?, ?)`)
          .run(entry.uuid, entry.sessionId, entry.parentUuid, entry.timestamp,
               entry.inputTokens, entry.outputTokens, costUSD, JSON.stringify(entry.toolUse))
        imported++
      }
      // Update import state
      db.prepare('INSERT OR REPLACE INTO import_state (filePath, lastOffset, lastTimestamp) VALUES (?, ?, ?)')
        .run(filePath, fileSize, Date.now())
    }
  }
  return { filesScanned, imported, skipped, totalMessages }
}
