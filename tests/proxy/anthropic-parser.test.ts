import { describe, it, expect } from 'vitest'
import { parseAnthropicResponse, parseAnthropicSSE } from '../../src/proxy/parsers/anthropic.js'

describe('parseAnthropicResponse', () => {
  it('parses a non-streaming response', () => {
    const body = {
      id: 'msg_123',
      model: 'claude-opus-4-20250514',
      usage: { input_tokens: 5000, output_tokens: 1200, cache_read_input_tokens: 3000, cache_creation_input_tokens: 500 },
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'Hello' }, { type: 'tool_use', name: 'Read', id: 'tu_1' }],
    }
    const result = parseAnthropicResponse(body)
    expect(result).toEqual({
      model: 'claude-opus-4-20250514',
      inputTokens: 5000, outputTokens: 1200, cacheReadTokens: 3000, cacheWriteTokens: 500,
      stopReason: 'end_turn', toolUse: ['Read'],
    })
  })

  it('handles missing cache fields', () => {
    const body = {
      id: 'msg_456', model: 'claude-haiku-4-5-20251001',
      usage: { input_tokens: 100, output_tokens: 50 },
      stop_reason: 'end_turn', content: [{ type: 'text', text: 'Hi' }],
    }
    const result = parseAnthropicResponse(body)
    expect(result.cacheReadTokens).toBe(0)
    expect(result.cacheWriteTokens).toBe(0)
    expect(result.toolUse).toEqual([])
  })
})

describe('parseAnthropicSSE', () => {
  it('extracts usage from message_delta event', () => {
    const chunks = [
      'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_1","model":"claude-sonnet-4-6","usage":{"input_tokens":1000,"output_tokens":0}}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}\n\n',
      'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":350}}\n\n',
    ]
    const result = parseAnthropicSSE(chunks.join(''))
    expect(result).not.toBeNull()
    expect(result!.model).toBe('claude-sonnet-4-6')
    expect(result!.inputTokens).toBe(1000)
    expect(result!.outputTokens).toBe(350)
    expect(result!.stopReason).toBe('end_turn')
  })
})
