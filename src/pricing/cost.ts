import { getModelPricing } from './models.js'

export interface TokenCounts {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

export function calculateCost(model: string, tokens: TokenCounts): number {
  const pricing = getModelPricing(model)
  if (!pricing) return 0
  return (
    (tokens.inputTokens * pricing.inputPerMillion) / 1_000_000 +
    (tokens.outputTokens * pricing.outputPerMillion) / 1_000_000 +
    (tokens.cacheReadTokens * pricing.cacheReadPerMillion) / 1_000_000 +
    (tokens.cacheWriteTokens * pricing.cacheWritePerMillion) / 1_000_000
  )
}
