import { getDb, type QueryFilter } from '../../db/db.js'
import { buildWhere } from '../analyzer.js'
import { isExpensiveModel } from '../../pricing/models.js'
import { calculateCost } from '../../pricing/cost.js'
import type { RuleFn, WasteDetection } from './index.js'
import type { RequestRecord } from '../../db/schema.js'

const CHEAP_MODEL = 'claude-haiku-4-5'

export const cheapestAvailable: RuleFn = (filter: QueryFilter): WasteDetection | null => {
  const db = getDb()
  const { sql, params } = buildWhere(filter)

  const rows = db.prepare(`
    SELECT * FROM requests
    ${sql}
  `).all(params) as RequestRecord[]

  // Broader than model-overuse: outputTokens < 500 (not just 200)
  const simpleRows = rows.filter(
    (r) => r.outputTokens < 500 && isExpensiveModel(r.model)
  )

  if (simpleRows.length === 0) return null

  let savings = 0
  for (const r of simpleRows) {
    const cheapCost = calculateCost(CHEAP_MODEL, {
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      cacheReadTokens: r.cacheReadTokens,
      cacheWriteTokens: r.cacheWriteTokens,
    })
    savings += Math.max(0, r.costUSD - cheapCost)
  }

  if (savings === 0) return null

  return {
    rule: 'cheapest-available',
    severity: savings > 5 ? 'medium' : 'low',
    wastedUSD: savings,
    savableUSD: savings,
    message: `${simpleRows.length} simple request(s) could save $${savings.toFixed(2)} with ${CHEAP_MODEL}`,
    detail: `${simpleRows.length} request(s) with <500 output tokens used expensive models. Switching to ${CHEAP_MODEL} could save $${savings.toFixed(2)}.`,
    suggestion: `Route simple tasks to cheaper models like ${CHEAP_MODEL}.`,
    fix: 'Route simple tasks to cheaper models.',
  }
}
