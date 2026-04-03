import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getDb, closeDb, insertRequest } from '../../src/db/db.js'
import {
  aggregateByModel,
  aggregateBySource,
  aggregateByDay,
  aggregateByHour,
  summarize,
} from '../../src/analyzer/analyzer.js'
import type { RequestRecord } from '../../src/db/schema.js'
import fs from 'fs'
import path from 'path'

const TEST_DB = path.join(import.meta.dirname, 'analyzer.test.db')

function makeRecord(id: string, overrides: Partial<RequestRecord> = {}): RequestRecord {
  return {
    id,
    timestamp: Date.now(),
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    source: 'claude-code',
    inputTokens: 1000,
    outputTokens: 200,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costUSD: 0.01,
    durationMs: 500,
    promptHash: `hash-${id}`,
    toolUse: '[]',
    stopReason: 'end_turn',
    sessionId: '',
    projectPath: '',
    ...overrides,
  }
}

beforeEach(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB)
  getDb(TEST_DB)
})

afterEach(() => {
  closeDb()
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB)
})

describe('aggregateByModel', () => {
  it('groups requests by model and sums cost', () => {
    insertRequest(makeRecord('r1', { model: 'claude-opus-4', costUSD: 0.10, inputTokens: 5000, outputTokens: 500 }))
    insertRequest(makeRecord('r2', { model: 'claude-opus-4', costUSD: 0.20, inputTokens: 8000, outputTokens: 800 }))
    insertRequest(makeRecord('r3', { model: 'claude-haiku-4-5', costUSD: 0.01, inputTokens: 1000, outputTokens: 100 }))

    const result = aggregateByModel({})
    expect(result).toHaveLength(2)

    // sorted by totalCost DESC
    expect(result[0].model).toBe('claude-opus-4')
    expect(result[0].totalCost).toBeCloseTo(0.30, 5)
    expect(result[0].requestCount).toBe(2)
    expect(result[0].totalInput).toBe(13000)
    expect(result[0].totalOutput).toBe(1300)

    expect(result[1].model).toBe('claude-haiku-4-5')
    expect(result[1].totalCost).toBeCloseTo(0.01, 5)
    expect(result[1].requestCount).toBe(1)
  })

  it('respects filter', () => {
    const now = Date.now()
    insertRequest(makeRecord('r1', { model: 'claude-opus-4', timestamp: now - 100000, costUSD: 0.10 }))
    insertRequest(makeRecord('r2', { model: 'claude-sonnet-4-6', timestamp: now, costUSD: 0.02 }))

    const result = aggregateByModel({ since: now - 1000 })
    expect(result).toHaveLength(1)
    expect(result[0].model).toBe('claude-sonnet-4-6')
  })
})

describe('aggregateBySource', () => {
  it('groups by source', () => {
    insertRequest(makeRecord('r1', { source: 'cursor', costUSD: 0.05 }))
    insertRequest(makeRecord('r2', { source: 'cursor', costUSD: 0.03 }))
    insertRequest(makeRecord('r3', { source: 'claude-code', costUSD: 0.10 }))

    const result = aggregateBySource({})
    expect(result).toHaveLength(2)
    expect(result[0].source).toBe('claude-code')
    expect(result[0].totalCost).toBeCloseTo(0.10, 5)
    expect(result[1].source).toBe('cursor')
    expect(result[1].requestCount).toBe(2)
  })
})

describe('aggregateByDay', () => {
  it('groups requests by day', () => {
    const now = Date.now()
    // Two requests on the same day (now), one from yesterday
    const yesterday = now - 86400000
    insertRequest(makeRecord('r1', { timestamp: now, costUSD: 0.05 }))
    insertRequest(makeRecord('r2', { timestamp: now + 1000, costUSD: 0.03 }))
    insertRequest(makeRecord('r3', { timestamp: yesterday, costUSD: 0.02 }))

    const result = aggregateByDay({})
    // Should have at most 2 distinct days
    expect(result.length).toBeGreaterThanOrEqual(1)
    // Total across all days should be ~0.10
    const total = result.reduce((s, r) => s + r.totalCost, 0)
    expect(total).toBeCloseTo(0.10, 5)
  })
})

describe('aggregateByHour', () => {
  it('returns hour buckets', () => {
    insertRequest(makeRecord('r1', { costUSD: 0.01 }))
    insertRequest(makeRecord('r2', { costUSD: 0.02 }))

    const result = aggregateByHour({})
    expect(result.length).toBeGreaterThanOrEqual(1)
    const total = result.reduce((s, r) => s + r.totalCost, 0)
    expect(total).toBeCloseTo(0.03, 5)
    // hour should be a 2-digit string like '14'
    expect(result[0].hour).toMatch(/^\d{2}$/)
  })
})

describe('summarize', () => {
  it('returns correct totals', () => {
    insertRequest(makeRecord('r1', {
      costUSD: 0.10, inputTokens: 5000, outputTokens: 500, cacheReadTokens: 200,
    }))
    insertRequest(makeRecord('r2', {
      costUSD: 0.20, inputTokens: 8000, outputTokens: 800, cacheReadTokens: 0,
    }))

    const result = summarize({})
    expect(result.totalCost).toBeCloseTo(0.30, 5)
    expect(result.totalRequests).toBe(2)
    expect(result.totalInputTokens).toBe(13000)
    expect(result.totalOutputTokens).toBe(1300)
    expect(result.totalCacheReadTokens).toBe(200)
    expect(result.avgCostPerRequest).toBeCloseTo(0.15, 5)
  })

  it('returns zeros for empty DB', () => {
    const result = summarize({})
    expect(result.totalCost).toBe(0)
    expect(result.totalRequests).toBe(0)
    expect(result.avgCostPerRequest).toBe(0)
  })

  it('respects filter', () => {
    const now = Date.now()
    insertRequest(makeRecord('r1', { timestamp: now - 100000, costUSD: 0.10 }))
    insertRequest(makeRecord('r2', { timestamp: now, costUSD: 0.05 }))

    const result = summarize({ since: now - 1000 })
    expect(result.totalRequests).toBe(1)
    expect(result.totalCost).toBeCloseTo(0.05, 5)
  })
})
