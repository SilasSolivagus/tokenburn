import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'

import { claudeCodeAdapter } from '../../src/logs/adapters/claude-code.js'
import { clineAdapter } from '../../src/logs/adapters/cline.js'
import { getInstalledAdapters } from '../../src/logs/adapters/index.js'

describe('claudeCodeAdapter', () => {
  it('has correct name', () => {
    expect(claudeCodeAdapter.name).toBe('claude-code')
  })
})

describe('clineAdapter', () => {
  it('has correct name', () => {
    expect(clineAdapter.name).toBe('cline')
  })

  it('detect() returns false when cline dir does not exist', () => {
    // On CI / dev machines without Cline installed this should return false
    // We verify by checking the platform-specific path
    const home = os.homedir()
    const clineDir = process.platform === 'darwin'
      ? path.join(home, 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev')
      : path.join(home, '.config', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev')
    const tasksDir = path.join(clineDir, 'tasks')

    // If tasks dir doesn't exist, detect() must return false
    if (!fs.existsSync(tasksDir)) {
      expect(clineAdapter.detect()).toBe(false)
    }
  })

  it('parse() correctly extracts api_req_started events from ui_messages.json', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cline-test-'))
    const taskId = 'task-abc123'
    const taskDir = path.join(tmpDir, taskId)
    fs.mkdirSync(taskDir, { recursive: true })

    const uiFile = path.join(taskDir, 'ui_messages.json')
    const mockData = [
      {
        type: 'say',
        say: 'api_req_started',
        ts: '2026-04-03T10:00:00Z',
        text: JSON.stringify({ tokensIn: 1000, tokensOut: 200, cacheReads: 500, cacheWrites: 100, cost: 0.05, model: 'claude-sonnet-4-6' }),
      },
      {
        type: 'say',
        say: 'text',
        ts: '2026-04-03T10:00:01Z',
        text: 'Hello',
      },
      {
        type: 'say',
        say: 'api_req_started',
        ts: '2026-04-03T10:00:05Z',
        text: JSON.stringify({ tokensIn: 2000, tokensOut: 400, cacheReads: 0, cacheWrites: 0, cost: 0.10 }),
      },
    ]
    fs.writeFileSync(uiFile, JSON.stringify(mockData, null, 2))

    try {
      const entries = clineAdapter.parse(uiFile, 0)

      expect(entries).toHaveLength(2)

      // First entry
      expect(entries[0].inputTokens).toBe(1000)
      expect(entries[0].outputTokens).toBe(200)
      expect(entries[0].cacheReadTokens).toBe(500)
      expect(entries[0].cacheWriteTokens).toBe(100)
      expect(entries[0].model).toBe('claude-sonnet-4-6')
      expect(entries[0].sessionId).toBe(taskId)

      // Second entry (no model field)
      expect(entries[1].inputTokens).toBe(2000)
      expect(entries[1].outputTokens).toBe(400)
      expect(entries[1].model).toBe('')

      // Sorted by timestamp
      expect(entries[0].timestamp).toBeLessThan(entries[1].timestamp)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('parse() skips events with timestamp <= offset', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cline-offset-test-'))
    const taskId = 'task-offset'
    const taskDir = path.join(tmpDir, taskId)
    fs.mkdirSync(taskDir, { recursive: true })

    const ts1 = new Date('2026-04-03T10:00:00Z').getTime()
    const ts2 = new Date('2026-04-03T10:00:05Z').getTime()

    const uiFile = path.join(taskDir, 'ui_messages.json')
    const mockData = [
      { type: 'say', say: 'api_req_started', ts: ts1, text: JSON.stringify({ tokensIn: 100, tokensOut: 50 }) },
      { type: 'say', say: 'api_req_started', ts: ts2, text: JSON.stringify({ tokensIn: 200, tokensOut: 80 }) },
    ]
    fs.writeFileSync(uiFile, JSON.stringify(mockData))

    try {
      // With offset = ts1, only entries with timestamp > ts1 should be returned
      const entries = clineAdapter.parse(uiFile, ts1)
      expect(entries).toHaveLength(1)
      expect(entries[0].inputTokens).toBe(200)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('parse() returns empty array for invalid JSON', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cline-invalid-'))
    const taskDir = path.join(tmpDir, 'bad-task')
    fs.mkdirSync(taskDir, { recursive: true })
    const uiFile = path.join(taskDir, 'ui_messages.json')
    fs.writeFileSync(uiFile, 'not valid json')

    try {
      const entries = clineAdapter.parse(uiFile, 0)
      expect(entries).toHaveLength(0)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('parse() returns empty array for missing file', () => {
    const entries = clineAdapter.parse('/nonexistent/path/ui_messages.json', 0)
    expect(entries).toHaveLength(0)
  })

  it('getFileSize() returns 0 for missing file', () => {
    expect(clineAdapter.getFileSize('/nonexistent/file')).toBe(0)
  })
})

describe('getInstalledAdapters', () => {
  it('returns only adapters where detect() returns true', () => {
    const installed = getInstalledAdapters()
    for (const adapter of installed) {
      expect(adapter.detect()).toBe(true)
    }
  })

  it('returns an array (may be empty in CI)', () => {
    const installed = getInstalledAdapters()
    expect(Array.isArray(installed)).toBe(true)
  })
})
