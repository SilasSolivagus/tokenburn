import chalk from 'chalk'
import { formatCost, header, dim } from './format.js'
import type { OptimizationPlan, SimulationResult } from '../analyzer/optimizer.js'

export function renderOptimizations(plans: OptimizationPlan[], totalCost: number): string {
  const lines = ['', header(`🔥 Total spending: ${formatCost(totalCost)}`), '']
  if (plans.length === 0) {
    lines.push(chalk.green('  ✨ No optimization opportunities found!'), '')
    return lines.join('\n')
  }
  const totalSavings = plans.reduce((s, p) => s + p.savingsUSD, 0)
  const pct = totalCost > 0 ? Math.round((totalSavings / totalCost) * 100) : 0
  lines.push(header(`  ${plans.length} optimization(s), est. savings ${formatCost(totalSavings)}/period:`), '')
  for (let i = 0; i < plans.length; i++) {
    const p = plans[i]
    lines.push(chalk.bold(`  ${i + 1}. ${p.description}`) + dim(` — save ${formatCost(p.savingsUSD)} (${p.savingsPercent.toFixed(0)}%)`))
    if (p.fix) lines.push(dim(`     ${p.fix.split('\n')[0]}`))
    lines.push('')
  }
  lines.push('  ' + '─'.repeat(40))
  lines.push(chalk.bold.green(`  💰 Total: ${formatCost(totalSavings)}/period (${pct}%)`))
  lines.push(dim(`  Current: ${formatCost(totalCost)} → Optimized: ${formatCost(totalCost - totalSavings)}`))
  lines.push('')
  return lines.join('\n')
}

export function renderSimulation(result: SimulationResult): string {
  const lines = [
    '', header(`  What-if: All requests used ${result.targetModel}`), '',
    `  Current:     ${formatCost(result.currentCost)}`,
    `  Simulated:   ${formatCost(result.simulatedCost)} (${result.savingsPercent.toFixed(0)}% ↓)`,
    `  Savings:     ${chalk.green(formatCost(result.savings))}`,
    `  Requests:    ${result.requestCount}`, '',
  ]
  if (result.warning) { lines.push(chalk.yellow(`  ⚠ ${result.warning}`), '') }
  return lines.join('\n')
}
