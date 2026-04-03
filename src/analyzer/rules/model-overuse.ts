import { getDb, type QueryFilter } from '../../db/db.js'
import { buildWhere } from '../analyzer.js'
import { isExpensiveModel } from '../../pricing/models.js'
import { calculateCost } from '../../pricing/cost.js'
import type { RuleFn, WasteDetection } from './index.js'
import type { RequestRecord } from '../../db/schema.js'

const CHEAP_MODEL = 'claude-haiku-4-5'

export const modelOveruse: RuleFn = (filter: QueryFilter): WasteDetection | null => {
  const db = getDb()
  const { sql, params } = buildWhere(filter)

  const rows = db.prepare(`
    SELECT * FROM requests
    ${sql}
  `).all(params) as RequestRecord[]

  const overuseRows = rows.filter(
    (r) => r.outputTokens < 200 && isExpensiveModel(r.model)
  )

  if (overuseRows.length === 0) return null

  let wastedUSD = 0
  for (const r of overuseRows) {
    const cheapCost = calculateCost(CHEAP_MODEL, {
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      cacheReadTokens: r.cacheReadTokens,
      cacheWriteTokens: r.cacheWriteTokens,
    })
    wastedUSD += Math.max(0, r.costUSD - cheapCost)
  }

  return {
    rule: 'model-overuse',
    severity: 'medium',
    wastedUSD,
    savableUSD: wastedUSD,
    message: `${overuseRows.length} expensive model request(s) with tiny outputs (<200 tokens)`,
    detail: `${overuseRows.length} request(s) used a premium model but produced fewer than 200 output tokens. Could have used ${CHEAP_MODEL} instead.`,
    suggestion: `Route short/simple requests to ${CHEAP_MODEL} to cut costs significantly.`,
    fix: '# Add to CLAUDE.md:\nFor simple questions and short responses (under 200 tokens), prefer claude-haiku-4-5 or claude-sonnet-4-6 over claude-opus-4.',
  }
}
