import { getDb, type QueryFilter } from '../../db/db.js'
import { buildWhere } from '../analyzer.js'
import type { RuleFn, WasteDetection } from './index.js'

export const lowTokenDensity: RuleFn = (filter: QueryFilter): WasteDetection | null => {
  const db = getDb()
  const { sql, params } = buildWhere(filter)

  const extra = "outputTokens > 500 AND toolUse = '[]'"
  const where = sql ? sql + ' AND ' + extra : 'WHERE ' + extra

  const row = db.prepare(`
    SELECT COUNT(*) as cnt, SUM(costUSD) as totalCost
    FROM requests
    ${where}
  `).get(params) as { cnt: number; totalCost: number }

  if (row.cnt < 5) return null

  const wastedUSD = row.totalCost * 0.3

  return {
    rule: 'low-token-density',
    severity: 'medium',
    wastedUSD,
    savableUSD: wastedUSD,
    message: `${row.cnt} high-output requests with no tool use`,
    detail: `Found ${row.cnt} requests generating >500 output tokens without any tool calls. The agent may be "talking" instead of acting.`,
    suggestion: 'Instruct the agent to take action with tools rather than explaining what it would do.',
    fix: '# Add to CLAUDE.md:\nDo not explain what you will do. Just do it using tools. Keep explanatory text to a minimum.',
  }
}
