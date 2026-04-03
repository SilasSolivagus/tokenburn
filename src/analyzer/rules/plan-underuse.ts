import { getDb, type QueryFilter } from '../../db/db.js'
import { buildWhere } from '../analyzer.js'
import type { RuleFn, WasteDetection } from './index.js'

const PLAN_PRICE = 100 // $100/month default

export const planUnderuse: RuleFn = (filter: QueryFilter): WasteDetection | null => {
  const db = getDb()

  // Use last 30 days if no filter specified
  const effectiveFilter: QueryFilter = {
    ...filter,
    since: filter.since ?? Date.now() - 30 * 24 * 60 * 60 * 1000,
  }

  const { sql, params } = buildWhere(effectiveFilter)

  const row = db.prepare(`
    SELECT COALESCE(SUM(costUSD), 0) as totalCost
    FROM requests
    ${sql}
  `).get(params) as { totalCost: number }

  if (row.totalCost === 0 || row.totalCost >= 30) return null

  return {
    rule: 'plan-underuse',
    severity: 'info',
    wastedUSD: 0,
    savableUSD: 0,
    message: `Only $${row.totalCost.toFixed(2)} API-equivalent usage in the last 30 days (vs $${PLAN_PRICE} plan)`,
    detail: `Your API-equivalent usage of $${row.totalCost.toFixed(2)} over the last 30 days suggests your $${PLAN_PRICE} plan may be more than you need.`,
    suggestion: 'Your plan may be more than you need. Consider a lower tier.',
    fix: 'Your plan may be more than you need. Consider a lower tier.',
  }
}
