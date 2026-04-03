import Table from 'cli-table3'
import type { Summary, ModelAgg, SourceAgg, DayAgg, HourAgg } from '../analyzer/analyzer.js'
import { formatCost, formatTokens, header, dim } from './format.js'

export function renderSummary(summary: Summary, label: string): string {
  const lines = [
    '',
    header(`📊 Summary — ${label}`),
    '',
    `  Total cost:       ${formatCost(summary.totalCost)}`,
    `  Total requests:   ${summary.totalRequests.toLocaleString()}`,
    `  Avg cost/request: ${formatCost(summary.avgCostPerRequest)}`,
    `  Input tokens:     ${formatTokens(summary.totalInputTokens)}`,
    `  Output tokens:    ${formatTokens(summary.totalOutputTokens)}`,
    `  Cache read:       ${formatTokens(summary.totalCacheReadTokens)}`,
    '',
  ]
  return lines.join('\n')
}

export function renderByModel(rows: ModelAgg[]): string {
  if (rows.length === 0) return dim('  No data for this period.\n')

  const table = new Table({
    head: ['Model', 'Cost', 'Requests', 'Input', 'Output'],
    style: { head: ['cyan'] },
    colAligns: ['left', 'right', 'right', 'right', 'right'],
  })

  for (const row of rows) {
    table.push([
      row.model,
      formatCost(row.totalCost),
      row.requestCount.toLocaleString(),
      formatTokens(row.totalInput),
      formatTokens(row.totalOutput),
    ])
  }

  return [header('  By Model:'), '', table.toString(), ''].join('\n')
}

export function renderBySource(rows: SourceAgg[]): string {
  if (rows.length === 0) return dim('  No data for this period.\n')

  const table = new Table({
    head: ['Source', 'Cost', 'Requests', 'Input', 'Output'],
    style: { head: ['cyan'] },
    colAligns: ['left', 'right', 'right', 'right', 'right'],
  })

  for (const row of rows) {
    table.push([
      row.source,
      formatCost(row.totalCost),
      row.requestCount.toLocaleString(),
      formatTokens(row.totalInput),
      formatTokens(row.totalOutput),
    ])
  }

  return [header('  By Source:'), '', table.toString(), ''].join('\n')
}

const BAR_WIDTH = 30

function makeBar(value: number, max: number): string {
  if (max === 0) return ''
  const filled = Math.round((value / max) * BAR_WIDTH)
  return '█'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled)
}

export function renderByDay(rows: DayAgg[]): string {
  if (rows.length === 0) return dim('  No data for this period.\n')

  const max = Math.max(...rows.map((r) => r.totalCost))
  const lines = [header('  By Day:'), '']

  for (const row of rows) {
    const bar = makeBar(row.totalCost, max)
    const cost = formatCost(row.totalCost).padStart(8)
    lines.push(`  ${row.day}  ${bar} ${cost}`)
  }

  lines.push('')
  return lines.join('\n')
}

export function renderByHour(rows: HourAgg[]): string {
  // Build a map for all 24 hours, filling in zeros for missing hours
  const hourMap = new Map<string, number>()
  for (const row of rows) {
    hourMap.set(row.hour, row.totalCost)
  }

  const allHours: Array<{ hour: string; totalCost: number }> = []
  for (let h = 0; h < 24; h++) {
    const hour = String(h).padStart(2, '0')
    allHours.push({ hour, totalCost: hourMap.get(hour) ?? 0 })
  }

  const max = Math.max(...allHours.map((r) => r.totalCost))
  const lines = [header('  By Hour (local time):'), '']

  for (const row of allHours) {
    const bar = makeBar(row.totalCost, max)
    const cost = max > 0 ? formatCost(row.totalCost).padStart(8) : '        '
    lines.push(`  ${row.hour}:00  ${bar} ${cost}`)
  }

  lines.push('')
  return lines.join('\n')
}
