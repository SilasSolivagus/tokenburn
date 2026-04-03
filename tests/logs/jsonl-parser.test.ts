import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { parseJsonlFile, getFileSize } from '../../src/logs/jsonl-parser.js'

const FIXTURE = path.join(import.meta.dirname, '..', 'fixtures', 'session-simple.jsonl')

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parser-test-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('parseJsonlFile', () => {
  it('extracts only assistant messages with usage (expect 2)', () => {
    const entries = parseJsonlFile(FIXTURE)
    expect(entries).toHaveLength(2)
  })

  it('parses token counts correctly for first assistant entry (u2)', () => {
    const entries = parseJsonlFile(FIXTURE)
    const first = entries[0]
    expect(first.inputTokens).toBe(500)
    expect(first.outputTokens).toBe(100)
    expect(first.cacheReadTokens).toBe(200)
    expect(first.cacheWriteTokens).toBe(50)
  })

  it('parses token counts correctly for second assistant entry (u4)', () => {
    const entries = parseJsonlFile(FIXTURE)
    const second = entries[1]
    expect(second.inputTokens).toBe(1000)
    expect(second.outputTokens).toBe(300)
    expect(second.cacheReadTokens).toBe(400)
    expect(second.cacheWriteTokens).toBe(0)
  })

  it('extracts tool_use names from second entry', () => {
    const entries = parseJsonlFile(FIXTURE)
    const second = entries[1]
    expect(second.toolUse).toEqual(['Read'])
  })

  it('extracts no tool_use for entry without tools', () => {
    const entries = parseJsonlFile(FIXTURE)
    const first = entries[0]
    expect(first.toolUse).toEqual([])
  })

  it('extracts session metadata (sessionId, uuid, parentUuid)', () => {
    const entries = parseJsonlFile(FIXTURE)
    const first = entries[0]
    expect(first.sessionId).toBe('sess-1')
    expect(first.uuid).toBe('u2')
    expect(first.parentUuid).toBe('u1')

    const second = entries[1]
    expect(second.uuid).toBe('u4')
    expect(second.parentUuid).toBe('u3')
  })

  it('parses timestamp correctly', () => {
    const entries = parseJsonlFile(FIXTURE)
    expect(entries[0].timestamp).toBe(new Date('2026-04-03T10:00:05Z').getTime())
  })

  it('returns entries sorted by timestamp', () => {
    const entries = parseJsonlFile(FIXTURE)
    expect(entries[0].timestamp).toBeLessThan(entries[1].timestamp)
  })

  it('extracts cwd', () => {
    const entries = parseJsonlFile(FIXTURE)
    expect(entries[0].cwd).toBe('/Users/test/project')
  })

  it('returns empty array for nonexistent file', () => {
    const result = parseJsonlFile('/nonexistent/file.jsonl')
    expect(result).toEqual([])
  })

  it('skips malformed lines and parses valid ones', () => {
    const badFile = path.join(tmpDir, 'bad.jsonl')
    const validLine = JSON.stringify({
      uuid: 'x1',
      parentUuid: null,
      sessionId: 's',
      timestamp: '2026-01-01T00:00:00Z',
      message: { role: 'assistant', content: [] },
      usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      cwd: '/tmp',
      version: '1.0.0',
    })
    fs.writeFileSync(badFile, ['not valid json', validLine, '{broken', ''].join('\n'))

    const entries = parseJsonlFile(badFile)
    expect(entries).toHaveLength(1)
    expect(entries[0].uuid).toBe('x1')
  })
})

describe('getFileSize', () => {
  it('returns file size > 0 for existing file', () => {
    const size = getFileSize(FIXTURE)
    expect(size).toBeGreaterThan(0)
  })

  it('returns 0 for nonexistent file', () => {
    expect(getFileSize('/nonexistent/file.jsonl')).toBe(0)
  })
})
