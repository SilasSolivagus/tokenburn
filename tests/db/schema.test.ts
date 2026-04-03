import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getDb, closeDb, insertRequest, queryRequests } from '../../src/db/db.js'
import type { RequestRecord } from '../../src/db/schema.js'
import fs from 'fs'
import path from 'path'

const TEST_DB = path.join(import.meta.dirname, 'test.db')

beforeEach(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB)
  getDb(TEST_DB)
})

afterEach(() => {
  closeDb()
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB)
})

describe('database', () => {
  it('inserts and retrieves a request record', () => {
    const record: RequestRecord = {
      id: 'test-1',
      timestamp: Date.now(),
      provider: 'anthropic',
      model: 'claude-opus-4-20250514',
      source: 'claude-code',
      inputTokens: 5000,
      outputTokens: 1200,
      cacheReadTokens: 3000,
      cacheWriteTokens: 500,
      costUSD: 0.15,
      durationMs: 2340,
      promptHash: 'abc123',
      toolUse: JSON.stringify(['Read', 'Bash']),
      stopReason: 'end_turn',
      sessionId: '',
      projectPath: '',
    }

    insertRequest(record)
    const results = queryRequests({ since: record.timestamp - 1000 })
    expect(results).toHaveLength(1)
    expect(results[0].model).toBe('claude-opus-4-20250514')
    expect(results[0].costUSD).toBeCloseTo(0.15)
  })

  it('queries by time range', () => {
    const now = Date.now()
    insertRequest(makeRecord('r1', now - 86400000 * 2))
    insertRequest(makeRecord('r2', now - 86400000))
    insertRequest(makeRecord('r3', now))

    const last24h = queryRequests({ since: now - 86400000 })
    expect(last24h).toHaveLength(2)
  })

  it('queries by provider', () => {
    const now = Date.now()
    insertRequest(makeRecord('r1', now, { provider: 'anthropic' }))
    insertRequest(makeRecord('r2', now, { provider: 'openai' }))

    const anthropicOnly = queryRequests({ since: now - 1000, provider: 'anthropic' })
    expect(anthropicOnly).toHaveLength(1)
    expect(anthropicOnly[0].provider).toBe('anthropic')
  })
})

function makeRecord(id: string, timestamp: number, overrides: Partial<RequestRecord> = {}): RequestRecord {
  return {
    id, timestamp,
    provider: 'anthropic', model: 'claude-sonnet-4-6', source: 'claude-code',
    inputTokens: 1000, outputTokens: 200, cacheReadTokens: 0, cacheWriteTokens: 0,
    costUSD: 0.01, durationMs: 500, promptHash: `hash-${id}`,
    toolUse: '[]', stopReason: 'end_turn',
    sessionId: '', projectPath: '',
    ...overrides,
  }
}
