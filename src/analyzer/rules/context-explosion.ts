import { getDb, type QueryFilter } from '../../db/db.js'
import { buildWhere } from '../analyzer.js'
import type { RuleFn, WasteDetection } from './index.js'

const LARGE_CONTEXT_THRESHOLD = 100_000
const PERCENT_THRESHOLD = 0.20
const SAVINGS_RATE = 0.30

export const contextExplosion: RuleFn = (filter: QueryFilter): WasteDetection | null => {
  const db = getDb()
  const { sql, params } = buildWhere(filter)

  const totalRow = db.prepare(`
    SELECT COUNT(*) AS total, COALESCE(SUM(costUSD), 0) AS totalCost
    FROM requests
    ${sql}
  `).get(params) as { total: number; totalCost: number }

  if (totalRow.total === 0) return null

  const largeRow = db.prepare(`
    SELECT COUNT(*) AS cnt, COALESCE(SUM(costUSD), 0) AS cost
    FROM requests
    ${sql ? sql + ' AND' : 'WHERE'} inputTokens > ${LARGE_CONTEXT_THRESHOLD}
  `).get(params) as { cnt: number; cost: number }

  const fraction = largeRow.cnt / totalRow.total
  if (fraction <= PERCENT_THRESHOLD) return null

  const wastedUSD = largeRow.cost * SAVINGS_RATE

  return {
    rule: 'context-explosion',
    severity: 'high',
    wastedUSD,
    savableUSD: wastedUSD,
    message: `${largeRow.cnt} request(s) (${(fraction * 100).toFixed(1)}%) have context >100k tokens`,
    detail: `${largeRow.cnt} of ${totalRow.total} requests exceed 100k input tokens (>${(PERCENT_THRESHOLD * 100).toFixed(0)}% threshold). These large contexts cost $${largeRow.cost.toFixed(4)} total.`,
    suggestion: 'Summarize or truncate conversation history. Use sliding windows or compaction strategies.',
    fix: '# Add to CLAUDE.md:\nKeep context concise. Summarize long file contents instead of including them verbatim. Use targeted file reads instead of reading entire files.',
  }
}
