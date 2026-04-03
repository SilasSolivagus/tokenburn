import { Command } from 'commander'
import chalk from 'chalk'
import { getDb } from '../db/db.js'
import { importLogs } from '../logs/importer.js'

function parseSince(period: string | undefined): number {
  if (!period) return 0
  const match = period.match(/^(\d+)([dhwm])$/)
  if (!match) return 0
  const value = parseInt(match[1], 10)
  const ms: Record<string, number> = { h: 3600000, d: 86400000, w: 604800000, m: 2592000000 }
  return Date.now() - value * ms[match[2]]
}

export const importCommand = new Command('import')
  .description('Import Claude Code local logs')
  .option('--since <period>', 'Only import entries newer than (e.g. 7d, 30d)')
  .option('--json', 'Output result as JSON', false)
  .action((opts: { since?: string; json: boolean }) => {
    getDb()
    const sinceMs = parseSince(opts.since)
    console.log(chalk.dim('Scanning Claude Code logs...'))
    const result = importLogs(undefined, sinceMs)
    if (opts.json) { console.log(JSON.stringify(result, null, 2)); return }
    console.log('')
    console.log(chalk.bold(`  Scanned ${result.filesScanned} files`))
    console.log(chalk.green(`  Imported ${result.imported} new records`))
    if (result.skipped > 0) console.log(chalk.dim(`  Skipped ${result.skipped} (already imported or filtered)`))
    console.log('')
  })
