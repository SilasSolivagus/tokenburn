export interface ModelPricing {
  inputPerMillion: number
  outputPerMillion: number
  cacheReadPerMillion: number
  cacheWritePerMillion: number
}

export const PRICING: Record<string, ModelPricing> = {
  // Anthropic
  'claude-opus-4': {
    inputPerMillion: 15,
    outputPerMillion: 75,
    cacheReadPerMillion: 1.5,
    cacheWritePerMillion: 18.75,
  },
  'claude-sonnet-4': {
    inputPerMillion: 3,
    outputPerMillion: 15,
    cacheReadPerMillion: 0.3,
    cacheWritePerMillion: 3.75,
  },
  'claude-sonnet-4-6': {
    inputPerMillion: 3,
    outputPerMillion: 15,
    cacheReadPerMillion: 0.3,
    cacheWritePerMillion: 3.75,
  },
  'claude-haiku-4-5': {
    inputPerMillion: 0.8,
    outputPerMillion: 4,
    cacheReadPerMillion: 0.08,
    cacheWritePerMillion: 1,
  },
  // OpenAI
  'gpt-4o': {
    inputPerMillion: 2.5,
    outputPerMillion: 10,
    cacheReadPerMillion: 1.25,
    cacheWritePerMillion: 2.5,
  },
  'gpt-4o-mini': {
    inputPerMillion: 0.15,
    outputPerMillion: 0.6,
    cacheReadPerMillion: 0.075,
    cacheWritePerMillion: 0.15,
  },
  'gpt-4.1': {
    inputPerMillion: 2,
    outputPerMillion: 8,
    cacheReadPerMillion: 0.5,
    cacheWritePerMillion: 2,
  },
  'gpt-4.1-mini': {
    inputPerMillion: 0.4,
    outputPerMillion: 1.6,
    cacheReadPerMillion: 0.1,
    cacheWritePerMillion: 0.4,
  },
  'gpt-4.1-nano': {
    inputPerMillion: 0.1,
    outputPerMillion: 0.4,
    cacheReadPerMillion: 0.025,
    cacheWritePerMillion: 0.1,
  },
  'o3': {
    inputPerMillion: 2,
    outputPerMillion: 8,
    cacheReadPerMillion: 0.5,
    cacheWritePerMillion: 2,
  },
  'o3-mini': {
    inputPerMillion: 1.1,
    outputPerMillion: 4.4,
    cacheReadPerMillion: 0.275,
    cacheWritePerMillion: 1.1,
  },
  'o4-mini': {
    inputPerMillion: 1.1,
    outputPerMillion: 4.4,
    cacheReadPerMillion: 0.275,
    cacheWritePerMillion: 1.1,
  },
}

/**
 * Strips date suffixes (e.g. -20250514) and tries progressively shorter prefixes
 * to find a matching pricing key.
 */
export function resolvePricingKey(model: string): string | undefined {
  // Strip trailing date suffix like -20250514 or -20251001
  const withoutDate = model.replace(/-\d{8}$/, '')

  // Try exact match first (with and without date)
  for (const candidate of [withoutDate, model]) {
    if (candidate in PRICING) return candidate
  }

  // Try progressively shorter prefixes by removing trailing segments
  const parts = withoutDate.split('-')
  for (let len = parts.length - 1; len >= 1; len--) {
    const prefix = parts.slice(0, len).join('-')
    if (prefix in PRICING) return prefix
  }

  return undefined
}

export function getModelPricing(model: string): ModelPricing | undefined {
  const key = resolvePricingKey(model)
  return key ? PRICING[key] : undefined
}

export function isExpensiveModel(model: string): boolean {
  const pricing = getModelPricing(model)
  return pricing !== undefined && pricing.outputPerMillion >= 10
}
