import { Command } from 'commander'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { startProxy } from '../proxy/server.js'
import { daemonStart, daemonStop, getDaemonStatus } from '../proxy/daemon.js'

const DEFAULT_PORT = 10811

export const proxyCommand = new Command('proxy')
  .description('Manage the tokenburn proxy server')

proxyCommand
  .command('start')
  .description('Start the proxy server')
  .option('-d, --daemon', 'Run in background as a daemon', false)
  .option('-p, --port <port>', 'Port to listen on', String(DEFAULT_PORT))
  .action(async (opts: { daemon: boolean; port: string }) => {
    const port = parseInt(opts.port, 10)
    if (opts.daemon) {
      const scriptPath = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'index.js')
      daemonStart(scriptPath, port)
    } else {
      console.log(`Starting proxy on port ${port}...`)
      await startProxy({ port })
      console.log(`Proxy listening on http://localhost:${port}`)
      console.log('Press Ctrl+C to stop.')
    }
  })

proxyCommand
  .command('stop')
  .description('Stop the background proxy daemon')
  .action(() => {
    daemonStop()
  })

proxyCommand
  .command('status')
  .description('Show proxy daemon status')
  .action(() => {
    const status = getDaemonStatus()
    if (status.running) {
      console.log(`Proxy is running (PID ${status.pid})`)
      console.log(`Logs: ${status.logFile}`)
    } else {
      console.log('Proxy is not running.')
    }
  })

proxyCommand
  .command('env')
  .description('Print environment variable export statements')
  .option('-p, --port <port>', 'Port the proxy is running on', String(DEFAULT_PORT))
  .action((opts: { port: string }) => {
    const port = opts.port
    console.log(`export ANTHROPIC_BASE_URL=http://localhost:${port}/anthropic`)
    console.log(`export OPENAI_BASE_URL=http://localhost:${port}/openai`)
  })

proxyCommand
  .command('install')
  .description('Append proxy env vars to ~/.zshrc')
  .option('-p, --port <port>', 'Port the proxy runs on', String(DEFAULT_PORT))
  .action((opts: { port: string }) => {
    const port = opts.port
    const zshrc = path.join(os.homedir(), '.zshrc')
    const lines = [
      '',
      '# tokenburn proxy',
      `export ANTHROPIC_BASE_URL=http://localhost:${port}/anthropic`,
      `export OPENAI_BASE_URL=http://localhost:${port}/openai`,
      '',
    ].join('\n')
    fs.appendFileSync(zshrc, lines)
    console.log(`Appended proxy env vars to ${zshrc}`)
    console.log('Run `source ~/.zshrc` to apply.')
  })
