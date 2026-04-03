import { getDb, type QueryFilter } from '../../db/db.js'
import { buildWhere } from '../analyzer.js'
import type { RuleFn, WasteDetection } from './index.js'
import type { RequestRecord } from '../../db/schema.js'

export const bashLoop: RuleFn = (filter: QueryFilter): WasteDetection | null => {
  const db = getDb()
  const { sql, params } = buildWhere(filter)

  const extra = "sessionId != ''"
  const where = sql ? sql + ' AND ' + extra : 'WHERE ' + extra

  const rows = db.prepare(`
    SELECT * FROM requests
    ${where}
  `).all(params) as RequestRecord[]

  const sessionBash: Record<string, RequestRecord[]> = {}
  for (const r of rows) {
    if (r.toolUse.includes('Bash')) {
      if (!sessionBash[r.sessionId]) sessionBash[r.sessionId] = []
      sessionBash[r.sessionId].push(r)
    }
  }

  const heavySessions = Object.entries(sessionBash).filter(([, recs]) => recs.length > 10)
  if (heavySessions.length === 0) return null

  let totalCost = 0
  for (const [, recs] of heavySessions) {
    totalCost += recs.reduce((s, r) => s + r.costUSD, 0)
  }

  const wastedUSD = totalCost * 0.2

  return {
    rule: 'bash-loop',
    severity: 'medium',
    wastedUSD,
    savableUSD: wastedUSD,
    message: `${heavySessions.length} session(s) with >10 Bash calls`,
    detail: `Found ${heavySessions.length} session(s) with more than 10 Bash tool calls. Agent may be stuck in a trial-and-error loop.`,
    suggestion: 'Break the task down. Avoid trial-and-error Bash loops.',
    fix: 'Agent may be stuck in a trial-and-error loop. Break the task down.',
  }
}
