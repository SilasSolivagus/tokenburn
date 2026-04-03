import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'

import { piAdapter } from '../../src/logs/adapters/pi.js'
import { codexAdapter } from '../../src/logs/adapters/codex.js'
import { geminiAdapter } from '../../src/logs/adapters/gemini.js'
import { rooCodeAdapter } from '../../src/logs/adapters/roo-code.js'
import { openCodeAdapter } from '../../src/logs/adapters/opencode.js'
import { getAllAdapters } from '../../src/logs/adapters/index.js'

// --- Pi Adapter ---

describe('piAdapter', () => {
  it('has correct name', () => {
    expect(piAdapter.name).toBe('pi')
  })

  it('detect() returns false when dir does not exist', () => {
    const piDir = path.join(os.homedir(), '.pi', 'agent', 'sessions')
    if (!fs.existsSync(piDir)) {
      expect(piAdapter.detect()).toBe(false)
    }
  })

  it('parse() extracts assistant messages from JSONL with session header', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-test-'))
    const file = path.join(tmpDir, 'session1.jsonl')

    const lines = [
      JSON.stringify({ type: 'session', id: 'sess-001', cwd: '/home/user/project' }),
      JSON.stringify({
        type: 'message', id: 'msg-1', parentId: 'msg-0',
        message: {
          role: 'assistant', model: 'claude-opus-4-6',
          usage: { input: 2450, output: 351, cacheRead: 0, cacheWrite: 0 },
        },
      }),
      JSON.stringify({
        type: 'message', id: 'msg-2', parentId: 'msg-1',
        message: { role: 'user', content: 'hello' },
      }),
      JSON.stringify({
        type: 'message', id: 'msg-3', parentId: 'msg-2',
        message: {
          role: 'assistant', model: 'claude-opus-4-6',
          usage: { input: 3000, output: 500, cacheRead: 100, cacheWrite: 50 },
        },
      }),
    ]
    fs.writeFileSync(file, lines.join('\n'))

    try {
      const entries = piAdapter.parse(file, 0)
      expect(entries).toHaveLength(2)

      expect(entries[0].inputTokens).toBe(2450)
      expect(entries[0].outputTokens).toBe(351)
      expect(entries[0].model).toBe('claude-opus-4-6')
      expect(entries[0].sessionId).toBe('sess-001')
      expect(entries[0].cwd).toBe('/home/user/project')
      expect(entries[0].uuid).toBe('pi-sess-001-msg-1')
      expect(entries[0].parentUuid).toBe('pi-sess-001-msg-0')

      expect(entries[1].inputTokens).toBe(3000)
      expect(entries[1].outputTokens).toBe(500)
      expect(entries[1].cacheReadTokens).toBe(100)
      expect(entries[1].cacheWriteTokens).toBe(50)
      expect(entries[1].uuid).toBe('pi-sess-001-msg-3')
      expect(entries[1].parentUuid).toBe('pi-sess-001-msg-2')
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('parse() returns empty array for missing file', () => {
    expect(piAdapter.parse('/nonexistent/file.jsonl', 0)).toHaveLength(0)
  })

  it('getFileSize() returns 0 for missing file', () => {
    expect(piAdapter.getFileSize('/nonexistent/file')).toBe(0)
  })
})

// --- Codex Adapter ---

describe('codexAdapter', () => {
  it('has correct name', () => {
    expect(codexAdapter.name).toBe('codex')
  })

  it('detect() returns false when dir does not exist', () => {
    const codexDir = path.join(os.homedir(), '.codex', 'sessions')
    if (!fs.existsSync(codexDir)) {
      expect(codexAdapter.detect()).toBe(false)
    }
  })

  it('parse() extracts messages with usage from JSONL', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-test-'))
    const file = path.join(tmpDir, 'rollout-001.jsonl')

    const lines = [
      JSON.stringify({
        timestamp: '2025-08-31T09:05:27Z',
        sessionId: 'session-abc',
        message: {
          usage: { input_tokens: 1200, output_tokens: 350 },
          model: 'gpt-4o-mini',
          id: 'msg_123',
        },
      }),
      JSON.stringify({ type: 'heartbeat', ts: 123 }),
      JSON.stringify({
        timestamp: '2025-08-31T09:06:00Z',
        sessionId: 'session-abc',
        message: {
          usage: { input_tokens: 2000, output_tokens: 800 },
          model: 'gpt-4o',
          id: 'msg_456',
        },
      }),
    ]
    fs.writeFileSync(file, lines.join('\n'))

    try {
      const entries = codexAdapter.parse(file, 0)
      expect(entries).toHaveLength(2)

      expect(entries[0].inputTokens).toBe(1200)
      expect(entries[0].outputTokens).toBe(350)
      expect(entries[0].model).toBe('gpt-4o-mini')
      expect(entries[0].sessionId).toBe('session-abc')
      expect(entries[0].uuid).toBe('codex-session-abc-msg_123')

      expect(entries[1].inputTokens).toBe(2000)
      expect(entries[1].outputTokens).toBe(800)
      expect(entries[1].model).toBe('gpt-4o')
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('parse() returns empty array for missing file', () => {
    expect(codexAdapter.parse('/nonexistent/file.jsonl', 0)).toHaveLength(0)
  })

  it('getFileSize() returns 0 for missing file', () => {
    expect(codexAdapter.getFileSize('/nonexistent/file')).toBe(0)
  })
})

// --- Gemini Adapter ---

describe('geminiAdapter', () => {
  it('has correct name', () => {
    expect(geminiAdapter.name).toBe('gemini')
  })

  it('detect() returns false when dir does not exist', () => {
    const geminiDir = path.join(os.homedir(), '.gemini', 'tmp')
    if (!fs.existsSync(geminiDir)) {
      expect(geminiAdapter.detect()).toBe(false)
    }
  })

  it('parse() extracts usage from JSON with messages array', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-test-'))
    const file = path.join(tmpDir, 'chat-001.json')

    const data = {
      model: 'gemini-2.0-flash',
      messages: [
        { usage: { input_tokens: 500, output_tokens: 200, cached_tokens: 50 }, timestamp: '2026-01-01T00:00:00Z' },
        { usage: { input_tokens: 800, output_tokens: 300 }, timestamp: '2026-01-01T00:01:00Z' },
      ],
    }
    fs.writeFileSync(file, JSON.stringify(data))

    try {
      const entries = geminiAdapter.parse(file, 0)
      expect(entries).toHaveLength(2)
      expect(entries[0].inputTokens).toBe(500)
      expect(entries[0].outputTokens).toBe(200)
      expect(entries[0].cacheReadTokens).toBe(50)
      expect(entries[0].model).toBe('gemini-2.0-flash')
      expect(entries[1].inputTokens).toBe(800)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('parse() returns empty array for invalid JSON', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-bad-'))
    const file = path.join(tmpDir, 'bad.json')
    fs.writeFileSync(file, 'not json')
    try {
      expect(geminiAdapter.parse(file, 0)).toHaveLength(0)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('getFileSize() returns 0 for missing file', () => {
    expect(geminiAdapter.getFileSize('/nonexistent/file')).toBe(0)
  })
})

// --- Roo Code Adapter ---

describe('rooCodeAdapter', () => {
  it('has correct name', () => {
    expect(rooCodeAdapter.name).toBe('roo-code')
  })

  it('detect() returns false when dir does not exist', () => {
    const home = os.homedir()
    const rooDir = process.platform === 'darwin'
      ? path.join(home, 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline')
      : path.join(home, '.config', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline')
    const tasksDir = path.join(rooDir, 'tasks')
    if (!fs.existsSync(tasksDir)) {
      expect(rooCodeAdapter.detect()).toBe(false)
    }
  })

  it('parse() correctly extracts api_req_started events', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'roo-test-'))
    const taskId = 'roo-task-001'
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
      const entries = rooCodeAdapter.parse(uiFile, 0)
      expect(entries).toHaveLength(2)

      expect(entries[0].inputTokens).toBe(1000)
      expect(entries[0].outputTokens).toBe(200)
      expect(entries[0].cacheReadTokens).toBe(500)
      expect(entries[0].cacheWriteTokens).toBe(100)
      expect(entries[0].model).toBe('claude-sonnet-4-6')
      expect(entries[0].sessionId).toBe(taskId)
      expect(entries[0].uuid).toContain('roo-code-')

      expect(entries[1].inputTokens).toBe(2000)
      expect(entries[1].outputTokens).toBe(400)
      expect(entries[1].model).toBe('')

      expect(entries[0].timestamp).toBeLessThan(entries[1].timestamp)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('parse() returns empty array for missing file', () => {
    expect(rooCodeAdapter.parse('/nonexistent/ui_messages.json', 0)).toHaveLength(0)
  })

  it('getFileSize() returns 0 for missing file', () => {
    expect(rooCodeAdapter.getFileSize('/nonexistent/file')).toBe(0)
  })
})

// --- OpenCode Adapter ---

describe('openCodeAdapter', () => {
  it('has correct name', () => {
    expect(openCodeAdapter.name).toBe('opencode')
  })

  it('detect() returns false when dir does not exist', () => {
    const openCodeDir = path.join(os.homedir(), '.local', 'share', 'opencode', 'storage')
    if (!fs.existsSync(openCodeDir)) {
      expect(openCodeAdapter.detect()).toBe(false)
    }
  })

  it('parse() extracts usage from message JSON', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opencode-test-'))
    const sessionDir = path.join(tmpDir, 'sess-001')
    fs.mkdirSync(sessionDir, { recursive: true })
    const file = path.join(sessionDir, 'msg_001.json')

    const data = {
      model: 'claude-sonnet-4-6',
      timestamp: '2026-01-15T12:00:00Z',
      usage: { input_tokens: 1500, output_tokens: 400, cache_read_tokens: 200 },
    }
    fs.writeFileSync(file, JSON.stringify(data))

    try {
      const entries = openCodeAdapter.parse(file, 0)
      expect(entries).toHaveLength(1)
      expect(entries[0].inputTokens).toBe(1500)
      expect(entries[0].outputTokens).toBe(400)
      expect(entries[0].cacheReadTokens).toBe(200)
      expect(entries[0].model).toBe('claude-sonnet-4-6')
      expect(entries[0].sessionId).toBe('sess-001')
      expect(entries[0].uuid).toBe('opencode-sess-001-msg_001')
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('parse() returns empty for JSON without usage', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opencode-nousage-'))
    const file = path.join(tmpDir, 'msg_002.json')
    fs.writeFileSync(file, JSON.stringify({ role: 'user', content: 'hello' }))
    try {
      expect(openCodeAdapter.parse(file, 0)).toHaveLength(0)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('getFileSize() returns 0 for missing file', () => {
    expect(openCodeAdapter.getFileSize('/nonexistent/file')).toBe(0)
  })
})

// --- Registry ---

describe('adapter registry', () => {
  it('getAllAdapters includes all 7 adapters', () => {
    const all = getAllAdapters()
    const names = all.map(a => a.name)
    expect(names).toContain('claude-code')
    expect(names).toContain('cline')
    expect(names).toContain('pi')
    expect(names).toContain('codex')
    expect(names).toContain('gemini')
    expect(names).toContain('roo-code')
    expect(names).toContain('opencode')
    expect(all).toHaveLength(7)
  })
})
