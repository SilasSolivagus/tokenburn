import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getDb, closeDb, queryRequests } from '../../src/db/db.js'
import { importLogs } from '../../src/logs/importer.js'
import { summarize, aggregateByModel } from '../../src/analyzer/analyzer.js'
import fs from 'fs'
import path from 'path'
import os from 'os'

const TEST_DB = path.join(import.meta.dirname, 'import-e2e.db')
const TEST_LOG_DIR = path.join(os.tmpdir(), 'tokenburn-e2e-import')
const JSONL_DIR = path.join(TEST_LOG_DIR, 'projects', 'proj1')

function assistantLine(uuid: string, parentUuid: string, sessionId: string, ts: string, model: string, input: number, output: number, tools: string[] = []): string {
  const content = [
    { type: 'text', text: 'response' },
    ...tools.map(name => ({ type: 'tool_use', name, id: `t-${name}` })),
  ]
  return JSON.stringify({
    uuid, parentUuid, sessionId, timestamp: ts,
    message: { role: 'assistant', model, content },
    usage: { input_tokens: input, output_tokens: output, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    cwd: '/test',
  })
}

function userLine(uuid: string, parentUuid: string | null, sessionId: string, ts: string): string {
  return JSON.stringify({
    uuid, parentUuid, sessionId, timestamp: ts,
    message: { role: 'user', content: [{ type: 'text', text: 'do something' }] },
    cwd: '/test',
  })
}

beforeEach(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB)
  fs.mkdirSync(JSONL_DIR, { recursive: true })
  getDb(TEST_DB)
})

afterEach(() => {
  closeDb()
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB)
  fs.rmSync(TEST_LOG_DIR, { recursive: true, force: true })
})

describe('import e2e', () => {
  it('full pipeline: import → query → analyze', () => {
    const lines = [
      userLine('u1', null, 'sess-1', '2026-04-03T10:00:00Z'),
      assistantLine('u2', 'u1', 'sess-1', '2026-04-03T10:00:05Z', 'claude-sonnet-4-6', 1000, 200, ['Read']),
      userLine('u3', 'u2', 'sess-1', '2026-04-03T10:00:10Z'),
      assistantLine('u4', 'u3', 'sess-1', '2026-04-03T10:00:15Z', 'claude-sonnet-4-6', 1000, 200, ['Read']),
      userLine('u5', 'u4', 'sess-1', '2026-04-03T10:00:20Z'),
      assistantLine('u6', 'u5', 'sess-1', '2026-04-03T10:00:25Z', 'claude-sonnet-4-6', 1000, 200),
    ]
    fs.writeFileSync(path.join(JSONL_DIR, 'session.jsonl'), lines.join('\n') + '\n')

    const result = importLogs([TEST_LOG_DIR])
    expect(result.imported).toBe(3)

    const records = queryRequests({ since: 0 })
    expect(records).toHaveLength(3)
    expect(records.every(r => r.source === 'claude-code')).toBe(true)
    expect(records.every(r => r.sessionId === 'sess-1')).toBe(true)

    const summary = summarize({ since: 0 })
    expect(summary.totalRequests).toBe(3)
    expect(summary.totalCost).toBeGreaterThan(0)

    const models = aggregateByModel({ since: 0 })
    expect(models[0].model).toBe('claude-sonnet-4-6')
  })
})
