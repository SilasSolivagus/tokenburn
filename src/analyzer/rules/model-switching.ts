import { getDb, type QueryFilter } from '../../db/db.js'
import { buildWhere } from '../analyzer.js'
import type { RuleFn, WasteDetection } from './index.js'

export const modelSwitching: RuleFn = (filter: QueryFilter): WasteDetection | null => {
  const db = getDb()
  const { sql, params } = buildWhere(filter)

  const extra = "sessionId != ''"
  const where = sql ? sql + ' AND ' + extra : 'WHERE ' + extra

  const rows = db.prepare(`
    SELECT sessionId, COUNT(DISTINCT model) as modelCount
    FROM requests
    ${where}
    GROUP BY sessionId
    HAVING modelCount >= 3
  `).all(params) as { sessionId: string; modelCount: number }[]

  if (rows.length === 0) return null

  return {
    rule: 'model-switching',
    severity: 'low',
    wastedUSD: 0,
    savableUSD: 0,
    message: `${rows.length} session(s) switching between 3+ different models`,
    detail: `Found ${rows.length} session(s) that used 3 or more different models. Frequent model switching can indicate unclear workflow.`,
    suggestion: 'Use a consistent model within each session to avoid context loss.',
    fix: '# Add to CLAUDE.md:\nUse consistent model within each session. Pick the right model at session start.',
  }
}
