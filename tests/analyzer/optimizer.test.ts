import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getDb, closeDb, insertRequest } from '../../src/db/db.js'
import { generateOptimizations, simulateModel } from '../../src/analyzer/optimizer.js'
import type { RequestRecord } from '../../src/db/schema.js'
import fs from 'fs'
import path from 'path'

const TEST_DB = path.join(import.meta.dirname, 'optimizer-test.db')

function rec(overrides: Partial<RequestRecord> = {}): RequestRecord {
  return {
    id: crypto.randomUUID(), timestamp: Date.now(),
    provider: 'anthropic', model: 'claude-opus-4', source: 'claude-code',
    inputTokens: 5000, outputTokens: 1000, cacheReadTokens: 0, cacheWriteTokens: 0,
    costUSD: 0.50, durationMs: 1000,
    promptHash: 'h-' + Math.random().toString(36).slice(2),
    toolUse: '["Read"]', stopReason: 'end_turn', sessionId: '', projectPath: '',
    ...overrides,
  }
}

beforeEach(() => { if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB); getDb(TEST_DB) })
afterEach(() => { closeDb(); if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB) })

describe('generateOptimizations', () => {
  it('returns plans sorted by savings', () => {
    for (let i = 0; i < 20; i++) insertRequest(rec({ outputTokens: 100, costUSD: 0.80 }))
    const plans = generateOptimizations({ since: 0 })
    expect(plans.length).toBeGreaterThan(0)
    for (let i = 1; i < plans.length; i++) {
      expect(plans[i - 1].savingsUSD).toBeGreaterThanOrEqual(plans[i].savingsUSD)
    }
  })
})

describe('simulateModel', () => {
  it('calculates savings for model switch', () => {
    for (let i = 0; i < 10; i++) insertRequest(rec())
    const result = simulateModel({ since: 0 }, 'claude-haiku-4-5')
    expect(result.currentCost).toBeGreaterThan(0)
    expect(result.simulatedCost).toBeLessThan(result.currentCost)
    expect(result.savings).toBeGreaterThan(0)
    expect(result.savingsPercent).toBeGreaterThan(0)
  })

  it('warns about complex requests', () => {
    for (let i = 0; i < 5; i++) insertRequest(rec({ outputTokens: 3000 }))
    const result = simulateModel({ since: 0 }, 'claude-haiku-4-5')
    expect(result.warning).toBeTruthy()
  })
})
