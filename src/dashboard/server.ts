import http from 'http'
import { getDb } from '../db/db.js'
import { summarize, aggregateByModel, aggregateByDay } from '../analyzer/analyzer.js'
import { runAllRules } from '../analyzer/rules/index.js'
import { DASHBOARD_HTML } from './html.js'

function parsePeriod(period: string | null): number {
  if (!period) return Date.now() - 7 * 86400000
  const match = period.match(/^(\d+)([hdwm])$/)
  if (!match) return Date.now() - 7 * 86400000
  const value = parseInt(match[1], 10)
  const ms: Record<string, number> = { h: 3600000, d: 86400000, w: 604800000, m: 2592000000 }
  return Date.now() - value * ms[match[2]]
}

export async function startDashboard(port: number = 10812): Promise<void> {
  getDb()
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`)
    if (url.pathname === '/' || url.pathname === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(DASHBOARD_HTML); return
    }
    const period = url.searchParams.get('period')
    const since = parsePeriod(period)
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Access-Control-Allow-Origin', '*')
    switch (url.pathname) {
      case '/api/summary': res.end(JSON.stringify(summarize({ since }))); break
      case '/api/models': res.end(JSON.stringify(aggregateByModel({ since }))); break
      case '/api/daily': res.end(JSON.stringify(aggregateByDay({ since }))); break
      case '/api/waste': res.end(JSON.stringify(runAllRules({ since }))); break
      default: res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' }))
    }
  })
  await new Promise<void>((resolve) => server.listen(port, resolve))
  console.log(`🔥 tokenburn dashboard: http://localhost:${port}`)
  console.log('   Press Ctrl+C to stop\n')
}
