import { summarize, aggregateByModel } from '../analyzer/analyzer.js'
import { runAllRules } from '../analyzer/rules/index.js'
import { generateOptimizations } from '../analyzer/optimizer.js'
import { buildAgentTree, getTreeSessions } from '../logs/tree-builder.js'
import { formatCost } from '../reporter/format.js'

function parsePeriod(period: string): number {
  const match = period?.match(/^(\d+)([hdwm])$/)
  if (!match) return Date.now() - 86400000
  const value = parseInt(match[1], 10)
  const ms: Record<string, number> = { h: 3600000, d: 86400000, w: 604800000, m: 2592000000 }
  return Date.now() - value * ms[match[2]]
}

export const TOOL_DEFINITIONS = [
  { name: 'get_spending', description: 'Get AI spending summary for a time period',
    inputSchema: { type: 'object' as const, properties: { period: { type: 'string', description: 'e.g. 1d, 7d, 24h', default: '1d' } } } },
  { name: 'get_waste', description: 'Detect waste patterns in AI spending',
    inputSchema: { type: 'object' as const, properties: { period: { type: 'string', default: '7d' } } } },
  { name: 'get_suggestion', description: 'Get optimization suggestions',
    inputSchema: { type: 'object' as const, properties: { period: { type: 'string', default: '7d' } } } },
  { name: 'get_tree', description: 'Get agent cost tree for a session',
    inputSchema: { type: 'object' as const, properties: { sessionId: { type: 'string', description: 'Session ID (omit for latest)' } } } },
]

export async function handleToolCall(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'get_spending': {
      const since = parsePeriod((args.period as string) ?? '1d')
      return { ...summarize({ since }), models: aggregateByModel({ since }).slice(0, 5) }
    }
    case 'get_waste': return runAllRules({ since: parsePeriod((args.period as string) ?? '7d') })
    case 'get_suggestion': {
      const plans = generateOptimizations({ since: parsePeriod((args.period as string) ?? '7d') })
      if (!plans.length) return 'No optimization opportunities found.'
      const total = plans.reduce((s, p) => s + p.savingsUSD, 0)
      const lines = [`Optimization suggestions (est. savings ${formatCost(total)}/period):\n`]
      for (const p of plans.slice(0, 5)) {
        lines.push(`- ${p.description}: save ${formatCost(p.savingsUSD)}`)
        if (p.fix) lines.push(`  Fix: ${p.fix.split('\n').filter(l => !l.startsWith('#')).join(' ').trim()}`)
      }
      return lines.join('\n')
    }
    case 'get_tree': {
      const sid = args.sessionId as string | undefined
      if (sid) return buildAgentTree(sid)
      const sessions = getTreeSessions(1)
      return sessions.length > 0 ? buildAgentTree(sessions[0]) : null
    }
    default: throw new Error(`Unknown tool: ${name}`)
  }
}
