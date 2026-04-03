import { getDb, type QueryFilter } from '../../db/db.js'
import { buildWhere } from '../analyzer.js'
import type { RuleFn, WasteDetection } from './index.js'

export const largeFileReread: RuleFn = (filter: QueryFilter): WasteDetection | null => {
  const db = getDb()
  const { sql, params } = buildWhere(filter)

  const extra = 'inputTokens > 50000'
  const where = sql ? sql + ' AND ' + extra : 'WHERE ' + extra

  const rows = db.prepare(`
    SELECT promptHash, COUNT(*) as cnt, SUM(costUSD) as totalCost
    FROM requests
    ${where}
    GROUP BY promptHash
    HAVING cnt >= 3
  `).all(params) as { promptHash: string; cnt: number; totalCost: number }[]

  if (rows.length === 0) return null

  let wastedUSD = 0
  for (const row of rows) {
    wastedUSD += row.totalCost * (1 - 1 / row.cnt)
  }

  const totalGroups = rows.length
  const totalReads = rows.reduce((s, r) => s + r.cnt, 0)

  return {
    rule: 'large-file-reread',
    severity: 'high',
    wastedUSD,
    savableUSD: wastedUSD,
    message: `${totalGroups} large context(s) re-sent 3+ times (${totalReads} total reads)`,
    detail: `Found ${totalGroups} prompt hash(es) with >50k input tokens sent 3+ times. Wasted $${wastedUSD.toFixed(4)} on redundant context.`,
    suggestion: 'Cache or summarize large file contents instead of re-reading them.',
    fix: '# Add to CLAUDE.md:\nDo not re-read large files. Summarize and remember key content from files you have already read.',
  }
}
