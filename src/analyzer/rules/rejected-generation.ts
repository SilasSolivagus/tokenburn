import { getDb, type QueryFilter } from '../../db/db.js'
import { buildWhere } from '../analyzer.js'
import type { RuleFn, WasteDetection } from './index.js'

export const rejectedGeneration: RuleFn = (filter: QueryFilter): WasteDetection | null => {
  const db = getDb()
  const { sql, params } = buildWhere(filter)

  const rows = db.prepare(`
    SELECT promptHash, timestamp, costUSD
    FROM requests
    ${sql}
    ORDER BY promptHash, timestamp
  `).all(params) as { promptHash: string; timestamp: number; costUSD: number }[]

  if (rows.length < 2) return null

  let pairCount = 0
  let wastedCost = 0

  for (let i = 1; i < rows.length; i++) {
    if (rows[i].promptHash !== rows[i - 1].promptHash) continue
    const diff = rows[i].timestamp - rows[i - 1].timestamp
    if (diff >= 1000 && diff <= 30000) {
      pairCount++
      wastedCost += rows[i].costUSD
    }
  }

  if (pairCount === 0) return null

  const wastedUSD = wastedCost / 2

  return {
    rule: 'rejected-generation',
    severity: 'medium',
    wastedUSD,
    savableUSD: wastedUSD,
    message: `${pairCount} likely rejected-and-resent generation(s)`,
    detail: `Found ${pairCount} cases where the same prompt was re-sent within 1-30 seconds, suggesting the first response was rejected.`,
    suggestion: 'Refine prompts before sending rather than regenerating responses.',
    fix: '# Add to CLAUDE.md:\nDo not regenerate responses. Instead, provide specific feedback on what to change.',
  }
}
