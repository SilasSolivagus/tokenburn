import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { getDb, closeDb } from '../../src/db/db.js'
import { importLogs } from '../../src/logs/importer.js'
import { claudeCodeAdapterWithDirs } from '../../src/logs/adapters/claude-code.js'

const TEST_DB = path.join(import.meta.dirname, 'importer-test.db')

// Helper: build a JSONL line for a user message
function userLine(uuid: string, parentUuid: string | null, sessionId: string, timestamp: string): string {
  return JSON.stringify({
    uuid,
    parentUuid,
    sessionId,
    timestamp,
    message: { role: 'user', content: [{ type: 'text', text: 'hello' }] },
    cwd: '/Users/test/project',
    version: '1.0.0',
  })
}

// Helper: build a JSONL line for an assistant message
function assistantLine(
  uuid: string,
  parentUuid: string | null,
  sessionId: string,
  timestamp: string,
  inputTokens = 500,
  outputTokens = 100,
): string {
  return JSON.stringify({
    uuid,
    parentUuid,
    sessionId,
    timestamp,
    message: {
      role: 'assistant',
      model: 'claude-sonnet-4-6',
      content: [{ type: 'text', text: 'Hi there!' }],
    },
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_read_input_tokens: 200,
      cache_creation_input_tokens: 50,
    },
    stop_reason: 'end_turn',
    cwd: '/Users/test/project',
    version: '1.0.0',
  })
}

let tmpDir: string

beforeEach(() => {
  // Clean up db singleton and start fresh
  closeDb()
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB)
  getDb(TEST_DB)

  // Create a fresh temp directory with the expected projects/proj1/ structure
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'importer-test-'))
  fs.mkdirSync(path.join(tmpDir, 'projects', 'proj1'), { recursive: true })
})

afterEach(() => {
  closeDb()
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB)
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('importLogs', () => {
  it('imports assistant messages into requests table', () => {
    const sessionFile = path.join(tmpDir, 'projects', 'proj1', 'session.jsonl')
    const lines = [
      userLine('u1', null, 'sess-import-1', '2026-04-03T10:00:00Z'),
      assistantLine('u2', 'u1', 'sess-import-1', '2026-04-03T10:00:05Z'),
      assistantLine('u4', 'u3', 'sess-import-1', '2026-04-03T10:00:15Z'),
    ]
    fs.writeFileSync(sessionFile, lines.join('\n') + '\n')

    importLogs([claudeCodeAdapterWithDirs([path.join(tmpDir, 'projects')])])

    const db = getDb(TEST_DB)
    const records = db.prepare("SELECT * FROM requests WHERE source = 'claude-code'").all() as any[]
    expect(records).toHaveLength(2)
    expect(records.every((r: any) => r.sessionId === 'sess-import-1')).toBe(true)
    expect(records.every((r: any) => r.source === 'claude-code')).toBe(true)
  })

  it('calculates cost for imported records', () => {
    const sessionFile = path.join(tmpDir, 'projects', 'proj1', 'session.jsonl')
    const lines = [
      userLine('u1', null, 'sess-cost-1', '2026-04-03T10:00:00Z'),
      assistantLine('u2', 'u1', 'sess-cost-1', '2026-04-03T10:00:05Z', 1000, 200),
    ]
    fs.writeFileSync(sessionFile, lines.join('\n') + '\n')

    importLogs([claudeCodeAdapterWithDirs([path.join(tmpDir, 'projects')])])

    const db = getDb(TEST_DB)
    const records = db.prepare('SELECT * FROM requests').all() as any[]
    expect(records).toHaveLength(1)
    expect(records[0].costUSD).toBeGreaterThan(0)
  })

  it('deduplicates on re-import', () => {
    const sessionFile = path.join(tmpDir, 'projects', 'proj1', 'session.jsonl')
    const lines = [
      userLine('u1', null, 'sess-dedup-1', '2026-04-03T10:00:00Z'),
      assistantLine('u2', 'u1', 'sess-dedup-1', '2026-04-03T10:00:05Z'),
      assistantLine('u4', 'u3', 'sess-dedup-1', '2026-04-03T10:00:15Z'),
    ]
    fs.writeFileSync(sessionFile, lines.join('\n') + '\n')

    importLogs([claudeCodeAdapterWithDirs([path.join(tmpDir, 'projects')])])
    importLogs([claudeCodeAdapterWithDirs([path.join(tmpDir, 'projects')])])

    const db = getDb(TEST_DB)
    const records = db.prepare('SELECT * FROM requests').all() as any[]
    expect(records).toHaveLength(2)
  })

  it('tracks import state for incremental imports', () => {
    const sessionFile = path.join(tmpDir, 'projects', 'proj1', 'session.jsonl')
    const lines = [
      userLine('u1', null, 'sess-state-1', '2026-04-03T10:00:00Z'),
      assistantLine('u2', 'u1', 'sess-state-1', '2026-04-03T10:00:05Z'),
    ]
    fs.writeFileSync(sessionFile, lines.join('\n') + '\n')

    importLogs([claudeCodeAdapterWithDirs([path.join(tmpDir, 'projects')])])

    const db = getDb(TEST_DB)
    const state = db
      .prepare('SELECT * FROM import_state WHERE filePath = ?')
      .get(sessionFile) as any
    expect(state).toBeDefined()
    expect(state.lastOffset).toBeGreaterThan(0)
  })

  it('incremental import picks up new lines', () => {
    const sessionFile = path.join(tmpDir, 'projects', 'proj1', 'session.jsonl')
    const lines = [
      userLine('u1', null, 'sess-incr-1', '2026-04-03T10:00:00Z'),
      assistantLine('u2', 'u1', 'sess-incr-1', '2026-04-03T10:00:05Z'),
      assistantLine('u4', 'u3', 'sess-incr-1', '2026-04-03T10:00:15Z'),
    ]
    fs.writeFileSync(sessionFile, lines.join('\n') + '\n')

    // First import
    importLogs([claudeCodeAdapterWithDirs([path.join(tmpDir, 'projects')])])

    // Append a new assistant line
    const newLine = assistantLine('u6', 'u5', 'sess-incr-1', '2026-04-03T10:00:25Z')
    fs.appendFileSync(sessionFile, newLine + '\n')

    // Second import — should only pick up the new line
    const result = importLogs([claudeCodeAdapterWithDirs([path.join(tmpDir, 'projects')])])

    expect(result.imported).toBe(1)

    const db = getDb(TEST_DB)
    const records = db.prepare('SELECT * FROM requests').all() as any[]
    expect(records).toHaveLength(3)
  })

  it('returns summary with file and message counts', () => {
    const sessionFile = path.join(tmpDir, 'projects', 'proj1', 'session.jsonl')
    const lines = [
      userLine('u1', null, 'sess-summary-1', '2026-04-03T10:00:00Z'),
      assistantLine('u2', 'u1', 'sess-summary-1', '2026-04-03T10:00:05Z'),
      assistantLine('u4', 'u3', 'sess-summary-1', '2026-04-03T10:00:15Z'),
    ]
    fs.writeFileSync(sessionFile, lines.join('\n') + '\n')

    const result = importLogs([claudeCodeAdapterWithDirs([path.join(tmpDir, 'projects')])])

    expect(result.filesScanned).toBe(1)
    expect(result.imported).toBe(2)
    expect(result.skipped).toBe(0)
    expect(result.totalMessages).toBe(2) // only assistant messages are counted
  })

  it('returns sources in result', () => {
    const sessionFile = path.join(tmpDir, 'projects', 'proj1', 'session.jsonl')
    const lines = [
      assistantLine('u2', 'u1', 'sess-sources-1', '2026-04-03T10:00:05Z'),
    ]
    fs.writeFileSync(sessionFile, lines.join('\n') + '\n')

    const result = importLogs([claudeCodeAdapterWithDirs([path.join(tmpDir, 'projects')])])

    expect(result.sources).toContain('claude-code')
  })
})
