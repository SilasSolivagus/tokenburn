import { Command } from 'commander'
import chalk from 'chalk'
import { getDb } from '../db/db.js'
import { summarize } from '../analyzer/analyzer.js'
import { runAllRules, listRules } from '../analyzer/rules/index.js'
import type { Severity } from '../analyzer/rules/index.js'
import { loadCustomRules, runCustomRules } from '../analyzer/rules/custom.js'
import { renderScan } from '../reporter/scan.js'
import { applyFixToClaudeMd, promptForFix } from '../analyzer/fix-applier.js'

function parsePeriod(period: string): number {
  const match = period.match(/^(\d+(?:\.\d+)?)([hdwm])$/)
  if (!match) throw new Error(`Invalid period: ${period}`)
  const value = parseFloat(match[1])
  const ms: Record<string, number> = { h: 3600000, d: 86400000, w: 604800000, m: 2592000000 }
  return Date.now() - Math.round(value * ms[match[2]])
}

const SEVERITY_LEVELS: Severity[] = ['high', 'medium', 'low', 'info']

export const scanCommand = new Command('scan')
  .description('Scan for waste patterns in AI spending')
  .option('--last <period>', 'Time period (e.g. 7d, 24h)', '7d')
  .option('--severity <level>', 'Minimum severity: high, medium, low, info', 'info')
  .option('--fix', 'Interactive fix mode', false)
  .option('--rules', 'List all available rules', false)
  .option('--disable <rules>', 'Comma-separated rules to skip')
  .option('--json', 'Output as JSON', false)
  .action(async (opts) => {
    getDb()

    if (opts.rules) {
      const rules = listRules()
      console.log(chalk.bold(`\n  ${rules.length} rules available:\n`))
      for (const r of rules) {
        console.log(`  ${chalk.cyan(r.name.padEnd(28))} ${r.description}`)
      }
      console.log('')
      return
    }

    const since = parsePeriod(opts.last)
    const filter = { since }
    const disabled = opts.disable ? opts.disable.split(',').map((s: string) => s.trim()) : []
    const minSeverity = opts.severity as Severity
    const minIndex = SEVERITY_LEVELS.indexOf(minSeverity)
    if (minIndex === -1) {
      console.error(`Invalid severity: ${opts.severity}`)
      process.exit(1)
    }

    const customRules = loadCustomRules()
    const customDetections = runCustomRules(customRules, filter)
    const combined = [...runAllRules(filter, disabled), ...customDetections]
    const detections = combined.filter(d => SEVERITY_LEVELS.indexOf(d.severity) <= minIndex)
    const summary = summarize(filter)

    if (opts.json) {
      console.log(JSON.stringify({ totalCost: summary.totalCost, detections }, null, 2))
      return
    }

    process.stdout.write(renderScan(detections, summary.totalCost))

    if (opts.fix) {
      let applied = 0
      for (const d of detections) {
        if (!d.fix) continue
        console.log(chalk.bold(`  Fix for: ${d.rule}`))
        console.log(chalk.dim(`  ${d.fix}`))
        const answer = await promptForFix(chalk.cyan('  Apply? [y/n/skip] '))
        if (answer === 'y') {
          const ok = applyFixToClaudeMd(d.fix)
          if (ok) { console.log(chalk.green('  ✓ Applied')); applied++ }
          else console.log(chalk.dim('  Already applied or empty'))
        }
        console.log('')
      }
      if (applied > 0) console.log(chalk.bold.green(`  ${applied} fix(es) applied. Review: git diff CLAUDE.md\n`))
    }
  })
