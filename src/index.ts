#!/usr/bin/env node
import { Command } from 'commander'
import chalk from 'chalk'
import { proxyCommand } from './commands/proxy.js'
import { reportCommand } from './commands/report.js'
import { scanCommand } from './commands/scan.js'
import { liveCommand } from './commands/live.js'
import { dbCommand } from './commands/db.js'
import { importCommand } from './commands/import.js'
import { optimizeCommand } from './commands/optimize.js'
import { getDb } from './db/db.js'
import { importLogs } from './logs/importer.js'
import { summarize, aggregateByModel } from './analyzer/analyzer.js'
import { runAllRules } from './analyzer/rules/index.js'
import { renderSummary, renderByModel } from './reporter/report.js'

const program = new Command()
program.name('tokenburn').description('🔥 htop for your AI spending').version('0.2.0')
program.addCommand(proxyCommand)
program.addCommand(reportCommand)
program.addCommand(scanCommand)
program.addCommand(liveCommand)
program.addCommand(dbCommand)
program.addCommand(importCommand)
program.addCommand(optimizeCommand)

// Default action when no subcommand given
program.action(() => {
  getDb()
  const result = importLogs()
  if (result.imported > 0) {
    console.log(chalk.dim(`  Imported ${result.imported} new records from Claude Code logs`))
  }

  const since = Date.now() - 86400000
  const filter = { since }
  const summary = summarize(filter)

  if (summary.totalRequests === 0) {
    console.log('')
    console.log(chalk.bold('🔥 tokenburn'))
    console.log('')
    console.log('  No usage data found for today.')
    console.log('')
    console.log('  Get started:')
    console.log(chalk.cyan('    tokenburn import          ') + chalk.dim('— import Claude Code logs'))
    console.log(chalk.cyan('    tokenburn proxy start -d  ') + chalk.dim('— start proxy for all AI tools'))
    console.log('')
    return
  }

  process.stdout.write(renderSummary(summary, 'Today'))
  process.stdout.write(renderByModel(aggregateByModel(filter)))

  const wasteFilter = { since: Date.now() - 7 * 86400000 }
  const detections = runAllRules(wasteFilter)
  if (detections.length > 0) {
    const totalWaste = detections.reduce((s, d) => s + d.wastedUSD, 0)
    console.log(chalk.yellow(`  ⚠ ${detections.length} waste patterns detected (~$${totalWaste.toFixed(2)}/week) — run \`tokenburn scan\` for details`))
    console.log('')
  }
})

program.parse()
