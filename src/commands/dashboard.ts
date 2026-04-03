import { Command } from 'commander'
import { startDashboard } from '../dashboard/server.js'

export const dashboardCommand = new Command('dashboard')
  .description('Open local web dashboard')
  .option('-p, --port <port>', 'Port number', '10812')
  .action(async (opts) => { await startDashboard(parseInt(opts.port, 10)) })
