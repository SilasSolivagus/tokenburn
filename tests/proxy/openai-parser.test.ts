import { describe, it, expect } from 'vitest'
import { parseOpenAIResponse, parseOpenAISSE } from '../../src/proxy/parsers/openai.js'

describe('parseOpenAIResponse', () => {
  it('parses a non-streaming response', () => {
    const body = {
      id: 'chatcmpl-123', model: 'gpt-4o-2024-08-06',
      usage: { prompt_tokens: 2000, completion_tokens: 500, prompt_tokens_details: { cached_tokens: 1000 } },
      choices: [{ finish_reason: 'stop', message: { content: 'Hello', tool_calls: [{ function: { name: 'get_weather' } }] } }],
    }
    const result = parseOpenAIResponse(body)
    expect(result.model).toBe('gpt-4o-2024-08-06')
    expect(result.inputTokens).toBe(2000)
    expect(result.outputTokens).toBe(500)
    expect(result.cacheReadTokens).toBe(1000)
    expect(result.stopReason).toBe('stop')
    expect(result.toolUse).toEqual(['get_weather'])
  })
})

describe('parseOpenAISSE', () => {
  it('extracts usage from the final chunk', () => {
    const chunks = [
      'data: {"id":"chatcmpl-1","model":"gpt-4o","choices":[{"delta":{"content":"Hi"}}]}\n\n',
      'data: {"id":"chatcmpl-1","model":"gpt-4o","choices":[{"finish_reason":"stop"}],"usage":{"prompt_tokens":500,"completion_tokens":100}}\n\n',
      'data: [DONE]\n\n',
    ]
    const result = parseOpenAISSE(chunks.join(''))
    expect(result).not.toBeNull()
    expect(result!.model).toBe('gpt-4o')
    expect(result!.inputTokens).toBe(500)
    expect(result!.outputTokens).toBe(100)
    expect(result!.stopReason).toBe('stop')
  })
})
