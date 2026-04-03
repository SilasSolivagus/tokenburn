import chalk from 'chalk'

export function formatCost(cost: number): string {
  if (cost >= 1) return `$${cost.toFixed(2)}`
  if (cost >= 0.01) return `$${cost.toFixed(3)}`
  return `$${cost.toFixed(4)}`
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`
  return String(tokens)
}

export function formatDuration(ms: number): string {
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`
  if (ms >= 1_000) return `${(ms / 1_000).toFixed(1)}s`
  return `${ms}ms`
}

export function severityIcon(severity: string): string {
  switch (severity) {
    case 'high': return chalk.red('🔴')
    case 'medium': return chalk.yellow('🟡')
    case 'low': return chalk.green('🟢')
    case 'info': return chalk.blue('💡')
    default: return '  '
  }
}

export function header(text: string): string { return chalk.bold(text) }
export function dim(text: string): string { return chalk.dim(text) }
