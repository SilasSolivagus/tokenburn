import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getDb, closeDb, insertRequest } from '../../src/db/db.js'
import { readHeavy } from '../../src/analyzer/rules/read-heavy.js'
import { thinkHeavy } from '../../src/analyzer/rules/think-heavy.js'
import { searchInefficient } from '../../src/analyzer/rules/search-inefficient.js'
import { writeRewrite } from '../../src/analyzer/rules/write-rewrite.js'
import { bashLoop } from '../../src/analyzer/rules/bash-loop.js'
import { contextDrift } from '../../src/analyzer/rules/context-drift.js'
import { noClaudemd } from '../../src/analyzer/rules/no-claudemd.js'
import { deepAgentTree } from '../../src/analyzer/rules/deep-agent-tree.js'
import { mcpTokenOverhead } from '../../src/analyzer/rules/mcp-token-overhead.js'
import { sessionTooLong } from '../../src/analyzer/rules/session-too-long.js'
import { planUnderuse } from '../../src/analyzer/rules/plan-underuse.js'
import { planOveruse } from '../../src/analyzer/rules/plan-overuse.js'
import { cheapestAvailable } from '../../src/analyzer/rules/cheapest-available.js'
import type { RequestRecord } from '../../src/db/schema.js'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const TEST_DB = path.join(import.meta.dirname, 'rules-v2-batch2.test.db')

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

// ── 1. read-heavy ──

describe('read-heavy rule', () => {
  it('returns null when Read is not dominant', () => {
    for (let i = 0; i < 5; i++) {
      insertRequest(rec({ toolUse: '["Read"]', inputTokens: 15000 }))
    }
    for (let i = 0; i < 5; i++) {
      insertRequest(rec({ toolUse: '["Bash"]', inputTokens: 1000 }))
    }
    // 50% Read, threshold is >60%
    expect(readHeavy({})).toBeNull()
  })

  it('detects Read-heavy usage', () => {
    for (let i = 0; i < 8; i++) {
      insertRequest(rec({ toolUse: '["Read"]', inputTokens: 15000 }))
    }
    for (let i = 0; i < 2; i++) {
      insertRequest(rec({ toolUse: '["Bash"]', inputTokens: 1000 }))
    }
    const result = readHeavy({})
    expect(result).not.toBeNull()
    expect(result!.rule).toBe('read-heavy')
    expect(result!.severity).toBe('low')
    expect(result!.wastedUSD).toBe(0)
  })

  it('returns null when avg input tokens is low', () => {
    for (let i = 0; i < 8; i++) {
      insertRequest(rec({ toolUse: '["Read"]', inputTokens: 5000 }))
    }
    for (let i = 0; i < 2; i++) {
      insertRequest(rec({ toolUse: '["Bash"]', inputTokens: 1000 }))
    }
    expect(readHeavy({})).toBeNull()
  })
})

// ── 2. think-heavy ──

describe('think-heavy rule', () => {
  it('returns null when thinking is < 40% of output', () => {
    insertRequest(rec({ outputTokens: 1500, toolUse: '[]' }))
    // More output from tool-using requests
    for (let i = 0; i < 5; i++) {
      insertRequest(rec({ outputTokens: 1000, toolUse: '["Read"]' }))
    }
    expect(thinkHeavy({})).toBeNull()
  })

  it('detects heavy thinking without tool use', () => {
    // 5 requests with heavy output and no tools
    for (let i = 0; i < 5; i++) {
      insertRequest(rec({ outputTokens: 2000, toolUse: '[]', costUSD: 0.10 }))
    }
    // 1 request with tools but small output
    insertRequest(rec({ outputTokens: 100, toolUse: '["Read"]', costUSD: 0.01 }))
    const result = thinkHeavy({})
    expect(result).not.toBeNull()
    expect(result!.rule).toBe('think-heavy')
    expect(result!.severity).toBe('medium')
    expect(result!.wastedUSD).toBeCloseTo(0.50 * 0.3, 5)
  })
})

// ── 3. search-inefficient ──

describe('search-inefficient rule', () => {
  it('returns null when <= 20 search requests', () => {
    for (let i = 0; i < 20; i++) {
      insertRequest(rec({ toolUse: '["Grep"]' }))
    }
    expect(searchInefficient({})).toBeNull()
  })

  it('detects >20 search operations', () => {
    for (let i = 0; i < 15; i++) {
      insertRequest(rec({ toolUse: '["Grep"]' }))
    }
    for (let i = 0; i < 10; i++) {
      insertRequest(rec({ toolUse: '["Glob"]' }))
    }
    const result = searchInefficient({})
    expect(result).not.toBeNull()
    expect(result!.rule).toBe('search-inefficient')
    expect(result!.severity).toBe('low')
    expect(result!.wastedUSD).toBe(0)
  })
})

// ── 4. write-rewrite ──

describe('write-rewrite rule', () => {
  it('returns null when fewer than 3 writes per session', () => {
    insertRequest(rec({ sessionId: 's1', toolUse: '["Edit"]' }))
    insertRequest(rec({ sessionId: 's1', toolUse: '["Edit"]' }))
    expect(writeRewrite({})).toBeNull()
  })

  it('detects session with 3+ write operations', () => {
    insertRequest(rec({ sessionId: 's1', toolUse: '["Edit"]' }))
    insertRequest(rec({ sessionId: 's1', toolUse: '["Write"]' }))
    insertRequest(rec({ sessionId: 's1', toolUse: '["Edit","Read"]' }))
    const result = writeRewrite({})
    expect(result).not.toBeNull()
    expect(result!.rule).toBe('write-rewrite')
    expect(result!.severity).toBe('low')
  })
})

// ── 5. bash-loop ──

describe('bash-loop rule', () => {
  it('returns null when <= 10 Bash calls per session', () => {
    for (let i = 0; i < 10; i++) {
      insertRequest(rec({ sessionId: 's1', toolUse: '["Bash"]' }))
    }
    expect(bashLoop({})).toBeNull()
  })

  it('detects session with >10 Bash calls', () => {
    for (let i = 0; i < 12; i++) {
      insertRequest(rec({ sessionId: 's1', toolUse: '["Bash"]', costUSD: 0.05 }))
    }
    const result = bashLoop({})
    expect(result).not.toBeNull()
    expect(result!.rule).toBe('bash-loop')
    expect(result!.severity).toBe('medium')
    expect(result!.wastedUSD).toBeCloseTo(0.60 * 0.2, 5)
  })
})

// ── 6. context-drift ──

describe('context-drift rule', () => {
  it('returns null when fewer than 5 records in session', () => {
    const now = Date.now()
    for (let i = 0; i < 4; i++) {
      insertRequest(rec({ sessionId: 's1', timestamp: now + i * 1000, inputTokens: 1000 * (i + 1) }))
    }
    expect(contextDrift({})).toBeNull()
  })

  it('detects context growing >3x', () => {
    const now = Date.now()
    for (let i = 0; i < 6; i++) {
      insertRequest(rec({
        sessionId: 's1',
        timestamp: now + i * 1000,
        inputTokens: 1000 + i * 2000, // 1000, 3000, 5000, 7000, 9000, 11000
        costUSD: 0.05,
      }))
    }
    // last (11000) > 3x first (1000)
    const result = contextDrift({})
    expect(result).not.toBeNull()
    expect(result!.rule).toBe('context-drift')
    expect(result!.severity).toBe('medium')
  })

  it('returns null when growth is < 3x', () => {
    const now = Date.now()
    for (let i = 0; i < 6; i++) {
      insertRequest(rec({
        sessionId: 's1',
        timestamp: now + i * 1000,
        inputTokens: 1000 + i * 300, // 1000..2500, ratio < 3x
        costUSD: 0.05,
      }))
    }
    expect(contextDrift({})).toBeNull()
  })
})

// ── 7. no-claudemd ──

describe('no-claudemd rule', () => {
  it('returns null when no records', () => {
    expect(noClaudemd({})).toBeNull()
  })

  it('always fires when records exist', () => {
    insertRequest(rec())
    const result = noClaudemd({})
    expect(result).not.toBeNull()
    expect(result!.rule).toBe('no-claudemd')
    expect(result!.severity).toBe('info')
    expect(result!.wastedUSD).toBe(0)
  })
})

// ── 8. deep-agent-tree ──

describe('deep-agent-tree rule', () => {
  it('returns null when no deep sessions', () => {
    const db = getDb()
    for (let i = 0; i < 5; i++) {
      db.prepare(`INSERT INTO agent_tree (uuid, sessionId, parentUuid, role, timestamp) VALUES (?, ?, ?, ?, ?)`)
        .run(`uuid-${i}`, 'sess1', i > 0 ? `uuid-${i - 1}` : null, 'assistant', Date.now() + i)
    }
    expect(deepAgentTree({})).toBeNull()
  })

  it('detects sessions with >5 agent tree nodes', () => {
    const db = getDb()
    for (let i = 0; i < 7; i++) {
      db.prepare(`INSERT INTO agent_tree (uuid, sessionId, parentUuid, role, timestamp) VALUES (?, ?, ?, ?, ?)`)
        .run(`uuid-${i}`, 'sess1', i > 0 ? `uuid-${i - 1}` : null, 'assistant', Date.now() + i)
    }
    const result = deepAgentTree({})
    expect(result).not.toBeNull()
    expect(result!.rule).toBe('deep-agent-tree')
    expect(result!.severity).toBe('medium')
  })
})

// ── 9. mcp-token-overhead ──

describe('mcp-token-overhead rule', () => {
  it('returns null when first requests are small', () => {
    insertRequest(rec({ sessionId: 's1', timestamp: 1000, inputTokens: 5000 }))
    insertRequest(rec({ sessionId: 's1', timestamp: 2000, inputTokens: 60000 }))
    expect(mcpTokenOverhead({})).toBeNull()
  })

  it('detects sessions starting with >50k input tokens', () => {
    insertRequest(rec({ sessionId: 's1', timestamp: 1000, inputTokens: 60000 }))
    insertRequest(rec({ sessionId: 's1', timestamp: 2000, inputTokens: 5000 }))
    const result = mcpTokenOverhead({})
    expect(result).not.toBeNull()
    expect(result!.rule).toBe('mcp-token-overhead')
    expect(result!.severity).toBe('info')
  })
})

// ── 10. session-too-long ──

describe('session-too-long rule', () => {
  it('returns null when sessions are < 3 hours', () => {
    const now = Date.now()
    insertRequest(rec({ sessionId: 's1', timestamp: now }))
    insertRequest(rec({ sessionId: 's1', timestamp: now + 10800000 })) // exactly 3h
    expect(sessionTooLong({})).toBeNull()
  })

  it('detects sessions > 3 hours', () => {
    const now = Date.now()
    insertRequest(rec({ sessionId: 's1', timestamp: now }))
    insertRequest(rec({ sessionId: 's1', timestamp: now + 10800001 })) // >3h
    const result = sessionTooLong({})
    expect(result).not.toBeNull()
    expect(result!.rule).toBe('session-too-long')
    expect(result!.severity).toBe('low')
  })
})

// ── 11. plan-underuse ──

describe('plan-underuse rule', () => {
  it('returns null when usage >= $30', () => {
    insertRequest(rec({ costUSD: 35.00 }))
    const result = planUnderuse({})
    expect(result).toBeNull()
  })

  it('detects underutilized plan', () => {
    insertRequest(rec({ costUSD: 10.00 }))
    const result = planUnderuse({})
    expect(result).not.toBeNull()
    expect(result!.rule).toBe('plan-underuse')
    expect(result!.severity).toBe('info')
  })
})

// ── 12. plan-overuse ──

describe('plan-overuse rule', () => {
  it('returns null when usage <= $200', () => {
    insertRequest(rec({ costUSD: 150.00 }))
    expect(planOveruse({})).toBeNull()
  })

  it('detects great value plan usage', () => {
    insertRequest(rec({ costUSD: 250.00 }))
    const result = planOveruse({})
    expect(result).not.toBeNull()
    expect(result!.rule).toBe('plan-overuse')
    expect(result!.severity).toBe('info')
    expect(result!.message).toContain('2.5x')
  })
})

// ── 13. cheapest-available ──

describe('cheapest-available rule', () => {
  it('returns null when no expensive simple requests', () => {
    insertRequest(rec({ model: 'claude-haiku-4-5', outputTokens: 100, costUSD: 0.001 }))
    expect(cheapestAvailable({})).toBeNull()
  })

  it('detects expensive models for simple tasks', () => {
    for (let i = 0; i < 5; i++) {
      insertRequest(rec({
        model: 'claude-sonnet-4-6',
        outputTokens: 300,
        inputTokens: 5000,
        costUSD: 0.10,
      }))
    }
    const result = cheapestAvailable({})
    expect(result).not.toBeNull()
    expect(result!.rule).toBe('cheapest-available')
    expect(result!.savableUSD).toBeGreaterThan(0)
  })

  it('returns null when outputs are large', () => {
    insertRequest(rec({ model: 'claude-sonnet-4-6', outputTokens: 600, costUSD: 0.10 }))
    expect(cheapestAvailable({})).toBeNull()
  })
})
