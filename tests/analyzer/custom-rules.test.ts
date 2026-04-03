import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { getDb, closeDb, insertRequest } from '../../src/db/db.js'
import { loadCustomRules, runCustomRules } from '../../src/analyzer/rules/custom.js'
import type { RequestRecord } from '../../src/db/schema.js'

const TEST_DB = path.join(import.meta.dirname, 'custom-rules.test.db')

function makeRecord(id: string, overrides: Partial<RequestRecord> = {}): RequestRecord {
  return {
    id,
    timestamp: Date.now(),
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    source: 'claude-code',
    inputTokens: 1000,
    outputTokens: 500,
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
})

afterEach(() => {
  closeDb()
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB)
})

describe('loadCustomRules', () => {
  it('loads rules from a YAML file', () => {
    const tmpFile = path.join(os.tmpdir(), `tokenburn-test-${Date.now()}.yaml`)
    try {
      fs.writeFileSync(tmpFile, `
rules:
  - name: test-rule
    condition: "costUSD > 0.40"
    severity: high
    message: "Expensive request"
    suggestion: "Use a cheaper model"
`)
      const rules = loadCustomRules(tmpFile)
      expect(rules).toHaveLength(1)
      expect(rules[0].name).toBe('test-rule')
      expect(rules[0].condition).toBe('costUSD > 0.40')
      expect(rules[0].severity).toBe('high')
      expect(rules[0].message).toBe('Expensive request')
      expect(rules[0].suggestion).toBe('Use a cheaper model')
    } finally {
      fs.unlinkSync(tmpFile)
    }
  })

  it('returns empty array for missing file', () => {
    const rules = loadCustomRules('/nonexistent/path/rules.yaml')
    expect(rules).toEqual([])
  })
})

describe('runCustomRules', () => {
  it('detects matching records', () => {
    insertRequest(makeRecord('r1', { costUSD: 0.50 }))
    insertRequest(makeRecord('r2', { costUSD: 0.10 }))

    const rules = [
      {
        name: 'expensive-alert',
        condition: 'costUSD > 0.40',
        severity: 'high' as const,
        message: 'Request exceeded $0.40',
        suggestion: 'Break into smaller tasks',
      },
    ]

    const detections = runCustomRules(rules, {})
    expect(detections).toHaveLength(1)
    expect(detections[0].rule).toBe('custom:expensive-alert')
    expect(detections[0].severity).toBe('high')
    expect(detections[0].wastedUSD).toBeCloseTo(0.50, 4)
    expect(detections[0].message).toContain('1 match')
  })

  it('returns empty array for non-matching rules', () => {
    insertRequest(makeRecord('r1', { costUSD: 0.01 }))

    const rules = [
      {
        name: 'very-expensive',
        condition: 'costUSD > 100',
        severity: 'high' as const,
        message: 'Very expensive',
        suggestion: 'Reduce usage',
      },
    ]

    const detections = runCustomRules(rules, {})
    expect(detections).toHaveLength(0)
  })

  it('returns empty array when no rules provided', () => {
    insertRequest(makeRecord('r1', { costUSD: 0.50 }))
    const detections = runCustomRules([], {})
    expect(detections).toHaveLength(0)
  })

  it('skips rules with invalid SQL conditions', () => {
    insertRequest(makeRecord('r1', { costUSD: 0.50 }))

    const rules = [
      {
        name: 'bad-rule',
        condition: 'INVALID SQL !!!',
        severity: 'low' as const,
        message: 'Bad rule',
        suggestion: 'Fix it',
      },
    ]

    // Should not throw
    expect(() => runCustomRules(rules, {})).not.toThrow()
    const detections = runCustomRules(rules, {})
    expect(detections).toHaveLength(0)
  })
})
