import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getDb, closeDb, insertRequest } from '../../src/db/db.js'
import { aggregateBySession } from '../../src/analyzer/analyzer.js'
import type { RequestRecord } from '../../src/db/schema.js'
import fs from 'fs'
import path from 'path'

const TEST_DB = path.join(import.meta.dirname, 'session.test.db')

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

describe('aggregateBySession', () => {
  it('groups requests by named sessionId', () => {
    const now = Date.now()
    insertRequest(makeRecord('r1', { sessionId: 'sess-a', costUSD: 0.10, inputTokens: 5000, outputTokens: 500, timestamp: now - 2000 }))
    insertRequest(makeRecord('r2', { sessionId: 'sess-a', costUSD: 0.05, inputTokens: 2000, outputTokens: 200, timestamp: now - 1000 }))
    insertRequest(makeRecord('r3', { sessionId: 'sess-b', costUSD: 0.20, inputTokens: 8000, outputTokens: 800, timestamp: now }))

    const result = aggregateBySession({})
    expect(result).toHaveLength(2)

    const sessA = result.find(s => s.sessionId === 'sess-a')
    const sessB = result.find(s => s.sessionId === 'sess-b')

    expect(sessA).toBeDefined()
    expect(sessA!.requestCount).toBe(2)
    expect(sessA!.totalCost).toBeCloseTo(0.15)
    expect(sessA!.totalInput).toBe(7000)
    expect(sessA!.totalOutput).toBe(700)

    expect(sessB).toBeDefined()
    expect(sessB!.requestCount).toBe(1)
    expect(sessB!.totalCost).toBeCloseTo(0.20)
  })

  it('auto-groups proxy data by 5-minute time gaps', () => {
    const base = 1000000000000
    // Group 1: 3 requests within 5 min
    insertRequest(makeRecord('p1', { sessionId: '', costUSD: 0.01, timestamp: base }))
    insertRequest(makeRecord('p2', { sessionId: '', costUSD: 0.02, timestamp: base + 60000 }))
    insertRequest(makeRecord('p3', { sessionId: '', costUSD: 0.03, timestamp: base + 120000 }))
    // Group 2: 2 requests after >5 min gap
    insertRequest(makeRecord('p4', { sessionId: '', costUSD: 0.05, timestamp: base + 600001 }))
    insertRequest(makeRecord('p5', { sessionId: '', costUSD: 0.04, timestamp: base + 660001 }))

    const result = aggregateBySession({})
    const autoGroups = result.filter(s => s.sessionId.startsWith('auto-'))
    expect(autoGroups).toHaveLength(2)

    const group1 = autoGroups.find(s => s.requestCount === 3)
    const group2 = autoGroups.find(s => s.requestCount === 2)
    expect(group1).toBeDefined()
    expect(group1!.totalCost).toBeCloseTo(0.06)
    expect(group2).toBeDefined()
    expect(group2!.totalCost).toBeCloseTo(0.09)
  })

  it('sorts results by totalCost descending', () => {
    insertRequest(makeRecord('r1', { sessionId: 'cheap', costUSD: 0.01 }))
    insertRequest(makeRecord('r2', { sessionId: 'expensive', costUSD: 0.50 }))
    insertRequest(makeRecord('r3', { sessionId: 'medium', costUSD: 0.10 }))

    const result = aggregateBySession({})
    expect(result[0].sessionId).toBe('expensive')
    expect(result[1].sessionId).toBe('medium')
    expect(result[2].sessionId).toBe('cheap')
  })

  it('returns empty array when no data', () => {
    const result = aggregateBySession({})
    expect(result).toHaveLength(0)
  })
})
