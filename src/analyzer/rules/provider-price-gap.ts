import { getDb, type QueryFilter } from '../../db/db.js'
import { buildWhere } from '../analyzer.js'
import type { RuleFn, WasteDetection } from './index.js'

export const providerPriceGap: RuleFn = (filter: QueryFilter): WasteDetection | null => {
  const db = getDb()
  const { sql, params } = buildWhere(filter)

  const rows = db.prepare(`
    SELECT provider, COUNT(*) as cnt, SUM(costUSD) as totalCost,
           AVG(costUSD) as avgCost
    FROM requests
    ${sql}
    GROUP BY provider
    HAVING cnt >= 5
  `).all(params) as { provider: string; cnt: number; totalCost: number; avgCost: number }[]

  if (rows.length < 2) return null

  let minAvg = Infinity
  let maxAvg = 0
  let cheapProvider = ''
  let expensiveProvider = ''

  for (const row of rows) {
    if (row.avgCost < minAvg) {
      minAvg = row.avgCost
      cheapProvider = row.provider
    }
    if (row.avgCost > maxAvg) {
      maxAvg = row.avgCost
      expensiveProvider = row.provider
    }
  }

  if (minAvg === 0 || maxAvg / minAvg < 1.5) return null

  const ratio = maxAvg / minAvg

  return {
    rule: 'provider-price-gap',
    severity: 'info',
    wastedUSD: 0,
    savableUSD: 0,
    message: `${expensiveProvider} costs ${ratio.toFixed(1)}x more per request than ${cheapProvider}`,
    detail: `Average cost: ${expensiveProvider} = $${maxAvg.toFixed(4)}, ${cheapProvider} = $${minAvg.toFixed(4)}. ${rows.length} provider(s) with 5+ requests.`,
    suggestion: `Consider using ${cheapProvider} for tasks where ${expensiveProvider} is not strictly needed.`,
    fix: `# Add to CLAUDE.md:\nPrefer ${cheapProvider} over ${expensiveProvider} for routine tasks to reduce costs.`,
  }
}
