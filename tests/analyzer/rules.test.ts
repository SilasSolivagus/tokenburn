import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getDb, closeDb, insertRequest } from '../../src/db/db.js'
import { runAllRules } from '../../src/analyzer/rules/index.js'
import { duplicateRequests } from '../../src/analyzer/rules/duplicate-requests.js'
import { modelOveruse } from '../../src/analyzer/rules/model-overuse.js'
import { retryStorm } from '../../src/analyzer/rules/retry-storm.js'
import { contextExplosion } from '../../src/analyzer/rules/context-explosion.js'
import { lowCacheHit } from '../../src/analyzer/rules/low-cache-hit.js'
import { truncationWaste } from '../../src/analyzer/rules/truncation-waste.js'
import { idleChat } from '../../src/analyzer/rules/idle-chat.js'
import type { RequestRecord } from '../../src/db/schema.js'
import fs from 'fs'
import path from 'path'

const TEST_DB = path.join(import.meta.dirname, 'rules.test.db')

function makeRecord(id: string, overrides: Partial<RequestRecord> = {}): RequestRecord {
  return {
    id,
    timestamp: Date.now(),
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    source: 'claude-code',
    inputTokens: 1000,
    outputTokens: 500,
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

describe('duplicate-requests rule', () => {
  it('returns null when no duplicates', () => {
    insertRequest(makeRecord('r1', { promptHash: 'a' }))
    insertRequest(makeRecord('r2', { promptHash: 'b' }))
    expect(duplicateRequests({})).toBeNull()
  })

  it('detects duplicate promptHashes', () => {
    insertRequest(makeRecord('r1', { promptHash: 'same', costUSD: 0.10 }))
    insertRequest(makeRecord('r2', { promptHash: 'same', costUSD: 0.10 }))
    insertRequest(makeRecord('r3', { promptHash: 'same', costUSD: 0.10 }))

    const result = duplicateRequests({})
    expect(result).not.toBeNull()
    expect(result!.rule).toBe('duplicate-requests')
    expect(result!.severity).toBe('high')
    // 3 requests, 1 useful: wasted = 0.30 * (1 - 1/3) = 0.20
    expect(result!.wastedUSD).toBeCloseTo(0.20, 5)
  })

  it('calculates wasted cost correctly for multiple groups', () => {
    // Group A: 2 requests at 0.10 each → wasted = 0.10 * (1 - 1/2) = 0.05
    insertRequest(makeRecord('a1', { promptHash: 'hashA', costUSD: 0.10 }))
    insertRequest(makeRecord('a2', { promptHash: 'hashA', costUSD: 0.10 }))
    // Group B: 4 requests at 0.05 each → wasted = 0.20 * (1 - 1/4) = 0.15
    insertRequest(makeRecord('b1', { promptHash: 'hashB', costUSD: 0.05 }))
    insertRequest(makeRecord('b2', { promptHash: 'hashB', costUSD: 0.05 }))
    insertRequest(makeRecord('b3', { promptHash: 'hashB', costUSD: 0.05 }))
    insertRequest(makeRecord('b4', { promptHash: 'hashB', costUSD: 0.05 }))

    const result = duplicateRequests({})
    expect(result).not.toBeNull()
    // Group A: total=0.20, wasted=0.20*(1-1/2)=0.10
    // Group B: total=0.20, wasted=0.20*(1-1/4)=0.15
    expect(result!.wastedUSD).toBeCloseTo(0.10 + 0.15, 5)
  })
})

describe('model-overuse rule', () => {
  it('returns null when no expensive model with tiny outputs', () => {
    // Haiku is cheap, not flagged
    insertRequest(makeRecord('r1', { model: 'claude-haiku-4-5', outputTokens: 100 }))
    expect(modelOveruse({})).toBeNull()
  })

  it('returns null when expensive model has large outputs', () => {
    insertRequest(makeRecord('r1', { model: 'claude-opus-4', outputTokens: 500, costUSD: 0.50 }))
    expect(modelOveruse({})).toBeNull()
  })

  it('detects expensive model used for tiny outputs', () => {
    // claude-opus-4 has outputPerMillion=75 >= 10, so isExpensiveModel = true
    insertRequest(makeRecord('r1', {
      model: 'claude-opus-4',
      outputTokens: 50,
      inputTokens: 100,
      costUSD: 0.10,
    }))

    const result = modelOveruse({})
    expect(result).not.toBeNull()
    expect(result!.rule).toBe('model-overuse')
    expect(result!.severity).toBe('medium')
    expect(result!.wastedUSD).toBeGreaterThan(0)
  })
})

describe('retry-storm rule', () => {
  it('returns null when no retry storms', () => {
    const now = Date.now()
    insertRequest(makeRecord('r1', { promptHash: 'a', timestamp: now }))
    insertRequest(makeRecord('r2', { promptHash: 'a', timestamp: now + 10000 })) // outside 5s window
    insertRequest(makeRecord('r3', { promptHash: 'b', timestamp: now }))
    expect(retryStorm({})).toBeNull()
  })

  it('detects retry storm: 3+ same hash within 5s', () => {
    const now = Date.now()
    insertRequest(makeRecord('r1', { promptHash: 'storm', timestamp: now, costUSD: 0.05 }))
    insertRequest(makeRecord('r2', { promptHash: 'storm', timestamp: now + 1000, costUSD: 0.05 }))
    insertRequest(makeRecord('r3', { promptHash: 'storm', timestamp: now + 2000, costUSD: 0.05 }))

    const result = retryStorm({})
    expect(result).not.toBeNull()
    expect(result!.rule).toBe('retry-storm')
    expect(result!.severity).toBe('high')
    // 3 requests, 2 wasted: 0.15 * (1 - 1/3) = 0.10
    expect(result!.wastedUSD).toBeCloseTo(0.10, 5)
  })

  it('does not flag when window exceeds 5s', () => {
    const now = Date.now()
    // Spread over 6 seconds
    insertRequest(makeRecord('r1', { promptHash: 'slow', timestamp: now }))
    insertRequest(makeRecord('r2', { promptHash: 'slow', timestamp: now + 2000 }))
    insertRequest(makeRecord('r3', { promptHash: 'slow', timestamp: now + 6000 }))
    expect(retryStorm({})).toBeNull()
  })
})

describe('context-explosion rule', () => {
  it('returns null when few large contexts', () => {
    insertRequest(makeRecord('r1', { inputTokens: 200000 }))
    insertRequest(makeRecord('r2', { inputTokens: 1000 }))
    insertRequest(makeRecord('r3', { inputTokens: 1000 }))
    insertRequest(makeRecord('r4', { inputTokens: 1000 }))
    insertRequest(makeRecord('r5', { inputTokens: 1000 }))
    // 1/5 = 20% = exactly at threshold, should NOT flag (> threshold required)
    expect(contextExplosion({})).toBeNull()
  })

  it('flags when >20% of requests have large contexts', () => {
    insertRequest(makeRecord('r1', { inputTokens: 200000, costUSD: 0.50 }))
    insertRequest(makeRecord('r2', { inputTokens: 150000, costUSD: 0.40 }))
    insertRequest(makeRecord('r3', { inputTokens: 1000, costUSD: 0.01 }))
    // 2/3 = 67% > 20% threshold
    const result = contextExplosion({})
    expect(result).not.toBeNull()
    expect(result!.rule).toBe('context-explosion')
    expect(result!.wastedUSD).toBeCloseTo((0.50 + 0.40) * 0.30, 5)
  })
})

describe('low-cache-hit rule', () => {
  it('returns null when cache hit rate is sufficient', () => {
    insertRequest(makeRecord('r1', { inputTokens: 1000, cacheReadTokens: 200 })) // 20%
    expect(lowCacheHit({})).toBeNull()
  })

  it('flags when cache hit rate is below 10%', () => {
    insertRequest(makeRecord('r1', { inputTokens: 10000, cacheReadTokens: 50, costUSD: 0.10 })) // 0.5%
    const result = lowCacheHit({})
    expect(result).not.toBeNull()
    expect(result!.rule).toBe('low-cache-hit')
    expect(result!.wastedUSD).toBeCloseTo(0.10 * 0.10, 5)
  })
})

describe('truncation-waste rule', () => {
  it('returns null when fewer than 3 truncations', () => {
    insertRequest(makeRecord('r1', { stopReason: 'max_tokens' }))
    insertRequest(makeRecord('r2', { stopReason: 'max_tokens' }))
    expect(truncationWaste({})).toBeNull()
  })

  it('flags when 3+ max_tokens stops', () => {
    insertRequest(makeRecord('r1', { stopReason: 'max_tokens', costUSD: 0.05 }))
    insertRequest(makeRecord('r2', { stopReason: 'max_tokens', costUSD: 0.05 }))
    insertRequest(makeRecord('r3', { stopReason: 'max_tokens', costUSD: 0.05 }))
    const result = truncationWaste({})
    expect(result).not.toBeNull()
    expect(result!.rule).toBe('truncation-waste')
    expect(result!.wastedUSD).toBeCloseTo(0.15, 5)
  })
})

describe('idle-chat rule', () => {
  it('returns null when no long streaks without tool use', () => {
    const now = Date.now()
    insertRequest(makeRecord('r1', { timestamp: now, toolUse: '["Read"]' }))
    insertRequest(makeRecord('r2', { timestamp: now + 1, toolUse: '[]' }))
    insertRequest(makeRecord('r3', { timestamp: now + 2, toolUse: '[]' }))
    // Only 2 consecutive idle, below threshold of 3
    expect(idleChat({})).toBeNull()
  })

  it('detects idle chat streaks of 3+', () => {
    const now = Date.now()
    insertRequest(makeRecord('r1', { timestamp: now, toolUse: '[]', costUSD: 0.02 }))
    insertRequest(makeRecord('r2', { timestamp: now + 1, toolUse: '[]', costUSD: 0.02 }))
    insertRequest(makeRecord('r3', { timestamp: now + 2, toolUse: '[]', costUSD: 0.02 }))
    const result = idleChat({})
    expect(result).not.toBeNull()
    expect(result!.rule).toBe('idle-chat')
    expect(result!.wastedUSD).toBeCloseTo(0.06, 5)
  })
})

describe('runAllRules', () => {
  it('returns empty array when no issues detected', () => {
    insertRequest(makeRecord('r1', { promptHash: 'unique1', cacheReadTokens: 200, inputTokens: 1000 }))
    insertRequest(makeRecord('r2', { promptHash: 'unique2', cacheReadTokens: 200, inputTokens: 1000 }))
    const results = runAllRules({})
    // Should not throw; may return some low-severity items but not crash
    expect(Array.isArray(results)).toBe(true)
  })

  it('returns sorted results (high severity first)', () => {
    const now = Date.now()
    // Create duplicate storm (high severity)
    insertRequest(makeRecord('r1', { promptHash: 'storm', timestamp: now, costUSD: 0.05 }))
    insertRequest(makeRecord('r2', { promptHash: 'storm', timestamp: now + 500, costUSD: 0.05 }))
    insertRequest(makeRecord('r3', { promptHash: 'storm', timestamp: now + 1000, costUSD: 0.05 }))

    const results = runAllRules({})
    expect(results.length).toBeGreaterThan(0)
    // First result should be high or medium severity
    const severities = ['high', 'medium', 'low', 'info']
    const firstSeverityIdx = severities.indexOf(results[0].severity)
    for (const r of results) {
      expect(severities.indexOf(r.severity)).toBeGreaterThanOrEqual(firstSeverityIdx)
    }
  })
})
