import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getDb, closeDb, insertRequest, queryRequests } from '../../src/db/db.js'
import type { RequestRecord } from '../../src/db/schema.js'
import fs from 'fs'
import path from 'path'

const TEST_DB = path.join(import.meta.dirname, 'migration.test.db')

beforeEach(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB)
  getDb(TEST_DB)
})

afterEach(() => {
  closeDb()
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB)
})

describe('schema migration v2', () => {
  it('inserts and queries a RequestRecord with sessionId and projectPath', () => {
    const record: RequestRecord = {
      id: 'mig-1',
      timestamp: Date.now(),
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      source: 'claude-code',
      inputTokens: 1000,
      outputTokens: 200,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      costUSD: 0.01,
      durationMs: 300,
      promptHash: 'hashMig1',
      toolUse: '[]',
      stopReason: 'end_turn',
      sessionId: 'session-abc',
      projectPath: '/home/user/project',
    }

    insertRequest(record)
    const results = queryRequests({ since: record.timestamp - 1000 })
    expect(results).toHaveLength(1)
    expect(results[0].sessionId).toBe('session-abc')
    expect(results[0].projectPath).toBe('/home/user/project')
  })

  it('defaults sessionId and projectPath to empty string when not provided explicitly', () => {
    const record: RequestRecord = {
      id: 'mig-2',
      timestamp: Date.now(),
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      source: 'claude-code',
      inputTokens: 500,
      outputTokens: 100,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      costUSD: 0.005,
      durationMs: 150,
      promptHash: 'hashMig2',
      toolUse: '[]',
      stopReason: 'end_turn',
      sessionId: '',
      projectPath: '',
    }

    insertRequest(record)
    const results = queryRequests({ since: record.timestamp - 1000 })
    expect(results).toHaveLength(1)
    expect(results[0].sessionId).toBe('')
    expect(results[0].projectPath).toBe('')
  })

  it('import_state table is created and supports insert + query', () => {
    const db = getDb(TEST_DB)
    db.prepare(`INSERT INTO import_state (filePath, lastOffset, lastTimestamp) VALUES (?, ?, ?)`).run(
      '/tmp/claude.jsonl', 1024, 1700000000000
    )

    const row = db.prepare(`SELECT * FROM import_state WHERE filePath = ?`).get('/tmp/claude.jsonl') as {
      filePath: string
      lastOffset: number
      lastTimestamp: number
    }

    expect(row).not.toBeNull()
    expect(row.filePath).toBe('/tmp/claude.jsonl')
    expect(row.lastOffset).toBe(1024)
    expect(row.lastTimestamp).toBe(1700000000000)
  })

  it('agent_tree table is created and supports insert + query', () => {
    const db = getDb(TEST_DB)
    db.prepare(`
      INSERT INTO agent_tree (uuid, sessionId, parentUuid, role, timestamp, inputTokens, outputTokens, costUSD, toolUse)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('uuid-001', 'sess-xyz', null, 'assistant', 1700000000000, 2000, 400, 0.02, '["Read"]')

    const row = db.prepare(`SELECT * FROM agent_tree WHERE uuid = ?`).get('uuid-001') as {
      uuid: string
      sessionId: string
      parentUuid: string | null
      role: string
      timestamp: number
      inputTokens: number
      outputTokens: number
      costUSD: number
      toolUse: string
    }

    expect(row).not.toBeNull()
    expect(row.uuid).toBe('uuid-001')
    expect(row.sessionId).toBe('sess-xyz')
    expect(row.parentUuid).toBeNull()
    expect(row.role).toBe('assistant')
    expect(row.inputTokens).toBe(2000)
    expect(row.outputTokens).toBe(400)
    expect(row.costUSD).toBeCloseTo(0.02)
    expect(row.toolUse).toBe('["Read"]')
  })

  it('agent_tree supports parent-child relationships', () => {
    const db = getDb(TEST_DB)
    db.prepare(`
      INSERT INTO agent_tree (uuid, sessionId, parentUuid, role, timestamp, inputTokens, outputTokens, costUSD, toolUse)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('parent-001', 'sess-xyz', null, 'user', 1700000000000, 100, 0, 0, '[]')

    db.prepare(`
      INSERT INTO agent_tree (uuid, sessionId, parentUuid, role, timestamp, inputTokens, outputTokens, costUSD, toolUse)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('child-001', 'sess-xyz', 'parent-001', 'assistant', 1700000001000, 500, 200, 0.01, '[]')

    const children = db.prepare(`SELECT * FROM agent_tree WHERE parentUuid = ?`).all('parent-001') as Array<{ uuid: string }>
    expect(children).toHaveLength(1)
    expect(children[0].uuid).toBe('child-001')
  })
})
