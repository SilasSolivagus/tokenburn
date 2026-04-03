import type { AgentNode, AgentTree } from '../logs/tree-builder.js'
import { formatCost, formatTokens, formatDuration } from './format.js'

function renderNode(node: AgentNode, prefix: string, isLast: boolean): string {
  const connector = isLast ? '\u2514\u2500\u2500' : '\u251c\u2500\u2500'
  const childPrefix = isLast ? '    ' : '\u2502   '

  const tools = node.toolUse.length > 0 ? ` [${node.toolUse.join(', ')}]` : ''
  const line = `${prefix}${connector} ${formatCost(node.costUSD)}${tools} (in: ${formatTokens(node.inputTokens)}, out: ${formatTokens(node.outputTokens)})\n`

  const childLines = node.children.map((child, i) =>
    renderNode(child, prefix + childPrefix, i === node.children.length - 1)
  ).join('')

  return line + childLines
}

export function renderTree(tree: AgentTree): string {
  const header = `\u{1F333} Session: ${tree.sessionId}\n`
  const meta = `   Cost: ${formatCost(tree.totalCost)} | ${tree.nodeCount} messages | ${formatDuration(tree.durationMs)}\n`
  const tools = tree.toolSummary ? `   Tools: ${tree.toolSummary}\n` : ''
  const separator = '\n'

  const nodes = tree.roots.map((root, i) =>
    renderNode(root, '', i === tree.roots.length - 1)
  ).join('')

  return header + meta + tools + separator + nodes + '\n'
}

export function renderTreeList(sessionIds: string[]): string {
  if (sessionIds.length === 0) {
    return '\n  No agent tree data found. Run tokenburn import to import logs.\n\n'
  }
  return sessionIds.join('\n') + '\n'
}
