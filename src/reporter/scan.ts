import chalk from 'chalk'
import { formatCost, severityIcon, header, dim } from './format.js'
import type { WasteDetection } from '../analyzer/rules/index.js'
import type { TokenburnConfig } from '../config.js'

export function renderScan(detections: WasteDetection[], totalCost: number, config?: TokenburnConfig): string {
  const mode = config?.mode ?? 'subscription'
  const planPrice = config?.planPrice ?? 200

  const lines: string[] = ['']

  if (mode === 'subscription') {
    const multiplier = planPrice > 0 && totalCost > 0 ? totalCost / planPrice : 0
    const multiplierStr = multiplier > 0 ? ` — ${multiplier.toFixed(1)}x value` : ''
    lines.push(header(`🔥 API equivalent: ${formatCost(totalCost)} (your plan: $${planPrice}/mo${multiplierStr} ✓)`))
  } else {
    lines.push(header(`🔥 Total spending in period: ${formatCost(totalCost)}`))
  }

  lines.push('')

  if (detections.length === 0) {
    if (mode === 'subscription') {
      lines.push(chalk.green('  ✨ No efficiency issues detected! Your AI usage looks optimized.'), '')
    } else {
      lines.push(chalk.green('  ✨ No waste detected! Your AI spending looks efficient.'), '')
    }
    return lines.join('\n')
  }

  if (mode === 'subscription') {
    lines.push(header(`  Efficiency scan (${detections.length} findings):`), '')
    for (const d of detections) {
      lines.push(`  ${severityIcon(d.severity)} ${chalk.bold(d.message)}`)
      lines.push(dim(`     ${d.detail}`))
      lines.push(chalk.cyan(`     → ${d.suggestion}`))
      lines.push('')
    }
    const multiplier = planPrice > 0 && totalCost > 0 ? totalCost / planPrice : 0
    const multiplierStr = multiplier > 0 ? ` Your $${planPrice}/mo Max plan provides ${multiplier.toFixed(1)}x value vs API pricing.` : ''
    lines.push(chalk.dim(`  💡 These findings help optimize efficiency and rate limits, not your bill.${multiplierStr}`), '')
  } else {
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
  }

  return lines.join('\n')
}
