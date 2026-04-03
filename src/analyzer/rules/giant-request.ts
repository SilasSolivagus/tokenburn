import { getDb, type QueryFilter } from '../../db/db.js'
import { buildWhere } from '../analyzer.js'
import type { RuleFn, WasteDetection } from './index.js'

export const giantRequest: RuleFn = (filter: QueryFilter): WasteDetection | null => {
  const db = getDb()
  const { sql, params } = buildWhere(filter)

  const row = db.prepare(`
    SELECT COUNT(*) as cnt, SUM(costUSD) as totalCost, MAX(costUSD) as maxCost
    FROM requests
    ${sql ? sql + ' AND costUSD > 2' : 'WHERE costUSD > 2'}
  `).get(params) as { cnt: number; totalCost: number; maxCost: number }

  if (row.cnt === 0) return null

  const wastedUSD = row.totalCost * 0.3

  return {
    rule: 'giant-request',
    severity: row.totalCost > 10 ? 'high' : 'medium',
    wastedUSD,
    savableUSD: wastedUSD,
    message: `${row.cnt} request(s) costing >$2 each (max $${row.maxCost.toFixed(2)})`,
    detail: `Found ${row.cnt} giant request(s) totaling $${row.totalCost.toFixed(2)}. Estimated 30% reducible.`,
    suggestion: 'Break large tasks into smaller prompts or use a cheaper model for exploration.',
    fix: '# Add to CLAUDE.md:\nBreak large tasks into smaller sub-tasks. Use cheaper models for exploration and expensive models only for final output.',
  }
}
