import { Command } from 'commander'
import { summarize, aggregateByModel, aggregateBySource, aggregateByDay, aggregateByHour, aggregateBySession, calculatePlanValue } from '../analyzer/analyzer.js'
import { renderSummary, renderByModel, renderBySource, renderByDay, renderByHour, renderBySession, renderPlanValue } from '../reporter/report.js'

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

function periodLabel(period: string): string {
  const match = period.match(/^(\d+(?:\.\d+)?)([hdwm])$/)
  if (!match) return period
  const unitMap: Record<string, string> = { h: 'hour', d: 'day', w: 'week', m: 'month' }
  const value = parseFloat(match[1])
  const unit = unitMap[match[2]]
  return `last ${value} ${unit}${value !== 1 ? 's' : ''}`
}

export const reportCommand = new Command('report')
  .description('Show spending report')
  .option('--last <period>', 'Time period (e.g. 1d, 7d, 24h)', '1d')
  .option('--by <dimension>', 'Breakdown dimension: model, source, day, hour, session')
  .option('--plan <price>', 'Compare against subscription plan price (USD/month)')
  .option('--json', 'Output as JSON', false)
  .action((opts: { last: string; by?: string; plan?: string; json: boolean }) => {
    const since = parsePeriod(opts.last)
    const filter = { since }
    const label = periodLabel(opts.last)

    const summary = summarize(filter)

    if (opts.json) {
      const output: Record<string, unknown> = { summary }
      if (opts.by === 'model') output.byModel = aggregateByModel(filter)
      else if (opts.by === 'source') output.bySource = aggregateBySource(filter)
      else if (opts.by === 'day') output.byDay = aggregateByDay(filter)
      else if (opts.by === 'hour') output.byHour = aggregateByHour(filter)
      else if (opts.by === 'session') output.bySession = aggregateBySession(filter)
      else {
        output.byModel = aggregateByModel(filter)
      }
      console.log(JSON.stringify(output, null, 2))
      return
    }

    process.stdout.write(renderSummary(summary, label))

    if (opts.by === 'model' || !opts.by) {
      process.stdout.write(renderByModel(aggregateByModel(filter)))
    }
    if (opts.by === 'source') {
      process.stdout.write(renderBySource(aggregateBySource(filter)))
    }
    if (opts.by === 'day') {
      process.stdout.write(renderByDay(aggregateByDay(filter)))
    }
    if (opts.by === 'hour') {
      process.stdout.write(renderByHour(aggregateByHour(filter)))
    }
    if (opts.by === 'session') {
      process.stdout.write(renderBySession(aggregateBySession(filter)))
    }
    if (opts.plan) {
      const planPrice = parseFloat(opts.plan)
      if (!isNaN(planPrice) && planPrice > 0) {
        const pv = calculatePlanValue({ since: Date.now() - 30 * 86400000 }, planPrice)
        process.stdout.write(renderPlanValue(pv))
      }
    }
  })
