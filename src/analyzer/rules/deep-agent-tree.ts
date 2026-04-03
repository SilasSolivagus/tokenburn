import { getDb, type QueryFilter } from '../../db/db.js'
import type { RuleFn, WasteDetection } from './index.js'

export const deepAgentTree: RuleFn = (_filter: QueryFilter): WasteDetection | null => {
  const db = getDb()

  const rows = db.prepare(`
    SELECT sessionId, COUNT(*) as cnt
    FROM agent_tree
    GROUP BY sessionId
    HAVING cnt > 5
  `).all() as { sessionId: string; cnt: number }[]

  if (rows.length === 0) return null

  const totalNodes = rows.reduce((s, r) => s + r.cnt, 0)

  return {
    rule: 'deep-agent-tree',
    severity: 'medium',
    wastedUSD: 0,
    savableUSD: 0,
    message: `${rows.length} session(s) with deep agent trees (${totalNodes} total nodes)`,
    detail: `Found ${rows.length} session(s) with more than 5 nodes in the agent tree. Deep agent recursion increases cost and complexity.`,
    suggestion: 'Limit agent depth. Break complex tasks into sequential steps.',
    fix: 'Limit agent depth. Break complex tasks into sequential steps.',
  }
}
