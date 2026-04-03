import { getDb, type QueryFilter } from '../../db/db.js'
import { buildWhere } from '../analyzer.js'
import type { RuleFn, WasteDetection } from './index.js'

const MIN_RETRIES = 3
const TIME_WINDOW_MS = 5000

export const retryStorm: RuleFn = (filter: QueryFilter): WasteDetection | null => {
  const db = getDb()
  const { sql, params } = buildWhere(filter)

  const rows = db.prepare(`
    SELECT
      promptHash,
      COUNT(*) AS cnt,
      MIN(timestamp) AS minTs,
      MAX(timestamp) AS maxTs,
      SUM(costUSD) AS totalCost
    FROM requests
    ${sql}
    GROUP BY promptHash
    HAVING cnt >= ${MIN_RETRIES} AND (maxTs - minTs) < ${TIME_WINDOW_MS}
  `).all(params) as { promptHash: string; cnt: number; minTs: number; maxTs: number; totalCost: number }[]

  if (rows.length === 0) return null

  let wastedUSD = 0
  let totalRetryRequests = 0
  for (const row of rows) {
    // First request is valid, rest are retries
    wastedUSD += row.totalCost * (1 - 1 / row.cnt)
    totalRetryRequests += row.cnt - 1
  }

  return {
    rule: 'retry-storm',
    severity: 'high',
    wastedUSD,
    savableUSD: wastedUSD,
    message: `${rows.length} retry storm(s) detected: ${totalRetryRequests} redundant request(s) within 5s`,
    detail: `Found ${rows.length} prompt hash(es) sent ${MIN_RETRIES}+ times within ${TIME_WINDOW_MS}ms — likely client-side retry loops. Wasted $${wastedUSD.toFixed(4)}.`,
    suggestion: 'Add exponential backoff with jitter. Use a circuit breaker to avoid thundering herd retries.',
  }
}
