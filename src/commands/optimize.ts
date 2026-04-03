import { Command } from 'commander'
import chalk from 'chalk'
import { getDb } from '../db/db.js'
import { summarize } from '../analyzer/analyzer.js'
import { generateOptimizations, simulateModel } from '../analyzer/optimizer.js'
import { renderOptimizations, renderSimulation } from '../reporter/optimize.js'
import { applyFixToClaudeMd } from '../analyzer/fix-applier.js'

function parsePeriod(period: string): number {
  const match = period.match(/^(\d+(?:\.\d+)?)([hdwm])$/)
  if (!match) return Date.now() - 7 * 86400000
  const value = parseFloat(match[1])
  const ms: Record<string, number> = { h: 3600000, d: 86400000, w: 604800000, m: 2592000000 }
  return Date.now() - Math.round(value * ms[match[2]])
}

export const optimizeCommand = new Command('optimize')
  .description('Generate optimization plans to reduce AI spending')
  .option('--last <period>', 'Time period', '7d')
  .option('--simulate', 'Simulate a global model switch', false)
  .option('--model <model>', 'Target model for simulation', 'claude-haiku-4-5')
  .option('--apply', 'Auto-apply all fixes to CLAUDE.md', false)
  .option('--json', 'Output as JSON', false)
  .action((opts) => {
    getDb()
    const since = parsePeriod(opts.last)
    const filter = { since }

    if (opts.simulate) {
      const result = simulateModel(filter, opts.model)
      if (opts.json) { console.log(JSON.stringify(result, null, 2)); return }
      process.stdout.write(renderSimulation(result))
      return
    }

    const plans = generateOptimizations(filter)
    const summary = summarize(filter)
    if (opts.json) { console.log(JSON.stringify({ totalCost: summary.totalCost, plans }, null, 2)); return }
    process.stdout.write(renderOptimizations(plans, summary.totalCost))

    if (opts.apply) {
      let applied = 0
      for (const p of plans) {
        if (p.fix && applyFixToClaudeMd(p.fix)) {
          console.log(chalk.green(`  ✓ Applied: ${p.name}`))
          applied++
        }
      }
      if (applied > 0) console.log(chalk.bold.green(`\n  ${applied} fix(es) applied. Review: git diff CLAUDE.md\n`))
    }
  })
