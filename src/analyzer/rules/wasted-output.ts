import { getDb, type QueryFilter } from '../../db/db.js'
import { buildWhere } from '../analyzer.js'
import type { RuleFn, WasteDetection } from './index.js'

export const wastedOutput: RuleFn = (filter: QueryFilter): WasteDetection | null => {
  const db = getDb()
  const { sql, params } = buildWhere(filter)

  const extra = "toolUse != '[]' AND outputTokens > 500"
  const where = sql ? sql + ' AND ' + extra : 'WHERE ' + extra

  const row = db.prepare(`
    SELECT COUNT(*) as cnt, SUM(costUSD) as totalCost
    FROM requests
    ${where}
  `).get(params) as { cnt: number; totalCost: number }

  if (row.cnt < 5) return null

  const wastedUSD = row.totalCost * 0.15

  return {
    rule: 'wasted-output',
    severity: 'medium',
    wastedUSD,
    savableUSD: wastedUSD,
    message: `${row.cnt} requests with both tool calls and long output text`,
    detail: `Found ${row.cnt} requests using tools while also generating >500 output tokens. This suggests redundant text alongside tool actions.`,
    suggestion: 'When using tools, keep text response minimal.',
    fix: '# Add to CLAUDE.md:\nWhen using tools, keep text response minimal. Do not narrate what you are doing — just do it.',
  }
}
