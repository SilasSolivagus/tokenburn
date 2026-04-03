import { getDb, type QueryFilter } from '../../db/db.js'
import { buildWhere } from '../analyzer.js'
import type { RuleFn, WasteDetection } from './index.js'

interface SessionRow {
  sessionId: string
  firstInput: number
  lastInput: number
  cnt: number
  totalCost: number
}

export const contextDrift: RuleFn = (filter: QueryFilter): WasteDetection | null => {
  const db = getDb()
  const { sql, params } = buildWhere(filter)

  const extra = "sessionId != ''"
  const where = sql ? sql + ' AND ' + extra : 'WHERE ' + extra

  // Get first and last inputTokens per session (by timestamp order)
  // We need sessions with 5+ records where last inputTokens > 3x first
  const sessions = db.prepare(`
    SELECT sessionId, COUNT(*) as cnt, SUM(costUSD) as totalCost
    FROM requests
    ${where}
    GROUP BY sessionId
    HAVING cnt >= 5
  `).all(params) as SessionRow[]

  if (sessions.length === 0) return null

  let driftingSessions = 0
  let extraCost = 0

  for (const session of sessions) {
    const ordered = db.prepare(`
      SELECT inputTokens FROM requests
      WHERE sessionId = @sid
      ORDER BY timestamp ASC
    `).all({ sid: session.sessionId }) as { inputTokens: number }[]

    if (ordered.length < 5) continue

    const first = ordered[0].inputTokens
    const last = ordered[ordered.length - 1].inputTokens

    if (first > 0 && last > 3 * first) {
      driftingSessions++
      // Estimate extra tokens cost: the growth beyond 1x is waste
      const extraTokens = last - first
      // Rough estimate: extraTokens * avg cost per input token
      const avgCostPerToken = session.totalCost / ordered.reduce((s, r) => s + r.inputTokens, 0)
      extraCost += extraTokens * (avgCostPerToken || 0)
    }
  }

  if (driftingSessions === 0) return null

  return {
    rule: 'context-drift',
    severity: 'medium',
    wastedUSD: extraCost,
    savableUSD: extraCost,
    message: `${driftingSessions} session(s) with context growing >3x from start to end`,
    detail: `Found ${driftingSessions} session(s) where inputTokens grew more than 3x between first and last request. Context accumulation degrades quality and increases cost.`,
    suggestion: 'Use /clear to reset context when switching subtasks.',
    fix: 'Use /clear to reset context when switching subtasks.',
  }
}
