const PATTERNS: Array<[RegExp, string]> = [
  [/claude-code/i, 'claude-code'],
  [/aider/i, 'aider'],
  [/cursor/i, 'cursor'],
  [/openclaw/i, 'openclaw'],
  [/continue/i, 'continue'],
  [/copilot/i, 'copilot'],
  [/cline/i, 'cline'],
]

export function detectSource(userAgent: string | undefined): string {
  if (!userAgent) return 'unknown'
  for (const [pattern, name] of PATTERNS) {
    if (pattern.test(userAgent)) return name
  }
  return 'unknown'
}
