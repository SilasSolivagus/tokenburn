import { Command } from 'commander'
import { summarize } from '../analyzer/analyzer.js'
import { runAllRules } from '../analyzer/rules/index.js'
import type { Severity } from '../analyzer/rules/index.js'
import { renderScan } from '../reporter/scan.js'

function parsePeriod(period: string): number {
  const match = period.match(/^(\d+(?:\.\d+)?)([hdwm])$/)
  if (!match) throw new Error(`Invalid period: ${period}. Use formats like 7d, 24h, 2w, 1m.`)
  const value = parseFloat(match[1])
  const unit = match[2]
  const msPerUnit: Record<string, number> = {
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
    m: 30 * 24 * 60 * 60 * 1000,
  }
  return Date.now() - Math.round(value * msPerUnit[unit])
}

const SEVERITY_LEVELS: Severity[] = ['high', 'medium', 'low', 'info']

export const scanCommand = new Command('scan')
  .description('Scan for waste patterns in AI spending')
  .option('--last <period>', 'Time period (e.g. 7d, 24h)', '7d')
  .option('--severity <level>', 'Minimum severity to show: high, medium, low, info', 'info')
  .option('--json', 'Output as JSON', false)
  .action((opts: { last: string; severity: string; json: boolean }) => {
    const since = parsePeriod(opts.last)
    const filter = { since }

    const minSeverity = opts.severity as Severity
    const minIndex = SEVERITY_LEVELS.indexOf(minSeverity)
    if (minIndex === -1) {
      console.error(`Invalid severity: ${opts.severity}. Choose from: high, medium, low, info`)
      process.exit(1)
    }

    const allDetections = runAllRules(filter)
    const detections = allDetections.filter(
      (d) => SEVERITY_LEVELS.indexOf(d.severity) <= minIndex
    )

    const summary = summarize(filter)
    const totalCost = summary.totalCost

    if (opts.json) {
      console.log(JSON.stringify({ totalCost, detections }, null, 2))
      return
    }

    process.stdout.write(renderScan(detections, totalCost))
  })
