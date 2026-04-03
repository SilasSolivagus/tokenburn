import { Command } from 'commander'
import { getDb, getDbPath, queryRequests } from '../db/db.js'
import type { RequestRecord } from '../db/schema.js'

function toCsvRow(record: RequestRecord): string {
  const fields = [
    record.id,
    record.timestamp,
    record.provider,
    record.model,
    record.source,
    record.inputTokens,
    record.outputTokens,
    record.cacheReadTokens,
    record.cacheWriteTokens,
    record.costUSD,
    record.durationMs,
    record.promptHash,
    record.toolUse,
    record.stopReason,
  ]
  return fields
    .map((f) => {
      const s = String(f)
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`
      }
      return s
    })
    .join(',')
}

export const dbCommand = new Command('db')
  .description('Database utilities')

dbCommand
  .command('path')
  .description('Print the database file path')
  .action(() => {
    console.log(getDbPath())
  })

dbCommand
  .command('export')
  .description('Export all records as CSV')
  .option('--since <ms>', 'Only export records after this timestamp (ms)')
  .action((opts: { since?: string }) => {
    const filter: { since?: number } = {}
    if (opts.since) filter.since = parseInt(opts.since, 10)
    const records = queryRequests(filter)
    const csvHeader =
      'id,timestamp,provider,model,source,inputTokens,outputTokens,cacheReadTokens,cacheWriteTokens,costUSD,durationMs,promptHash,toolUse,stopReason'
    console.log(csvHeader)
    for (const record of records) {
      console.log(toCsvRow(record))
    }
  })

dbCommand
  .command('prune')
  .description('Delete records older than a given number of days')
  .option('--days <n>', 'Delete records older than N days', '90')
  .action((opts: { days: string }) => {
    const days = parseInt(opts.days, 10)
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    const db = getDb()
    const result = db.prepare('DELETE FROM requests WHERE timestamp < @cutoff').run({ cutoff })
    console.log(`Deleted ${result.changes} records older than ${days} days.`)
  })
