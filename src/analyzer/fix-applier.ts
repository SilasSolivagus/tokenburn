import fs from 'fs'
import path from 'path'
import readline from 'readline'

export function applyFixToClaudeMd(fix: string, cwd: string = process.cwd()): boolean {
  const claudeMdPath = path.join(cwd, 'CLAUDE.md')
  const content = fix.split('\n')
    .filter(line => !line.startsWith('# Add to CLAUDE.md:') && !line.startsWith('# Tip:') && !line.startsWith('# Create'))
    .join('\n').trim()
  if (!content) return false
  const existing = fs.existsSync(claudeMdPath) ? fs.readFileSync(claudeMdPath, 'utf8') : ''
  if (existing.includes(content)) return false
  fs.writeFileSync(claudeMdPath, existing ? `${existing}\n\n${content}\n` : `${content}\n`)
  return true
}

export async function promptForFix(question: string): Promise<'y' | 'n' | 'skip'> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      const a = answer.trim().toLowerCase()
      if (a === 'y' || a === 'yes') resolve('y')
      else if (a === 'n' || a === 'no') resolve('n')
      else resolve('skip')
    })
  })
}
