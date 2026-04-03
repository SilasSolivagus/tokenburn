import { getDb, type QueryFilter } from '../../db/db.js'
import { buildWhere } from '../analyzer.js'
import type { RuleFn, WasteDetection } from './index.js'
import type { RequestRecord } from '../../db/schema.js'

export const readHeavy: RuleFn = (filter: QueryFilter): WasteDetection | null => {
  const db = getDb()
  const { sql, params } = buildWhere(filter)

  const rows = db.prepare(`
    SELECT * FROM requests
    ${sql}
  `).all(params) as RequestRecord[]

  if (rows.length === 0) return null

  const readRows = rows.filter((r) => r.toolUse.includes('Read'))
  const readPct = readRows.length / rows.length

  if (readPct <= 0.6) return null

  const avgInput = readRows.reduce((s, r) => s + r.inputTokens, 0) / readRows.length
  if (avgInput <= 10000) return null

  return {
    rule: 'read-heavy',
    severity: 'low',
    wastedUSD: 0,
    savableUSD: 0,
    message: `${readRows.length}/${rows.length} requests (${(readPct * 100).toFixed(0)}%) use Read with avg ${Math.round(avgInput)} input tokens`,
    detail: `Read operations dominate token usage. ${readRows.length} of ${rows.length} requests contain Read tool calls with an average of ${Math.round(avgInput)} input tokens.`,
    suggestion: 'Use targeted line-range reads instead of reading entire files.',
    fix: 'Use targeted line-range reads instead of reading entire files.',
  }
}
