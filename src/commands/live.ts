import { Command } from 'commander'
import { summarize, aggregateByModel } from '../analyzer/analyzer.js'
import { renderSummary, renderByModel } from '../reporter/report.js'

function render(): void {
  const since = Date.now() - 24 * 60 * 60 * 1000 // last 24h
  const filter = { since }
  const summary = summarize(filter)
  const byModel = aggregateByModel(filter).slice(0, 10)

  process.stdout.write('\x1Bc') // clear screen
  process.stdout.write(renderSummary(summary, 'last 24h (live)'))
  process.stdout.write(renderByModel(byModel))
  process.stdout.write('  Press Ctrl+C to exit.\n')
}

export const liveCommand = new Command('live')
  .description('Live dashboard — refreshes every 2s')
  .action(() => {
    render()
    const interval = setInterval(render, 2000)

    process.on('SIGINT', () => {
      clearInterval(interval)
      process.stdout.write('\n')
      process.exit(0)
    })
  })
