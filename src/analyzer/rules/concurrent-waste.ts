import { getDb, type QueryFilter } from '../../db/db.js'
import { buildWhere } from '../analyzer.js'
import type { RuleFn, WasteDetection } from './index.js'

export const concurrentWaste: RuleFn = (filter: QueryFilter): WasteDetection | null => {
  const db = getDb()
  const { sql, params } = buildWhere(filter)

  const rows = db.prepare(`
    SELECT promptHash, CAST(timestamp / 1000 AS INTEGER) as sec,
           COUNT(*) as cnt, SUM(costUSD) as totalCost
    FROM requests
    ${sql}
    GROUP BY promptHash, sec
    HAVING cnt >= 2
  `).all(params) as { promptHash: string; sec: number; cnt: number; totalCost: number }[]

  if (rows.length === 0) return null

  let wastedUSD = 0
  for (const row of rows) {
    wastedUSD += row.totalCost * (1 - 1 / row.cnt)
  }

  const totalGroups = rows.length
  const totalRequests = rows.reduce((s, r) => s + r.cnt, 0)

  return {
    rule: 'concurrent-waste',
    severity: 'high',
    wastedUSD,
    savableUSD: wastedUSD,
    message: `${totalGroups} concurrent duplicate(s) detected (${totalRequests} requests)`,
    detail: `Found ${totalGroups} cases where the same prompt was sent 2+ times in the same second. Wasted $${wastedUSD.toFixed(4)}.`,
    suggestion: 'Deduplicate concurrent requests using a request queue or mutex.',
    fix: '# Add to CLAUDE.md:\nDo not send the same request concurrently. Wait for the first response before retrying.',
  }
}
