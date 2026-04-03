import { getDb, type QueryFilter } from '../../db/db.js'
import { buildWhere } from '../analyzer.js'
import type { RuleFn, WasteDetection } from './index.js'
import type { RequestRecord } from '../../db/schema.js'

export const searchInefficient: RuleFn = (filter: QueryFilter): WasteDetection | null => {
  const db = getDb()
  const { sql, params } = buildWhere(filter)

  const rows = db.prepare(`
    SELECT * FROM requests
    ${sql}
  `).all(params) as RequestRecord[]

  const searchRows = rows.filter((r) => r.toolUse.includes('Grep') || r.toolUse.includes('Glob'))

  if (searchRows.length <= 20) return null

  return {
    rule: 'search-inefficient',
    severity: 'low',
    wastedUSD: 0,
    savableUSD: 0,
    message: `${searchRows.length} search operations (Grep/Glob) detected`,
    detail: `Found ${searchRows.length} requests using Grep or Glob tools. Many searches may indicate inefficient search patterns.`,
    suggestion: 'Use more specific search patterns. Combine multiple searches into one.',
    fix: 'Use more specific search patterns. Combine multiple searches into one.',
  }
}
