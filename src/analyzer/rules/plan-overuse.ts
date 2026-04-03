import { getDb, type QueryFilter } from '../../db/db.js'
import { buildWhere } from '../analyzer.js'
import type { RuleFn, WasteDetection } from './index.js'

const PLAN_PRICE = 100 // $100/month default

export const planOveruse: RuleFn = (filter: QueryFilter): WasteDetection | null => {
  const db = getDb()

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

  if (row.totalCost <= 200) return null

  const multiplier = row.totalCost / PLAN_PRICE

  return {
    rule: 'plan-overuse',
    severity: 'info',
    wastedUSD: 0,
    savableUSD: 0,
    message: `Your plan provides ${multiplier.toFixed(1)}x value ($${row.totalCost.toFixed(2)} API-equivalent usage vs $${PLAN_PRICE} plan)`,
    detail: `Your API-equivalent usage of $${row.totalCost.toFixed(2)} over the last 30 days is ${multiplier.toFixed(1)}x your $${PLAN_PRICE} plan price. Great value!`,
    suggestion: 'Your subscription is providing great value. Keep using it!',
    fix: 'Your subscription is providing great value. Keep using it!',
  }
}
