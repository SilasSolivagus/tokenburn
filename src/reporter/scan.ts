import chalk from 'chalk'
import { formatCost, severityIcon, header, dim } from './format.js'
import type { WasteDetection } from '../analyzer/rules/index.js'

export function renderScan(detections: WasteDetection[], totalCost: number): string {
  const lines = ['', header(`🔥 Total spending in period: ${formatCost(totalCost)}`), '']
  if (detections.length === 0) {
    lines.push(chalk.green('  ✨ No waste detected! Your AI spending looks efficient.'), '')
    return lines.join('\n')
  }
  lines.push(header(`  Waste detection (${detections.length} issues found):`), '')
  for (const d of detections) {
    lines.push(`  ${severityIcon(d.severity)} ${chalk.bold(d.message)} — ${formatCost(d.wastedUSD)} wasted`)
    lines.push(dim(`     ${d.detail}`))
    lines.push(chalk.cyan(`     → ${d.suggestion}`))
    lines.push('')
  }
  const totalSavable = detections.reduce((sum, d) => sum + d.savableUSD, 0)
  if (totalSavable > 0) {
    const pct = totalCost > 0 ? Math.round((totalSavable / totalCost) * 100) : 0
    lines.push(chalk.bold.green(`  💰 Potential savings: ${formatCost(totalSavable)}/period (${pct}%)`), '')
  }
  return lines.join('\n')
}
