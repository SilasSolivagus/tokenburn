import { TOOL_DEFINITIONS, handleToolCall } from './tools.js'
import { getDb } from '../db/db.js'
import { importLogs } from '../logs/importer.js'

interface JsonRpcRequest { jsonrpc: '2.0'; id: number | string; method: string; params?: Record<string, unknown> }
interface JsonRpcResponse { jsonrpc: '2.0'; id: number | string; result?: unknown; error?: { code: number; message: string } }

function send(response: JsonRpcResponse): void {
  const json = JSON.stringify(response)
  process.stdout.write(`Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`)
}

export function startMcpServer(): void {
  getDb(); importLogs()
  let buffer = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (chunk: string) => {
    buffer += chunk
    while (true) {
      const headerEnd = buffer.indexOf('\r\n\r\n')
      if (headerEnd === -1) break
      const header = buffer.slice(0, headerEnd)
      const match = header.match(/Content-Length:\s*(\d+)/i)
      if (!match) { buffer = buffer.slice(headerEnd + 4); continue }
      const len = parseInt(match[1], 10)
      const bodyStart = headerEnd + 4
      if (buffer.length < bodyStart + len) break
      const body = buffer.slice(bodyStart, bodyStart + len)
      buffer = buffer.slice(bodyStart + len)
      let req: JsonRpcRequest
      try { req = JSON.parse(body) } catch { send({ jsonrpc: '2.0', id: 0, error: { code: -32700, message: 'Parse error' } }); continue }
      handleMessage(req)
    }
  })
  process.stdin.on('end', () => process.exit(0))
}

async function handleMessage(req: JsonRpcRequest): Promise<void> {
  switch (req.method) {
    case 'initialize':
      send({ jsonrpc: '2.0', id: req.id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'tokenburn', version: '0.2.0' } } })
      break
    case 'notifications/initialized': break
    case 'tools/list':
      send({ jsonrpc: '2.0', id: req.id, result: { tools: TOOL_DEFINITIONS } })
      break
    case 'tools/call': {
      const p = req.params as Record<string, unknown>
      const name = p?.name as string; const args = (p?.arguments ?? {}) as Record<string, unknown>
      try {
        const result = await handleToolCall(name, args)
        send({ jsonrpc: '2.0', id: req.id, result: { content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }] } })
      } catch (err) { send({ jsonrpc: '2.0', id: req.id, error: { code: -32603, message: (err as Error).message } }) }
      break
    }
    default:
      send({ jsonrpc: '2.0', id: req.id, error: { code: -32601, message: `Method not found: ${req.method}` } })
  }
}
