import { getDb, type QueryFilter } from '../../db/db.js'
import { buildWhere } from '../analyzer.js'
import type { RuleFn, WasteDetection } from './index.js'

const CACHE_HIT_THRESHOLD = 0.10
const SAVINGS_RATE = 0.10

export const lowCacheHit: RuleFn = (filter: QueryFilter): WasteDetection | null => {
  const db = getDb()
  const { sql, params } = buildWhere(filter)

  const row = db.prepare(`
    SELECT
      COALESCE(SUM(cacheReadTokens), 0) AS totalCacheRead,
      COALESCE(SUM(inputTokens), 0) AS totalInput,
      COALESCE(SUM(costUSD), 0) AS totalCost
    FROM requests
    ${sql}
  `).get(params) as { totalCacheRead: number; totalInput: number; totalCost: number }

  if (row.totalInput === 0) return null

  const cacheHitRate = row.totalCacheRead / row.totalInput
  if (cacheHitRate >= CACHE_HIT_THRESHOLD) return null

  const wastedUSD = row.totalCost * SAVINGS_RATE

  return {
    rule: 'low-cache-hit',
    severity: 'medium',
    wastedUSD,
    savableUSD: wastedUSD,
    message: `Cache hit rate is ${(cacheHitRate * 100).toFixed(1)}% (below ${CACHE_HIT_THRESHOLD * 100}% threshold)`,
    detail: `Only ${row.totalCacheRead.toLocaleString()} of ${row.totalInput.toLocaleString()} input tokens were served from cache (${(cacheHitRate * 100).toFixed(1)}%). An estimated ${(SAVINGS_RATE * 100).toFixed(0)}% savings is possible.`,
    suggestion: 'Enable prompt caching for system prompts and repeated context blocks.',
  }
}
