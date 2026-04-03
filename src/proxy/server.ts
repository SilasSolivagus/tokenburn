import http from 'http'
import { parseAnthropicResponse, parseAnthropicSSE } from './parsers/anthropic.js'
import { parseOpenAIResponse, parseOpenAISSE } from './parsers/openai.js'
import { collectRequest } from './collector.js'

const DEFAULT_TARGETS: Record<string, string> = {
  anthropic: 'https://api.anthropic.com',
  openai: 'https://api.openai.com',
}

interface ProxyConfig {
  port?: number
  targets?: { anthropic?: string; openai?: string }
}

let server: http.Server | null = null
let running = false

export async function startProxy(config?: ProxyConfig): Promise<void> {
  const port = config?.port ?? 10811
  const targets: Record<string, string> = {
    ...DEFAULT_TARGETS,
    ...config?.targets,
  }

  server = http.createServer((req, res) => {
    handleRequest(req, res, targets).catch(() => {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Bad Gateway' }))
      }
    })
  })
  server.keepAliveTimeout = 0

  await new Promise<void>((resolve) => {
    server!.listen(port, resolve)
  })
  running = true
}

export async function stopProxy(): Promise<void> {
  if (!server) return
  server.closeIdleConnections?.()
  await new Promise<void>((resolve) => {
    server!.close(() => resolve())
  })
  server = null
  running = false
}

export function isProxyRunning(): boolean {
  return running
}

type Provider = 'anthropic' | 'openai'

function extractProvider(url: string): { provider: Provider; upstreamPath: string } | null {
  const match = url.match(/^\/(anthropic|openai)(\/.*)$/)
  if (!match) return null
  return { provider: match[1] as Provider, upstreamPath: match[2] }
}

async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  targets: Record<string, string>,
): Promise<void> {
  const extracted = extractProvider(req.url ?? '/')
  if (!extracted) {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Unknown provider path' }))
    return
  }

  const { provider, upstreamPath } = extracted
  const targetBase = targets[provider]
  if (!targetBase) {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Unknown provider' }))
    return
  }

  // Read request body
  const requestBody = await new Promise<string>((resolve) => {
    let body = ''
    req.on('data', (chunk: Buffer) => (body += chunk.toString()))
    req.on('end', () => resolve(body))
  })

  const upstreamUrl = `${targetBase}${upstreamPath}`
  const startTime = Date.now()

  // Forward headers, excluding host and connection-specific ones
  const forwardHeaders: Record<string, string> = {}
  for (const [key, value] of Object.entries(req.headers)) {
    if (['host', 'connection', 'transfer-encoding'].includes(key.toLowerCase())) continue
    if (typeof value === 'string') {
      forwardHeaders[key] = value
    } else if (Array.isArray(value)) {
      forwardHeaders[key] = value.join(', ')
    }
  }

  let upstreamResponse: Response
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: req.method ?? 'POST',
      headers: forwardHeaders,
      body: requestBody || undefined,
    })
  } catch {
    res.writeHead(502, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Bad Gateway' }))
    return
  }

  const durationMs = Date.now() - startTime
  const userAgent = req.headers['user-agent']
  const contentType = upstreamResponse.headers.get('content-type') ?? ''
  const isSSE = contentType.includes('text/event-stream')

  // Forward response headers
  const responseHeaders: Record<string, string> = {}
  upstreamResponse.headers.forEach((value, key) => {
    // Skip hop-by-hop headers
    if (['transfer-encoding', 'connection'].includes(key.toLowerCase())) return
    responseHeaders[key] = value
  })
  responseHeaders['connection'] = 'close'

  res.writeHead(upstreamResponse.status, responseHeaders)

  if (isSSE && upstreamResponse.body) {
    // Stream SSE response
    const reader = upstreamResponse.body.getReader()
    const decoder = new TextDecoder()
    let sseBuffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        sseBuffer += chunk
        res.write(chunk)
      }
    } catch {
      // Stream error, close response
    } finally {
      res.end()
    }

    // Parse SSE in background
    try {
      const parseFn = provider === 'anthropic' ? parseAnthropicSSE : parseOpenAISSE
      const parsed = parseFn(sseBuffer)
      if (parsed) {
        collectRequest({ provider, requestBody, parsed, userAgent, durationMs })
      }
    } catch {
      // Silently continue
    }
  } else {
    // Non-streaming response
    const responseBody = await upstreamResponse.text()
    res.end(responseBody)

    // Parse and collect in background
    try {
      const body = JSON.parse(responseBody) as Record<string, unknown>
      const parseFn = provider === 'anthropic' ? parseAnthropicResponse : parseOpenAIResponse
      const parsed = parseFn(body)
      collectRequest({ provider, requestBody, parsed, userAgent, durationMs })
    } catch {
      // Silently continue
    }
  }
}
