import { Command } from 'commander'
import chalk from 'chalk'
import { loadConfig, saveConfig, getConfigPath } from '../config.js'

export const configCommand = new Command('config')
  .description('View or set tokenburn configuration')

configCommand.command('show')
  .description('Show current config')
  .action(() => {
    const config = loadConfig()
    console.log(`\n  Mode:       ${chalk.bold(config.mode)}`)
    console.log(`  Plan price: ${chalk.bold('$' + config.planPrice + '/mo')}`)
    console.log(`  Config:     ${getConfigPath()}\n`)
  })

configCommand.command('set')
  .description('Set config values')
  .option('--mode <mode>', 'billing mode: subscription or api')
  .option('--plan-price <price>', 'subscription plan price USD/month')
  .action((opts) => {
    const config = loadConfig()
    if (opts.mode) {
      if (opts.mode !== 'subscription' && opts.mode !== 'api') {
        console.error('Mode must be "subscription" or "api"')
        process.exit(1)
      }
      config.mode = opts.mode
    }
    if (opts.planPrice) {
      config.planPrice = parseFloat(opts.planPrice)
    }
    saveConfig(config)
    console.log(chalk.green('\n  ✓ Config saved\n'))
  })
