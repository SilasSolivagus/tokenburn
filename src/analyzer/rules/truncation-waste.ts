import { getDb, type QueryFilter } from '../../db/db.js'
import { buildWhere } from '../analyzer.js'
import type { RuleFn, WasteDetection } from './index.js'

const MIN_TRUNCATIONS = 3

export const truncationWaste: RuleFn = (filter: QueryFilter): WasteDetection | null => {
  const db = getDb()
  const { sql, params } = buildWhere(filter)

  const row = db.prepare(`
    SELECT COUNT(*) AS cnt, COALESCE(SUM(costUSD), 0) AS cost
    FROM requests
    ${sql ? sql + ' AND' : 'WHERE'} stopReason = 'max_tokens'
  `).get(params) as { cnt: number; cost: number }

  if (row.cnt < MIN_TRUNCATIONS) return null

  return {
    rule: 'truncation-waste',
    severity: 'medium',
    wastedUSD: row.cost,
    savableUSD: row.cost * 0.5,
    message: `${row.cnt} request(s) hit max_tokens limit (truncated output)`,
    detail: `${row.cnt} requests were cut off at the token limit (stopReason = 'max_tokens'), costing $${row.cost.toFixed(4)} total. Truncated responses may require retries.`,
    suggestion: 'Increase max_tokens limit or structure prompts to produce shorter outputs.',
  }
}
