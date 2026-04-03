import { getDb, type QueryFilter } from '../../db/db.js'
import { buildWhere } from '../analyzer.js'
import type { RuleFn, WasteDetection } from './index.js'
import type { RequestRecord } from '../../db/schema.js'

const STREAK_THRESHOLD = 3

export const idleChat: RuleFn = (filter: QueryFilter): WasteDetection | null => {
  const db = getDb()
  const { sql, params } = buildWhere(filter)

  const rows = db.prepare(`
    SELECT * FROM requests
    ${sql}
    ORDER BY timestamp ASC
  `).all(params) as RequestRecord[]

  if (rows.length === 0) return null

  let wastedUSD = 0
  let streakStart = -1
  let streakCount = 0

  for (let i = 0; i < rows.length; i++) {
    const isEmpty = rows[i].toolUse === '[]' || rows[i].toolUse === ''
    if (isEmpty) {
      if (streakStart === -1) streakStart = i
      streakCount++
    } else {
      if (streakCount >= STREAK_THRESHOLD) {
        // All requests in the streak are idle
        for (let j = streakStart; j < streakStart + streakCount; j++) {
          wastedUSD += rows[j].costUSD
        }
      }
      streakStart = -1
      streakCount = 0
    }
  }

  // Check trailing streak
  if (streakCount >= STREAK_THRESHOLD) {
    for (let j = streakStart; j < streakStart + streakCount; j++) {
      wastedUSD += rows[j].costUSD
    }
  }

  if (wastedUSD === 0) return null

  return {
    rule: 'idle-chat',
    severity: 'low',
    wastedUSD,
    savableUSD: wastedUSD * 0.8,
    message: `Idle chat streaks detected (3+ consecutive no-tool requests) costing $${wastedUSD.toFixed(4)}`,
    detail: `Found streak(s) of ${STREAK_THRESHOLD}+ consecutive requests with no tool usage, suggesting idle or exploratory conversation totaling $${wastedUSD.toFixed(4)}.`,
    suggestion: 'Consider batching exploratory queries or using a cheaper model for conversational turns.',
  }
}
