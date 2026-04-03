import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getDb, closeDb, insertRequest } from '../../src/db/db.js'
import { handleToolCall } from '../../src/mcp/tools.js'
import type { RequestRecord } from '../../src/db/schema.js'
import fs from 'fs'
import path from 'path'

const TEST_DB = path.join(import.meta.dirname, 'tools.test.db')

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
  // Insert 10 records
  for (let i = 0; i < 10; i++) {
    insertRequest(makeRecord(`r${i}`, { costUSD: 0.01, inputTokens: 1000, outputTokens: 200 }))
  }
})

afterEach(() => {
  closeDb()
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB)
})

describe('handleToolCall', () => {
  it('get_spending returns summary with totalCost > 0 and totalRequests = 10', async () => {
    const result = await handleToolCall('get_spending', { period: '1d' }) as Record<string, unknown>
    expect(result).toBeDefined()
    expect((result as { totalCost: number }).totalCost).toBeGreaterThan(0)
    expect((result as { totalRequests: number }).totalRequests).toBe(10)
    expect(Array.isArray((result as { models: unknown[] }).models)).toBe(true)
  })

  it('get_spending uses default period when not specified', async () => {
    const result = await handleToolCall('get_spending', {}) as Record<string, unknown>
    expect(result).toBeDefined()
    expect((result as { totalRequests: number }).totalRequests).toBe(10)
  })

  it('get_waste returns an array', async () => {
    const result = await handleToolCall('get_waste', { period: '7d' })
    expect(Array.isArray(result)).toBe(true)
  })

  it('get_waste uses default period when not specified', async () => {
    const result = await handleToolCall('get_waste', {})
    expect(Array.isArray(result)).toBe(true)
  })

  it('get_suggestion returns a string', async () => {
    const result = await handleToolCall('get_suggestion', { period: '7d' })
    expect(typeof result).toBe('string')
  })

  it('get_suggestion uses default period when not specified', async () => {
    const result = await handleToolCall('get_suggestion', {})
    expect(typeof result).toBe('string')
  })

  it('get_tree returns null when no sessions exist', async () => {
    const result = await handleToolCall('get_tree', {})
    expect(result).toBeNull()
  })

  it('get_tree accepts sessionId argument', async () => {
    // No agent_tree data in DB — buildAgentTree should return null for unknown session
    const result = await handleToolCall('get_tree', { sessionId: 'nonexistent-session' })
    expect(result).toBeNull()
  })

  it('unknown tool throws an error', async () => {
    await expect(handleToolCall('unknown_tool', {})).rejects.toThrow('Unknown tool: unknown_tool')
  })

  it('get_spending models list has at most 5 entries', async () => {
    const result = await handleToolCall('get_spending', { period: '1d' }) as { models: unknown[] }
    expect(result.models.length).toBeLessThanOrEqual(5)
  })
})
