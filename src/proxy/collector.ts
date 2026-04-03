import crypto from 'crypto'
import type { ParsedResponse } from './parsers/anthropic.js'
import { detectSource } from './source-detect.js'
import { calculateCost } from '../pricing/cost.js'
import { insertRequest } from '../db/db.js'

export interface CollectInput {
  provider: 'anthropic' | 'openai'
  requestBody: string
  parsed: ParsedResponse
  userAgent: string | undefined
  durationMs: number
}

export function collectRequest(input: CollectInput): void {
  const promptHash = crypto.createHash('sha256').update(input.requestBody).digest('hex').slice(0, 16)
  const costUSD = calculateCost(input.parsed.model, {
    inputTokens: input.parsed.inputTokens,
    outputTokens: input.parsed.outputTokens,
    cacheReadTokens: input.parsed.cacheReadTokens,
    cacheWriteTokens: input.parsed.cacheWriteTokens,
  })
  insertRequest({
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    provider: input.provider,
    model: input.parsed.model,
    source: detectSource(input.userAgent),
    inputTokens: input.parsed.inputTokens,
    outputTokens: input.parsed.outputTokens,
    cacheReadTokens: input.parsed.cacheReadTokens,
    cacheWriteTokens: input.parsed.cacheWriteTokens,
    costUSD, durationMs: input.durationMs,
    promptHash,
    toolUse: JSON.stringify(input.parsed.toolUse),
    stopReason: input.parsed.stopReason,
    sessionId: '',
    projectPath: '',
  })
}
