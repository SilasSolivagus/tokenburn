import { describe, it, expect } from 'vitest'
import { calculateCost } from '../../src/pricing/cost.js'

describe('calculateCost', () => {
  it('calculates Anthropic Claude Opus 4 cost', () => {
    const cost = calculateCost('claude-opus-4-20250514', {
      inputTokens: 1000,
      outputTokens: 500,
      cacheReadTokens: 2000,
      cacheWriteTokens: 100,
    })
    // opus: input=$15/M, output=$75/M, cacheRead=$1.5/M, cacheWrite=$18.75/M
    expect(cost).toBeCloseTo(0.057375, 5)
  })

  it('calculates OpenAI GPT-4o cost', () => {
    const cost = calculateCost('gpt-4o', {
      inputTokens: 1000,
      outputTokens: 500,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    })
    // gpt-4o: input=$2.50/M, output=$10/M
    expect(cost).toBeCloseTo(0.0075, 5)
  })

  it('calculates Claude Haiku cost', () => {
    const cost = calculateCost('claude-haiku-4-5-20251001', {
      inputTokens: 10000,
      outputTokens: 1000,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    })
    // haiku: input=$0.80/M, output=$4/M
    expect(cost).toBeCloseTo(0.012, 5)
  })

  it('returns 0 for unknown model', () => {
    const cost = calculateCost('unknown-model', {
      inputTokens: 1000,
      outputTokens: 500,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    })
    expect(cost).toBe(0)
  })

  it('handles model aliases (without date suffix)', () => {
    const cost = calculateCost('claude-sonnet-4-6', {
      inputTokens: 1000,
      outputTokens: 500,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    })
    // sonnet 4.6: input=$3/M, output=$15/M
    expect(cost).toBeCloseTo(0.003 + 0.0075, 5)
  })
})
