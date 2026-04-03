#!/usr/bin/env node
import { Command } from 'commander'
import { proxyCommand } from './commands/proxy.js'
import { reportCommand } from './commands/report.js'
import { scanCommand } from './commands/scan.js'
import { liveCommand } from './commands/live.js'
import { dbCommand } from './commands/db.js'

const program = new Command()
program.name('tokenburn').description('🔥 htop for your AI spending').version('0.1.0')
program.addCommand(proxyCommand)
program.addCommand(reportCommand)
program.addCommand(scanCommand)
program.addCommand(liveCommand)
program.addCommand(dbCommand)
program.parse()
