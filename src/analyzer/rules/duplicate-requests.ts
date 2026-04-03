import { getDb, type QueryFilter } from '../../db/db.js'
import { buildWhere } from '../analyzer.js'
import type { RuleFn, WasteDetection } from './index.js'

export const duplicateRequests: RuleFn = (filter: QueryFilter): WasteDetection | null => {
  const db = getDb()
  const { sql, params } = buildWhere(filter)

  const rows = db.prepare(`
    SELECT
      promptHash,
      COUNT(*) AS cnt,
      SUM(costUSD) AS totalCost
    FROM requests
    ${sql}
    GROUP BY promptHash
    HAVING cnt >= 2
  `).all(params) as { promptHash: string; cnt: number; totalCost: number }[]

  if (rows.length === 0) return null

  let wastedUSD = 0
  for (const row of rows) {
    // First request is useful, rest are wasted
    wastedUSD += row.totalCost * (1 - 1 / row.cnt)
  }

  const totalDupeGroups = rows.length
  const totalDupeRequests = rows.reduce((s, r) => s + r.cnt, 0)

  return {
    rule: 'duplicate-requests',
    severity: 'high',
    wastedUSD,
    savableUSD: wastedUSD,
    message: `${totalDupeGroups} duplicate prompt group(s) detected (${totalDupeRequests} total requests)`,
    detail: `Found ${totalDupeGroups} prompt hash(es) sent 2+ times. The redundant calls wasted $${wastedUSD.toFixed(4)}.`,
    suggestion: 'Cache responses for identical prompts using a prompt cache or memoization layer.',
  }
}
