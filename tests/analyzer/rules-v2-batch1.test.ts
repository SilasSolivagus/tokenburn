import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getDb, closeDb, insertRequest } from '../../src/db/db.js'
import { giantRequest } from '../../src/analyzer/rules/giant-request.js'
import { wastedOutput } from '../../src/analyzer/rules/wasted-output.js'
import { modelSwitching } from '../../src/analyzer/rules/model-switching.js'
import { longTailSession } from '../../src/analyzer/rules/long-tail-session.js'
import { rejectedGeneration } from '../../src/analyzer/rules/rejected-generation.js'
import { largeFileReread } from '../../src/analyzer/rules/large-file-reread.js'
import { concurrentWaste } from '../../src/analyzer/rules/concurrent-waste.js'
import { lowTokenDensity } from '../../src/analyzer/rules/low-token-density.js'
import { providerPriceGap } from '../../src/analyzer/rules/provider-price-gap.js'
import type { RequestRecord } from '../../src/db/schema.js'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const TEST_DB = path.join(import.meta.dirname, 'rules-v2-batch1.test.db')

function rec(overrides: Partial<RequestRecord> = {}): RequestRecord {
  return {
    id: crypto.randomUUID(),
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
    promptHash: 'h-' + Math.random().toString(36).slice(2),
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

describe('giant-request rule', () => {
  it('returns null when no requests cost >$2', () => {
    insertRequest(rec({ costUSD: 1.50 }))
    insertRequest(rec({ costUSD: 0.50 }))
    expect(giantRequest({})).toBeNull()
  })

  it('detects requests costing >$2', () => {
    insertRequest(rec({ costUSD: 3.00 }))
    insertRequest(rec({ costUSD: 5.00 }))
    const result = giantRequest({})
    expect(result).not.toBeNull()
    expect(result!.rule).toBe('giant-request')
    expect(result!.wastedUSD).toBeCloseTo(8.0 * 0.3, 5)
  })

  it('severity is high when totalCost > 10', () => {
    insertRequest(rec({ costUSD: 6.00 }))
    insertRequest(rec({ costUSD: 6.00 }))
    const result = giantRequest({})
    expect(result!.severity).toBe('high')
  })

  it('severity is medium when totalCost <= 10', () => {
    insertRequest(rec({ costUSD: 3.00 }))
    const result = giantRequest({})
    expect(result!.severity).toBe('medium')
  })
})

describe('wasted-output rule', () => {
  it('returns null when fewer than 5 matching requests', () => {
    for (let i = 0; i < 4; i++) {
      insertRequest(rec({ toolUse: '["Read"]', outputTokens: 600 }))
    }
    expect(wastedOutput({})).toBeNull()
  })

  it('detects tool calls with long output', () => {
    for (let i = 0; i < 6; i++) {
      insertRequest(rec({ toolUse: '["Read"]', outputTokens: 600, costUSD: 0.10 }))
    }
    const result = wastedOutput({})
    expect(result).not.toBeNull()
    expect(result!.rule).toBe('wasted-output')
    expect(result!.wastedUSD).toBeCloseTo(0.60 * 0.15, 5)
  })

  it('does not flag requests without tool use', () => {
    for (let i = 0; i < 10; i++) {
      insertRequest(rec({ toolUse: '[]', outputTokens: 600 }))
    }
    expect(wastedOutput({})).toBeNull()
  })
})

describe('model-switching rule', () => {
  it('returns null when fewer than 3 models in a session', () => {
    insertRequest(rec({ sessionId: 's1', model: 'claude-sonnet-4-6' }))
    insertRequest(rec({ sessionId: 's1', model: 'claude-haiku-4-5' }))
    expect(modelSwitching({})).toBeNull()
  })

  it('detects session with 3+ models', () => {
    insertRequest(rec({ sessionId: 's1', model: 'claude-sonnet-4-6' }))
    insertRequest(rec({ sessionId: 's1', model: 'claude-haiku-4-5' }))
    insertRequest(rec({ sessionId: 's1', model: 'claude-opus-4' }))
    const result = modelSwitching({})
    expect(result).not.toBeNull()
    expect(result!.rule).toBe('model-switching')
    expect(result!.severity).toBe('low')
    expect(result!.wastedUSD).toBe(0)
  })

  it('ignores requests without sessionId', () => {
    insertRequest(rec({ sessionId: '', model: 'claude-sonnet-4-6' }))
    insertRequest(rec({ sessionId: '', model: 'claude-haiku-4-5' }))
    insertRequest(rec({ sessionId: '', model: 'claude-opus-4' }))
    expect(modelSwitching({})).toBeNull()
  })
})

describe('long-tail-session rule', () => {
  it('returns null when sessions are short', () => {
    const now = Date.now()
    insertRequest(rec({ sessionId: 's1', timestamp: now, costUSD: 0.10 }))
    insertRequest(rec({ sessionId: 's1', timestamp: now + 3600000, costUSD: 0.10 })) // 1 hour
    expect(longTailSession({})).toBeNull()
  })

  it('detects sessions >2 hours', () => {
    const now = Date.now()
    insertRequest(rec({ sessionId: 's1', timestamp: now, costUSD: 0.50 }))
    insertRequest(rec({ sessionId: 's1', timestamp: now + 7200001, costUSD: 0.50 })) // >2 hours
    const result = longTailSession({})
    expect(result).not.toBeNull()
    expect(result!.rule).toBe('long-tail-session')
    expect(result!.wastedUSD).toBeCloseTo(1.00 * 0.2, 5)
  })
})

describe('rejected-generation rule', () => {
  it('returns null when no re-sends', () => {
    const now = Date.now()
    insertRequest(rec({ promptHash: 'a', timestamp: now }))
    insertRequest(rec({ promptHash: 'b', timestamp: now + 5000 }))
    expect(rejectedGeneration({})).toBeNull()
  })

  it('detects same promptHash re-sent within 1-30s', () => {
    const now = Date.now()
    insertRequest(rec({ promptHash: 'same', timestamp: now, costUSD: 0.10 }))
    insertRequest(rec({ promptHash: 'same', timestamp: now + 5000, costUSD: 0.10 }))
    const result = rejectedGeneration({})
    expect(result).not.toBeNull()
    expect(result!.rule).toBe('rejected-generation')
    expect(result!.wastedUSD).toBeCloseTo(0.05, 5) // 0.10 / 2
  })

  it('does not flag if time diff < 1s', () => {
    const now = Date.now()
    insertRequest(rec({ promptHash: 'fast', timestamp: now, costUSD: 0.10 }))
    insertRequest(rec({ promptHash: 'fast', timestamp: now + 500, costUSD: 0.10 }))
    expect(rejectedGeneration({})).toBeNull()
  })

  it('does not flag if time diff > 30s', () => {
    const now = Date.now()
    insertRequest(rec({ promptHash: 'slow', timestamp: now, costUSD: 0.10 }))
    insertRequest(rec({ promptHash: 'slow', timestamp: now + 31000, costUSD: 0.10 }))
    expect(rejectedGeneration({})).toBeNull()
  })
})

describe('large-file-reread rule', () => {
  it('returns null when fewer than 3 re-reads', () => {
    insertRequest(rec({ promptHash: 'big', inputTokens: 60000, costUSD: 0.20 }))
    insertRequest(rec({ promptHash: 'big', inputTokens: 60000, costUSD: 0.20 }))
    expect(largeFileReread({})).toBeNull()
  })

  it('detects large context sent 3+ times', () => {
    insertRequest(rec({ promptHash: 'big', inputTokens: 60000, costUSD: 0.20 }))
    insertRequest(rec({ promptHash: 'big', inputTokens: 60000, costUSD: 0.20 }))
    insertRequest(rec({ promptHash: 'big', inputTokens: 60000, costUSD: 0.20 }))
    const result = largeFileReread({})
    expect(result).not.toBeNull()
    expect(result!.rule).toBe('large-file-reread')
    expect(result!.severity).toBe('high')
    // 3 requests, wasted = 0.60 * (1 - 1/3) = 0.40
    expect(result!.wastedUSD).toBeCloseTo(0.40, 5)
  })

  it('does not flag small input tokens', () => {
    insertRequest(rec({ promptHash: 'small', inputTokens: 1000, costUSD: 0.01 }))
    insertRequest(rec({ promptHash: 'small', inputTokens: 1000, costUSD: 0.01 }))
    insertRequest(rec({ promptHash: 'small', inputTokens: 1000, costUSD: 0.01 }))
    expect(largeFileReread({})).toBeNull()
  })
})

describe('concurrent-waste rule', () => {
  it('returns null when no concurrent duplicates', () => {
    const now = Date.now()
    insertRequest(rec({ promptHash: 'a', timestamp: now }))
    insertRequest(rec({ promptHash: 'a', timestamp: now + 2000 })) // different second
    expect(concurrentWaste({})).toBeNull()
  })

  it('detects same promptHash in same second', () => {
    const now = 1700000000000 // exact second boundary
    insertRequest(rec({ promptHash: 'dup', timestamp: now, costUSD: 0.10 }))
    insertRequest(rec({ promptHash: 'dup', timestamp: now + 100, costUSD: 0.10 }))
    const result = concurrentWaste({})
    expect(result).not.toBeNull()
    expect(result!.rule).toBe('concurrent-waste')
    // 2 requests, wasted = 0.20 * (1 - 1/2) = 0.10
    expect(result!.wastedUSD).toBeCloseTo(0.10, 5)
  })
})

describe('low-token-density rule', () => {
  it('returns null when fewer than 5 matching requests', () => {
    for (let i = 0; i < 4; i++) {
      insertRequest(rec({ outputTokens: 600, toolUse: '[]' }))
    }
    expect(lowTokenDensity({})).toBeNull()
  })

  it('detects high output with no tool use', () => {
    for (let i = 0; i < 6; i++) {
      insertRequest(rec({ outputTokens: 600, toolUse: '[]', costUSD: 0.10 }))
    }
    const result = lowTokenDensity({})
    expect(result).not.toBeNull()
    expect(result!.rule).toBe('low-token-density')
    expect(result!.wastedUSD).toBeCloseTo(0.60 * 0.3, 5)
  })

  it('does not flag requests with tool use', () => {
    for (let i = 0; i < 10; i++) {
      insertRequest(rec({ outputTokens: 600, toolUse: '["Read"]', costUSD: 0.10 }))
    }
    expect(lowTokenDensity({})).toBeNull()
  })
})

describe('provider-price-gap rule', () => {
  it('returns null when fewer than 2 providers', () => {
    for (let i = 0; i < 10; i++) {
      insertRequest(rec({ provider: 'anthropic', costUSD: 0.10 }))
    }
    expect(providerPriceGap({})).toBeNull()
  })

  it('returns null when price gap < 1.5x', () => {
    for (let i = 0; i < 5; i++) {
      insertRequest(rec({ provider: 'anthropic', costUSD: 0.10 }))
    }
    for (let i = 0; i < 5; i++) {
      insertRequest(rec({ provider: 'openai', costUSD: 0.12 }))
    }
    expect(providerPriceGap({})).toBeNull()
  })

  it('detects >1.5x price gap between providers', () => {
    for (let i = 0; i < 5; i++) {
      insertRequest(rec({ provider: 'anthropic', costUSD: 0.10 }))
    }
    for (let i = 0; i < 5; i++) {
      insertRequest(rec({ provider: 'openai', costUSD: 0.30 }))
    }
    const result = providerPriceGap({})
    expect(result).not.toBeNull()
    expect(result!.rule).toBe('provider-price-gap')
    expect(result!.severity).toBe('info')
    expect(result!.wastedUSD).toBe(0)
  })

  it('requires 5+ requests per provider', () => {
    for (let i = 0; i < 5; i++) {
      insertRequest(rec({ provider: 'anthropic', costUSD: 0.10 }))
    }
    for (let i = 0; i < 4; i++) {
      insertRequest(rec({ provider: 'openai', costUSD: 0.50 }))
    }
    expect(providerPriceGap({})).toBeNull()
  })
})
