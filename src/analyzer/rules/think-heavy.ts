import { getDb, type QueryFilter } from '../../db/db.js'
import { buildWhere } from '../analyzer.js'
import type { RuleFn, WasteDetection } from './index.js'
import type { RequestRecord } from '../../db/schema.js'

export const thinkHeavy: RuleFn = (filter: QueryFilter): WasteDetection | null => {
  const db = getDb()
  const { sql, params } = buildWhere(filter)

  const rows = db.prepare(`
    SELECT * FROM requests
    ${sql}
  `).all(params) as RequestRecord[]

  if (rows.length === 0) return null

  const thinkRows = rows.filter((r) => r.outputTokens > 1000 && r.toolUse === '[]')
  if (thinkRows.length === 0) return null

  const totalOutput = rows.reduce((s, r) => s + r.outputTokens, 0)
  const thinkOutput = thinkRows.reduce((s, r) => s + r.outputTokens, 0)

  if (totalOutput === 0 || thinkOutput / totalOutput <= 0.4) return null

  const thinkCost = thinkRows.reduce((s, r) => s + r.costUSD, 0)
  const wastedUSD = thinkCost * 0.3

  return {
    rule: 'think-heavy',
    severity: 'medium',
    wastedUSD,
    savableUSD: wastedUSD,
    message: `${thinkRows.length} request(s) producing heavy output without tool use (${(thinkOutput / totalOutput * 100).toFixed(0)}% of output tokens)`,
    detail: `${thinkRows.length} request(s) generated >1000 output tokens without any tool calls, accounting for ${(thinkOutput / totalOutput * 100).toFixed(0)}% of total output tokens. This suggests excessive thinking/explaining.`,
    suggestion: 'Only use extended thinking for complex architectural decisions.',
    fix: 'Only use extended thinking for complex architectural decisions.',
  }
}
