import { getDb, type QueryFilter } from '../../db/db.js'
import { buildWhere } from '../analyzer.js'
import type { RuleFn, WasteDetection } from './index.js'

export const noClaudemd: RuleFn = (filter: QueryFilter): WasteDetection | null => {
  const db = getDb()
  const { sql, params } = buildWhere(filter)

  const row = db.prepare(`
    SELECT COUNT(*) as cnt FROM requests
    ${sql}
  `).get(params) as { cnt: number }

  if (row.cnt === 0) return null

  return {
    rule: 'no-claudemd',
    severity: 'info',
    wastedUSD: 0,
    savableUSD: 0,
    message: 'Consider creating a CLAUDE.md configuration file',
    detail: 'A CLAUDE.md file in your project root can provide coding preferences and constraints to reduce wasted tokens from misunderstood requirements.',
    suggestion: 'Create a CLAUDE.md file in your project root with coding preferences and constraints.',
    fix: 'Create a CLAUDE.md file in your project root with coding preferences and constraints.',
  }
}
