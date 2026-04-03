import { getDb, type QueryFilter } from '../../db/db.js'
import { buildWhere } from '../analyzer.js'
import type { RuleFn, WasteDetection } from './index.js'

export const sessionTooLong: RuleFn = (filter: QueryFilter): WasteDetection | null => {
  const db = getDb()
  const { sql, params } = buildWhere(filter)

  const extra = "sessionId != ''"
  const where = sql ? sql + ' AND ' + extra : 'WHERE ' + extra

  const rows = db.prepare(`
    SELECT sessionId, MAX(timestamp) - MIN(timestamp) as spanMs
    FROM requests
    ${where}
    GROUP BY sessionId
    HAVING spanMs > 10800000
  `).all(params) as { sessionId: string; spanMs: number }[]

  if (rows.length === 0) return null

  const totalHours = rows.reduce((s, r) => s + r.spanMs / 3600000, 0)

  return {
    rule: 'session-too-long',
    severity: 'low',
    wastedUSD: 0,
    savableUSD: 0,
    message: `${rows.length} session(s) lasting >3 hours (${totalHours.toFixed(1)}h total)`,
    detail: `Found ${rows.length} session(s) spanning more than 3 hours. Long sessions degrade context quality.`,
    suggestion: 'Split long sessions. Start fresh every 2-3 hours.',
    fix: 'Split long sessions. Start fresh every 2-3 hours.',
  }
}
