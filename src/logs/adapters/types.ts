import type { LogEntry } from '../jsonl-parser.js'

export interface ImportAdapter {
  name: string                    // e.g. "claude-code", "cline"
  detect(): boolean               // is this tool installed?
  scan(): string[]                // return list of data files
  parse(filePath: string, offset: number): LogEntry[]
  getFileSize(filePath: string): number
}
