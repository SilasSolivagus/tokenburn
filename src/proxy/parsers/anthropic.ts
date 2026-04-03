export interface ParsedResponse {
  model: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  stopReason: string
  toolUse: string[]
}

export function parseAnthropicResponse(body: Record<string, unknown>): ParsedResponse {
  const usage = (body.usage ?? {}) as Record<string, number>
  const content = (body.content ?? []) as Array<Record<string, unknown>>

  const toolUse = content
    .filter((block) => block.type === 'tool_use' && typeof block.name === 'string')
    .map((block) => block.name as string)

  return {
    model: body.model as string,
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
    stopReason: body.stop_reason as string,
    toolUse,
  }
}

export function parseAnthropicSSE(raw: string): ParsedResponse | null {
  let model = ''
  let inputTokens = 0
  let outputTokens = 0
  let cacheReadTokens = 0
  let cacheWriteTokens = 0
  let stopReason = ''
  const toolUse: string[] = []

  for (const line of raw.split('\n')) {
    if (!line.startsWith('data: ')) continue
    const jsonStr = line.slice('data: '.length).trim()
    if (!jsonStr || jsonStr === '[DONE]') continue

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(jsonStr) as Record<string, unknown>
    } catch {
      continue
    }

    const type = parsed.type as string

    if (type === 'message_start') {
      const message = (parsed.message ?? {}) as Record<string, unknown>
      model = (message.model as string) ?? model
      const usage = (message.usage ?? {}) as Record<string, number>
      inputTokens = usage.input_tokens ?? inputTokens
      cacheReadTokens = usage.cache_read_input_tokens ?? cacheReadTokens
      cacheWriteTokens = usage.cache_creation_input_tokens ?? cacheWriteTokens
    } else if (type === 'content_block_start') {
      const block = (parsed.content_block ?? {}) as Record<string, unknown>
      if (block.type === 'tool_use' && typeof block.name === 'string') {
        toolUse.push(block.name)
      }
    } else if (type === 'message_delta') {
      const delta = (parsed.delta ?? {}) as Record<string, unknown>
      if (delta.stop_reason) stopReason = delta.stop_reason as string
      const usage = (parsed.usage ?? {}) as Record<string, number>
      if (usage.output_tokens !== undefined) outputTokens = usage.output_tokens
    }
  }

  if (!model && inputTokens === 0 && outputTokens === 0) return null

  return { model, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, stopReason, toolUse }
}
