import fs from 'fs'
import path from 'path'
import os from 'os'

export function getDefaultLogDirs(): string[] {
  const home = os.homedir()
  return [
    path.join(home, '.claude', 'projects'),
    path.join(home, '.config', 'claude', 'projects'),
  ]
}

export function scanLogFiles(baseDir: string): string[] {
  if (!fs.existsSync(baseDir)) return []
  const results: string[] = []
  function walk(dir: string): void {
    let entries: fs.Dirent[]
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(fullPath)
      else if (entry.isFile() && entry.name.endsWith('.jsonl')) results.push(fullPath)
    }
  }
  walk(baseDir)
  return results.sort()
}

export function extractProjectPath(filePath: string): string {
  const parts = filePath.split(path.sep)
  const projIdx = parts.indexOf('projects')
  if (projIdx === -1 || projIdx + 1 >= parts.length) return ''
  const encoded = parts[projIdx + 1]
  return encoded.replace(/^-/, '/').replace(/-/g, '/')
}
