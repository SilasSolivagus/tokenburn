import { getDb, type QueryFilter } from '../../db/db.js'
import { buildWhere } from '../analyzer.js'
import type { RuleFn, WasteDetection } from './index.js'

export const longTailSession: RuleFn = (filter: QueryFilter): WasteDetection | null => {
  const db = getDb()
  const { sql, params } = buildWhere(filter)

  const extra = "sessionId != ''"
  const where = sql ? sql + ' AND ' + extra : 'WHERE ' + extra

  const rows = db.prepare(`
    SELECT sessionId, SUM(costUSD) as totalCost,
           MAX(timestamp) - MIN(timestamp) as spanMs
    FROM requests
    ${where}
    GROUP BY sessionId
    HAVING spanMs > 7200000
  `).all(params) as { sessionId: string; totalCost: number; spanMs: number }[]

  if (rows.length === 0) return null

  let wastedUSD = 0
  for (const row of rows) {
    wastedUSD += row.totalCost * 0.2
  }

  const totalHours = rows.reduce((s, r) => s + r.spanMs / 3600000, 0)

  return {
    rule: 'long-tail-session',
    severity: 'medium',
    wastedUSD,
    savableUSD: wastedUSD,
    message: `${rows.length} session(s) lasting >2 hours (${totalHours.toFixed(1)}h total)`,
    detail: `Found ${rows.length} long-running session(s). Context degrades over time, leading to higher token usage.`,
    suggestion: 'Start a new session every 1-2 hours to keep context fresh.',
    fix: '# Add to CLAUDE.md:\nStart a new session every 1-2 hours. Long sessions degrade context quality and increase token waste.',
  }
}
