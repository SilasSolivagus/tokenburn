import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { collectRequest } from '../../src/proxy/collector.js'
import { getDb, closeDb, queryRequests } from '../../src/db/db.js'
import fs from 'fs'
import path from 'path'

const TEST_DB = path.join(import.meta.dirname, 'collector-test.db')

beforeEach(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB)
  getDb(TEST_DB)
})

afterEach(() => {
  closeDb()
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB)
})

describe('collectRequest', () => {
  it('stores an Anthropic request', () => {
    collectRequest({
      provider: 'anthropic',
      requestBody: '{"messages":[{"role":"user","content":"hello"}]}',
      parsed: {
        model: 'claude-sonnet-4-6',
        inputTokens: 1000, outputTokens: 200,
        cacheReadTokens: 0, cacheWriteTokens: 0,
        stopReason: 'end_turn', toolUse: ['Read'],
      },
      userAgent: 'claude-code/1.2.3',
      durationMs: 450,
    })
    const records = queryRequests({ since: 0 })
    expect(records).toHaveLength(1)
    expect(records[0].source).toBe('claude-code')
    expect(records[0].provider).toBe('anthropic')
    expect(records[0].costUSD).toBeGreaterThan(0)
    expect(records[0].promptHash).toBeTruthy()
  })
})
