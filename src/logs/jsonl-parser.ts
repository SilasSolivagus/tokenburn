import fs from 'fs'

export interface LogEntry {
  uuid: string
  parentUuid: string | null
  sessionId: string
  timestamp: number
  model: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  toolUse: string[]
  stopReason: string
  cwd: string
}

export function parseJsonlFile(filePath: string, offset: number = 0): LogEntry[] {
  let content: string
  try {
    const fd = fs.openSync(filePath, 'r')
    const stats = fs.fstatSync(fd)
    const size = stats.size - offset
    if (size <= 0) { fs.closeSync(fd); return [] }
    const buffer = Buffer.alloc(size)
    fs.readSync(fd, buffer, 0, size, offset)
    fs.closeSync(fd)
    content = buffer.toString('utf8')
  } catch { return [] }

  const entries: LogEntry[] = []
  for (const line of content.split('\n')) {
    if (!line.trim()) continue
    let raw: any
    try { raw = JSON.parse(line) } catch { continue }
    if (raw.message?.role !== 'assistant' || !raw.usage) continue

    const toolUse: string[] = []
    if (Array.isArray(raw.message.content)) {
      for (const block of raw.message.content) {
        if (block.type === 'tool_use' && block.name) toolUse.push(block.name)
      }
    }

    entries.push({
      uuid: raw.uuid ?? '',
      parentUuid: raw.parentUuid ?? null,
      sessionId: raw.sessionId ?? '',
      timestamp: raw.timestamp ? new Date(raw.timestamp).getTime() : 0,
      model: raw.message.model ?? '',
      inputTokens: raw.usage.input_tokens ?? 0,
      outputTokens: raw.usage.output_tokens ?? 0,
      cacheReadTokens: raw.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: raw.usage.cache_creation_input_tokens ?? 0,
      toolUse,
      stopReason: raw.stop_reason ?? '',
      cwd: raw.cwd ?? '',
    })
  }
  return entries.sort((a, b) => a.timestamp - b.timestamp)
}

export function getFileSize(filePath: string): number {
  try { return fs.statSync(filePath).size } catch { return 0 }
}
