import type { ParsedResponse } from './anthropic.js'

export function parseOpenAIResponse(body: Record<string, unknown>): ParsedResponse {
  const usage = (body.usage ?? {}) as Record<string, unknown>
  const promptTokensDetails = (usage.prompt_tokens_details ?? {}) as Record<string, number>
  const choices = (body.choices ?? []) as Array<Record<string, unknown>>
  const firstChoice = (choices[0] ?? {}) as Record<string, unknown>
  const message = (firstChoice.message ?? {}) as Record<string, unknown>
  const toolCalls = (message.tool_calls ?? []) as Array<Record<string, unknown>>

  const toolUse = toolCalls
    .map((tc) => {
      const fn = (tc.function ?? {}) as Record<string, unknown>
      return fn.name as string
    })
    .filter(Boolean)

  return {
    model: body.model as string,
    inputTokens: (usage.prompt_tokens as number) ?? 0,
    outputTokens: (usage.completion_tokens as number) ?? 0,
    cacheReadTokens: promptTokensDetails.cached_tokens ?? 0,
    cacheWriteTokens: 0,
    stopReason: (firstChoice.finish_reason as string) ?? '',
    toolUse,
  }
}

export function parseOpenAISSE(raw: string): ParsedResponse | null {
  let model = ''
  let inputTokens = 0
  let outputTokens = 0
  let cacheReadTokens = 0
  const cacheWriteTokens = 0
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

    if (typeof parsed.model === 'string' && parsed.model) {
      model = parsed.model
    }

    const usage = parsed.usage as Record<string, unknown> | undefined
    if (usage) {
      if (typeof usage.prompt_tokens === 'number') inputTokens = usage.prompt_tokens
      if (typeof usage.completion_tokens === 'number') outputTokens = usage.completion_tokens
      const details = usage.prompt_tokens_details as Record<string, number> | undefined
      if (details?.cached_tokens !== undefined) cacheReadTokens = details.cached_tokens
    }

    const choices = (parsed.choices ?? []) as Array<Record<string, unknown>>
    for (const choice of choices) {
      if (typeof choice.finish_reason === 'string' && choice.finish_reason) {
        stopReason = choice.finish_reason
      }
      const delta = (choice.delta ?? {}) as Record<string, unknown>
      const toolCalls = (delta.tool_calls ?? []) as Array<Record<string, unknown>>
      for (const tc of toolCalls) {
        const fn = (tc.function ?? {}) as Record<string, unknown>
        if (typeof fn.name === 'string' && fn.name) {
          toolUse.push(fn.name)
        }
      }
    }
  }

  if (!model && inputTokens === 0 && outputTokens === 0) return null

  return { model, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, stopReason, toolUse }
}
