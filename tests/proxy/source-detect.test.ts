import { describe, it, expect } from 'vitest'
import { detectSource } from '../../src/proxy/source-detect.js'

describe('detectSource', () => {
  it('detects Claude Code', () => {
    expect(detectSource('claude-code/1.0.0')).toBe('claude-code')
    expect(detectSource('Mozilla/5.0 claude-code/2.1.3')).toBe('claude-code')
  })
  it('detects aider', () => {
    expect(detectSource('aider/0.52.0')).toBe('aider')
  })
  it('detects Cursor', () => {
    expect(detectSource('Cursor/0.45.0')).toBe('cursor')
  })
  it('detects OpenClaw', () => {
    expect(detectSource('openclaw/1.0.0')).toBe('openclaw')
  })
  it('detects Continue', () => {
    expect(detectSource('Continue/1.0.0')).toBe('continue')
  })
  it('returns unknown for unrecognized', () => {
    expect(detectSource('Mozilla/5.0')).toBe('unknown')
    expect(detectSource(undefined)).toBe('unknown')
    expect(detectSource('')).toBe('unknown')
  })
})
