import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { startProxy, stopProxy } from '../../src/proxy/server.js'
import { getDb, closeDb, queryRequests } from '../../src/db/db.js'
import http from 'http'
import fs from 'fs'
import path from 'path'

const TEST_DB = path.join(import.meta.dirname, 'proxy-e2e.db')
const PROXY_PORT = 19811
let mockAnthropicServer: http.Server

beforeAll(async () => {
  mockAnthropicServer = http.createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        id: 'msg_test', model: 'claude-sonnet-4-6',
        usage: { input_tokens: 500, output_tokens: 100 },
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Hello' }],
      }))
    })
  })
  await new Promise<void>((resolve) => mockAnthropicServer.listen(19812, resolve))
})

afterAll(async () => {
  await new Promise<void>((resolve) => mockAnthropicServer.close(() => resolve()))
})

beforeEach(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB)
  getDb(TEST_DB)
})

afterEach(async () => {
  await stopProxy()
  closeDb()
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB)
})

describe('proxy server', () => {
  it('intercepts and records an Anthropic request', async () => {
    await startProxy({ port: PROXY_PORT, targets: { anthropic: 'http://localhost:19812' } })

    const response = await fetch(`http://localhost:${PROXY_PORT}/anthropic/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'claude-code/1.0.0' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
    })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.model).toBe('claude-sonnet-4-6')

    await new Promise((r) => setTimeout(r, 50))

    const records = queryRequests({ since: 0 })
    expect(records).toHaveLength(1)
    expect(records[0].source).toBe('claude-code')
    expect(records[0].inputTokens).toBe(500)
  })
})

describe('full pipeline', () => {
  it('proxy → collect → report → scan', async () => {
    await startProxy({ port: PROXY_PORT, targets: { anthropic: 'http://localhost:19812' } })

    // Send 5 identical requests (should trigger duplicate detection)
    for (let i = 0; i < 5; i++) {
      await fetch(`http://localhost:${PROXY_PORT}/anthropic/v1/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'claude-code/1.0.0' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
      })
    }

    await new Promise((r) => setTimeout(r, 100))

    const records = queryRequests({ since: 0 })
    expect(records.length).toBe(5)

    const { summarize } = await import('../../src/analyzer/analyzer.js')
    const summary = summarize({ since: 0 })
    expect(summary.totalRequests).toBe(5)

    const { runAllRules } = await import('../../src/analyzer/rules/index.js')
    const detections = runAllRules({ since: 0 })
    const dup = detections.find((d: any) => d.rule === 'duplicate-requests')
    expect(dup).toBeDefined()
  })
})
