import type { ImportAdapter } from './types.js'
import { scanLogFiles, getDefaultLogDirs } from '../scanner.js'
import { parseJsonlFile, getFileSize } from '../jsonl-parser.js'

export const claudeCodeAdapter: ImportAdapter = {
  name: 'claude-code',
  detect() {
    const dirs = getDefaultLogDirs()
    return dirs.some(d => scanLogFiles(d).length > 0)
  },
  scan() {
    const dirs = getDefaultLogDirs()
    return dirs.flatMap(d => scanLogFiles(d))
  },
  parse: parseJsonlFile,
  getFileSize,
}

export function claudeCodeAdapterWithDirs(dirs: string[]): ImportAdapter {
  return {
    name: 'claude-code',
    detect() {
      return dirs.some(d => scanLogFiles(d).length > 0)
    },
    scan() {
      return dirs.flatMap(d => scanLogFiles(d))
    },
    parse: parseJsonlFile,
    getFileSize,
  }
}
