import { getDb, type QueryFilter } from '../../db/db.js'
import { buildWhere } from '../analyzer.js'
import type { RuleFn, WasteDetection } from './index.js'
import type { RequestRecord } from '../../db/schema.js'

export const writeRewrite: RuleFn = (filter: QueryFilter): WasteDetection | null => {
  const db = getDb()
  const { sql, params } = buildWhere(filter)

  const extra = "sessionId != ''"
  const where = sql ? sql + ' AND ' + extra : 'WHERE ' + extra

  const rows = db.prepare(`
    SELECT * FROM requests
    ${where}
  `).all(params) as RequestRecord[]

  const sessionWrites: Record<string, number> = {}
  for (const r of rows) {
    if (r.toolUse.includes('Edit') || r.toolUse.includes('Write')) {
      sessionWrites[r.sessionId] = (sessionWrites[r.sessionId] || 0) + 1
    }
  }

  const heavySessions = Object.entries(sessionWrites).filter(([, cnt]) => cnt >= 3)
  if (heavySessions.length === 0) return null

  const totalWrites = heavySessions.reduce((s, [, cnt]) => s + cnt, 0)

  return {
    rule: 'write-rewrite',
    severity: 'low',
    wastedUSD: 0,
    savableUSD: 0,
    message: `${heavySessions.length} session(s) with 3+ write operations (${totalWrites} total)`,
    detail: `Found ${heavySessions.length} session(s) with 3 or more Edit/Write operations. This may indicate trial-and-error editing.`,
    suggestion: 'Plan changes before writing. Avoid trial-and-error editing.',
    fix: 'Plan changes before writing. Avoid trial-and-error editing.',
  }
}
