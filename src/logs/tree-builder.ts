import { getDb } from '../db/db.js'

export interface AgentNode {
  uuid: string
  parentUuid: string | null
  costUSD: number
  inputTokens: number
  outputTokens: number
  toolUse: string[]
  children: AgentNode[]
}

export interface AgentTree {
  sessionId: string
  totalCost: number
  totalInputTokens: number
  totalOutputTokens: number
  nodeCount: number
  roots: AgentNode[]
  toolSummary: string
  durationMs: number
}

interface TreeRow {
  uuid: string; parentUuid: string | null; inputTokens: number
  outputTokens: number; costUSD: number; toolUse: string; timestamp: number
}

export function buildAgentTree(sessionId: string): AgentTree | null {
  const db = getDb()
  const rows = db.prepare(
    'SELECT uuid, parentUuid, inputTokens, outputTokens, costUSD, toolUse, timestamp FROM agent_tree WHERE sessionId = ? ORDER BY timestamp ASC'
  ).all(sessionId) as TreeRow[]
  if (rows.length === 0) return null

  const nodeMap = new Map<string, AgentNode>()
  for (const row of rows) {
    nodeMap.set(row.uuid, {
      uuid: row.uuid, parentUuid: row.parentUuid,
      costUSD: row.costUSD, inputTokens: row.inputTokens, outputTokens: row.outputTokens,
      toolUse: JSON.parse(row.toolUse), children: [],
    })
  }

  const roots: AgentNode[] = []
  for (const node of nodeMap.values()) {
    if (node.parentUuid && nodeMap.has(node.parentUuid)) {
      nodeMap.get(node.parentUuid)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  let totalCost = 0, totalInput = 0, totalOutput = 0
  const allTools: string[] = []
  for (const row of rows) {
    totalCost += row.costUSD; totalInput += row.inputTokens; totalOutput += row.outputTokens
    allTools.push(...JSON.parse(row.toolUse))
  }

  const toolCounts = new Map<string, number>()
  for (const t of allTools) toolCounts.set(t, (toolCounts.get(t) ?? 0) + 1)
  const toolSummary = Array.from(toolCounts.entries()).sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n} \xd7${c}`).join(', ')

  const timestamps = rows.map(r => r.timestamp)
  const durationMs = timestamps.length > 1 ? Math.max(...timestamps) - Math.min(...timestamps) : 0

  return { sessionId, totalCost, totalInputTokens: totalInput, totalOutputTokens: totalOutput, nodeCount: rows.length, roots, toolSummary, durationMs }
}

export function getTreeSessions(limit: number = 10): string[] {
  const db = getDb()
  const rows = db.prepare('SELECT DISTINCT sessionId FROM agent_tree ORDER BY timestamp DESC LIMIT ?').all(limit) as Array<{ sessionId: string }>
  return rows.map(r => r.sessionId)
}
