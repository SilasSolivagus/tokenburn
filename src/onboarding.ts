import readline from 'readline'
import chalk from 'chalk'
import { configExists, saveConfig, getConfigPath, type TokenburnConfig } from './config.js'

export function isFirstRun(): boolean {
  return !configExists()
}

function showSplash(): void {
  console.log('')
  console.log(chalk.bold.hex('#f0883e')('  🔥 tokenburn'))
  console.log(chalk.dim('  htop for your AI spending'))
  console.log('')
}

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()))
  })
}

export async function runOnboarding(): Promise<TokenburnConfig> {
  showSplash()

  if (!process.stdin.isTTY) {
    console.log(chalk.dim('  Non-interactive mode. Using default config.'))
    console.log(chalk.dim('  Run `tokenburn config set` to customize.\n'))
    const config: TokenburnConfig = { mode: 'subscription', planPrice: 200 }
    saveConfig(config)
    return config
  }

  console.log(chalk.bold('  Quick setup:\n'))

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  rl.on('close', () => { if (!done) process.exit(0) })
  let done = false

  // Question 1: billing mode
  let mode: 'subscription' | 'api' = 'subscription'
  while (true) {
    const answer = await ask(rl, chalk.cyan('  How do you pay for AI?\n') +
      '  (1) Subscription (Claude Max, Cursor Pro, etc.)\n' +
      '  (2) API (pay per token)\n' +
      chalk.dim('  > '))
    if (answer === '1' || answer.toLowerCase() === 'subscription') { mode = 'subscription'; break }
    if (answer === '2' || answer.toLowerCase() === 'api') { mode = 'api'; break }
    console.log(chalk.red('  Please enter 1 or 2'))
  }

  // Question 2: plan price (subscription only)
  let planPrice = 200
  if (mode === 'subscription') {
    while (true) {
      const answer = await ask(rl, chalk.cyan('\n  Monthly plan price?\n') +
        '  (1) $100\n' +
        '  (2) $200\n' +
        '  (3) Custom amount\n' +
        chalk.dim('  > '))
      if (answer === '1') { planPrice = 100; break }
      if (answer === '2') { planPrice = 200; break }
      if (answer === '3') {
        const custom = await ask(rl, chalk.dim('  Enter price in USD: $'))
        const parsed = parseFloat(custom)
        if (!isNaN(parsed) && parsed > 0) { planPrice = parsed; break }
        console.log(chalk.red('  Please enter a valid number'))
        continue
      }
      console.log(chalk.red('  Please enter 1, 2, or 3'))
    }
  }

  done = true
  rl.close()

  const config: TokenburnConfig = { mode, planPrice }
  saveConfig(config)

  console.log('')
  console.log(chalk.green('  ✓ Config saved to ' + getConfigPath()))
  console.log(chalk.dim(`    Mode: ${mode}, Plan: $${planPrice}/mo`))
  console.log('')

  return config
}
