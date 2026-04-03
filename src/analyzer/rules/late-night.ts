import { getDb, type QueryFilter } from '../../db/db.js'
import { buildWhere } from '../analyzer.js'
import type { RuleFn, WasteDetection } from './index.js'

export const lateNight: RuleFn = (filter: QueryFilter): WasteDetection | null => {
  const db = getDb()
  const { sql, params } = buildWhere(filter)

  const row = db.prepare(`
    SELECT COUNT(*) AS cnt, COALESCE(SUM(costUSD), 0) AS cost
    FROM requests
    ${sql ? sql + ' AND' : 'WHERE'}
      CAST(strftime('%H', timestamp / 1000, 'unixepoch', 'localtime') AS INTEGER) BETWEEN 1 AND 5
  `).get(params) as { cnt: number; cost: number }

  if (row.cnt === 0) return null

  return {
    rule: 'late-night',
    severity: 'info',
    wastedUSD: row.cost,
    savableUSD: 0,
    message: `${row.cnt} request(s) made during off-hours (1am–5am local time)`,
    detail: `${row.cnt} requests were made between 1am and 5am local time, costing $${row.cost.toFixed(4)}. These may be automated jobs or overnight runs.`,
    suggestion: 'Review overnight automation for efficiency. Consider scheduling heavy jobs during off-peak times intentionally.',
    fix: '# Tip: Set budget limits for unattended agent sessions. Consider using cheaper models for overnight work.',
  }
}
