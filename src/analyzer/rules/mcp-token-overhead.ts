import { getDb, type QueryFilter } from '../../db/db.js'
import { buildWhere } from '../analyzer.js'
import type { RuleFn, WasteDetection } from './index.js'

export const mcpTokenOverhead: RuleFn = (filter: QueryFilter): WasteDetection | null => {
  const db = getDb()
  const { sql, params } = buildWhere(filter)

  const extra = "sessionId != ''"
  const where = sql ? sql + ' AND ' + extra : 'WHERE ' + extra

  // Find first request per session
  const rows = db.prepare(`
    SELECT sessionId, inputTokens
    FROM requests
    ${where}
    AND timestamp = (
      SELECT MIN(r2.timestamp) FROM requests r2 WHERE r2.sessionId = requests.sessionId
    )
  `).all(params) as { sessionId: string; inputTokens: number }[]

  const highOverhead = rows.filter((r) => r.inputTokens > 50000)

  if (highOverhead.length === 0) return null

  return {
    rule: 'mcp-token-overhead',
    severity: 'info',
    wastedUSD: 0,
    savableUSD: 0,
    message: `${highOverhead.length} session(s) start with >50k input tokens`,
    detail: `Found ${highOverhead.length} session(s) where the first request has over 50,000 input tokens. This may indicate MCP server connection overhead loading tool schemas.`,
    suggestion: 'Review active MCP servers. Disable unused ones to reduce connection overhead.',
    fix: 'Review active MCP servers. Disable unused ones to reduce connection overhead.',
  }
}
